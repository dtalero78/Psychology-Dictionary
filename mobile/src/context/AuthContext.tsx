import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { api, unwrap } from '../api/client';
import type { User, TokenResponse } from '../types';

const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null;
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.setItem(key, value);
      return;
    }
    return SecureStore.setItemAsync(key, value);
  },
  async deleteItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.removeItem(key);
      return;
    }
    return SecureStore.deleteItemAsync(key);
  },
};

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  // True when the user has explicitly opted into Anthropic Claude processing.
  // AI-calling endpoints will 403 until this becomes true.
  hasAiConsent: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithApple: (identityToken: string, authorizationCode: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setAiConsent: (consent: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function storeTokens(tokens: TokenResponse) {
    await storage.setItem('access_token', tokens.access_token);
    await storage.setItem('refresh_token', tokens.refresh_token);
  }

  async function fetchMe() {
    const res = await api.get('/auth/me');
    setUser(unwrap<User>(res));
  }

  useEffect(() => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setIsLoading(false);
    };
    // Hard cap: never leave the splash spinner stuck on a slow network or
    // a SecureStore quirk. After 8s we let the user reach the login screen.
    const safety = setTimeout(finish, 8000);
    (async () => {
      try {
        const token = await storage.getItem('access_token');
        console.log('[Auth] bootstrap token?', !!token);
        if (token) {
          try {
            await fetchMe();
            console.log('[Auth] /me OK');
          } catch (e) {
            console.log('[Auth] /me failed, clearing tokens', e);
            try { await storage.deleteItem('access_token'); } catch {}
            try { await storage.deleteItem('refresh_token'); } catch {}
          }
        }
      } catch (e) {
        console.log('[Auth] bootstrap error', e);
      } finally {
        clearTimeout(safety);
        finish();
      }
    })();
    return () => clearTimeout(safety);
  }, []);

  async function login(email: string, password: string) {
    const res = await api.post('/auth/login', { email, password });
    await storeTokens(unwrap<TokenResponse>(res));
    await fetchMe();
  }

  async function loginWithApple(identityToken: string, authorizationCode: string) {
    const res = await api.post('/auth/apple', { identity_token: identityToken, authorization_code: authorizationCode });
    await storeTokens(unwrap<TokenResponse>(res));
    await fetchMe();
  }

  async function register(email: string, password: string) {
    const res = await api.post('/auth/register', { email, password });
    await storeTokens(unwrap<TokenResponse>(res));
    await fetchMe();
  }

  async function logout() {
    await storage.deleteItem('access_token');
    await storage.deleteItem('refresh_token');
    setUser(null);
  }

  async function refreshUser() {
    await fetchMe();
  }

  async function setAiConsent(consent: boolean) {
    const res = await api.put('/auth/ai-consent', { consent });
    setUser(unwrap<User>(res));
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        hasAiConsent: !!user?.ai_consent_at,
        login,
        loginWithApple,
        register,
        logout,
        refreshUser,
        setAiConsent,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
