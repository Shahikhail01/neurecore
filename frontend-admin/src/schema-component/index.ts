/**
 * Schema Component Library - Phase 5
 * Adapted from NocoBase schema-component system
 * Provides reusable form fields, display components, and UI primitives
 */

// Field Components
export {
  InputField,
  TextAreaField,
  PasswordField,
  SelectField,
  CheckboxField,
  RadioField,
  NumberField,
  DatePickerField,
  TimePickerField,
  InputReadPretty,
  TextAreaReadPretty,
  PasswordReadPretty,
  SelectReadPretty,
  CheckboxReadPretty,
  RadioReadPretty,
  NumberReadPretty,
  DateReadPretty,
  TimeReadPretty,
} from './fields/index';

// Composition Components
export { Form } from './composition/Form';
export type { FormComponentProps } from './composition/Form';

export { FormItem } from './composition/FormItem';
export type { FormItemProps } from './composition/FormItem';

export { Space } from './composition/Space';
export type { SpaceProps } from './composition/Space';

export { Tabs, TabPane } from './composition/Tabs';
export type { TabsProps, TabItem } from './composition/Tabs';

export { Divider } from './composition/Divider';
export type { DividerProps } from './composition/Divider';

// Registry & Utilities
export { schemaComponentRegistry, useSchemaComponentRegistry } from './registry/SchemaComponentRegistry';
export { useSchemaComponent, SchemaComponentRenderer } from './registry/useSchemaComponent';
export { initializeSchemaComponents, getRegisteredComponentNames, isComponentRegistered } from './registry/initialize';

// Types
export type {
  SchemaFieldProps,
  SchemaFieldDefinition,
  SchemaFieldOption,
  FormSchema,
  ReadPrettyProps,
  SchemaComponentEntry,
} from './types';
