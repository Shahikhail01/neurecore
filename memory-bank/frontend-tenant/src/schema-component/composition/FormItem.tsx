/**
 * FormItem Component
 * Wrapper for form fields with label, help text, validation
 * Adapted from NocoBase FormItem pattern
 */

"use client";

import { Form as AntdForm, FormItemProps as AntdFormItemProps } from "antd";
import React, { ReactNode } from "react";

export interface FormItemProps extends AntdFormItemProps {
  description?: string;
  helpText?: string;
  required?: boolean;
  children?: ReactNode;
}

/**
 * FormItem component for wrapping individual form fields
 */
export const FormItem: React.FC<FormItemProps> = ({
  label,
  name,
  description,
  helpText,
  required,
  children,
  rules,
  ...props
}) => {
  // Merge required rule
  const mergedRules = rules ? [...rules] : [];
  if (required) {
    mergedRules.unshift({
      required: true,
      message: `${label} is required`,
    });
  }

  return (
    <AntdForm.Item
      label={label}
      name={name}
      rules={mergedRules.length > 0 ? mergedRules : undefined}
      help={helpText || description}
      required={required}
      {...props}
    >
      {children}
    </AntdForm.Item>
  );
};

FormItem.displayName = "FormItem";

export default FormItem;
