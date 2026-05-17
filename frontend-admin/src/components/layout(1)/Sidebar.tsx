/**
 * Sidebar Component
 * Navigation menu
 */

"use client";

import React from "react";
import { Layout, Menu } from "antd";
import {
  DesktopOutlined,
  UserOutlined,
  CheckCircleOutlined,
  TeamOutlined,
  FileTextOutlined,
  AuditOutlined,
  BarChartOutlined,
} from "@ant-design/icons";
import { useRouter, usePathname } from "next/navigation";

const { Sider } = Layout;

export function DashboardSidebar() {
  const router = useRouter();
  const pathname = usePathname();

  const menuItems = [
    {
      key: "/dashboard",
      icon: <DesktopOutlined />,
      label: "Dashboard",
    },
    {
      key: "/dashboard/agents",
      icon: <UserOutlined />,
      label: "Agents",
    },
    {
      key: "/dashboard/tasks",
      icon: <CheckCircleOutlined />,
      label: "Tasks",
    },
    {
      key: "/dashboard/approvals",
      icon: <TeamOutlined />,
      label: "Approvals",
    },
    {
      type: "divider",
    },
    {
      key: "/dashboard/analytics",
      icon: <BarChartOutlined />,
      label: "Analytics",
    },
    {
      key: "/dashboard/audit-logs",
      icon: <AuditOutlined />,
      label: "Audit Logs",
    },
    {
      key: "/dashboard/settings",
      icon: <FileTextOutlined />,
      label: "Settings",
    },
  ];

  return (
    <Sider
      theme="light"
      width={200}
      style={{
        boxShadow: "1px 0 3px rgba(0,0,0,0.12)",
      }}
    >
      <Menu
        mode="inline"
        selectedKeys={[pathname]}
        items={menuItems}
        onClick={(item) => {
          if (item.key !== "/") {
            router.push(item.key as string);
          }
        }}
      />
    </Sider>
  );
}
