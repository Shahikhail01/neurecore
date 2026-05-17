/**
 * Current User Provider
 * Manages current logged-in user state
 * Based on NocoBase's CurrentUserProvider pattern
 */

"use client";

import React, { createContext, useContext } from "react";
import { useRequest, ReturnTypeOfUseRequest } from "../api-client";

interface User {
  id: string;
  email: string;
  nickname?: string;
  roles?: Array<{ name: string; id: string }>;
}

export interface CurrentUserContextData extends ReturnTypeOfUseRequest {
  data?: {
    data: User;
  };
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
  return !!ctx?.data?.data?.id;
};

/**
 * Helper hook to get current user's roles
 */
export const useCurrentRoles = (): string[] => {
  const ctx = useCurrentUserContext();
  return (ctx?.data?.data?.roles || []).map((r: any) => r.name || r);
};

/**
 * Helper hook to get current user data
 */
export const useCurrentUser = (): User | null => {
  const ctx = useCurrentUserContext();
  return ctx?.data?.data || null;
};

export default CurrentUserProvider;
