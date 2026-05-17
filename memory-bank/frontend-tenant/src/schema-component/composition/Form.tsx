/**
 * Form Component
 * Container for form fields with validation and submission
 * Adapted from NocoBase Form pattern
 */

"use client";

import {
  Form as AntdForm,
  FormInstance,
  FormProps as AntdFormProps,
} from "antd";
import React, { ReactNode } from "react";
import { FormSchema } from "../types";

export interface FormComponentProps extends Omit<AntdFormProps, "children"> {
  schema?: FormSchema;
  children?: ReactNode;
  onFinish?: (values: any) => Promise<void> | void;
  onFinishFailed?: (errorInfo: any) => void;
  submitButtonText?: string;
  showSubmit?: boolean;
}

/**
 * Form component for containing and managing form fields
 */
export const Form = React.forwardRef<FormInstance, FormComponentProps>(
  (
    {
      schema,
      children,
      onFinish,
      onFinishFailed,
      submitButtonText = "Submit",
      showSubmit = true,
      layout = "vertical",
      ...props
    },
    ref,
  ) => {
    return (
      <AntdForm
        ref={ref}
        layout={layout}
        onFinish={onFinish}
        onFinishFailed={onFinishFailed}
        {...props}
      >
        {children}
        {showSubmit && (
          <AntdForm.Item>
            <button
              type="submit"
              style={{
                padding: "8px 16px",
                backgroundColor: "#1890ff",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              {submitButtonText}
            </button>
          </AntdForm.Item>
        )}
      </AntdForm>
    );
  },
);

Form.displayName = "Form";

export default Form;
