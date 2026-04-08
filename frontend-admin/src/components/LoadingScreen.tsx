/**
 * LoadingScreen Component
 * Full-screen loading indicator
 */

"use client";

import React from "react";
import { Spin } from "antd";
import { LoadingOutlined } from "@ant-design/icons";

interface LoadingScreenProps {
  tip?: string;
  fullScreen?: boolean;
}

export function LoadingScreen({
  tip = "Loading...",
  fullScreen = true,
}: LoadingScreenProps) {
  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white bg-opacity-90 flex items-center justify-center z-50 backdrop-blur-sm">
        <div className="text-center">
          <Spin
            indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />}
            tip={tip}
            size="large"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-8">
      <Spin
        indicator={<LoadingOutlined style={{ fontSize: 32 }} spin />}
        tip={tip}
      />
    </div>
  );
}
