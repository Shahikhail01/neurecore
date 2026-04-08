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
  Select,
  Alert,
} from "antd";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PasswordField } from "@/components/Auth/PasswordField";

export default function RegisterPage() {
  const router = useRouter();
  const { register, isLoading, error: authError } = useAuth();
  const [form] = Form.useForm();
  const [password, setPassword] = useState("");

  const handleSubmit = async (values: any) => {
    try {
      await register({
        email: values.email,
        password: values.password,
        firstName: values.firstName,
        lastName: values.lastName,
        tenantId: values.tenantId || "default",
      });
      router.push("/dashboard");
    } catch (err) {
      console.error("Registration failed:", err);
    }
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
                Create Account
              </Typography.Title>
              <Typography.Title
                level={4}
                type="secondary"
                style={{ margin: 0 }}
              >
                Join NeureCore Admin
              </Typography.Title>
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
                {authError && (
                  <Alert
                    message="Error"
                    description={authError}
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

                <Form.Item
                  label="First Name"
                  name="firstName"
                  rules={[
                    { required: true, message: "First name is required" },
                  ]}
                >
                  <Input placeholder="Your first name" />
                </Form.Item>

                <Form.Item
                  label="Last Name"
                  name="lastName"
                  rules={[{ required: true, message: "Last name is required" }]}
                >
                  <Input placeholder="Your last name" />
                </Form.Item>

                <Form.Item
                  label="Tenant ID"
                  name="tenantId"
                  rules={[{ required: true, message: "Tenant is required" }]}
                >
                  <Input placeholder="Your tenant ID" />
                </Form.Item>

                <Form.Item label="Password" required>
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
                  <Input type="hidden" />
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
                  <Input.Password placeholder="Confirm your password" />
                </Form.Item>

                <Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    block
                    loading={isLoading}
                    size="large"
                  >
                    Create Account
                  </Button>
                </Form.Item>

                <Typography.Paragraph
                  style={{ textAlign: "center", marginBottom: 0 }}
                >
                  Already have an account?{" "}
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
