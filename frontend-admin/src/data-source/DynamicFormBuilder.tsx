/**
 * Dynamic Form Builder
 * Generate Formily forms from collection schemas
 * Adapted from NocoBase's form generation patterns
 */

"use client";

import { useCallback, useMemo } from "react";
import { createForm, FormPath } from "@formily/core";
import { collectionRegistry, CollectionMetadata } from "../CollectionRegistry";
import { SchemaValidator } from "../schema/SchemaValidator";

export interface FormFieldConfig {
  name: string;
  type:
    | "text"
    | "number"
    | "email"
    | "url"
    | "date"
    | "select"
    | "checkbox"
    | "textarea"
    | "password";
  title?: string;
  description?: string;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  readonly?: boolean;
  defaultValue?: any;
  validation?: {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string | RegExp;
  };
  options?: Array<{ label: string; value: any }>;
  help?: string;
  tooltip?: string;
}

export interface DynamicFormConfig {
  collectionName: string;
  mode?: "create" | "edit" | "view";
  initialValues?: Record<string, any>;
  excludeFields?: string[];
  includeFields?: string[];
  customFields?: Record<string, FormFieldConfig>;
  onSubmit?: (data: any) => Promise<void>;
  onCancel?: () => void;
}

export interface FormSchema {
  type: "object";
  properties: Record<string, any>;
  required?: string[];
}

/**
 * Generate Formily schema from collection metadata
 */
export class DynamicFormBuilder {
  private collectionName: string;
  private metadata?: CollectionMetadata;
  private excludeFields: Set<string>;
  private includeFields?: Set<string>;
  private customFields: Map<string, FormFieldConfig>;

  constructor(
    collectionName: string,
    options?: {
      excludeFields?: string[];
      includeFields?: string[];
      customFields?: Record<string, FormFieldConfig>;
    },
  ) {
    this.collectionName = collectionName;
    this.metadata = collectionRegistry.get(collectionName);
    this.excludeFields = new Set(
      options?.excludeFields || ["id", "createdAt", "updatedAt"],
    );
    this.includeFields = options?.includeFields
      ? new Set(options.includeFields)
      : undefined;
    this.customFields = new Map(Object.entries(options?.customFields || {}));
  }

  /**
   * Build field schema from field metadata
   */
  private buildFieldSchema(fieldMeta: any): FormFieldConfig {
    // Check if custom field config exists
    if (this.customFields.has(fieldMeta.name)) {
      return this.customFields.get(fieldMeta.name)!;
    }

    const config: FormFieldConfig = {
      name: fieldMeta.name,
      title: fieldMeta.title || fieldMeta.name,
      required: fieldMeta.required || false,
    };

    // Map field type to form input type
    switch (fieldMeta.type) {
      case "string":
        config.type = "text";
        break;
      case "email":
        config.type = "email";
        break;
      case "url":
        config.type = "url";
        break;
      case "password":
        config.type = "password";
        break;
      case "text":
      case "richtext":
        config.type = "textarea";
        break;
      case "number":
      case "integer":
        config.type = "number";
        break;
      case "date":
        config.type = "date";
        break;
      case "datetime":
        config.type = "date";
        break;
      case "select":
        config.type = "select";
        config.options = fieldMeta.options || [];
        break;
      case "checkbox":
        config.type = "checkbox";
        break;
      default:
        config.type = "text";
    }

    return config;
  }

  /**
   * Get fields to include in form
   */
  private getFormFields(): Array<any> {
    if (!this.metadata) {
      return [];
    }

    return this.metadata.fields.filter((field) => {
      // Skip excluded fields
      if (this.excludeFields.has(field.name)) {
        return false;
      }

      // Only include specified fields if includeFields is set
      if (this.includeFields && !this.includeFields.has(field.name)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Generate Formily JSON schema
   */
  generateSchema(): FormSchema {
    const fields = this.getFormFields();
    const properties: Record<string, any> = {};
    const required: string[] = [];

    fields.forEach((fieldMeta) => {
      const fieldSchema = this.buildFieldSchema(fieldMeta);

      properties[fieldSchema.name] = {
        type: this.mapToJsonType(fieldSchema.type),
        title: fieldSchema.title,
        description: fieldSchema.description,
        default: fieldSchema.defaultValue,
        "x-component": this.mapToComponent(fieldSchema.type),
        "x-component-props": {
          placeholder: fieldSchema.placeholder,
          disabled: fieldSchema.disabled,
          readOnly: fieldSchema.readonly,
          options: fieldSchema.options,
        },
      };

      if (fieldSchema.required) {
        required.push(fieldSchema.name);
      }
    });

    return {
      type: "object",
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }

  /**
   * Map form field type to JSON schema type
   */
  private mapToJsonType(
    fieldType: string,
  ): "string" | "number" | "boolean" | "object" {
    switch (fieldType) {
      case "number":
        return "number";
      case "checkbox":
        return "boolean";
      default:
        return "string";
    }
  }

  /**
   * Map form field type to Formily component name
   */
  private mapToComponent(fieldType: string): string {
    switch (fieldType) {
      case "text":
        return "Input";
      case "number":
        return "InputNumber";
      case "email":
        return "Input";
      case "password":
        return "Password";
      case "textarea":
        return "TextArea";
      case "date":
        return "DatePicker";
      case "select":
        return "Select";
      case "checkbox":
        return "Checkbox";
      case "url":
        return "Input";
      default:
        return "Input";
    }
  }

  /**
   * Generate form configuration for use with @formily/react
   */
  generateFormConfig(mode: "create" | "edit" | "view" = "create") {
    const schema = this.generateSchema();
    const readonly = mode === "view";

    return {
      version: "2.0",
      type: "object",
      properties: Object.entries(schema.properties || {}).reduce(
        (acc, [name, schemaField]) => {
          acc[name] = {
            ...schemaField,
            "x-component-props": {
              ...(schemaField as any)["x-component-props"],
              readOnly:
                readonly || (schemaField as any)["x-component-props"]?.readOnly,
            },
          };
          return acc;
        },
        {} as Record<string, any>,
      ),
    };
  }

  /**
   * Create a Formily Form instance
   */
  createForm(config?: DynamicFormConfig) {
    const schema = this.generateFormConfig(config?.mode || "create");
    const mode = config?.mode || "create";

    const form = createForm({
      initialValues: config?.initialValues || {},
      validateFirst: true,
      effects: () => {
        // Custom validation effects can be added here
      },
    });

    return {
      form,
      schema,
      validateAsync: async (values: any) => {
        if (!this.metadata) return { isValid: true };

        const errors = SchemaValidator.validateRecord(values, this.metadata);
        return {
          isValid: Object.keys(errors).length === 0,
          errors,
        };
      },
      submit: async (values: any) => {
        const validation = await this.validateAsync(values);
        if (!validation.isValid) {
          throw new Error("Validation failed");
        }

        if (config?.onSubmit) {
          await config.onSubmit(values);
        }

        return values;
      },
    };
  }

  /**
   * Add custom field configuration
   */
  addField(name: string, config: FormFieldConfig): void {
    this.customFields.set(name, config);
  }

  /**
   * Remove field from form
   */
  removeField(name: string): void {
    this.excludeFields.add(name);
  }

  /**
   * Get field configuration
   */
  getField(name: string): FormFieldConfig | undefined {
    if (this.customFields.has(name)) {
      return this.customFields.get(name);
    }

    const fields = this.getFormFields();
    const fieldMeta = fields.find((f) => f.name === name);
    return fieldMeta ? this.buildFieldSchema(fieldMeta) : undefined;
  }

  /**
   * Get all field configurations
   */
  getAllFields(): FormFieldConfig[] {
    return this.getFormFields().map((fieldMeta) =>
      this.buildFieldSchema(fieldMeta),
    );
  }

  /**
   * Export configuration as JSON
   */
  export() {
    return {
      collectionName: this.collectionName,
      schema: this.generateSchema(),
      fields: this.getAllFields(),
      customFields: Array.from(this.customFields.entries()),
      excludeFields: Array.from(this.excludeFields),
      includeFields: this.includeFields
        ? Array.from(this.includeFields)
        : undefined,
    };
  }
}

/**
 * React hook for form building
 */
export function useDynamicForm(config: DynamicFormConfig) {
  const builder = useMemo(
    () =>
      new DynamicFormBuilder(config.collectionName, {
        excludeFields: config.excludeFields,
        includeFields: config.includeFields,
        customFields: config.customFields,
      }),
    [
      config.collectionName,
      config.excludeFields,
      config.includeFields,
      config.customFields,
    ],
  );

  const { form, schema, validateAsync, submit } = useMemo(
    () => builder.createForm(config),
    [builder, config],
  );

  const handleSubmit = useCallback(
    async (values: any) => {
      try {
        await submit(values);
      } catch (error) {
        throw error;
      }
    },
    [submit],
  );

  return {
    form,
    schema,
    builder,
    validateAsync,
    submit: handleSubmit,
    fields: builder.getAllFields(),
    getField: (name: string) => builder.getField(name),
    addField: (name: string, config: FormFieldConfig) =>
      builder.addField(name, config),
    removeField: (name: string) => builder.removeField(name),
  };
}

export default DynamicFormBuilder;
