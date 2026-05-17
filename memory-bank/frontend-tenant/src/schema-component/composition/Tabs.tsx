/**
 * Tabs Component
 * Container for tabbed content
 * Adapted from Ant Design Tabs
 */

"use client";

import { Tabs as AntdTabs, TabsProps as AntdTabsProps } from "antd";
import React, { ReactNode } from "react";

export interface TabItem {
  key: string;
  label: string;
  children: ReactNode;
  disabled?: boolean;
  closable?: boolean;
}

export interface TabsProps extends Omit<AntdTabsProps, "items"> {
  items?: TabItem[];
  children?: ReactNode;
}

/**
 * Tabs component for tabbed navigation
 */
export const Tabs: React.FC<TabsProps> = ({
  items = [],
  children,
  ...props
}) => {
  return (
    <AntdTabs items={items} {...props}>
      {children}
    </AntdTabs>
  );
};

Tabs.displayName = "Tabs";

export const TabPane = AntdTabs.TabPane;

export default Tabs;
