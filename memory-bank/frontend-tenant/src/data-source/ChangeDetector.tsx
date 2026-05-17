/**
 * Change Detector
 * Track unsaved changes in forms and provide dirty state management
 * Pattern adapted from NocoBase's form change tracking and Formily dirty state
 */

"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  createContext,
  useContext,
  ReactNode,
  FC,
} from "react";

export interface FieldChange {
  field: string;
  before: any;
  after: any;
  isDirty: boolean;
}

export interface ChangeDetectorState {
  isDirty: boolean;
  changes: Map<string, FieldChange>;
  initialValues: Record<string, any>;
  currentValues: Record<string, any>;
  changedFields: string[];
  hasErrors: boolean;
}

export interface ChangeDetectorContextValue {
  state: ChangeDetectorState;
  track: (fieldName: string, newValue: any, oldValue: any) => void;
  reset: () => void;
  setInitialValues: (values: Record<string, any>) => void;
  getCurrentValues: () => Record<string, any>;
  getChanges: () => FieldChange[];
  isFieldDirty: (fieldName: string) => boolean;
  getFieldChange: (fieldName: string) => FieldChange | undefined;
  markAsSubmitted: () => void;
  markAsClean: () => void;
  subscribeToChanges: (callback: (changes: FieldChange[]) => void) => () => void;
}

const ChangeDetectorContext = createContext<ChangeDetectorContextValue | null>(null);

/**
 * Change detector service
 */
export class ChangeDetector {
  private initialValues: Record<string, any> = {};
  private currentValues: Record<string, any> = {};
  private changes: Map<string, FieldChange> = new Map();
  private subscribers: Set<(changes: FieldChange[]) => void> = new Set();
  private hasErrors = false;
  private isSubmitted = false;

  /**
   * Set initial values
   */
  setInitialValues(values: Record<string, any>): void {
    this.initialValues = { ...values };
    this.currentValues = { ...values };
    this.changes.clear();
    this.notifySubscribers();
  }

  /**
   * Track field change
   */
  track(fieldName: string, newValue: any, oldValue?: any): void {
    const initialValue = this.initialValues[fieldName];
    const isDirty = JSON.stringify(newValue) !== JSON.stringify(initialValue);

    if (isDirty) {
      this.changes.set(fieldName, {
        field: fieldName,
        before: oldValue !== undefined ? oldValue : initialValue,
        after: newValue,
        isDirty: true,
      });
    } else {
      this.changes.delete(fieldName);
    }

    this.currentValues[fieldName] = newValue;
    this.notifySubscribers();
  }

  /**
   * Reset to initial state
   */
  reset(): void {
    this.currentValues = { ...this.initialValues };
    this.changes.clear();
    this.hasErrors = false;
    this.isSubmitted = false;
    this.notifySubscribers();
  }

  /**
   * Get all changes
   */
  getChanges(): FieldChange[] {
    return Array.from(this.changes.values());
  }

  /**
   * Get change for specific field
   */
  getFieldChange(fieldName: string): FieldChange | undefined {
    return this.changes.get(fieldName);
  }

  /**
   * Check if field is dirty
   */
  isFieldDirty(fieldName: string): boolean {
    return this.changes.has(fieldName);
  }

  /**
   * Check if form is dirty
   */
  isDirty(): boolean {
    return this.changes.size > 0;
  }

  /**
   * Get all changed field names
   */
  getChangedFields(): string[] {
    return Array.from(this.changes.keys());
  }

  /**
   * Get current values
   */
  getCurrentValues(): Record<string, any> {
    return { ...this.currentValues };
  }

  /**
   * Get only changed values for submission
   */
  getChangedValues(): Record<string, any> {
    const result: Record<string, any> = {};
    this.changes.forEach((change, field) => {
      result[field] = change.after;
    });
    return result;
  }

  /**
   * Mark form as submitted
   */
  markAsSubmitted(): void {
    this.isSubmitted = true;
  }

  /**
   * Check if form is submitted
   */
  getIsSubmitted(): boolean {
    return this.isSubmitted;
  }

  /**
   * Set error state
   */
  setHasErrors(hasErrors: boolean): void {
    this.hasErrors = hasErrors;
  }

  /**
   * Check if form has errors
   */
  getHasErrors(): boolean {
    return this.hasErrors;
  }

  /**
   * Can submit (has changes and no errors)
   */
  canSubmit(): boolean {
    return this.isDirty() && !this.hasErrors;
  }

  /**
   * Subscribe to changes
   */
  subscribe(callback: (changes: FieldChange[]) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  /**
   * Notify all subscribers
   */
  private notifySubscribers(): void {
    const changes = this.getChanges();
    this.subscribers.forEach(callback => {
      callback(changes);
    });
  }

  /**
   * Export state
   */
  exportState(): ChangeDetectorState {
    return {
      isDirty: this.isDirty(),
      changes: new Map(this.changes),
      initialValues: { ...this.initialValues },
      currentValues: { ...this.currentValues },
      changedFields: this.getChangedFields(),
      hasErrors: this.hasErrors,
    };
  }

  /**
   * Import state
   */
  importState(state: ChangeDetectorState): void {
    this.initialValues = { ...state.initialValues };
    this.currentValues = { ...state.currentValues };
    this.changes = new Map(state.changes);
    this.hasErrors = state.hasErrors;
    this.notifySubscribers();
  }

  /**
   * Clear everything
   */
  clear(): void {
    this.initialValues = {};
    this.currentValues = {};
    this.changes.clear();
    this.hasErrors = false;
    this.isSubmitted = false;
  }
}

/**
 * Provider for change detection context
 */
export interface ChangeDetectorProviderProps {
  initialValues?: Record<string, any>;
  children: ReactNode;
}

export const ChangeDetectorProvider: FC<ChangeDetectorProviderProps> = ({
  initialValues = {},
  children,
}) => {
  const detectorRef = useRef(new ChangeDetector());
  const [, setRenderCount] = useState(0);

  const detector = detectorRef.current;

  useEffect(() => {
    detector.setInitialValues(initialValues);
  }, [initialValues, detector]);

  useEffect(() => {
    // Subscribe to changes to trigger re-renders
    const unsubscribe = detector.subscribe(() => {
      setRenderCount(prev => prev + 1);
    });

    return unsubscribe;
  }, [detector]);

  const value = useMemo<ChangeDetectorContextValue>(
    () => ({
      state: detector.exportState(),
      track: (fieldName, newValue, oldValue) => {
        detector.track(fieldName, newValue, oldValue);
      },
      reset: () => detector.reset(),
      setInitialValues: (values) => detector.setInitialValues(values),
      getCurrentValues: () => detector.getCurrentValues(),
      getChanges: () => detector.getChanges(),
      isFieldDirty: (fieldName) => detector.isFieldDirty(fieldName),
      getFieldChange: (fieldName) => detector.getFieldChange(fieldName),
      markAsSubmitted: () => detector.markAsSubmitted(),
      markAsClean: () => detector.reset(),
      subscribeToChanges: (callback) => detector.subscribe(callback),
    }),
    [detector]
  );

  return (
    <ChangeDetectorContext.Provider value={value}>
      {children}
    </ChangeDetectorContext.Provider>
  );
};

/**
 * Hook to use change detector
 */
export function useChangeDetector(): ChangeDetectorContextValue {
  const context = useContext(ChangeDetectorContext);
  if (!context) {
    throw new Error("useChangeDetector must be used within ChangeDetectorProvider");
  }
  return context;
}

/**
 * Hook to track field changes
 */
export function useTrackFieldChange(fieldName: string) {
  const { track, isFieldDirty, getFieldChange } = useChangeDetector();

  const handleChange = useCallback(
    (newValue: any, oldValue?: any) => {
      track(fieldName, newValue, oldValue);
    },
    [fieldName, track]
  );

  return {
    track: handleChange,
    isDirty: isFieldDirty(fieldName),
    change: getFieldChange(fieldName),
  };
}

/**
 * Hook to get form dirty state
 */
export function useFormDirtyState() {
  const { state, getChangedValues, canSubmit } = useChangeDetector();

  return {
    isDirty: state.isDirty,
    changedFields: state.changedFields,
    changes: state.changes,
    changedValues: getChangedValues(),
    canSubmit: canSubmit(),
    hasErrors: state.hasErrors,
  };
}

/**
 * Hook to handle form submission
 */
export function useFormSubmissionState() {
  const { state, markAsSubmitted, canSubmit, getChangedValues } = useChangeDetector();

  const handleSubmit = useCallback(async (onSubmit: (values: Record<string, any>) => Promise<void>) => {
    markAsSubmitted();

    if (!canSubmit()) {
      throw new Error("Form has errors or no changes");
    }

    const values = getChangedValues();
    await onSubmit(values);
  }, [markAsSubmitted, canSubmit, getChangedValues]);

  return {
    isSubmitted: state.isDirty,
    canSubmit: canSubmit(),
    changedValues: getChangedValues(),
    submit: handleSubmit,
  };
}

/**
 * Hook for unsaved changes warning
 */
export function useUnsavedChangesWarning(enabled = true) {
  const { state } = useChangeDetector();

  useEffect(() => {
    if (!enabled || !state.isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [enabled, state.isDirty]);

  return {
    hasUnsavedChanges: state.isDirty,
    changedFieldsCount: state.changedFields.length,
  };
}

export default ChangeDetector;
