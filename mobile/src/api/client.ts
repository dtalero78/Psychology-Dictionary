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

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      const refreshToken = await SecureStore.getItemAsync('refresh_token');
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refresh_token: refreshToken });
          const tokens = data.data;
          await SecureStore.setItemAsync('access_token', tokens.access_token);
          await SecureStore.setItemAsync('refresh_token', tokens.refresh_token);
          error.config.headers.Authorization = `Bearer ${tokens.access_token}`;
          return api.request(error.config);
        } catch {
          await SecureStore.deleteItemAsync('access_token');
          await SecureStore.deleteItemAsync('refresh_token');
        }
      }
    }
    return Promise.reject(error);
  }
);

export function unwrap<T>(response: { data: { data: T; error: string | null } }): T {
  if (response.data.error) throw new Error(response.data.error);
  return response.data.data as T;
}
