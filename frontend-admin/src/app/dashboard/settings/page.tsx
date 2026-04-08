/**
 * Settings Page
 * User profile and account settings page
 */

"use client";

import React, { useState } from "react";
import {
  Tabs,
  Card,
  Form,
  Input,
  Button,
  Upload,
  Avatar,
  Space,
  message,
} from "antd";
import {
  UserOutlined,
  LockOutlined,
  SafetyOutlined,
  BellOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/hooks/useAuth";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { SessionManagement } from "@/components/SessionManagement";

export default function SettingsPage() {
  const { user } = useAuth();
  const [profileForm] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleProfileUpdate = async (values: any) => {
    setLoading(true);
    try {
      // TODO: Implement API call to update user profile
      // await userService.updateProfile(user?.id, values)
      message.success("Profile updated successfully");
    } catch (error: any) {
      message.error(error.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const items = [
    {
      key: "1",
      label: (
        <span>
          <UserOutlined /> Profile
        </span>
      ),
      children: (
        <div className="space-y-6">
          {/* Avatar Section */}
          <Card>
            <div className="flex items-center gap-6">
              <Avatar size={100} icon={<UserOutlined />} />
              <div>
                <h3 className="font-medium mb-2">Profile Picture</h3>
                <Upload maxCount={1} accept="image/*">
                  <Button>Upload New Picture</Button>
                </Upload>
                <p className="text-xs text-gray-600 mt-2">
                  Recommended: Square image, minimum 200x200px, max 5MB
                </p>
              </div>
            </div>
          </Card>

          {/* Profile Form */}
          <Card title="Personal Information">
            <Form
              form={profileForm}
              layout="vertical"
              onFinish={handleProfileUpdate}
              initialValues={{
                email: user?.email,
                firstName: user?.firstName || "",
                lastName: user?.lastName || "",
                phone: user?.phone || "",
                company: user?.company || "",
              }}
            >
              <Form.Item label="Email Address">
                <Input value={user?.email} disabled />
              </Form.Item>

              <Form.Item label="First Name" name="firstName">
                <Input placeholder="Enter first name" />
              </Form.Item>

              <Form.Item label="Last Name" name="lastName">
                <Input placeholder="Enter last name" />
              </Form.Item>

              <Form.Item label="Phone" name="phone">
                <Input placeholder="Enter phone number" />
              </Form.Item>

              <Form.Item label="Company" name="company">
                <Input placeholder="Enter company name" />
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading}>
                  Save Changes
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </div>
      ),
    },
    {
      key: "2",
      label: (
        <span>
          <LockOutlined /> Password
        </span>
      ),
      children: (
        <Card>
          <ChangePasswordForm />
        </Card>
      ),
    },
    {
      key: "3",
      label: (
        <span>
          <SafetyOutlined /> Security
        </span>
      ),
      children: (
        <div className="space-y-6">
          <Card title="Two-Factor Authentication">
            <div className="space-y-4">
              <p className="text-gray-600">
                Add an extra layer of security to your account with two-factor
                authentication (2FA).
              </p>
              <Button type="primary">Enable 2FA</Button>
            </div>
          </Card>

          <Card title="Active Sessions">
            <SessionManagement />
          </Card>

          <Card title="Login History">
            <p className="text-gray-600 mb-4">
              View your recent login activity to monitor your account security.
            </p>
            <Button>View Login History</Button>
          </Card>
        </div>
      ),
    },
    {
      key: "4",
      label: (
        <span>
          <BellOutlined /> Notifications
        </span>
      ),
      children: (
        <Card title="Notification Preferences">
          <Form layout="vertical" className="space-y-4">
            <Form.Item>
              <div className="flex items-center justify-between">
                <label className="font-medium">Email Notifications</label>
                <input type="checkbox" defaultChecked />
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Receive email notifications for important updates
              </p>
            </Form.Item>

            <Form.Item>
              <div className="flex items-center justify-between">
                <label className="font-medium">Task Assignments</label>
                <input type="checkbox" defaultChecked />
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Notify me when new tasks are assigned
              </p>
            </Form.Item>

            <Form.Item>
              <div className="flex items-center justify-between">
                <label className="font-medium">Approval Requests</label>
                <input type="checkbox" defaultChecked />
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Notify me of pending approval requests
              </p>
            </Form.Item>

            <Form.Item>
              <div className="flex items-center justify-between">
                <label className="font-medium">Weekly Summary</label>
                <input type="checkbox" />
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Receive a weekly summary of your activities
              </p>
            </Form.Item>

            <Button type="primary">Save Preferences</Button>
          </Form>
        </Card>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-2">Settings</h1>
      <p className="text-gray-600 mb-6">
        Manage your account settings and preferences
      </p>

      <Tabs items={items} />
    </div>
  );
}
