"use client";

import React, { useState } from "react";
import {
  Card,
  Space,
  Typography,
  Row,
  Col,
  Form,
  Input,
  Button,
  Alert,
  Result,
} from "antd";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [form] = Form.useForm();
  const { requestPasswordReset, isLoading, error } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [email, setEmail] = useState("");

  const handleSubmit = async (values: { email: string }) => {
    try {
      await requestPasswordReset(values.email);
      setEmail(values.email);
      setSubmitted(true);
    } catch (err) {
      console.error("Password reset request failed:", err);
    }
  };

  if (submitted) {
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
            <Card
              style={{
                boxShadow:
                  "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)",
                borderRadius: 8,
              }}
            >
              <Result
                status="success"
                title="Check Your Email"
                subTitle={`We've sent a password reset link to ${email}. Click the link to reset your password.`}
                extra={[
                  <Link key="login" href="/login">
                    <Button type="primary">Back to Login</Button>
                  </Link>,
                ]}
              />
              <Typography.Paragraph
                style={{ textAlign: "center", color: "#8c8c8c", fontSize: 12 }}
              >
                Didn't receive the email? Check your spam folder or try again.
              </Typography.Paragraph>
            </Card>
          </Col>
        </Row>
      </div>
    );
  }

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
              <Typography.Title level={2} style={{ margin: 0 }}>
                Reset Password
              </Typography.Title>
              <Typography.Paragraph type="secondary">
                Enter your email to receive a password reset link
              </Typography.Paragraph>
            </div>

            <Card
              style={{
                boxShadow:
                  "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)",
                borderRadius: 8,
              }}
            >
              <Form
                layout="vertical"
                form={form}
                onFinish={handleSubmit}
                size="large"
              >
                {error && (
                  <Alert
                    message="Error"
                    description={error}
                    type="error"
                    showIcon
                    style={{ marginBottom: 16 }}
                  />
                )}

                <Form.Item
                  label="Email"
                  name="email"
                  rules={[
                    { required: true, message: "Email is required" },
                    { type: "email", message: "Invalid email" },
                  ]}
                >
                  <Input placeholder="Enter your email" />
                </Form.Item>

                <Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    block
                    loading={isLoading}
                    size="large"
                  >
                    Send Reset Link
                  </Button>
                </Form.Item>

                <Typography.Paragraph
                  style={{ textAlign: "center", marginBottom: 0 }}
                >
                  Remember your password?{" "}
                  <Link href="/login">
                    <Typography.Link>Login here</Typography.Link>
                  </Link>
                </Typography.Paragraph>
              </Form>
            </Card>
          </Space>
        </Col>
      </Row>
    </div>
  );
}
