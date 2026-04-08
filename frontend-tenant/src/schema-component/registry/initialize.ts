/**
 * Initialize Schema Component Registry
 * Register all built-in schema field components
 */

import { schemaComponentRegistry } from './SchemaComponentRegistry';
import {
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
} from '../fields/index';

/**
 * Register all built-in schema components
 */
export function initializeSchemaComponents() {
  schemaComponentRegistry.register('input', InputField, { readPretty: InputReadPretty });
  schemaComponentRegistry.register('textarea', TextAreaField, { readPretty: TextAreaReadPretty });
  schemaComponentRegistry.register('password', PasswordField, { readPretty: PasswordReadPretty });
  schemaComponentRegistry.register('number', NumberField, { readPretty: NumberReadPretty });
  schemaComponentRegistry.register('select', SelectField, { readPretty: SelectReadPretty });
  schemaComponentRegistry.register('checkbox', CheckboxField, { readPretty: CheckboxReadPretty });
  schemaComponentRegistry.register('radio', RadioField, { readPretty: RadioReadPretty });
  schemaComponentRegistry.register('date', DatePickerField, { readPretty: DateReadPretty });
  schemaComponentRegistry.register('time', TimePickerField, { readPretty: TimeReadPretty });
}

export function getRegisteredComponentNames(): string[] {
  return schemaComponentRegistry.getNames();
}

export function isComponentRegistered(type: string): boolean {
  return schemaComponentRegistry.has(type);
}
