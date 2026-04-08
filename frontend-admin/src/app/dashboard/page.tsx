"use client";

import React from "react";
import {
  Row,
  Col,
  Card,
  Statistic,
  Space,
  Typography,
  Button,
  Table,
  Empty,
} from "antd";
import {
  UserOutlined,
  DatabaseOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/hooks/useAuth";

export default function DashboardHome() {
  const { user } = useAuth();

  const stats = [
    {
      title: "Total Agents",
      value: 24,
      prefix: <UserOutlined />,
      color: "#1890ff",
    },
    {
      title: "Active Tasks",
      value: 156,
      prefix: <DatabaseOutlined />,
      color: "#52c41a",
    },
    {
      title: "Completed",
      value: "92%",
      prefix: <CheckCircleOutlined />,
      color: "#faad14",
    },
    {
      title: "Avg Duration",
      value: "2.4h",
      prefix: <ClockCircleOutlined />,
      color: "#f5222d",
    },
  ];

  const recentActivity = [
    { id: 1, action: "Login", user: "John Doe", time: "5 minutes ago" },
    {
      id: 2,
      action: "Task Approved",
      user: "Jane Smith",
      time: "15 minutes ago",
    },
    { id: 3, action: "Agent Created", user: "Admin", time: "1 hour ago" },
  ];

  return (
    <Space direction="vertical" style={{ width: "100%" }} size="large">
      {/* Welcome Section */}
      <div>
        <Typography.Title level={2}>
          Welcome back, {user?.email}!
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          Here's what's happening with your dashboard today.
        </Typography.Paragraph>
      </div>

      {/* Stats Grid */}
      <Row gutter={[16, 16]}>
        {stats.map((stat, idx) => (
          <Col key={idx} xs={24} sm={12} md={6}>
            <Card
              style={{
                boxShadow:
                  "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)",
              }}
            >
              <Statistic
                title={stat.title}
                value={stat.value}
                prefix={stat.prefix}
                valueStyle={{ color: stat.color }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Recent Activity */}
      <Card
        title="Recent Activity"
        extra={<Button type="link">View All</Button>}
        style={{
          boxShadow: "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)",
        }}
      >
        <Table
          dataSource={recentActivity}
          columns={[
            { title: "Action", dataIndex: "action", key: "action" },
            { title: "User", dataIndex: "user", key: "user" },
            { title: "Time", dataIndex: "time", key: "time" },
          ]}
          pagination={false}
          locale={{ emptyText: <Empty description="No activity" /> }}
        />
      </Card>

      {/* Quick Actions */}
      <Card
        title="Quick Actions"
        style={{
          boxShadow: "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)",
        }}
      >
        <Space>
          <Button type="primary">Create Agent</Button>
          <Button>Create Task</Button>
          <Button>View Reports</Button>
        </Space>
      </Card>
    </Space>
  );
}
