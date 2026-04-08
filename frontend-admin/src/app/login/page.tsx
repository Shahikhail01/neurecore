"use client";

import React, { useEffect } from "react";
import { Card, Space, Typography, Row, Col } from "antd";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { LoginForm } from "@/components/Auth/LoginForm";

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, router]);

  const handleLoginSuccess = () => {
    router.push("/dashboard");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        background: "#f0f2f5",
      }}
    >
      <Row justify="center" style={{ width: "100%" }}>
        <Col xs={24} sm={20} md={16} lg={12} xl={8}>
          <Space direction="vertical" style={{ width: "100%" }} size="large">
            <div style={{ textAlign: "center" }}>
              <Typography.Title level={1} style={{ margin: 0 }}>
                NeureCore
              </Typography.Title>
              <Typography.Title
                level={4}
                type="secondary"
                style={{ margin: 0 }}
              >
                Admin Dashboard
              </Typography.Title>
            </div>

            <Card
              style={{
                boxShadow:
                  "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)",
                borderRadius: 8,
              }}
            >
              <LoginForm onSuccess={handleLoginSuccess} />
            </Card>

            <Typography.Paragraph
              style={{
                textAlign: "center",
                color: "#8c8c8c",
                fontSize: 12,
                margin: 0,
              }}
            >
              Use your credentials to access the admin dashboard
            </Typography.Paragraph>
          </Space>
        </Col>
      </Row>
    </div>
  );
}
