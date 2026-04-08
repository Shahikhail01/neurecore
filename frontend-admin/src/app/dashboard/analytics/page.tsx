"use client";

import React from "react";
import {
  Space,
  Typography,
  Card,
  Row,
  Col,
  Statistic,
  LineChart,
  BarChart,
  Button,
} from "antd";
import { DownloadOutlined } from "@ant-design/icons";

export default function AnalyticsPage() {
  const metrics = [
    { title: "Task Completion Rate", value: "92%", change: "+5%" },
    { title: "Avg Approval Time", value: "2.4h", change: "-15%" },
    { title: "Agent Utilization", value: "87%", change: "+8%" },
    { title: "Outstanding Tasks", value: "23", change: "-4" },
  ];

  return (
    <Space direction="vertical" style={{ width: "100%" }} size="large">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Typography.Title level={2} style={{ margin: 0 }}>
          Analytics
        </Typography.Title>
        <Button icon={<DownloadOutlined />}>Export Report</Button>
      </div>

      <Row gutter={[16, 16]}>
        {metrics.map((metric, idx) => (
          <Col key={idx} xs={24} sm={12} md={6}>
            <Card
              style={{
                boxShadow:
                  "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)",
              }}
            >
              <Statistic
                title={metric.title}
                value={metric.value}
                suffix={
                  <span
                    style={{
                      fontSize: "14px",
                      color: metric.change.startsWith("-")
                        ? "#f5222d"
                        : "#52c41a",
                    }}
                  >
                    {metric.change}
                  </span>
                }
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Card
        title="Task Completion Trends"
        style={{
          boxShadow: "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)",
        }}
      >
        <Typography.Paragraph type="secondary">
          Chart visualization coming soon
        </Typography.Paragraph>
      </Card>

      <Card
        title="Agent Performance"
        style={{
          boxShadow: "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)",
        }}
      >
        <Typography.Paragraph type="secondary">
          Chart visualization coming soon
        </Typography.Paragraph>
      </Card>
    </Space>
  );
}
