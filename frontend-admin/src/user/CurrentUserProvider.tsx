/**
 * Current User Provider
 * Manages current logged-in user state
 * Based on NocoBase's CurrentUserProvider pattern
 */

"use client";

import React, { createContext, useContext, useEffect } from "react";
import { AUTH_SESSION_CLEARED_EVENT } from "@/lib/auth-session";
import { useRequest, ReturnTypeOfUseRequest } from "../api-client";

interface User {
  id: string;
  email: string;
  nickname?: string;
  roles?: Array<{ name: string; id: string }>;
}

export interface CurrentUserContextData extends ReturnTypeOfUseRequest {
  data?: User | { data: User } | null;
}

function extractCurrentUser(data: CurrentUserContextData["data"]): User | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }

  const candidate =
    "data" in data && data.data && typeof data.data === "object"
      ? data.data
      : data;

  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }

  return typeof candidate.id === "string" ? (candidate as User) : null;
}

export const CurrentUserContext = createContext<CurrentUserContextData | null>(
  null,
);

interface CurrentUserProviderProps {
  children?: React.ReactNode;
}

export const CurrentUserProvider: React.FC<CurrentUserProviderProps> = ({
  children,
}) => {
  const result = useRequest(
    {
      url: "/auth/me",
      skipNotify: true,
      skipAuth: true,
    },
    {
      manual: false,
      cacheKey: "currentUser",
    },
  );

  useEffect(() => {
    const handleSessionCleared = () => {
      result.mutate?.(null);
    };

    window.addEventListener(AUTH_SESSION_CLEARED_EVENT, handleSessionCleared);

    return () => {
      window.removeEventListener(
        AUTH_SESSION_CLEARED_EVENT,
        handleSessionCleared,
      );
    };
  }, [result.mutate]);

  return (
    <CurrentUserContext.Provider value={result}>
      {children}
    </CurrentUserContext.Provider>
  );
};

/**
 * Hook to access current user context
 */
export const useCurrentUserContext = (): CurrentUserContextData => {
  const context = useContext(CurrentUserContext);
  if (!context) {
    throw new Error(
      "useCurrentUserContext must be used within CurrentUserProvider",
    );
  }
  return context;
};

/**
 * Helper hook to check if user is logged in
 */
export const useIsLoggedIn = (): boolean => {
  const ctx = useCurrentUserContext();
  return !!extractCurrentUser(ctx?.data)?.id;
};

/**
 * Helper hook to get current user's roles
 */
export const useCurrentRoles = (): string[] => {
  const ctx = useCurrentUserContext();
  return (extractCurrentUser(ctx?.data)?.roles || []).map((r: any) => r.name || r);
};

/**
 * Helper hook to get current user data
 */
export const useCurrentUser = (): User | null => {
  const ctx = useCurrentUserContext();
  return extractCurrentUser(ctx?.data);
};

export default CurrentUserProvider;
