import api from './api';
import type { AuthResult, LoginPayload, RegisterPayload, AuthUser } from '@/types/auth.types';
import { unwrapItem } from '@/services/unwrap';
import { tokenManager } from '@/core/infrastructure/auth/TokenManager';
import type { AxiosError } from 'axios';

function extractServerMessage(err: unknown): string {
  const axErr = err as AxiosError<{ error?: { message?: string }; message?: string | string[] }>;
  const data = axErr?.response?.data;
  if (data?.error?.message) return data.error.message;
  if (Array.isArray(data?.message)) return data.message[0];
  if (typeof data?.message === 'string') return data.message;
  return (err instanceof Error ? err.message : null) ?? 'Request failed';
}

export const authService = {
  async login(payload: LoginPayload): Promise<AuthResult> {
    try {
      const res = await api.post('/auth/login', payload);
      const result = unwrapItem(res) as AuthResult;
      if (result?.tokens) {
        tokenManager.setTokens(result.tokens.accessToken, result.tokens.refreshToken);
      }
      return result;
    } catch (err) {
      throw new Error(extractServerMessage(err));
    }
  },

  async register(payload: RegisterPayload): Promise<AuthResult> {
    try {
      const res = await api.post('/auth/register', payload);
      const result = unwrapItem(res) as AuthResult;
      if (result?.tokens) {
        tokenManager.setTokens(result.tokens.accessToken, result.tokens.refreshToken);
      }
      return result;
    } catch (err) {
      throw new Error(extractServerMessage(err));
    }
  },

  async refresh(): Promise<void> {
    const refreshToken = tokenManager.getRefreshToken();
    if (!refreshToken) return;
    try {
      const res = await api.post('/auth/refresh', { refreshToken });
      const result = unwrapItem(res) as { accessToken: string; refreshToken: string };
      if (result?.accessToken) {
        tokenManager.setTokens(result.accessToken, result.refreshToken);
      }
    } catch {
      // Refresh failure is non-fatal here — tokens will be refreshed on next 401
    }
  },

  async me(): Promise<AuthUser> {
    const res = await api.get('/auth/me');
    return unwrapItem(res) as AuthUser;
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout').catch(() => {});
    tokenManager.clearTokens();
  },
};
