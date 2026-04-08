/**
 * ChangePasswordForm Component
 * Allows users to change their password with validation
 */

"use client";

import React, { useState } from "react";
import { Form, Input, Button, message, Modal, Progress } from "antd";
import {
  LockOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/hooks/useAuth";

export function ChangePasswordForm() {
  const { user, changePassword } = useAuth();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  // Password requirements
  const requirements = {
    minLength: /^.{8,}$/.test(form.getFieldValue("newPassword") || ""),
    hasUppercase: /[A-Z]/.test(form.getFieldValue("newPassword") || ""),
    hasLowercase: /[a-z]/.test(form.getFieldValue("newPassword") || ""),
    hasDigit: /\d/.test(form.getFieldValue("newPassword") || ""),
    hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(
      form.getFieldValue("newPassword") || "",
    ),
  };

  const checkPassword = (value: string) => {
    let strength = 0;
    if (requirements.minLength) strength++;
    if (requirements.hasUppercase) strength++;
    if (requirements.hasLowercase) strength++;
    if (requirements.hasDigit) strength++;
    if (requirements.hasSpecial) strength++;
    setPasswordStrength((strength / 5) * 100);
  };

  const onFinish = async (values: any) => {
    // Verify all requirements are met
    const allRequirementsMet = Object.values(requirements).every(
      (req) => req === true,
    );
    if (!allRequirementsMet) {
      message.error("Password does not meet all requirements");
      return;
    }

    // Verify passwords match
    if (values.newPassword !== values.confirmPassword) {
      message.error("Passwords do not match");
      return;
    }

    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    setShowConfirm(false);
    setLoading(true);

    try {
      const values = form.getFieldsValue();
      await changePassword(values.currentPassword, values.newPassword);
      message.success("Password changed successfully");
      form.resetFields();
    } catch (error: any) {
      message.error(error.message || "Failed to change password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md">
      <h2 className="text-xl font-semibold mb-6">Change Password</h2>

      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        className="space-y-4"
      >
        <Form.Item
          label="Current Password"
          name="currentPassword"
          rules={[
            { required: true, message: "Please enter your current password" },
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="Enter current password"
          />
        </Form.Item>

        <Form.Item
          label="New Password"
          name="newPassword"
          rules={[{ required: true, message: "Please enter a new password" }]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="Enter new password"
            onChange={(e) => checkPassword(e.target.value)}
          />
        </Form.Item>

        {/* Password Strength Indicator */}
        <div className="mb-4">
          <div className="text-sm font-medium mb-2">Password Strength</div>
          <Progress
            percent={passwordStrength}
            strokeColor={
              passwordStrength < 40
                ? "#ff4d4f"
                : passwordStrength < 70
                  ? "#faad14"
                  : "#52c41a"
            }
            showInfo={false}
          />
          <div className="text-xs text-gray-600 mt-2">
            {passwordStrength < 40 && "Weak"}
            {passwordStrength >= 40 && passwordStrength < 70 && "Fair"}
            {passwordStrength >= 70 && "Strong"}
          </div>
        </div>

        {/* Requirements Checklist */}
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="text-sm font-medium mb-2">Password Requirements:</div>
          <div className="space-y-1 text-xs">
            <div
              className={
                requirements.minLength ? "text-green-600" : "text-gray-600"
              }
            >
              {requirements.minLength ? "✓" : "✗"} At least 8 characters
            </div>
            <div
              className={
                requirements.hasUppercase ? "text-green-600" : "text-gray-600"
              }
            >
              {requirements.hasUppercase ? "✓" : "✗"} One uppercase letter
            </div>
            <div
              className={
                requirements.hasLowercase ? "text-green-600" : "text-gray-600"
              }
            >
              {requirements.hasLowercase ? "✓" : "✗"} One lowercase letter
            </div>
            <div
              className={
                requirements.hasDigit ? "text-green-600" : "text-gray-600"
              }
            >
              {requirements.hasDigit ? "✓" : "✗"} One number
            </div>
            <div
              className={
                requirements.hasSpecial ? "text-green-600" : "text-gray-600"
              }
            >
              {requirements.hasSpecial ? "✓" : "✗"} One special character
            </div>
          </div>
        </div>

        <Form.Item
          label="Confirm New Password"
          name="confirmPassword"
          rules={[
            { required: true, message: "Please confirm your new password" },
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="Confirm new password"
          />
        </Form.Item>

        <Button type="primary" htmlType="submit" block loading={loading}>
          Change Password
        </Button>
      </Form>

      {/* Confirmation Modal */}
      <Modal
        title="Confirm Password Change"
        open={showConfirm}
        onOk={handleConfirm}
        onCancel={() => setShowConfirm(false)}
        confirmLoading={loading}
      >
        <div className="flex items-start gap-3">
          <ExclamationCircleOutlined className="text-warning text-lg flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">
              Are you sure you want to change your password?
            </p>
            <p className="text-sm text-gray-600 mt-1">
              You will need to log in again with your new password.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
