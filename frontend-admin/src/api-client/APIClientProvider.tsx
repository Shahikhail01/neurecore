"use client";

/**
 * APIClient Context and Provider
 */

import React, { createContext, useContext, useEffect, useState } from "react";
import { APIClient } from "./APIClient";

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
    const token =
      typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    return new APIClient({
      baseURL,
      token: token || undefined,
    });
  });

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
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
