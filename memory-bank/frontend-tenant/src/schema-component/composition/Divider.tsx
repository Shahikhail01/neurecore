/**
 * Divider Component
 * Visual separator for layout
 * Adapted from Ant Design Divider
 */

"use client";

import { Divider as AntdDivider, DividerProps as AntdDividerProps } from "antd";
import React, { ReactNode } from "react";

export interface DividerProps extends AntdDividerProps {
  children?: ReactNode;
}

/**
 * Divider component for visual separation
 */
export const Divider: React.FC<DividerProps> = ({ children, ...props }) => {
  return <AntdDivider {...props}>{children}</AntdDivider>;
};

Divider.displayName = "Divider";

export default Divider;
