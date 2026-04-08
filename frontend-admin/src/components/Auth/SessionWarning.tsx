/**
 * SessionWarning Component
 * Modal that warns user their session is about to expire
 */

"use client";

import React, { useEffect, useState } from "react";
import { Modal, Button, Space, Typography } from "antd";
import { ClockCircleOutlined } from "@ant-design/icons";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";

interface SessionWarningProps {
  warningThreshold?: number; // ms before expiry to show warning (default 5 min)
  checkInterval?: number; // how often to check expiry (default 1 min)
}

export function SessionWarning({
  warningThreshold = 5 * 60 * 1000,
  checkInterval = 60 * 1000,
}: SessionWarningProps) {
  const { logout, accessToken } = useAuth();
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  // Extract expiry from JWT token
  const getTokenExpiry = (token: string | null): number | null => {
    if (!token) return null;

    try {
      const parts = token.split(".");
      if (parts.length !== 3) return null;

      const payload = JSON.parse(atob(parts[1]));
      return payload.exp ? payload.exp * 1000 : null;
    } catch {
      return null;
    }
  };

  // Check token expiry periodically
  useEffect(() => {
    const checkExpiry = () => {
      const expiry = getTokenExpiry(accessToken);
      if (!expiry) {
        setIsVisible(false);
        return;
      }

      const now = Date.now();
      const timeUntilExpiry = expiry - now;

      if (timeUntilExpiry <= 0) {
        // Token has expired
        setIsVisible(false);
        handleLogout();
      } else if (timeUntilExpiry <= warningThreshold) {
        // Show warning
        setIsVisible(true);
        setSecondsRemaining(Math.floor(timeUntilExpiry / 1000));
      } else {
        // Still plenty of time
        setIsVisible(false);
      }
    };

    checkExpiry();
    const interval = setInterval(checkExpiry, checkInterval);

    return () => clearInterval(interval);
  }, [accessToken, warningThreshold, checkInterval]);

  // Update remaining time display
  useEffect(() => {
    if (!isVisible) return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [isVisible]);

  const handleRefresh = async () => {
    try {
      // Trigger manual refresh by making any authenticated request
      window.dispatchEvent(new Event("refresh-session"));
      setIsVisible(false);
    } catch (err) {
      console.error("Session refresh failed:", err);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;

  return (
    <Modal
      title={
        <Space>
          <ClockCircleOutlined style={{ color: "#faad14" }} />
          <span>Session Expiring Soon</span>
        </Space>
      }
      open={isVisible}
      closable={false}
      footer={[
        <Button key="logout" danger onClick={handleLogout}>
          Logout
        </Button>,
        <Button key="refresh" type="primary" onClick={handleRefresh}>
          Continue Session
        </Button>,
      ]}
    >
      <Typography.Paragraph>
        Your session will expire in{" "}
        <strong>
          {minutes}:{seconds.toString().padStart(2, "0")}
        </strong>
      </Typography.Paragraph>
      <Typography.Paragraph type="secondary">
        Click "Continue Session" to refresh your access, or "Logout" to end your
        session.
      </Typography.Paragraph>
    </Modal>
  );
}
