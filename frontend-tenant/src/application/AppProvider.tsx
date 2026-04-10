/**
 * Root App Component
 * Sets up all providers in correct order
 */

import React from "react";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { APIClientProvider } from "../api-client";
import { SchemaInitializerProvider } from "../schema-initializer";

interface AppProviderProps {
  children?: React.ReactNode;
}

/**
 * Provider wrapper with correct hierarchy:
 * 1. APIClientProvider - HTTP client access
 * 2. SchemaInitializerProvider - NocoBase schema initialization
 * 3. AntD ConfigProvider - UI styling
 *
 * Note: CurrentUserProvider omitted — tenant uses Zustand (useAuthStore) for auth,
 * not the NocoBase user provider pattern.
 */
export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  return (
    <APIClientProvider baseURL={process.env.NEXT_PUBLIC_API_URL}>
      <SchemaInitializerProvider>
        <ConfigProvider locale={zhCN}>{children}</ConfigProvider>
      </SchemaInitializerProvider>
    </APIClientProvider>
  );
};

export default AppProvider;
