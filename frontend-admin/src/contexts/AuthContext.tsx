/**
 * AuthContext
 * Global authentication state provider
 */

"use client";

import React, { createContext, useState, useEffect } from "react";
import {
  AUTH_STORAGE_KEYS,
  getStoredAccessToken,
  getStoredRefreshToken,
} from "@/lib/auth-session";

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  tenantId: string;
}

export interface AuthContextType {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  setUser: (user: AuthUser | null) => void;
  setAccessToken: (token: string | null) => void;
  setRefreshToken: (token: string | null) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const storedAccessToken = getStoredAccessToken();
    const storedRefreshToken = getStoredRefreshToken();
    const storedUser = localStorage.getItem(AUTH_STORAGE_KEYS.user);

    if (storedAccessToken) {
      setAccessToken(storedAccessToken);
    }
    if (storedRefreshToken) {
      setRefreshToken(storedRefreshToken);
    }
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (err) {
        console.error("Failed to parse stored user:", err);
      }
    }

    setIsHydrated(true);
  }, []);

  if (!isHydrated) {
    return <>{children}</>;
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        refreshToken,
        setUser,
        setAccessToken,
        setRefreshToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
