import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { api, unwrap } from '../api/client';
import type { User, TokenResponse } from '../types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithApple: (identityToken: string, authorizationCode: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function storeTokens(tokens: TokenResponse) {
    await SecureStore.setItemAsync('access_token', tokens.access_token);
    await SecureStore.setItemAsync('refresh_token', tokens.refresh_token);
  }

  async function fetchMe() {
    const res = await api.get('/auth/me');
    setUser(unwrap<User>(res));
  }

  useEffect(() => {
    (async () => {
      const token = await SecureStore.getItemAsync('access_token');
      if (token) {
        try {
          await fetchMe();
        } catch {
          await SecureStore.deleteItemAsync('access_token');
          await SecureStore.deleteItemAsync('refresh_token');
        }
      }
      setIsLoading(false);
    })();
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
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('refresh_token');
    setUser(null);
  }

  async function refreshUser() {
    await fetchMe();
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, login, loginWithApple, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
