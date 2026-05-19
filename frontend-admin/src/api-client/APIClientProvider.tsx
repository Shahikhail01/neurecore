"use client";

/**
 * APIClient Context and Provider
 */

import React, { createContext, useContext, useEffect, useState } from "react";
import { APIClient } from "./APIClient";
import { getStoredAccessToken } from "@/lib/auth-session";

interface APIClientContextType {
  api: APIClient;
}

export const APIClientContext = createContext<APIClientContextType | null>(
  null,
);

interface APIClientProviderProps {
  children?: React.ReactNode;
  baseURL?: string;
}

export const APIClientProvider: React.FC<APIClientProviderProps> = ({
  children,
  baseURL = process.env.NEXT_PUBLIC_API_URL,
}) => {
  const [api] = useState(() => {
    const token = getStoredAccessToken();
    return new APIClient({
      baseURL,
      token: token || undefined,
    });
  });

  useEffect(() => {
    const token = getStoredAccessToken();
    if (token) {
      api.setToken(token);
    }
  }, [api]);

  return (
    <APIClientContext.Provider value={{ api }}>
      {children}
    </APIClientContext.Provider>
  );
};

export const useAPIClient = (): APIClient => {
  const context = useContext(APIClientContext);
  if (!context) {
    throw new Error("useAPIClient must be used within APIClientProvider");
  }
  return context.api;
};

export default APIClientProvider;
