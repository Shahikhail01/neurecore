import api from './api';
import type { AuthResult, LoginPayload, RegisterPayload, AuthUser } from '@/types/auth.types';
import { unwrapItem } from '@/services/unwrap';
import { tokenManager } from '@/core/infrastructure/auth/TokenManager';

export const authService = {
  async login(payload: LoginPayload): Promise<AuthResult> {
    const res = await api.post('/auth/login', payload);
    const result = unwrapItem(res) as AuthResult;
    if (result?.tokens) {
      tokenManager.setTokens(result.tokens.accessToken, result.tokens.refreshToken);
    }
    return result;
  },

  async register(payload: RegisterPayload): Promise<AuthResult> {
    const res = await api.post('/auth/register', payload);
    const result = unwrapItem(res) as AuthResult;
    if (result?.tokens) {
      tokenManager.setTokens(result.tokens.accessToken, result.tokens.refreshToken);
    }
    return result;
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
