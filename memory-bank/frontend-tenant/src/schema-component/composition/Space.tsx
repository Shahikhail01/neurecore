/**
 * Space Component
 * Layout component for spacing items horizontally or vertically
 * Adapted from Ant Design Space
 */

"use client";

import { Space as AntdSpace, SpaceProps as AntdSpaceProps } from "antd";
import React, { ReactNode } from "react";

export interface SpaceProps extends AntdSpaceProps {
  children?: ReactNode;
}

/**
 * Space component for layout with spacing
 */
export const Space: React.FC<SpaceProps> = ({
  direction = "horizontal",
  size = "middle",
  children,
  ...props
}) => {
  return (
    <AntdSpace direction={direction} size={size} {...props}>
      {children}
    </AntdSpace>
  );
};

Space.displayName = "Space";

export default Space;
