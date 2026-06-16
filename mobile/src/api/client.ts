import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

// Default timeout 60s covers normal CRUD. AI-driven endpoints override per-call
// (see `aiTimeout` below) because Claude generations can take 60-180s.
export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});

// Use as: `await api.post('/documents', body, aiTimeout(180000))`
export function aiTimeout(ms: number = 180000) {
  return { timeout: ms };
}

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

type TokenResponse = {
  access_token: string;
  refresh_token: string;
};

// Module-level in-flight refresh promise. Concurrent 401s share this single
// promise so we never spawn multiple /auth/refresh calls in parallel.
let refreshPromise: Promise<TokenResponse> | null = null;

async function performRefresh(refreshToken: string): Promise<TokenResponse> {
  const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
    refresh_token: refreshToken,
  });
  const tokens = data.data as TokenResponse;
  await SecureStore.setItemAsync('access_token', tokens.access_token);
  await SecureStore.setItemAsync('refresh_token', tokens.refresh_token);
  return tokens;
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalConfig = error.config;

    // Only attempt refresh-and-retry on 401s with a config we can replay.
    if (error.response?.status !== 401 || !originalConfig) {
      return Promise.reject(error);
    }

    // One-shot retry guard: if this request has already been retried once,
    // bail out to avoid infinite refresh loops (e.g. server rotated SECRET_KEY,
    // user deleted, clock skew — new access token still gets 401).
    if (originalConfig._retry) {
      return Promise.reject(error);
    }
    originalConfig._retry = true;

    const refreshToken = await SecureStore.getItemAsync('refresh_token');
    if (!refreshToken) {
      return Promise.reject(error);
    }

    try {
      // Coalesce concurrent 401s onto a single in-flight refresh call.
      if (!refreshPromise) {
        refreshPromise = performRefresh(refreshToken).finally(() => {
          refreshPromise = null;
        });
      }
      const tokens = await refreshPromise;

      // Overwrite the stale Authorization header on the original config before
      // replaying — the request interceptor would also do this, but being
      // explicit here guards against any edge case where it doesn't run.
      originalConfig.headers = originalConfig.headers ?? {};
      originalConfig.headers.Authorization = `Bearer ${tokens.access_token}`;

      return api.request(originalConfig);
    } catch {
      // Refresh failed (refresh token expired/revoked, network, server error).
      // Clear tokens and reject the ORIGINAL error so AuthContext sees the
      // failure and can route the user back to login.
      await SecureStore.deleteItemAsync('access_token');
      await SecureStore.deleteItemAsync('refresh_token');
      return Promise.reject(error);
    }
  }
);

export function unwrap<T>(response: { data: { data: T; error: string | null } }): T {
  if (response.data.error) throw new Error(response.data.error);
  return response.data.data as T;
}
