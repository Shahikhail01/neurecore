/**
 * LoginForm Component
 * Email + password login form
 */

"use client";

import React, { useState } from "react";
import { Form, Input, Button, Checkbox, Space, Typography, Alert } from "antd";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";

export interface LoginFormProps {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function LoginForm({ onSuccess, onError }: LoginFormProps) {
  const [form] = Form.useForm();
  const { login, isLoading, error } = useAuth();
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = async (values: { email: string; password: string }) => {
    try {
      await login({
        email: values.email,
        password: values.password,
      });

      if (rememberMe) {
        localStorage.setItem("rememberEmail", values.email);
      } else {
        localStorage.removeItem("rememberEmail");
      }

      onSuccess?.();
    } catch (err) {
      onError?.(err as Error);
    }
  };

  return (
    <Form layout="vertical" form={form} onFinish={handleSubmit} size="large">
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
        initialValue={
          typeof window !== "undefined"
            ? localStorage.getItem("rememberEmail") || ""
            : ""
        }
        rules={[
          { required: true, message: "Email is required" },
          { type: "email", message: "Invalid email" },
        ]}
      >
        <Input placeholder="Enter your email" />
      </Form.Item>

      <Form.Item
        label="Password"
        name="password"
        rules={[{ required: true, message: "Password is required" }]}
      >
        <Input.Password placeholder="Enter your password" />
      </Form.Item>

      <Space
        style={{
          justifyContent: "space-between",
          width: "100%",
          marginBottom: 16,
        }}
      >
        <Checkbox
          checked={rememberMe}
          onChange={(e) => setRememberMe(e.target.checked)}
        >
          Remember me
        </Checkbox>
        <Link href="/forgot-password" className="ant-btn-link" style={{ padding: 0 }}>
          <span style={{ color: '#1677ff' }}>Forgot password?</span>
        </Link>
      </Space>

      <Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          block
          loading={isLoading}
          size="large"
        >
          Login
        </Button>
      </Form.Item>

      <Typography.Paragraph style={{ textAlign: "center", marginBottom: 0 }}>
        Don&apos;t have an account?{" "}
        <Link href="/register">
          <span style={{ color: '#1677ff' }}>Register here</span>
        </Link>
      </Typography.Paragraph>
    </Form>
  );
}
