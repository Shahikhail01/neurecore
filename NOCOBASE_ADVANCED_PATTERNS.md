# NocoBase Advanced Patterns - Production Code Reference

## 1. Operation Queue/Batch Processing

### Files

- [packages/core/client/src/api-client/APIClient.ts](packages/core/client/src/api-client/APIClient.ts)
- [packages/core/client/src/api-client/hooks/useRequest.ts](packages/core/client/src/api-client/hooks/useRequest.ts)
- [packages/core/client/src/api-client/hooks/useResource.ts](packages/core/client/src/api-client/hooks/useResource.ts)

### Key Classes/Hooks

- **APIClient** - Main API client with error handling and notification middleware
- **useRequest<P>()** - Hook for handling service requests with caching and state management
- **useResource(name, of)** - Simple hook for resource access

### Core Functionality

- **Error Caching Pattern**: Uses a Map to deduplicate error messages within 500ms windows
- **Service Caching**: `APIClient.services` stores service results by UID
- **Request Batching**: ahooks `useRequest` handles request deduplication and batching
- **State Management**: `useSetState()` for independent state management alongside request state

### Important Code Snippets

#### Error Deduplication Pattern:

```typescript
const errorCache = new Map();

// In notification middleware
const errs = errs.filter((error) => {
  const lastTime = errorCache.get(error.message);
  if (lastTime && new Date().getTime() - lastTime < 500) {
    return false; // Skip if duplicate within 500ms
  }
  errorCache.set(error.message, new Date().getTime());
  return true;
});
```

#### Service Caching Pattern:

```typescript
class APIClient {
  services: Record<string, Result<any, any>> = {};

  // Service is stored by UID
  onSuccess(...args) {
    if (options.uid) {
      api.services[options.uid] = result;
    }
  }
}
```

#### Request Hook with State:

```typescript
export function useRequest<P>(
  service: UseRequestService<P>,
  options: UseRequestOptions = {},
): UseRequestResult<P> {
  const [state, setState] = useSetState({});
  const api = useAPIClient();

  const result = useReq<P, any>(tempService, tempOptions);
  return useMemo(() => {
    return { ...result, state, setState };
  }, [result, setState, state]);
}
```

---

## 2. Change Detection/Tracking

### Files

- [packages/core/client/src/block-provider/FormBlockProvider.tsx](packages/core/client/src/block-provider/FormBlockProvider.tsx)
- [packages/core/client/src/block-provider/DetailsBlockProvider.tsx](packages/core/client/src/block-provider/DetailsBlockProvider.tsx)
- [packages/core/client/src/block-provider/hooks/index.ts](packages/core/client/src/block-provider/hooks/index.ts) (71KB - contains action handlers)

### Key Classes/Hooks

- **FormBlockContext** - Context for form block state with form instance
- **useFormBlockContext()** - Access form block context
- **useCollectValuesToSubmit()** - Collects form values for submission
- **useCreateActionProps()** - Props for create action with validation
- **useUpdateActionProps()** - Props for update action
- **useCustomizeUpdateActionProps()** - Custom update with change tracking
- **useCustomizeBulkUpdateActionProps()** - Bulk update with change tracking

### Core Functionality

- **Form State Management**: Uses Formily `createForm` with validation first strategy
- **Change Tracking**: Form instances track initial values vs current values
- **Read-Only State**: `readPretty` prop controls read-only rendering
- **Dirty State**: Form maintains dirty flag through Formily's core
- **Association Value Updates**: Context provides `updateAssociationValues` for related records

### Important Code Pattern - FormBlockProvider Structure:

```typescript
export const FormBlockContext = createContext<{
  form?: any;
  type?: "update" | "create";
  action?: string;
  field?: any;
  service?: any;
  resource?: any;
  updateAssociationValues?: any;
  formBlockRef?: any;
  collectionName?: string;
  params?: any;
  formRecord?: CollectionRecord;
}>({});

const form = useMemo(
  () =>
    createForm({
      validateFirst: true, // Validate entire form before submission
      readPretty, // Read-only mode
    }),
  [readPretty],
);
```

### Available Action Props Hooks (from index.ts):

- `useCollectValuesToSubmit()` - Collect form values for submission
- `useCreateActionProps()` - New record creation
- `useUpdateActionProps()` - Record update
- `useDestroyActionProps()` - Record deletion
- `useBulkDestroyActionProps()` - Bulk deletion
- `useRefreshActionProps()` - Refresh data
- `useCustomizeUpdateActionProps()` - Custom update with validation
- `useCustomizeBulkUpdateActionProps()` - Custom bulk update

---

## 3. Record Context Patterns

### Files

- [packages/core/client/src/data-source/collection-record/CollectionRecord.ts](packages/core/client/src/data-source/collection-record/CollectionRecord.ts)
- [packages/core/client/src/data-source/collection-record/CollectionRecordProvider.tsx](packages/core/client/src/data-source/collection-record/CollectionRecordProvider.tsx)

### Key Classes/Interfaces

- **CollectionRecord<DataType, ParentDataType>** - Represents a record with parent hierarchy
- **CollectionRecordContext** - React context for record data
- **CollectionRecordProvider** - Provider component

### Core Functionality

- **Record Hierarchy**: Records can have parent records forming a chain
- **Type-Safe Records**: Generic typing for data and parent data
- **Record State**: `isNew` flag, mutable data storage
- **Parent Record Linkage**: Maintains reference to parent for access to parent data

### Important Code Snippets

#### CollectionRecord Class:

```typescript
export class CollectionRecord<DataType = any, ParentDataType = {}> {
  public data?: DataType;
  public parentRecord?: CollectionRecord<ParentDataType>;
  public isNew?: boolean;

  constructor(options: CollectionRecordOptions<DataType, ParentDataType>) {
    const { data, parentRecord, isNew } = options;
    this.isNew = isNew;
    this.data = data;
    this.parentRecord = parentRecord;
  }

  setData(data: DataType) {
    this.data = data;
  }

  setParentRecord(parentRecord: CollectionRecord<ParentDataType>) {
    this.parentRecord = parentRecord;
  }
}
```

#### CollectionRecordProvider Logic:

```typescript
export const CollectionRecordProvider: FC<CollectionRecordProviderProps> = React.memo(
  ({ isNew, record, parentRecord, children }) => {
    // Convert parent data to CollectionRecord instance
    const parentRecordValue = useMemo(() => {
      if (parentRecord) {
        if (parentRecord instanceof CollectionRecord) return parentRecord;
        return new CollectionRecord({ data: parentRecord });
      }
      if (record instanceof CollectionRecord) return record.parentRecord;
    }, [parentRecord, record]);

    // Convert current record to CollectionRecord instance
    const currentRecordValue = useMemo(() => {
      let res: CollectionRecord;
      if (record) {
        if (record instanceof CollectionRecord) {
          res = record;
          res.isNew = record.isNew || isNew;
        } else {
          res = new CollectionRecord({ data: record, isNew });
        }
      } else {
        res = new CollectionRecord({ isNew });
      }
      res.setParentRecord(parentRecordValue);
      return res;
    }, [record, parentRecordValue, isNew]);

    return (
      <CollectionRecordContext.Provider value={currentRecordValue}>
        {children}
      </CollectionRecordContext.Provider>
    );
  },
);
```

### Usage Hooks

- **useCollectionRecord<DataType, ParentDataType>()** - Get current record as CollectionRecord instance
- **useCollectionRecordData<DataType>()** - Get current record data
- **useCollectionParentRecord<ParentDataType>()** - Get parent record instance
- **useCollectionParentRecordData<ParentDataType>()** - Get parent record data

---

## 4. Block Provider Patterns

### 4.1 DataBlockProvider (New Pattern)

### Files

- [packages/core/client/src/data-source/data-block/DataBlockProvider.tsx](packages/core/client/src/data-source/data-block/DataBlockProvider.tsx)
- [packages/core/client/src/data-source/data-block/DataBlockRequestProvider.tsx](packages/core/client/src/data-source/data-block/DataBlockRequestProvider.tsx)
- [packages/core/client/src/data-source/data-block/DataBlockResourceProvider.tsx](packages/core/client/src/data-source/data-block/DataBlockResourceProvider.tsx)

### Key Classes/Hooks

- **DataBlockContext** - Context for block configuration
- **DataBlockProvider** - Main provider component (with HOC)
- **DataBlockRequestProvider** - Handles data fetching for blocks
- **DataBlockResourceProvider** - Provides API resource
- **useDataBlock<T>()** - Get block context
- **useDataBlockProps<T>()** - Get block props
- **useRerenderDataBlock()** - Force block rerender

### Core Functionality

- **Type-Safe Props**: Union types for different block operations (list, get, create)
- **Multi-Type Support**: Collections, Associations, Records
- **Action Modes**: 'list', 'get', 'create'
- **Parent Record Context**: Supports nested record hierarchies
- **Optimized Re-rendering**: `RerenderDataBlockProvider` prevents unnecessary updates

### Important Code Patterns

#### DataBlockProvider Composition:

```typescript
export const DataBlockProvider: FC<Partial<AllDataBlockProps>> = withDynamicSchemaProps(
  React.memo((props) => {
    const { collection, association, dataSource, children, hidden, ...resets } = props;
    const { dn } = useDesignable();
    const fieldSchema = useFieldSchema();

    if (hidden) return null;

    return (
      <VariableScope scopeId={fieldSchema?.['x-uid']} type="dataBlock">
        <DataBlockContext.Provider value={{ dn, props: { ...resets, collection, association, dataSource } }}>
          <CollectionManagerProvider dataSource={dataSource}>
            <AssociationOrCollectionProvider collection={collection} association={association}>
              <ACLCollectionProvider>
                <BlockLinkageRuleProvider>
                  <DataBlockResourceProvider>
                    <BlockRequestProvider>
                      <DataBlockCollector params={props.params}>
                        <RerenderDataBlockProvider>
                          {children}
                        </RerenderDataBlockProvider>
                      </DataBlockCollector>
                    </BlockRequestProvider>
                  </DataBlockResourceProvider>
                </BlockLinkageRuleProvider>
              </ACLCollectionProvider>
            </AssociationOrCollectionProvider>
          </CollectionManagerProvider>
        </DataBlockContext.Provider>
      </VariableScope>
    );
  }),
);
```

#### DataBlockResourceProvider Pattern:

```typescript
export const DataBlockResourceProvider: FC<{ children?: ReactNode }> = ({ children }) => {
  const dataBlockProps = useDataBlockProps();
  const cm = useCollectionManager();
  const { association, collection, dataSource, sourceId, parentRecord } = dataBlockProps;
  const api = useAPIClient();
  const headers = useDataSourceHeaders(dataSource);

  const resource = useMemo(() => {
    if (association) {
      return api.resource(association, sourceIdValue, headers, !sourceIdValue);
    }
    return api.resource(collectionName, undefined, headers);
  }, [api, association, collection, sourceIdValue, headers]);

  return (
    <DataBlockResourceContext.Provider value={resource}>
      {children}
    </DataBlockResourceContext.Provider>
  );
};
```

#### BlockRequestProvider Pattern - Change Detection:

```typescript
function useRecordRequest<T>(options: Omit<AllDataBlockProps, "type">) {
  const {
    action,
    params = {},
    record,
    requestService,
    requestOptions,
    sourceId,
    association,
    parentRecord,
  } = options;
  const [JSONParams, JSONRecord] = useMemo(
    () => [JSON.stringify(params), JSON.stringify(record)],
    [params, record],
  );

  const request = useRequest<T>(service, {
    ...requestOptions,
    manual: dataLoadingMode === "manual",
    ready: !!action,
    refreshDeps: [
      action,
      JSONParams,
      JSONRecord,
      resource,
      association,
      parentRecord,
      sourceId,
    ],
    // JSON stringified deps detect changes in nested objects
  });

  return request;
}
```

### 4.2 FormBlockProvider

### Files

- [packages/core/client/src/block-provider/FormBlockProvider.tsx](packages/core/client/src/block-provider/FormBlockProvider.tsx)

### Key Features

- **Type System**: Distinguishes between 'update' and 'create' forms
- **Form Instance**: Creates one Formily form per block
- **Read-Only Support**: Controlled via `readPretty` prop
- **Record Context**: Provides `formRecord` as `CollectionRecord`
- **Association Updates**: Tracks updates to associated records

### Code Pattern:

```typescript
const form = useMemo(
  () =>
    createForm({
      validateFirst: true,
      readPretty,
    }),
  [readPretty],
);

const formBlockValue: any = useMemo(() => {
  return {
    ...ctx,
    params,
    action,
    form,
    type: action === "get" ? "update" : "create", // Determine form type
    field,
    service,
    resource,
    updateAssociationValues,
    formBlockRef,
    collectionName: collection || cm.getCollectionField(association)?.target,
    formRecord: record, // CollectionRecord instance
  };
}, [
  action,
  association,
  cm,
  collection,
  ctx,
  field,
  form,
  params,
  record,
  resource,
  service,
  updateAssociationValues,
]);
```

### 4.3 TableBlockProvider

### Files

- [packages/core/client/src/block-provider/TableBlockProvider.tsx](packages/core/client/src/block-provider/TableBlockProvider.tsx)

### Key Features

- **Tree Table Support**: Handles hierarchical data with `childrenColumnName`
- **Drag Sort Support**: Tracks sort column and enabled state
- **Index Column**: Optional row numbering
- **Expand State Management**: Tracks expanded rows for tree tables
- **Basic Value Separation**: Splits context into two to prevent unnecessary re-renders

### Code Pattern:

```typescript
// Split from value to prevent unnecessary re-renders
const basicValue = useMemo(
  () => ({
    field,
    rowKey,
    childrenColumnName,
    showIndex,
    dragSort,
    dragSortBy: props.dragSortBy,
  }),
  [field, rowKey, childrenColumnName, showIndex, dragSort, props.dragSortBy],
);

const value = useMemo(
  () => ({
    collection,
    field,
    service,
    resource,
    params,
    showIndex,
    dragSort,
    rowKey,
    expandFlag,
    childrenColumnName,
    allIncludesChildren,
    setExpandFlag: setExpandFlagValue,
    heightProps,
    association,
    enableIndexColumn,
  }),
  [
    allIncludesChildren,
    childrenColumnName,
    collection,
    dragSort,
    expandFlag,
    field,
    heightProps,
    params,
    resource,
    rowKey,
    service,
    setExpandFlagValue,
    showIndex,
    association,
    enableIndexColumn,
  ],
);
```

### 4.4 DetailsBlockProvider

### Files

- [packages/core/client/src/block-provider/DetailsBlockProvider.tsx](packages/core/client/src/block-provider/DetailsBlockProvider.tsx)

### Key Features

- **Read-Only Support**: Read-only forms via `readPretty`
- **Pagination Support**: For details with pagination
- **Single Record**: Extracts first record for list action, direct access for get
- **Form Management**: Creates form with reset and value management

### Code Pattern:

```typescript
const form = useMemo(
  () =>
    createForm({
      readPretty,
    }),
  [readPretty],
);

const currentRecord =
  (action === "list" ? service?.data?.data?.[0] : service?.data?.data) || {};

export const useDetailsBlockProps = () => {
  const ctx = useDetailsBlockContext();
  useEffect(() => {
    if (!ctx.service.loading) {
      const data =
        ctx.action === "list"
          ? ctx.service?.data?.data?.[0]
          : ctx.service?.data?.data;
      ctx.form
        .reset()
        .then(() => {
          ctx.form.setInitialValues(data || {});
          ctx.form.setValues(data || {});
        })
        .catch(console.error);
    }
  }, [ctx.action, ctx.form, ctx.service]);
};
```

---

## 5. Data Source Multi-Support Pattern

### Files

- [packages/core/client/src/data-source/data-source/DataSourceManager.ts](packages/core/client/src/data-source/data-source/DataSourceManager.ts)
- [packages/core/client/src/data-source/data-source/DataSource.ts](packages/core/client/src/data-source/data-source/DataSource.ts)
- [packages/core/client/src/data-source/data-source/DataSourceManagerProvider.tsx](packages/core/client/src/data-source/data-source/DataSourceManagerProvider.tsx)
- [packages/core/client/src/data-source/collection/CollectionManager.ts](packages/core/client/src/data-source/collection/CollectionManager.ts)

### Key Classes/Hooks

- **DataSourceManager** - Manages multiple data sources and their collections
- **DataSource** - Abstract base class for data sources
- **LocalDataSource** - In-memory data source implementation
- **CollectionManager** - Manages collections within a data source
- **useDataSourceManager()** - Access DataSourceManager context

### Core Functionality

- **Multi-Source Support**: Map of data sources by key
- **Dynamic Loading**: `addDataSources()` for dynamic/lazy loading
- **Collection Hierarchy**: Nested collection managers per data source
- **Mixin System**: Applies collection mixins for extensibility
- **Reload Callbacks**: Supports reload hooks for collections

### Important Code Snippets

#### DataSourceManager Multi-Source Pattern:

```typescript
export class DataSourceManager {
  protected dataSourceInstancesMap: Record<string, DataSource> = {};
  protected multiDataSources: [
    () => Promise<DataSourceOptions[]>,
    DataSourceFactory,
  ][] = [];
  public collectionMixins: (typeof Collection)[] = [];

  getDataSources(filterDataSource?: (dataSource: DataSource) => boolean) {
    const allDataSources = Object.values(this.dataSourceInstancesMap);
    return filterDataSource
      ? _.filter(allDataSources, filterDataSource)
      : allDataSources;
  }

  getDataSource(key?: string) {
    return key
      ? this.dataSourceInstancesMap[key]
      : this.dataSourceInstancesMap[DEFAULT_DATA_SOURCE_KEY];
  }

  addDataSource(DataSource: DataSourceFactory, options: DataSourceOptions) {
    const dataSourceInstance = new DataSource(options, this);
    this.dataSourceInstancesMap[dataSourceInstance.key] = dataSourceInstance;
    return dataSourceInstance;
  }

  async addDataSources(
    request: () => Promise<DataSourceOptions[]>,
    DataSource: DataSourceFactory,
  ) {
    if (
      this.multiDataSources.some(
        ([req, DS]) => req === request && DS === DataSource,
      )
    )
      return;
    this.multiDataSources.push([request, DataSource]);
  }

  async reload() {
    await Promise.all(
      this.multiDataSources.map(async ([request, DataSource]) => {
        const list = await request();
        list.map((options) => this.addDataSource(DataSource, options));
      }),
    );
    return Promise.all(
      this.getDataSources().map((dataSource) => dataSource.reload()),
    );
  }
}
```

#### DataSource Abstract Pattern:

```typescript
export abstract class DataSource {
  collectionManager: CollectionManager;
  protected reloadCallbacks: LoadCallback[] = [];

  constructor(
    protected options: DataSourceOptions,
    public dataSourceManager: DataSourceManager,
  ) {
    this.collectionManager = new CollectionManager(options.collections, this);
  }

  addReloadCallback(callback: LoadCallback) {
    if (this.reloadCallbacks.includes(callback)) return;
    this.reloadCallbacks.push(callback);
  }

  async reload() {
    const dataSource = await this.getDataSource();
    this.setOptions(dataSource);
    this.collectionManager.setCollections(dataSource.collections || []);
    this.reloadCallbacks.forEach((callback) =>
      callback(dataSource.collections),
    );
    return this.options;
  }

  abstract getDataSource(): Promise<Omit<Partial<DataSourceOptions>, "key">>;
}
```

#### CollectionManager Pattern:

```typescript
export class CollectionManager {
  public collectionInstancesMap: Record<string, Collection> = {};
  public collectionInstancesArr: Collection[] = [];

  getCollection<Mixins = {}>(
    path: SchemaKey | CollectionOptions,
  ): (Mixins & Collection) | undefined {
    if (!path) return undefined;

    if (typeof path === "object") {
      path.disableTranslation = true;
      return this.getCollectionInstance(path) as Mixins & Collection;
    }

    if (String(path).split(".").length > 1) {
      // Handle nested paths like 'users.profile.name'
      const associationField = this.getCollectionField(path);
      if (!associationField) return undefined;
      return this.getCollection(associationField.target);
    }

    return this.collectionInstancesMap[path] as Mixins & Collection;
  }

  getCollectionField(path: SchemaKey | CollectionFieldOptions) {
    if (!path) return;

    if (typeof path === "object") {
      return path;
    }

    if (String(path).split(".").length < 2) {
      console.error(`CollectionManager.getField() path "${path}" is invalid`);
      return;
    }

    const [collectionName, ...fieldNames] = String(path).split(".");
    const collection = this.getCollection(collectionName);
    if (!collection) {
      return;
    }
    return collection.getField(fieldNames.join("."));
  }
}
```

---

## Summary: Production Code Adaptation Guide

### For NeureCore Implementation:

1. **Operation Queuing**: Use Map-based deduplication with time windows for request batching
2. **Change Detection**: Use JSON.stringify of deps in useMemo for deep change detection; Formily's form instance tracks dirty state
3. **Record Hierarchy**: Implement parent-child record relationships with CollectionRecord pattern
4. **Block Providers**: Compose multiple providers (Data, Request, Resource) for flexibility
5. **Multi-Source Support**: Factory pattern with DataSourceManager for multi-tenant/multi-source handling

### Key Takeaways:

- NocoBase uses **Formily** for form state management (not direct form tracking)
- **Hierarchical record structures** enable parent-child relationships
- **Context composition** through multiple providers rather than one mega-context
- **Type-safe generics** for reusable components across different data types
- **JSON stringification** of deps for comparing complex objects in memoization
