/**
 * PasswordField Component
 * Password input with strength indicator
 */

"use client";

import React, { useState } from "react";
import { Input, Progress, Space, Typography } from "antd";
import { EyeInvisibleOutlined, EyeOutlined } from "@ant-design/icons";

export interface PasswordFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  showStrength?: boolean;
  showRequirements?: boolean;
}

const PASSWORD_REQUIREMENTS = [
  { pattern: /.{8,}/, label: "At least 8 characters" },
  { pattern: /[A-Z]/, label: "Uppercase letter" },
  { pattern: /[a-z]/, label: "Lowercase letter" },
  { pattern: /\d/, label: "Number" },
  { pattern: /[!@#$%^&*]/, label: "Special character (!@#$%^&*)" },
];

function calculateStrength(password: string): {
  score: number;
  text: string;
  color: string;
} {
  if (!password) return { score: 0, text: "", color: "#d9d9d9" };

  let score = 0;
  let metRequirements = 0;

  if (password.length >= 8) score += 20;
  if (password.length >= 12) score += 10;
  if (/[A-Z]/.test(password)) score += 20;
  if (/[a-z]/.test(password)) score += 20;
  if (/\d/.test(password)) score += 15;
  if (/[!@#$%^&*]/.test(password)) score += 15;

  for (const req of PASSWORD_REQUIREMENTS) {
    if (req.pattern.test(password)) {
      metRequirements++;
    }
  }

  let text = "";
  let color = "";

  if (score < 40) {
    text = "Weak";
    color = "#ff4d4f";
  } else if (score < 70) {
    text = "Fair";
    color = "#faad14";
  } else if (score < 90) {
    text = "Good";
    color = "#1890ff";
  } else {
    text = "Strong";
    color = "#52c41a";
  }

  return { score: Math.min(score, 100), text, color };
}

export function PasswordField({
  value,
  onChange,
  placeholder = "Enter password",
  showStrength = true,
  showRequirements = true,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const strength = calculateStrength(value);

  const metRequirements = PASSWORD_REQUIREMENTS.filter((req) =>
    req.pattern.test(value),
  );

  return (
    <Space direction="vertical" style={{ width: "100%" }} size="small">
      <Input.Password
        size="large"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        iconRender={() =>
          visible ? <EyeOutlined /> : <EyeInvisibleOutlined />
        }
        onBlur={() => setVisible(false)}
        onFocus={() => setVisible(true)}
      />

      {showStrength && value && (
        <>
          <Space direction="vertical" style={{ width: "100%" }} size={4}>
            <Space
              style={{
                width: "100%",
                justifyContent: "space-between",
                display: "flex",
              }}
            >
              <Typography.Text type="secondary" style={{ fontSize: "12px" }}>
                Password Strength:
              </Typography.Text>
              <Typography.Text
                style={{
                  fontSize: "12px",
                  color: strength.color,
                  fontWeight: 600,
                }}
              >
                {strength.text}
              </Typography.Text>
            </Space>
            <Progress
              percent={strength.score}
              strokeColor={strength.color}
              strokeLinecap="round"
              showInfo={false}
              size="small"
            />
          </Space>
        </>
      )}

      {showRequirements && value && (
        <div style={{ fontSize: "12px", lineHeight: "1.6" }}>
          {PASSWORD_REQUIREMENTS.map((req, idx) => (
            <div
              key={idx}
              style={{
                color: req.pattern.test(value) ? "#52c41a" : "#8c8c8c",
                textDecoration: req.pattern.test(value)
                  ? "line-through"
                  : "none",
              }}
            >
              {req.pattern.test(value) ? "✓" : "○"} {req.label}
            </div>
          ))}
        </div>
      )}
    </Space>
  );
}
