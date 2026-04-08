/**
 * SessionManagement Component
 * View and manage active sessions across devices
 */

"use client";

import React, { useState, useEffect } from "react";
import { Table, Button, Modal, Spin, message, Space, Tag, Tooltip } from "antd";
import { DeleteOutlined, ExclamationCircleOutlined } from "@ant-design/icons";
import { useAuth } from "@/hooks/useAuth";

interface Session {
  id: string;
  deviceName: string;
  userAgent: string;
  ipAddress: string;
  lastActivity: string;
  createdAt: string;
  isCurrent: boolean;
  browser?: string;
  os?: string;
}

export function SessionManagement() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      // TODO: Implement API call to fetch sessions from backend
      // const response = await sessionService.getActiveSessions(user?.id)
      // setSessions(response)

      // Mock data for now
      const mockSessions: Session[] = [
        {
          id: "1",
          deviceName: "Chrome on MacOS",
          userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
          ipAddress: "192.168.1.100",
          lastActivity: new Date().toISOString(),
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          isCurrent: true,
          browser: "Chrome 120",
          os: "macOS 13.2",
        },
        {
          id: "2",
          deviceName: "Safari on iPhone",
          userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2)",
          ipAddress: "203.0.113.45",
          lastActivity: new Date(Date.now() - 3600000).toISOString(),
          createdAt: new Date(Date.now() - 604800000).toISOString(),
          isCurrent: false,
          browser: "Safari 17",
          os: "iOS 17.2",
        },
        {
          id: "3",
          deviceName: "Firefox on Windows",
          userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          ipAddress: "203.0.113.89",
          lastActivity: new Date(Date.now() - 86400000 * 3).toISOString(),
          createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
          isCurrent: false,
          browser: "Firefox 121",
          os: "Windows 10",
        },
      ];
      setSessions(mockSessions);
    } catch (error) {
      message.error("Failed to load sessions");
    } finally {
      setLoading(false);
    }
  };

  const handleLogoutSession = (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (session?.isCurrent) {
      message.warning(
        "Cannot logout from current session. Use the main logout button.",
      );
      return;
    }

    Modal.confirm({
      title: "Logout Session",
      icon: <ExclamationCircleOutlined />,
      content: `Are you sure you want to logout this session? (${session?.deviceName})`,
      okText: "Logout",
      okType: "danger",
      onOk: async () => {
        try {
          // TODO: Implement API call to logout this specific session
          // await sessionService.logoutSession(sessionId)
          setSessions((prev) => prev.filter((s) => s.id !== sessionId));
          message.success("Session logged out");
        } catch (error) {
          message.error("Failed to logout session");
        }
      },
    });
  };

  const handleLogoutAll = () => {
    Modal.confirm({
      title: "Logout All Sessions",
      icon: <ExclamationCircleOutlined />,
      content:
        "This will logout all your sessions except the current one. You will need to login again on other devices.",
      okText: "Logout All",
      okType: "danger",
      onOk: async () => {
        try {
          // TODO: Implement API call to logout all other sessions
          // await sessionService.logoutAllOtherSessions()
          setSessions((prev) => prev.filter((s) => s.isCurrent));
          message.success("All other sessions logged out");
        } catch (error) {
          message.error("Failed to logout sessions");
        }
      },
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTimeSinceLastActivity = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const columns = [
    {
      title: "Device",
      dataIndex: "deviceName",
      key: "deviceName",
      render: (text: string, record: Session) => (
        <div>
          <div className="font-medium">{text}</div>
          <div className="text-xs text-gray-600">{record.browser}</div>
        </div>
      ),
    },
    {
      title: "OS",
      dataIndex: "os",
      key: "os",
      width: 150,
    },
    {
      title: "IP Address",
      dataIndex: "ipAddress",
      key: "ipAddress",
      width: 150,
    },
    {
      title: "Last Activity",
      dataIndex: "lastActivity",
      key: "lastActivity",
      width: 150,
      render: (text: string) => (
        <Tooltip title={formatDate(text)}>
          <span>{getTimeSinceLastActivity(text)}</span>
        </Tooltip>
      ),
    },
    {
      title: "Status",
      dataIndex: "isCurrent",
      key: "isCurrent",
      width: 100,
      render: (isCurrent: boolean) => (
        <Tag color={isCurrent ? "blue" : "default"}>
          {isCurrent ? "Current" : "Inactive"}
        </Tag>
      ),
    },
    {
      title: "Action",
      key: "action",
      width: 100,
      render: (_: any, record: Session) => (
        <Space>
          {!record.isCurrent && (
            <Button
              type="text"
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => handleLogoutSession(record.id)}
            >
              Logout
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Active Sessions</h2>
        <p className="text-gray-600 text-sm">
          Manage your active sessions across devices. Logout from sessions you
          don't recognize.
        </p>
      </div>

      <div className="mb-4 flex justify-between">
        <div className="text-sm text-gray-600">
          Total sessions: <span className="font-medium">{sessions.length}</span>
        </div>
        {sessions.length > 1 && (
          <Button danger onClick={handleLogoutAll}>
            Logout All Other Sessions
          </Button>
        )}
      </div>

      <Spin spinning={loading}>
        <Table
          columns={columns}
          dataSource={sessions}
          rowKey="id"
          pagination={false}
          bordered
        />
      </Spin>
    </div>
  );
}
