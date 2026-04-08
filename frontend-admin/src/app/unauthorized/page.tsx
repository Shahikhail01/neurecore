"use client";

import React from "react";
import { Result, Button } from "antd";
import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Result
        status="403"
        title="Access Denied"
        subTitle="You don't have permission to access this page."
        extra={[
          <Link key="home" href="/dashboard">
            <Button type="primary">Go to Dashboard</Button>
          </Link>,
          <Link key="login" href="/login">
            <Button>Back to Login</Button>
          </Link>,
        ]}
      />
    </div>
  );
}
