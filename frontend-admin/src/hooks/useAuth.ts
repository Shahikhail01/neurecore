/**
 * useAuth Hook
 * Provides authentication functionality using the APIClient infrastructure
 */

"use client";

import { useCallback, useState } from "react";
import { useCurrentUser, useIsLoggedIn } from "@/user";
import { useAPIClient } from "@/api-client";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface ResetPasswordRequest {
  email: string;
}

export interface PasswordResetRequest {
  token: string;
  newPassword: string;
}

interface AuthResponse {
  user: any;
  accessToken: string;
  refreshToken?: string;
}

export function useAuth() {
  const user = useCurrentUser();
  const isLoggedIn = useIsLoggedIn();
  const api = useAPIClient();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(
    async (credentials: LoginRequest) => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await api.post("/auth/login", credentials);
        const data = response.data?.data || response.data;
        if (data.accessToken) {
          localStorage.setItem("accessToken", data.accessToken);
        }
        if (data.refreshToken) {
          localStorage.setItem("refreshToken", data.refreshToken);
        }
        return data as AuthResponse;
      } catch (err: any) {
        const message =
          err.response?.data?.message || err.message || "Login failed";
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [api],
  );

  const register = useCallback(
    async (credentials: RegisterRequest) => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await api.post("/auth/register", credentials);
        const data = response.data?.data || response.data;
        if (data.accessToken) {
          localStorage.setItem("accessToken", data.accessToken);
        }
        if (data.refreshToken) {
          localStorage.setItem("refreshToken", data.refreshToken);
        }
        return data as AuthResponse;
      } catch (err: any) {
        const message =
          err.response?.data?.message || err.message || "Registration failed";
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [api],
  );

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await api.post("/auth/logout", {});
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
    } catch (err: any) {
      console.error("Logout error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [api]);

  const requestPasswordReset = useCallback(
    async (email: string) => {
      setIsLoading(true);
      setError(null);
      try {
        await api.post("/auth/forgot-password", { email });
      } catch (err: any) {
        const message =
          err.response?.data?.message ||
          err.message ||
          "Failed to request password reset";
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [api],
  );

  const resetPassword = useCallback(
    async (token: string, newPassword: string) => {
      setIsLoading(true);
      setError(null);
      try {
        await api.post("/auth/reset-password", { token, newPassword });
      } catch (err: any) {
        const message =
          err.response?.data?.message ||
          err.message ||
          "Failed to reset password";
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [api],
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      setIsLoading(true);
      setError(null);
      try {
        await api.post("/auth/change-password", {
          currentPassword,
          newPassword,
        });
      } catch (err: any) {
        const message =
          err.response?.data?.message ||
          err.message ||
          "Failed to change password";
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [api],
  );

  const accessToken =
    typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;

  return {
    user,
    isAuthenticated: isLoggedIn,
    isLoading,
    error,
    login,
    register,
    logout,
    requestPasswordReset,
    resetPassword,
    changePassword,
    accessToken,
  };
}
