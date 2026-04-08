/**
 * Form Field Dependencies
 * Manage field visibility and conditional properties based on form state
 * Pattern adapted from NocoBase's FormActiveFieldsProvider & field dependencies
 */

"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  ReactNode,
  FC,
  useRef,
  useEffect,
} from "react";

export interface FieldDependency {
  field: string;
  dependsOn: string[];
  condition?: (formValues: Record<string, any>) => boolean;
  effects?: {
    visible?: (formValues: Record<string, any>) => boolean;
    disabled?: (formValues: Record<string, any>) => boolean;
    required?: (formValues: Record<string, any>) => boolean;
    value?: (formValues: Record<string, any>) => any;
  };
}

export interface FormFieldDependenciesContextValue {
  addActiveFieldName(fieldName: string): void;
  removeActiveFieldName(fieldName: string): void;
  getActiveFieldsName(prefix?: string): string[];
  isFieldActive(fieldName: string): boolean;

  // Dependencies
  setDependencies(dependencies: FieldDependency[]): void;
  getDependencies(fieldName?: string): FieldDependency[];
  isFieldVisible(fieldName: string, formValues: Record<string, any>): boolean;
  isFieldDisabled(fieldName: string, formValues: Record<string, any>): boolean;
  isFieldRequired(fieldName: string, formValues: Record<string, any>): boolean;
  getFieldValue(fieldName: string, formValues: Record<string, any>): any;

  // Batch operations
  getFieldsWithDependencies(
    formValues: Record<string, any>
  ): Record<
    string,
    {
      visible: boolean;
      disabled: boolean;
      required: boolean;
    }
  >;
}

const FormFieldDependenciesContext =
  createContext<FormFieldDependenciesContextValue | null>(null);

export interface FormFieldDependenciesProviderProps {
  name: string;
  dependencies?: FieldDependency[];
  children: ReactNode;
}

/**
 * Provider for form field dependencies
 */
export const FormFieldDependenciesProvider: FC<
  FormFieldDependenciesProviderProps
> = ({ name, dependencies = [], children }) => {
  const activeFieldsRef = useRef<Set<string>>(new Set());
  const [deps, setDeps] = useState<FieldDependency[]>(dependencies);
  const [, setRenderCount] = useState(0);

  // Rebuild on dependency change
  useEffect(() => {
    setDeps(dependencies);
  }, [dependencies]);

  const addActiveFieldName = useCallback((fieldName: string) => {
    activeFieldsRef.current.add(fieldName);
    setRenderCount(prev => prev + 1);
  }, []);

  const removeActiveFieldName = useCallback((fieldName: string) => {
    activeFieldsRef.current.delete(fieldName);
    setRenderCount(prev => prev + 1);
  }, []);

  const getActiveFieldsName = useCallback((prefix?: string) => {
    const fields = Array.from(activeFieldsRef.current);
    if (prefix) {
      return fields.filter(f => f.startsWith(prefix));
    }
    return fields;
  }, []);

  const isFieldActive = useCallback((fieldName: string) => {
    return activeFieldsRef.current.has(fieldName);
  }, []);

  const setDependencies = useCallback((newDeps: FieldDependency[]) => {
    setDeps(newDeps);
  }, []);

  const getDependencies = useCallback(
    (fieldName?: string): FieldDependency[] => {
      if (fieldName) {
        return deps.filter(
          d => d.field === fieldName || d.dependsOn.includes(fieldName)
        );
      }
      return deps;
    },
    [deps]
  );

  const isFieldVisible = useCallback(
    (fieldName: string, formValues: Record<string, any>): boolean => {
      const dep = deps.find(d => d.field === fieldName);
      if (!dep) return true; // Default to visible if no dependency

      // Check custom condition
      if (dep.condition && !dep.condition(formValues)) {
        return false;
      }

      // Check visibility effect
      if (dep.effects?.visible) {
        return dep.effects.visible(formValues);
      }

      return true;
    },
    [deps]
  );

  const isFieldDisabled = useCallback(
    (fieldName: string, formValues: Record<string, any>): boolean => {
      const dep = deps.find(d => d.field === fieldName);
      if (!dep || !dep.effects?.disabled) return false;

      return dep.effects.disabled(formValues);
    },
    [deps]
  );

  const isFieldRequired = useCallback(
    (fieldName: string, formValues: Record<string, any>): boolean => {
      const dep = deps.find(d => d.field === fieldName);
      if (!dep || !dep.effects?.required) return false;

      return dep.effects.required(formValues);
    },
    [deps]
  );

  const getFieldValue = useCallback(
    (fieldName: string, formValues: Record<string, any>): any => {
      const dep = deps.find(d => d.field === fieldName);
      if (!dep || !dep.effects?.value) {
        return formValues[fieldName];
      }

      return dep.effects.value(formValues);
    },
    [deps]
  );

  const getFieldsWithDependencies = useCallback(
    (
      formValues: Record<string, any>
    ): Record<
      string,
      {
        visible: boolean;
        disabled: boolean;
        required: boolean;
      }
    > => {
      const result: Record<
        string,
        {
          visible: boolean;
          disabled: boolean;
          required: boolean;
        }
      > = {};

      for (const dep of deps) {
        result[dep.field] = {
          visible: isFieldVisible(dep.field, formValues),
          disabled: isFieldDisabled(dep.field, formValues),
          required: isFieldRequired(dep.field, formValues),
        };
      }

      return result;
    },
    [deps, isFieldVisible, isFieldDisabled, isFieldRequired]
  );

  const value = useMemo<FormFieldDependenciesContextValue>(
    () => ({
      addActiveFieldName,
      removeActiveFieldName,
      getActiveFieldsName,
      isFieldActive,
      setDependencies,
      getDependencies,
      isFieldVisible,
      isFieldDisabled,
      isFieldRequired,
      getFieldValue,
      getFieldsWithDependencies,
    }),
    [
      addActiveFieldName,
      removeActiveFieldName,
      getActiveFieldsName,
      isFieldActive,
      setDependencies,
      getDependencies,
      isFieldVisible,
      isFieldDisabled,
      isFieldRequired,
      getFieldValue,
      getFieldsWithDependencies,
    ]
  );

  return (
    <FormFieldDependenciesContext.Provider value={value}>
      {children}
    </FormFieldDependenciesContext.Provider>
  );
};

/**
 * Hook to use form field dependencies
 */
export function useFormFieldDependencies(): FormFieldDependenciesContextValue {
  const context = useContext(FormFieldDependenciesContext);
  if (!context) {
    throw new Error(
      "useFormFieldDependencies must be used within FormFieldDependenciesProvider"
    );
  }
  return context;
}

/**
 * Hook to track field visibility
 */
export function useFieldVisibility(
  fieldName: string,
  formValues: Record<string, any>
): boolean {
  const { isFieldVisible } = useFormFieldDependencies();
  return isFieldVisible(fieldName, formValues);
}

/**
 * Hook to track field state
 */
export function useFieldState(
  fieldName: string,
  formValues: Record<string, any>
) {
  const {
    isFieldVisible,
    isFieldDisabled,
    isFieldRequired,
    getFieldValue,
  } = useFormFieldDependencies();

  return useMemo(
    () => ({
      visible: isFieldVisible(fieldName, formValues),
      disabled: isFieldDisabled(fieldName, formValues),
      required: isFieldRequired(fieldName, formValues),
      value: getFieldValue(fieldName, formValues),
    }),
    [
      fieldName,
      formValues,
      isFieldVisible,
      isFieldDisabled,
      isFieldRequired,
      getFieldValue,
    ]
  );
}

/**
 * Hook to register field as active
 */
export function useRegisterActiveField(fieldName: string) {
  const { addActiveFieldName, removeActiveFieldName } =
    useFormFieldDependencies();

  useEffect(() => {
    addActiveFieldName(fieldName);
    return () => removeActiveFieldName(fieldName);
  }, [fieldName, addActiveFieldName, removeActiveFieldName]);
}

/**
 * Factory to define field dependencies for a collection
 */
export class FieldDependencyBuilder {
  private dependencies: Map<string, FieldDependency> = new Map();

  /**
   * Add field dependency
   */
  addDependency(
    fieldName: string,
    dependsOn: string[],
    config: Omit<FieldDependency, "field" | "dependsOn">
  ): this {
    this.dependencies.set(fieldName, {
      field: fieldName,
      dependsOn,
      ...config,
    });
    return this;
  }

  /**
   * Add conditional visibility
   */
  addVisibility(
    fieldName: string,
    dependsOn: string[],
    condition: (values: Record<string, any>) => boolean
  ): this {
    const existing = this.dependencies.get(fieldName) || {
      field: fieldName,
      dependsOn,
    };

    this.dependencies.set(fieldName, {
      ...existing,
      effects: {
        ...existing.effects,
        visible: condition,
      },
    });

    return this;
  }

  /**
   * Add conditional disable
   */
  addDisabled(
    fieldName: string,
    dependsOn: string[],
    condition: (values: Record<string, any>) => boolean
  ): this {
    const existing = this.dependencies.get(fieldName) || {
      field: fieldName,
      dependsOn,
    };

    this.dependencies.set(fieldName, {
      ...existing,
      effects: {
        ...existing.effects,
        disabled: condition,
      },
    });

    return this;
  }

  /**
   * Add conditional required
   */
  addRequired(
    fieldName: string,
    dependsOn: string[],
    condition: (values: Record<string, any>) => boolean
  ): this {
    const existing = this.dependencies.get(fieldName) || {
      field: fieldName,
      dependsOn,
    };

    this.dependencies.set(fieldName, {
      ...existing,
      effects: {
        ...existing.effects,
        required: condition,
      },
    });

    return this;
  }

  /**
   * Build dependencies array
   */
  build(): FieldDependency[] {
    return Array.from(this.dependencies.values());
  }

  /**
   * Export as map
   */
  export(): Map<string, FieldDependency> {
    return new Map(this.dependencies);
  }
}

export default useFormFieldDependencies;
