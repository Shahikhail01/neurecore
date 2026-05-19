/**
 * Root App Component
 * Sets up all providers in correct order
 */

'use client';

import '@/lib/antd-react-compat';
import React from "react";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { APIClientProvider } from "../api-client";
import { CurrentUserProvider } from "../user";
import { SchemaInitializerProvider } from "../schema-initializer";

interface AppProviderProps {
  children?: React.ReactNode;
}

/**
 * Provider wrapper with correct hierarchy:
 * 1. APIClientProvider - HTTP client access
 * 2. CurrentUserProvider - User auth state
 * 3. SchemaInitializerProvider - NocoBase schema initialization
 * 4. AntD ConfigProvider - UI styling
 */
export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  return (
    <APIClientProvider baseURL={process.env.NEXT_PUBLIC_API_URL}>
      <CurrentUserProvider>
        <SchemaInitializerProvider>
          <ConfigProvider locale={zhCN}>{children}</ConfigProvider>
        </SchemaInitializerProvider>
      </CurrentUserProvider>
    </APIClientProvider>
  );
};

export default AppProvider;
