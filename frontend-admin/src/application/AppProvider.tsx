/**
 * Root App Component
 * Sets up all providers in correct order
 */

import React from "react";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { APIClientProvider } from "../api-client";
import { CurrentUserProvider } from "../user";

interface AppProviderProps {
  children?: React.ReactNode;
}

/**
 * Provider wrapper with correct hierarchy:
 * 1. APIClientProvider - HTTP client access
 * 2. CurrentUserProvider - User auth state
 * 3. AntD ConfigProvider - UI styling
 */
export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  return (
    <APIClientProvider baseURL={process.env.NEXT_PUBLIC_API_URL}>
      <CurrentUserProvider>
        <ConfigProvider locale={zhCN}>{children}</ConfigProvider>
      </CurrentUserProvider>
    </APIClientProvider>
  );
};

export default AppProvider;
