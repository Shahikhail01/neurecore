/**
 * Phase 5 Schema Component Types
 * Type definitions for schema-based field rendering
 */

import React from "react";

/**
 * Field component props - minimal interface for all schema fields
 */
export interface SchemaFieldProps {
  value?: any;
  onChange?: (value: any) => void;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  required?: boolean;
  title?: string;
  description?: string;
}

/**
 * Schema field definition - describes a field's metadata and behavior
 */
export interface SchemaFieldDefinition {
  type: string; // 'input', 'select', 'checkbox', 'date', etc.
  name: string;
  title?: string;
  description?: string;
  required?: boolean;
  disabled?: boolean;
  defaultValue?: any;
  placeholder?: string;
  pattern?: string | RegExp;
  validate?: (value: any) => string | null;
  options?: SchemaFieldOption[];
  props?: Record<string, any>;
}

/**
 * Option for select/checkbox/radio fields
 */
export interface SchemaFieldOption {
  label: string;
  value: any;
  disabled?: boolean;
  description?: string;
}

/**
 * Form schema - describes an entire form structure
 */
export interface FormSchema {
  fields: SchemaFieldDefinition[];
  title?: string;
  description?: string;
  layout?: "vertical" | "horizontal" | "inline";
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
}

/**
 * Read-pretty (display-only) component props
 */
export interface ReadPrettyProps {
  value?: any;
  ellipsis?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Component registry entry
 */
export interface SchemaComponentEntry {
  type: string;
  component: React.ComponentType<any>;
  readPretty?: React.ComponentType<any>;
  props?: Record<string, any>;
}
