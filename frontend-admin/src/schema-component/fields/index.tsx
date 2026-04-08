'use client';

/**
 * Schema Component Field Wrappers
 * Simplified implementation focusing on core functionality
 * All components are simple React function components
 */

'use client';

import { Input as AntdInput, Select as AntdSelect, Checkbox as AntdCheckbox, Radio as AntdRadio, InputNumber as AntdInputNumber, DatePicker as AntdDatePicker, TimePicker as AntdTimePicker } from 'antd';
import React, { useMemo } from 'react';
import { ReadPrettyProps } from '../types';

/**
 * Text InputField
 */
export function InputField(props: any) {
  return <AntdInput {...props} />;
}
InputField.displayName = 'InputField';

/**
 * TextArea Field
 */
export function TextAreaField(props: any) {
  return <AntdInput.TextArea autoSize={{ minRows: 3, maxRows: 10 }} {...props} />;
}
TextAreaField.displayName = 'TextAreaField';

/**
 * Password Field
 */
export function PasswordField(props: any) {
  return <AntdInput.Password {...props} />;
}
PasswordField.displayName = 'PasswordField';

/**
 * Select Field
 */
export function SelectField(props: any) {
  return <AntdSelect {...props} />;
}
SelectField.displayName = 'SelectField';

/**
 * Checkbox Field
 */
export function CheckboxField(props: any) {
  if (props.mode === 'group') {
    return <AntdCheckbox.Group {...props} />;
  }
  return <AntdCheckbox {...props} />;
}
CheckboxField.displayName = 'CheckboxField';

/**
 * Radio Field
 */
export function RadioField(props: any) {
  return <AntdRadio.Group {...props} />;
}
RadioField.displayName = 'RadioField';

/**
 * Number Field
 */
export function NumberField(props: any) {
  return <AntdInputNumber style={{ width: '100%', ...props.style }} {...props} />;
}
NumberField.displayName = 'NumberField';

/**
 * DatePicker Field
 */
export function DatePickerField(props: any) {
  return <AntdDatePicker style={{ width: '100%', ...props.style }} {...props} />;
}
DatePickerField.displayName = 'DatePickerField';

/**
 * TimePicker Field
 */
export function TimePickerField(props: any) {
  return <AntdTimePicker style={{ width: '100%', ...props.style }} {...props} />;
}
TimePickerField.displayName = 'TimePickerField';

// ===== READ-PRETTY (Display-Only) Components =====

/**
 * InputReadPretty
 */
export const InputReadPretty: React.FC<ReadPrettyProps> = ({ value, className, style }) => {
  const displayValue = useMemo(() => {
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    return value && typeof value === 'object' ? JSON.stringify(value) : String(value || '');
  }, [value]);

  return (
    <div className={className} style={{ ...style, overflowWrap: 'break-word', whiteSpace: 'normal' }}>
      {displayValue}
    </div>
  );
};
InputReadPretty.displayName = 'InputReadPretty';

/**
 * TextAreaReadPretty
 */
export const TextAreaReadPretty: React.FC<ReadPrettyProps> = ({ value, className, style }) => {
  const displayValue = useMemo(() => {
    const val = String(value || '');
    return val.split('\n').map((line, idx) => (
      <React.Fragment key={idx}>
        {line}
        {idx < val.split('\n').length - 1 && <br />}
      </React.Fragment>
    ));
  }, [value]);

  return (
    <div className={className} style={{ ...style, whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}>
      {displayValue}
    </div>
  );
};
TextAreaReadPretty.displayName = 'TextAreaReadPretty';

/**
 * PasswordReadPretty
 */
export const PasswordReadPretty: React.FC<ReadPrettyProps> = ({ value, className, style }) => {
  return (
    <div className={className} style={style}>
      {value ? '••••••••' : ''}
    </div>
  );
};
PasswordReadPretty.displayName = 'PasswordReadPretty';

/**
 * SelectReadPretty
 */
export const SelectReadPretty: React.FC<ReadPrettyProps & { options?: any[] }> = ({ value, options = [], className, style }) => {
  const displayValue = useMemo(() => {
    if (Array.isArray(value)) {
      return value.map((v) => options.find((opt) => opt.value === v)?.label || v).join(', ');
    }
    const option = options.find((opt) => opt.value === value);
    return option?.label || value;
  }, [value, options]);

  return (
    <div className={className} style={style}>
      {displayValue}
    </div>
  );
};
SelectReadPretty.displayName = 'SelectReadPretty';

/**
 * CheckboxReadPretty
 */
export const CheckboxReadPretty: React.FC<ReadPrettyProps & { options?: any[] }> = ({ value, options = [], className, style }) => {
  const displayValue = useMemo(() => {
    if (typeof value === 'boolean') {
      return value ? '✓' : '';
    }
    if (Array.isArray(value)) {
      return value.map((v) => options.find((opt) => opt.value === v)?.label || v).join(', ');
    }
    const option = options.find((opt) => opt.value === value);
    return option?.label || String(value || '');
  }, [value, options]);

  return (
    <div className={className} style={style}>
      {displayValue}
    </div>
  );
};
CheckboxReadPretty.displayName = 'CheckboxReadPretty';

/**
 * RadioReadPretty
 */
export const RadioReadPretty: React.FC<ReadPrettyProps & { options?: any[] }> = ({ value, options = [], className, style }) => {
  const displayValue = useMemo(() => {
    const option = options.find((opt) => opt.value === value);
    return option?.label || String(value || '');
  }, [value, options]);

  return (
    <div className={className} style={style}>
      {displayValue}
    </div>
  );
};
RadioReadPretty.displayName = 'RadioReadPretty';

/**
 * NumberReadPretty
 */
export const NumberReadPretty: React.FC<ReadPrettyProps & { precision?: number }> = ({ value, precision = 0, className, style }) => {
  const displayValue = useMemo(() => {
    if (value === null || value === undefined) return '';
    const num = Number(value);
    if (isNaN(num)) return String(value);
    return num.toFixed(precision);
  }, [value, precision]);

  return (
    <div className={className} style={style}>
      {displayValue}
    </div>
  );
};
NumberReadPretty.displayName = 'NumberReadPretty';

/**
 * DateReadPretty
 */
export const DateReadPretty: React.FC<ReadPrettyProps & { format?: string }> = ({ value, format = 'YYYY-MM-DD', className, style }) => {
  const displayValue = useMemo(() => {
    if (!value) return '';
    try {
      // Simple date formatting without dayjs dependency
      const date = new Date(value);
      return date.toLocaleDateString();
    } catch {
      return String(value);
    }
  }, [value, format]);

  return (
    <div className={className} style={style}>
      {displayValue}
    </div>
  );
};
DateReadPretty.displayName = 'DateReadPretty';

/**
 * TimeReadPretty
 */
export const TimeReadPretty: React.FC<ReadPrettyProps & { format?: string }> = ({ value, format = 'HH:mm:ss', className, style }) => {
  const displayValue = useMemo(() => {
    if (!value) return '';
    try {
      const date = new Date(value);
      return date.toLocaleTimeString();
    } catch {
      return String(value);
    }
  }, [value, format]);

  return (
    <div className={className} style={style}>
      {displayValue}
    </div>
  );
};
TimeReadPretty.displayName = 'TimeReadPretty';
