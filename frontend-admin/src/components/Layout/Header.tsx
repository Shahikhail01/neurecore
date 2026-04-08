/**
 * Header Component
 * Top navigation with user menu and logout
 */

"use client";

import React from "react";
import { Layout, Menu, Dropdown, Avatar, Space, Button } from "antd";
import {
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";

const { Header } = Layout;

export function DashboardHeader() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const userMenu = (
    <Menu>
      <Menu.Item key="profile" icon={<UserOutlined />}>
        Profile
      </Menu.Item>
      <Menu.Item key="settings" icon={<SettingOutlined />}>
        Settings
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item key="logout" icon={<LogoutOutlined />} onClick={handleLogout}>
        Logout
      </Menu.Item>
    </Menu>
  );

  return (
    <Header
      style={{
        background: "#fff",
        padding: "0 24px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <div style={{ fontSize: "18px", fontWeight: "bold" }}>
        NeureCore Admin
      </div>

      <Space>
        <Dropdown menu={{ items: userMenu }} trigger={["click"]}>
          <Space style={{ cursor: "pointer" }}>
            <Avatar size="large" icon={<UserOutlined />} />
            <div>
              <div style={{ fontSize: "14px", fontWeight: 500 }}>
                {user?.email}
              </div>
              <div style={{ fontSize: "12px", color: "#8c8c8c" }}>
                {user?.role}
              </div>
            </div>
          </Space>
        </Dropdown>
      </Space>
    </Header>
  );
}
