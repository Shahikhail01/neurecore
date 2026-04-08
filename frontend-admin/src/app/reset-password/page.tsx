"use client";

import React, { useState, Suspense } from "react";
import {
  Card,
  Space,
  Typography,
  Row,
  Col,
  Form,
  Button,
  Alert,
  Result,
} from "antd";
import { useAuth } from "@/hooks/useAuth";
import {
  useSearchParams as useSearchParamsHook,
  useRouter,
} from "next/navigation";
import Link from "next/link";
import { PasswordField } from "@/components/Auth/PasswordField";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParamsHook();
  const token = searchParams.get("token");

  const [form] = Form.useForm();
  const { resetPassword, isLoading, error } = useAuth();
  const [password, setPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (!token) {
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
                status="error"
                title="Invalid Reset Link"
                subTitle="The password reset link is missing or invalid. Please request a new one."
                extra={[
                  <Link key="forgot" href="/forgot-password">
                    <Button type="primary">Request New Link</Button>
                  </Link>,
                ]}
              />
            </Card>
          </Col>
        </Row>
      </div>
    );
  }

  const handleSubmit = async (values: any) => {
    try {
      await resetPassword({
        resetToken: token,
        newPassword: values.password,
      });
      setSubmitted(true);
    } catch (err) {
      console.error("Password reset failed:", err);
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
                title="Password Reset Successful"
                subTitle="Your password has been reset. You can now login with your new password."
                extra={[
                  <Link key="login" href="/login">
                    <Button type="primary">Go to Login</Button>
                  </Link>,
                ]}
              />
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
                Set New Password
              </Typography.Title>
              <Typography.Paragraph type="secondary">
                Enter your new password below
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

                <Form.Item label="New Password" required>
                  <PasswordField
                    value={password}
                    onChange={setPassword}
                    showStrength
                    showRequirements
                  />
                  <input type="hidden" name="password" value={password} />
                </Form.Item>

                <Form.Item
                  name="password"
                  hidden
                  initialValue={password}
                  rules={[
                    { required: true, message: "Password is required" },
                    {
                      min: 8,
                      message: "Password must be at least 8 characters",
                    },
                  ]}
                >
                  <input type="hidden" />
                </Form.Item>

                <Form.Item
                  label="Confirm Password"
                  name="confirmPassword"
                  dependencies={["password"]}
                  rules={[
                    { required: true, message: "Please confirm your password" },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || getFieldValue("password") === value) {
                          return Promise.resolve();
                        }
                        return Promise.reject(
                          new Error("Passwords do not match"),
                        );
                      },
                    }),
                  ]}
                >
                  <input type="password" placeholder="Confirm your password" />
                </Form.Item>

                <Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    block
                    loading={isLoading}
                    size="large"
                  >
                    Reset Password
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
