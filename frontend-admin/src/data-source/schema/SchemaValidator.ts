/**
 * Schema Validation Utilities
 * Adapted from NocoBase's schema validation patterns
 * Provides type-safe field validation and schema compliance checking
 */

"use client";

export type ValidationRule = {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  min?: number;
  max?: number;
  message?: string;
};

export type FieldValidationError = {
  field: string;
  message: string;
  value?: any;
};

export class SchemaValidator {
  /**
   * Validate a single field value
   */
  static validateField(
    value: any,
    fieldType: string,
    rules?: ValidationRule,
  ): FieldValidationError | null {
    if (!rules) return null;

    // Required check
    if (
      rules.required &&
      (value === null || value === undefined || value === "")
    ) {
      return {
        field: "unknown",
        message: rules.message || "This field is required",
        value,
      };
    }

    // Type-specific validation
    switch (fieldType) {
      case "string":
      case "email":
      case "url":
        if (typeof value !== "string") return null;

        if (rules.minLength && value.length < rules.minLength) {
          return {
            field: "unknown",
            message:
              rules.message ||
              `Minimum length is ${rules.minLength} characters`,
            value,
          };
        }

        if (rules.maxLength && value.length > rules.maxLength) {
          return {
            field: "unknown",
            message:
              rules.message ||
              `Maximum length is ${rules.maxLength} characters`,
            value,
          };
        }

        if (rules.pattern && !rules.pattern.test(value)) {
          return {
            field: "unknown",
            message: rules.message || "Invalid format",
            value,
          };
        }

        if (fieldType === "email") {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            return {
              field: "unknown",
              message: rules.message || "Invalid email address",
              value,
            };
          }
        }

        if (fieldType === "url") {
          try {
            new URL(value);
          } catch {
            return {
              field: "unknown",
              message: rules.message || "Invalid URL",
              value,
            };
          }
        }

        break;

      case "number":
      case "integer":
        if (typeof value !== "number") return null;

        if (rules.min !== undefined && value < rules.min) {
          return {
            field: "unknown",
            message: rules.message || `Minimum value is ${rules.min}`,
            value,
          };
        }

        if (rules.max !== undefined && value > rules.max) {
          return {
            field: "unknown",
            message: rules.message || `Maximum value is ${rules.max}`,
            value,
          };
        }

        break;

      case "date":
      case "datetime":
        if (!(value instanceof Date || typeof value === "string")) return null;

        try {
          const date = new Date(value);
          if (isNaN(date.getTime())) {
            return {
              field: "unknown",
              message: rules.message || "Invalid date",
              value,
            };
          }
        } catch {
          return {
            field: "unknown",
            message: rules.message || "Invalid date",
            value,
          };
        }
        break;
    }

    return null;
  }

  /**
   * Validate an entire record against a schema
   */
  static validateRecord(
    record: Record<string, any>,
    schema: Record<string, { type: string; rules?: ValidationRule }>,
  ): FieldValidationError[] {
    const errors: FieldValidationError[] = [];

    Object.entries(schema).forEach(([fieldName, { type, rules }]) => {
      const value = record[fieldName];
      const error = this.validateField(value, type, rules);
      if (error) {
        errors.push({ ...error, field: fieldName });
      }
    });

    return errors;
  }

  /**
   * Check if validation errors exist
   */
  static hasErrors(errors: FieldValidationError[]): boolean {
    return errors.length > 0;
  }

  /**
   * Get first error message for a field
   */
  static getFieldError(
    errors: FieldValidationError[],
    field: string,
  ): string | null {
    const error = errors.find((e) => e.field === field);
    return error?.message || null;
  }

  /**
   * Group errors by field
   */
  static groupByField(
    errors: FieldValidationError[],
  ): Record<string, string[]> {
    return errors.reduce(
      (groups, error) => {
        if (!groups[error.field]) {
          groups[error.field] = [];
        }
        groups[error.field].push(error.message);
        return groups;
      },
      {} as Record<string, string[]>,
    );
  }
}

export const validateField = SchemaValidator.validateField;
export const validateRecord = SchemaValidator.validateRecord;
export const hasErrors = SchemaValidator.hasErrors;
export const getFieldError = SchemaValidator.getFieldError;
export const groupByField = SchemaValidator.groupByField;

export default SchemaValidator;
