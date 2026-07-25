// services/uploads.service.ts — Tenant logo + AI Employee avatar uploads.
// Uses raw axios because we need to send multipart/form-data with a real
// progress event chain — the standard api wrapper (services/api.ts) does
// JSON-only.

import axios from 'axios';
import { tokenManager } from '@/core/infrastructure/auth/TokenManager';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
const CSRF_COOKIE = '__Host-nc_csrf';

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const cookies = document.cookie ? document.cookie.split('; ') : [];
  for (const raw of cookies) {
    const eq = raw.indexOf('=');
    if (eq < 0) continue;
    const key = raw.slice(0, eq);
    if (key === name) {
      const v = raw.slice(eq + 1);
      try {
        return decodeURIComponent(v);
      } catch {
        return v;
      }
    }
  }
  return null;
}

export interface UploadLogoResult {
  url: string;
  key: string;
  size: number;
}

export const LOGO_UPLOAD = {
  maxBytes: 5 * 1024 * 1024,
  allowedTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'] as const,
} as const;

// Tighter limits than logos — avatars are rendered at small sizes and a 5 MB
// avatar would slow every page that lists agents.
export const AGENT_AVATAR_UPLOAD = {
  maxBytes: 2 * 1024 * 1024,
  allowedTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'] as const,
} as const;

function authHeader(): Record<string, string> {
  const token = tokenManager.getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const uploadsService = {
  async uploadLogo(file: File): Promise<UploadLogoResult> {
    if (file.size > LOGO_UPLOAD.maxBytes) {
      throw new Error(
        `Logo exceeds ${LOGO_UPLOAD.maxBytes / (1024 * 1024)} MB limit`,
      );
    }
    if (!(LOGO_UPLOAD.allowedTypes as readonly string[]).includes(file.type)) {
      throw new Error(`Unsupported image type: ${file.type || 'unknown'}`);
    }

    const form = new FormData();
    form.append('file', file);

    const csrf = readCookie(CSRF_COOKIE);
    const res = await axios.post<{ data: UploadLogoResult }>(
      `${API_URL}/uploads/logo`,
      form,
      {
        headers: {
          ...authHeader(),
          'Content-Type': 'multipart/form-data',
          ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        },
      },
    );
    return res.data.data;
  },

  async deleteLogo(key: string): Promise<void> {
    const csrf = readCookie(CSRF_COOKIE);
    await axios.delete(`${API_URL}/uploads/logo/${encodeURIComponent(key)}`, {
      headers: { ...authHeader(), ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
    });
  },

  async uploadAgentAvatar(file: File): Promise<UploadLogoResult> {
    if (file.size > AGENT_AVATAR_UPLOAD.maxBytes) {
      throw new Error(
        `Avatar exceeds ${AGENT_AVATAR_UPLOAD.maxBytes / (1024 * 1024)} MB limit`,
      );
    }
    if (!(AGENT_AVATAR_UPLOAD.allowedTypes as readonly string[]).includes(file.type)) {
      throw new Error(`Unsupported image type: ${file.type || 'unknown'}`);
    }

    const form = new FormData();
    form.append('file', file);

    const csrf = readCookie(CSRF_COOKIE);
    const res = await axios.post<{ data: UploadLogoResult }>(
      `${API_URL}/uploads/agent-avatar`,
      form,
      {
        headers: {
          ...authHeader(),
          'Content-Type': 'multipart/form-data',
          ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        },
      },
    );
    return res.data.data;
  },

  async deleteAgentAvatar(key: string): Promise<void> {
    const csrf = readCookie(CSRF_COOKIE);
    await axios.delete(
      `${API_URL}/uploads/agent-avatar/${encodeURIComponent(key)}`,
      { headers: { ...authHeader(), ...(csrf ? { 'X-CSRF-Token': csrf } : {}) } },
    );
  },
};