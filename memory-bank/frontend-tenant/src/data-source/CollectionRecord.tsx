/**
 * Collection Record
 * Immutable record representation with parent/child hierarchy support
 * Pattern adapted from NocoBase's CollectionRecord & CollectionRecordProvider
 */

"use client";

import {
  createContext,
  useContext,
  useMemo,
  ReactNode,
  FC,
  useCallback,
} from "react";

/**
 * Record with optional parent hierarchy
 */
export class CollectionRecord<DataType = any, ParentDataType = any> {
  public readonly data?: DataType;
  public readonly parentRecord?: CollectionRecord<ParentDataType>;
  public readonly isNew?: boolean;
  public readonly collectionName: string;
  private readonly changeset: Map<string, any> = new Map();

  constructor(options: {
    data?: DataType;
    parentRecord?: CollectionRecord<ParentDataType>;
    isNew?: boolean;
    collectionName: string;
  }) {
    this.data = options.data;
    this.parentRecord = options.parentRecord;
    this.isNew = options.isNew || !options.data;
    this.collectionName = options.collectionName;
  }

  /**
   * Get field value
   */
  get<K extends keyof DataType>(fieldName: K): DataType[K] | undefined {
    return this.data?.[fieldName];
  }

  /**
   * Create modified copy with new data
   */
  setData(data: Partial<DataType>): CollectionRecord<DataType, ParentDataType> {
    return new CollectionRecord({
      data: { ...this.data, ...data } as DataType,
      parentRecord: this.parentRecord,
      isNew: this.isNew,
      collectionName: this.collectionName,
    });
  }

  /**
   * Set parent record
   */
  setParentRecord(
    parentRecord: CollectionRecord<ParentDataType> | undefined
  ): CollectionRecord<DataType, ParentDataType> {
    return new CollectionRecord({
      data: this.data,
      parentRecord,
      isNew: this.isNew,
      collectionName: this.collectionName,
    });
  }

  /**
   * Get parent record
   */
  getParentRecord(): CollectionRecord<ParentDataType> | undefined {
    return this.parentRecord;
  }

  /**
   * Get parent data
   */
  getParentData(): ParentDataType | undefined {
    return this.parentRecord?.data;
  }

  /**
   * Get root ancestor record
   */
  getRootRecord(): CollectionRecord {
    let current: CollectionRecord = this;
    while (current.parentRecord) {
      current = current.parentRecord as CollectionRecord;
    }
    return current;
  }

  /**
   * Get all ancestors
   */
  getAncestors(): CollectionRecord[] {
    const ancestors: CollectionRecord[] = [];
    let current = this.parentRecord;

    while (current) {
      ancestors.push(current);
      current = current.parentRecord as CollectionRecord;
    }

    return ancestors.reverse();
  }

  /**
   * Track field change
   */
  trackChange(fieldName: string, value: any): void {
    this.changeset.set(fieldName, value);
  }

  /**
   * Get tracked changes
   */
  getChanges(): Record<string, any> {
    const result: Record<string, any> = {};
    this.changeset.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  /**
   * Clear tracked changes
   */
  clearChanges(): void {
    this.changeset.clear();
  }

  /**
   * Check if record is new
   */
  isNewRecord(): boolean {
    return this.isNew || false;
  }

  /**
   * Get breadcrumb path of collections
   */
  getBreadcrumbPath(): string[] {
    const path: string[] = [this.collectionName];
    let current = this.parentRecord;

    while (current) {
      path.unshift(current.collectionName);
      current = current.parentRecord as CollectionRecord;
    }

    return path;
  }

  /**
   * Export record data
   */
  export(): {
    data?: DataType;
    parentData?: ParentDataType;
    collectionName: string;
    isNew: boolean;
  } {
    return {
      data: this.data,
      parentData: this.parentRecord?.data,
      collectionName: this.collectionName,
      isNew: this.isNew || false,
    };
  }
}

/**
 * Collection record context
 */
interface CollectionRecordContextValue<DataType = any, ParentDataType = any> {
  record: CollectionRecord<DataType, ParentDataType>;
  data: DataType | undefined;
  parentRecord: CollectionRecord<ParentDataType> | undefined;
  parentData: ParentDataType | undefined;
  isNew: boolean;
}

const CollectionRecordContext =
  createContext<CollectionRecordContextValue | null>(null);

export interface CollectionRecordProviderProps<DataType = any, ParentDataType = any> {
  record: CollectionRecord<DataType, ParentDataType>;
  children: ReactNode;
}

/**
 * Provider for collection record context
 */
export const CollectionRecordProvider: FC<CollectionRecordProviderProps> = ({
  record,
  children,
}) => {
  const value = useMemo<CollectionRecordContextValue>(
    () => ({
      record,
      data: record.data,
      parentRecord: record.getParentRecord(),
      parentData: record.getParentData(),
      isNew: record.isNewRecord(),
    }),
    [record]
  );

  return (
    <CollectionRecordContext.Provider value={value}>
      {children}
    </CollectionRecordContext.Provider>
  );
};

/**
 * Hook to use collection record
 */
export function useCollectionRecord<DataType = any, ParentDataType = any>(): CollectionRecord<DataType, ParentDataType> {
  const context = useContext(CollectionRecordContext);
  if (!context) {
    throw new Error(
      "useCollectionRecord must be used within CollectionRecordProvider"
    );
  }
  return context.record as CollectionRecord<DataType, ParentDataType>;
}

/**
 * Hook to use collection record data
 */
export function useCollectionRecordData<DataType = any>(): DataType | undefined {
  const context = useContext(CollectionRecordContext);
  if (!context) {
    return undefined;
  }
  return context.data as DataType;
}

/**
 * Hook to use parent record
 */
export function useCollectionParentRecord<ParentDataType = any>(): CollectionRecord<ParentDataType> | undefined {
  const context = useContext(CollectionRecordContext);
  return context?.parentRecord as CollectionRecord<ParentDataType> | undefined;
}

/**
 * Hook to use parent data
 */
export function useCollectionParentData<ParentDataType = any>(): ParentDataType | undefined {
  const context = useContext(CollectionRecordContext);
  return context?.parentData as ParentDataType;
}

/**
 * Hook to check if record is new
 */
export function useIsNewRecord(): boolean {
  const context = useContext(CollectionRecordContext);
  return context?.isNew || false;
}

/**
 * Hook to get record ancestors
 */
export function useCollectionAncestors(): CollectionRecord[] {
  const record = useCollectionRecord();
  return useMemo(() => record.getAncestors(), [record]);
}

/**
 * Hook to get record breadcrumb path
 */
export function useCollectionBreadcrumb(): string[] {
  const record = useCollectionRecord();
  return useMemo(() => record.getBreadcrumbPath(), [record]);
}

/**
 * Hook to track field changes in record
 */
export function useRecordFieldChange(fieldName: string) {
  const record = useCollectionRecord();

  const trackChange = useCallback(
    (value: any) => {
      record.trackChange(fieldName, value);
    },
    [record, fieldName]
  );

  return {
    trackChange,
    value: record.get(fieldName),
  };
}

/**
 * Factory for creating new records
 */
export class RecordFactory {
  /**
   * Create new record
   */
  static createNew<DataType = any>(
    collectionName: string,
    initialData?: Partial<DataType>,
    parentRecord?: CollectionRecord
  ): CollectionRecord<DataType> {
    return new CollectionRecord<DataType>({
      data: initialData as DataType,
      parentRecord,
      isNew: true,
      collectionName,
    });
  }

  /**
   * Create existing record
   */
  static createExisting<DataType = any>(
    collectionName: string,
    data: DataType,
    parentRecord?: CollectionRecord
  ): CollectionRecord<DataType> {
    return new CollectionRecord<DataType>({
      data,
      parentRecord,
      isNew: false,
      collectionName,
    });
  }

  /**
   * Clone record
   */
  static clone<DataType = any, ParentDataType = any>(
    record: CollectionRecord<DataType, ParentDataType>
  ): CollectionRecord<DataType, ParentDataType> {
    return new CollectionRecord<DataType, ParentDataType>({
      data: record.data ? { ...record.data } : undefined,
      parentRecord: record.parentRecord,
      isNew: record.isNew,
      collectionName: record.collectionName,
    });
  }

  /**
   * Create record with parent
   */
  static createWithParent<DataType = any, ParentDataType = any>(
    collectionName: string,
    data: DataType,
    parentRecord: CollectionRecord<ParentDataType>
  ): CollectionRecord<DataType, ParentDataType> {
    return new CollectionRecord<DataType, ParentDataType>({
      data,
      parentRecord,
      isNew: false,
      collectionName,
    });
  }
}

export default CollectionRecord;
