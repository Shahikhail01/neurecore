/**
 * Audit Logs Page
 * View system audit logs and security events
 */

"use client";

import React, { useState, useEffect } from "react";
import {
  Table,
  Card,
  Input,
  Select,
  DatePicker,
  Button,
  Space,
  Tag,
  Tooltip,
  Spin,
  Empty,
} from "antd";
import {
  FilterOutlined,
  DeleteOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

interface AuditLog {
  id: string;
  action: string;
  eventType:
    | "create"
    | "read"
    | "update"
    | "delete"
    | "login"
    | "logout"
    | "error";
  resource: string;
  resourceId?: string;
  userId: string;
  userEmail: string;
  ipAddress: string;
  success: boolean;
  timestamp: string;
  details?: string;
  changes?: {
    before: Record<string, any>;
    after: Record<string, any>;
  };
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [filterEventType, setFilterEventType] = useState<string>("");
  const [filterDateRange, setFilterDateRange] = useState<
    [dayjs.Dayjs | null, dayjs.Dayjs | null] | null
  >(null);

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      // TODO: Implement API call to fetch audit logs from backend
      // const response = await auditService.getLogs({ limit: 50 })
      // setLogs(response)

      // Mock data for now
      const mockLogs: AuditLog[] = [
        {
          id: "1",
          action: "User Login",
          eventType: "login",
          resource: "Authentication",
          userId: "user-1",
          userEmail: "john@example.com",
          ipAddress: "192.168.1.100",
          success: true,
          timestamp: new Date().toISOString(),
        },
        {
          id: "2",
          action: "Agent Created",
          eventType: "create",
          resource: "Agent",
          resourceId: "agent-123",
          userId: "user-1",
          userEmail: "john@example.com",
          ipAddress: "192.168.1.100",
          success: true,
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          details: "Created new agent: Marketing Bot",
          changes: {
            before: {},
            after: {
              name: "Marketing Bot",
              email: "marketing@example.com",
              role: "agent",
              status: "active",
            },
          },
        },
        {
          id: "3",
          action: "Agent Updated",
          eventType: "update",
          resource: "Agent",
          resourceId: "agent-123",
          userId: "user-1",
          userEmail: "john@example.com",
          ipAddress: "192.168.1.100",
          success: true,
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          details: "Updated agent configuration",
          changes: {
            before: { status: "active" },
            after: { status: "inactive" },
          },
        },
        {
          id: "4",
          action: "Task Created",
          eventType: "create",
          resource: "Task",
          resourceId: "task-456",
          userId: "user-1",
          userEmail: "john@example.com",
          ipAddress: "192.168.1.100",
          success: true,
          timestamp: new Date(Date.now() - 10800000).toISOString(),
          details: "Created task: Q1 Marketing Campaign",
        },
        {
          id: "5",
          action: "Password Changed",
          eventType: "update",
          resource: "User",
          userId: "user-1",
          userEmail: "john@example.com",
          ipAddress: "192.168.1.100",
          success: true,
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          details: "User changed password",
        },
        {
          id: "6",
          action: "Failed Login Attempt",
          eventType: "error",
          resource: "Authentication",
          userId: "unknown",
          userEmail: "attacker@example.com",
          ipAddress: "203.0.113.45",
          success: false,
          timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
          details: "Invalid password provided",
        },
      ];
      setLogs(mockLogs);
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const getEventTypeColor = (eventType: string) => {
    const colors: Record<string, string> = {
      create: "success",
      read: "default",
      update: "processing",
      delete: "error",
      login: "blue",
      logout: "default",
      error: "error",
    };
    return colors[eventType] || "default";
  };

  const getEventTypeLabel = (eventType: string) => {
    const labels: Record<string, string> = {
      create: "Create",
      read: "Read",
      update: "Update",
      delete: "Delete",
      login: "Login",
      logout: "Logout",
      error: "Error",
    };
    return labels[eventType] || eventType;
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.userEmail.toLowerCase().includes(searchText.toLowerCase()) ||
      log.action.toLowerCase().includes(searchText.toLowerCase()) ||
      log.resource.toLowerCase().includes(searchText.toLowerCase());

    const matchesType = !filterEventType || log.eventType === filterEventType;

    return matchesSearch && matchesType;
  });

  const columns = [
    {
      title: "Action",
      dataIndex: "action",
      key: "action",
      width: 150,
      render: (text: string, record: AuditLog) => (
        <div>
          <div className="font-medium">{text}</div>
          <Tag color={getEventTypeColor(record.eventType)} className="mt-1">
            {getEventTypeLabel(record.eventType)}
          </Tag>
        </div>
      ),
    },
    {
      title: "Resource",
      dataIndex: "resource",
      key: "resource",
      width: 120,
      render: (text: string, record: AuditLog) => (
        <div>
          <div className="font-medium">{text}</div>
          {record.resourceId && (
            <div className="text-xs text-gray-600">{record.resourceId}</div>
          )}
        </div>
      ),
    },
    {
      title: "User",
      dataIndex: "userEmail",
      key: "userEmail",
      width: 150,
    },
    {
      title: "IP Address",
      dataIndex: "ipAddress",
      key: "ipAddress",
      width: 130,
    },
    {
      title: "Status",
      dataIndex: "success",
      key: "success",
      width: 100,
      render: (success: boolean) => (
        <Tag color={success ? "green" : "red"}>
          {success ? "Success" : "Failed"}
        </Tag>
      ),
    },
    {
      title: "Time",
      dataIndex: "timestamp",
      key: "timestamp",
      width: 150,
      render: (timestamp: string) => (
        <Tooltip title={dayjs(timestamp).format("YYYY-MM-DD HH:mm:ss")}>
          <span>{dayjs(timestamp).fromNow()}</span>
        </Tooltip>
      ),
    },
    {
      title: "Details",
      dataIndex: "details",
      key: "details",
      width: 200,
      render: (text: string, record: AuditLog) => (
        <Tooltip title={text || "No details available"}>
          <span className="text-gray-600 line-clamp-2">{text || "-"}</span>
        </Tooltip>
      ),
    },
  ];

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Audit Logs</h1>

      <Card className="mb-6">
        <Space direction="vertical" className="w-full">
          <div className="flex gap-4 flex-wrap">
            <Input.Search
              placeholder="Search by user, action, or resource"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 300 }}
            />

            <Select
              placeholder="Filter by event type"
              value={filterEventType}
              onChange={setFilterEventType}
              allowClear
              style={{ width: 200 }}
              options={[
                { label: "Create", value: "create" },
                { label: "Read", value: "read" },
                { label: "Update", value: "update" },
                { label: "Delete", value: "delete" },
                { label: "Login", value: "login" },
                { label: "Logout", value: "logout" },
                { label: "Error", value: "error" },
              ]}
            />

            <DatePicker.RangePicker
              value={filterDateRange}
              onChange={(dates) => setFilterDateRange(dates as any)}
              style={{ width: 300 }}
            />

            <Button
              icon={<FilterOutlined />}
              onClick={() => {
                setSearchText("");
                setFilterEventType("");
                setFilterDateRange(null);
                fetchAuditLogs();
              }}
            >
              Reset Filters
            </Button>

            <Button danger icon={<DeleteOutlined />}>
              Clear Old Logs
            </Button>
          </div>
        </Space>
      </Card>

      <Card>
        {filteredLogs.length === 0 ? (
          <Spin spinning={loading}>
            <Empty description="No logs found" />
          </Spin>
        ) : (
          <Spin spinning={loading}>
            <Table
              columns={columns}
              dataSource={filteredLogs}
              rowKey="id"
              pagination={{ pageSize: 20 }}
              scroll={{ x: 1200 }}
            />
          </Spin>
        )}
      </Card>
    </div>
  );
}
