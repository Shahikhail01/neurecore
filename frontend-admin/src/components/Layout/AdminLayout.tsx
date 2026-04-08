/**
 * AdminLayout
 * Main layout wrapper with header and sidebar
 */

"use client";

import React from "react";
import { Layout } from "antd";
import { DashboardHeader } from "./Header";
import { DashboardSidebar } from "./Sidebar";
import { ProtectedRoute } from "@/components/Auth/ProtectedRoute";

const { Content } = Layout;

export interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <ProtectedRoute>
      <Layout style={{ minHeight: "100vh" }}>
        <DashboardHeader />
        <Layout>
          <DashboardSidebar />
          <Content style={{ padding: "24px", background: "#f0f2f5" }}>
            {children}
          </Content>
        </Layout>
      </Layout>
    </ProtectedRoute>
  );
}
