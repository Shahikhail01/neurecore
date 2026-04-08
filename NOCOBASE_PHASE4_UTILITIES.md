# NocoBase Phase 4 - Reusable Utilities & Patterns

**Last Scanned:** April 7, 2026  
**Source:** `/Web Dev/opensource/nocobase-main/packages/core/client/src/`

## 1. Association/Eager Loading Utilities

### Pattern: AssociationProvider & Nested Relationship Handling

**File:** `data-source/collection/AssociationProvider.tsx`

**Description:** Handles nested relationship loading and association context management for related collections.

**Key Exports:**

```typescript
export const AssociationProvider: FC<AssociationProviderProps>
export const useAssociationName(): string | null
export const useParentCollection(): Collection
```

**Key Interfaces:**

```typescript
interface AssociationProviderProps {
  dataSource?: string;
  name: string; // e.g., 'users.roles'
  children?: ReactNode;
}
```

**Usage Pattern:** Used to load and provide context for association fields (relationship fields between collections). Extracts parent collection context while providing the nested collection context.

---

### Pattern: Collection Record Relationships

**File:** `data-source/collection-record/CollectionRecord.ts`

**Description:** Manages record data with parent/child relationships for nested data structures.

**Key Class:**

```typescript
export class CollectionRecord<DataType = any, ParentDataType = {}> {
  public data?: DataType;
  public parentRecord?: CollectionRecord<ParentDataType>;
  public isNew?: boolean;

  constructor(options: CollectionRecordOptions);
  setData(data: DataType): void;
  setParentRecord(parentRecord: CollectionRecord<ParentDataType>): void;
}
```

**Provider Hooks:**

```typescript
export function useCollectionRecord<
  DataType,
  ParentDataType,
>(): CollectionRecord<DataType, ParentDataType>;
export function useCollectionRecordData<DataType>(): DataType;
export function useCollectionParentRecord<
  ParentDataType,
>(): CollectionRecord<ParentDataType>;
export function useCollectionParentRecordData<ParentDataType>(): ParentDataType;
```

**File:** `data-source/collection-record/CollectionRecordProvider.tsx`

**Usage Pattern:** Wraps records with parent/child relationships, allowing components to access nested data hierarchy.

---

### Pattern: Collection Manager - Association Resolution

**File:** `data-source/collection/CollectionManager.ts`

**Description:** Manages all collections and resolves associations between them.

**Key Methods:**

```typescript
export class CollectionManager {
  addCollections(collections: CollectionOptions[]): void;
  getCollection(name: string): Collection;
  getCollectionField(path: string): CollectionFieldOptions; // Resolves dotted paths like 'users.roles'
  getCollectionFields(predicate?: GetCollectionFieldPredicate): Field[];
}
```

**File:** `data-source/data-source/DataSourceManager.ts`

**Key Methods:**

```typescript
getDataSources(filterDataSource?: (ds: DataSource) => boolean): DataSource[]
collectionTemplateManager: CollectionTemplateManager
collectionFieldInterfaceManager: CollectionFieldInterfaceManager
```

**Usage Pattern:** Central registry for managing collections across multiple data sources. Resolves field paths with association targets (`.target` property on association fields).

---

## 2. Cache/Memoization Patterns

### Pattern: useRequest Hook with Caching

**File:** `api-client/hooks/useRequest.ts`

**Description:** Custom hook replacing ahooks' useRequest with automatic caching via API client services registry.

**Key Export:**

```typescript
export function useRequest<P>(
  service: UseRequestService<P>,
  options: UseRequestOptions = {},
): UseRequestResult<P>;

export interface UseRequestResult<P> extends Result<P, any> {
  state: any; // Memoized state object
  setState: SetState<{}>;
}
```

**Service Type:**

```typescript
export type UseRequestService<P> =
  | AxiosRequestConfig<P>
  | ResourceActionOptions<P>
  | FunctionService; // (...args: any[]) => Promise<any>
```

**Options:**

```typescript
export type UseRequestOptions = Options<any, any> & {
  uid?: string; // Service caching key
};
```

**Caching Mechanism:**

- Stores results in `api.services[options.uid]` when uid is provided
- Uses `useMemo` internally to prevent unnecessary re-renders
- Merges with existing parameters using `assign()` utility

**File:** `api-client/hooks/useResource.ts`

```typescript
export function useResource(name: string, of?: string | number) {
  const apiClient = useAPIClient();
  return apiClient.resource(name, of); // Returns memoized resource instance
}
```

**Usage Pattern:** Cache API responses by providing a unique `uid` option. Results are stored in the API client's services registry.

---

### Pattern: Memoized Context Values

**Files:** Multiple provider patterns use `useMemo` to prevent unnecessary re-renders

**Example - FormBlockProvider:**

```typescript
const formBlockValue: any = useMemo(() => {
  return {
    params,
    action,
    form,
    type: action === "get" ? "update" : "create",
    field,
    service,
    resource,
    updateAssociationValues,
    formBlockRef,
    collectionName: collection || cm.getCollectionField(association)?.target,
    formRecord: record,
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

**Files Using Similar Pattern:**

- `data-source/collection/CollectionProvider.tsx` - Memoizes collection lookup
- `data-source/collection-field/CollectionFieldProvider.tsx` - Memoizes field resolution
- `data-source/collection-record/CollectionRecordProvider.tsx` - Memoizes record hierarchy
- `data-source/utils.ts` - `useDataSourceHeaders()` hook with memoization

**Usage Pattern:** Wrap context values in `useMemo` with explicit dependency arrays to prevent child re-renders on parent updates.

---

### Pattern: Collection Header Caching

**File:** `data-source/utils.ts`

**Description:** Memoizes data source headers for API requests.

**Key Exports:**

```typescript
export const useDataSourceHeaders = (dataSource?: string) => {
  const headers = useMemo(() => {
    if (dataSource && dataSource !== DEFAULT_DATA_SOURCE_KEY) {
      return { [HEADERS_DATA_SOURCE_KEY]: dataSource };
    }
  }, [dataSource]);
  return headers;
};

export const getDataSourceHeaders = (dataSource?: string) => {
  if (dataSource && dataSource !== DEFAULT_DATA_SOURCE_KEY) {
    return { [HEADERS_DATA_SOURCE_KEY]: dataSource };
  }
  return {};
};

const DEFAULT_DATA_SOURCE_KEY = "main";
const HEADERS_DATA_SOURCE_KEY = "x-data-source";
```

**Usage Pattern:** Cache data source information in request headers to avoid redundant header computation.

---

## 3. Field Dependency Handling

### Pattern: FormActiveFieldsProvider - Field Visibility Tracking

**File:** `block-provider/hooks/useFormActiveFields.tsx`

**Description:** Tracks which form fields are currently active/visible, enabling conditional rendering and field dependencies.

**Key Context:**

```typescript
interface FormActiveFieldsProviderValue {
  getActiveFieldsName(name: string): string[];
  addActiveFieldName(fieldName: string): void;
  removeActiveFieldName(fieldName: string): void;
  name: string;
  parent: FormActiveFieldsProviderValue; // Parent context chain
}
```

**Provider Component:**

```typescript
export const FormActiveFieldsProvider = ({
  children,
  name,
  getActiveFieldsName,
  addActiveFieldName,
  removeActiveFieldName,
}: ProviderProps) => {
  const activeFieldsNameRef = useRef<Set<string>>(new Set());
  const upLevelContext = useContext(FormActiveFieldsContext);
  // ... tracks visible fields in a Set
};
```

**Usage Pattern:** Render form fields and track which ones are active via `addActiveFieldName()`. Query active fields with `getActiveFieldsName()` to determine visibility of dependent fields.

---

### Pattern: Form Field Synchronization

**File:** `block-provider/FormFieldProvider.tsx`

**Description:** Manages nested form field data with parent form synchronization.

**Key Context:**

```typescript
export const FormFieldContext = createContext<any>({
  action: string;
  form: any;  // Formily form instance
  field: any;  // Current field
  service: any;
  resource: any;
  fieldName: string;
}>();
```

**Form Effects Pattern:**

```typescript
const form = useMemo(
  () =>
    createForm({
      effects() {
        onFormValuesChange((form) => {
          // Sync nested form values to parent form
          formBlockCtx?.form?.setValuesIn(fieldName, form.values);
        });
      },
      readPretty,
    }),
  [],
);

// Sync parent form changes to nested form
useEffect(() => {
  const dispose = autorun(() => {
    const data = formBlockCtx?.form?.values[fieldName] || {};
    form.reset();
    forEach(data, (value, key) => {
      if (value) {
        form.values[key] = value;
      }
    });
  });
  return dispose;
}, []);
```

**Usage Pattern:** Use Formily's `onFormValuesChange` and `autorun` for bidirectional form field synchronization. Parent form updates trigger nested form updates.

---

### Pattern: Collection Field Interface - Component Options

**File:** `data-source/collection-field-interface/CollectionFieldInterface.ts`

**Description:** Manages field type interfaces with component options that can have visibility and property dependencies.

**Key Interface Properties:**

```typescript
export abstract class CollectionFieldInterface {
  componentOptions?: CollectionFieldInterfaceComponentOption[];

  properties?: any; // Schema for field configuration

  validateSchema?(fieldSchema: ISchema): Record<string, ISchema>;

  usePathOptions?(field: CollectionFieldOptions): any;

  schemaInitialize?(schema: ISchema, data: any): void;
}

export interface CollectionFieldInterfaceComponentOption {
  label: string;
  value: string;
  useVisible?: () => boolean; // Conditional visibility
  useProps?: () => any; // Dynamic properties
}
```

**Usage Pattern:** Field types can define conditional component options based on runtime properties. `useVisible()` and `useProps()` hooks enable field-level dependencies.

---

### Pattern: Form Block Context - Type Tracking

**File:** `block-provider/FormBlockProvider.tsx`

**Description:** Tracks form type (create vs update) to enable conditional behavior based on record state.

**Key Exports:**

```typescript
export const useFormBlockType = () => {
  const ctx = useFormBlockContext() || {};
  const res = useMemo(() => {
    return { type: ctx.type } as { type: "update" | "create" };
  }, [ctx.type]);
  return res;
};

export const useIsDetailBlock = () => {
  const ctx = useFormBlockContext();
  const { fieldSchema } = useActionContext();
  return (
    ctx.type !== "create" &&
    fieldSchema?.["x-acl-action"] !== "create" &&
    fieldSchema?.["x-action"] !== "create"
  );
};
```

**Context Value:**

```typescript
export const FormBlockContext = createContext<{
  form?: any;
  type?: "update" | "create";
  action?: string;
  updateAssociationValues?: any;
  formRecord?: CollectionRecord;
  [key: string]: any;
}>({});
```

**Usage Pattern:** Use `useFormBlockType()` in dependent fields to apply different validation, visibility, or defaults based on whether form is create or update mode.

---

## 4. Plugin/Extension System

### Pattern: Core Plugin Architecture

**File:** `application/Plugin.ts`

**Description:** Base plugin class providing access to application subsystems.

**Key Class:**

```typescript
export class Plugin<T = any> {
  constructor(
    public options: T,
    protected app: Application,
  ) {}

  // Plugin subsystems
  get pluginManager() {
    return this.app.pluginManager;
  }
  get context() {
    return this.app.context;
  }
  get flowEngine() {
    return this.app.flowEngine;
  }
  get ai() {
    return this.app.aiManager;
  }
  get pm() {
    return this.app.pm;
  }
  get router() {
    return this.app.router;
  }
  get pluginSettingsManager() {
    return this.app.pluginSettingsManager;
  }
  get schemaInitializerManager() {
    return this.app.schemaInitializerManager;
  }
  get schemaSettingsManager() {
    return this.app.schemaSettingsManager;
  }
  get dataSourceManager() {
    return this.app.dataSourceManager;
  }

  // Lifecycle hooks
  async afterAdd() {}
  async beforeLoad() {}
  async load() {}

  // i18n support
  t(text: TFuncKey | TFuncKey[], options?: TOptions) {
    return this.app.i18n.t(text, {
      ns: this.options?.["packageName"],
      ...options,
    });
  }
}
```

**Usage Pattern:** Extend `Plugin` class and override lifecycle methods. Each plugin can register schemas, settings, routes, and data sources through manager properties.

---

### Pattern: Plugin Manager - Registration & Lifecycle

**File:** `application/PluginManager.ts`

**Description:** Manages plugin discovery, loading, and lifecycle.

**Key Methods:**

```typescript
export class PluginManager {
  async init(_plugins: PluginType[]): Promise<void>;

  async add<T>(plugin: typeof Plugin, opts?: PluginOptions<T>): Promise<void>;

  get<T extends typeof Plugin>(PluginClass: T): InstanceType<T>;
  get<T extends {}>(name: string): T;

  async load(): Promise<void>; // Executes load() on all plugins
}

export type PluginType<Opts = any> =
  | typeof Plugin
  | [typeof Plugin<Opts>, PluginOptions<Opts>];

export type PluginOptions<T = any> = {
  name?: string; // Alias for retrieval
  packageName?: string; // Package identifier
  config?: T; // Plugin configuration
};
```

**Lifecycle Flow:**

1. `initStaticPlugins()` - Register all plugins
2. `initRemotePlugins()` - Load plugins from server if enabled
3. `add()` - Create plugin instance → call `afterAdd()`
4. `load()` - Call `beforeLoad()` then `load()` on all plugins in order

**Usage Pattern:** Plugins can be registered as class references or as `[PluginClass, options]` tuples. Use `pluginManager.get(PluginName)` to retrieve plugin instance.

---

### Pattern: Schema Initializer System - Extensible UI

**File:** `application/schema-initializer/SchemaInitializer.tsx` & `application/schema-initializer/SchemaInitializerManager.ts`

**Description:** Allows plugins to register and customize schema-based UI components.

**Key Manager Methods:**

```typescript
export class SchemaInitializerManager {
  register(name: string, factory: SchemaInitializerFactory): void;
  get(name: string): SchemaInitializer;
  has(name: string): boolean;
}

export type SchemaInitializerFactory = () => SchemaInitializer;

export class SchemaInitializer {
  name: string;
  items?: SchemaInitializerItemOptions[]; // Menu items
  // ... extensible properties
}
```

**Usage Pattern:**

```typescript
// In plugin
class MyPlugin extends Plugin {
  async load() {
    this.schemaInitializerManager.register("myInitializer", () => ({
      name: "myInitializer",
      items: [
        { name: "item1", label: "Item 1", component: MyComponent },
        { name: "field", type: "item", label: "Add Field" },
      ],
    }));
  }
}
```

---

### Pattern: Data Source Manager - Multi-source Extensions

**File:** `data-source/data-source/DataSourceManager.ts`

**Description:** Allows plugins to register custom data source types and collection templates.

**Key Registration Methods:**

```typescript
export class DataSourceManager {
  addDataSource(
    dataSourceFactory: typeof DataSource,
    options: DataSourceOptions,
  ): void;

  addCollectionMixins(mixins: (typeof Collection)[] = []): void;

  getDataSources(filterDataSource?: (ds: DataSource) => boolean): DataSource[];

  collectionTemplateManager: CollectionTemplateManager;
  collectionFieldInterfaceManager: CollectionFieldInterfaceManager;
}
```

**Usage Pattern:** Plugins can add custom data source types, collection templates, and field interfaces to extend the data model system.

---

### Pattern: Collection Template Factory - Customizable Collections

**File:** `data-source/collection-template/CollectionTemplate.ts`

**Description:** Base class for creating custom collection templates (different collection types).

**Key Abstract Class:**

```typescript
export abstract class CollectionTemplate {
  constructor(public collectionTemplateManager: CollectionTemplateManager) {}

  name: string;
  Collection?: typeof Collection; // Custom Collection class
  title?: string;
  default?: CollectionTemplateDefaultOptions;
  configurableProperties?: Record<string, ISchema>; // UI schema
  availableFieldInterfaces?: AvailableFieldInterfacesInclude &
    AvailableFieldInterfacesExclude;

  transform?(
    collection: CollectionOptions,
    app: Application,
  ): CollectionOptions;
}

interface CollectionTemplateDefaultOptions {
  autoGenId?: boolean;
  createdBy?: boolean;
  updatedBy?: boolean;
  createdAt?: boolean;
  updatedAt?: boolean;
  sortable?: boolean;
  tree?: string;
  logging?: boolean;
  inherits?: string[] | string;
  fields?: CollectionFieldOptions[];
}
```

**Usage Pattern:** Plugins create custom collection types by extending `CollectionTemplate`. Define default fields, available field types, and transform logic.

---

### Pattern: Collection Field Interface - Custom Field Types

**File:** `data-source/collection-field-interface/CollectionFieldInterface.ts`

**Description:** Base class for custom field types.

**Key Abstract Class:**

```typescript
export abstract class CollectionFieldInterface {
  constructor(
    public collectionFieldInterfaceManager: CollectionFieldInterfaceManager,
  ) {}

  name: string;
  group: string;
  title?: string;
  default?: { type: string; uiSchema?: ISchema; [key: string]: any };
  sortable?: boolean;
  isAssociation?: boolean;
  operators?: any[]; // Filter operators
  properties?: any; // Field configuration schema

  validateSchema?(fieldSchema: ISchema): Record<string, ISchema>;
  usePathOptions?(field: CollectionFieldOptions): any;
  schemaInitialize?(schema: ISchema, data: any): void;

  componentOptions?: CollectionFieldInterfaceComponentOption[];
  filterable?: {
    operators?: any[];
    children?: any[];
    [key: string]: any;
  };
}
```

**Usage Pattern:** Plugins define custom field types by extending `CollectionFieldInterface`. Provide UI schemas, validation logic, and component options.

---

### Pattern: Application Context Access

**File:** `application/Application.tsx` & `api-client/context.ts`

**Description:** Provides dependency injection of application instance and API client to all components.

**Provider Pattern:**

```typescript
// Application.tsx wraps entire app with providers
<ApplicationProvider app={app}>
  <APIClientProvider apiClient={api}>
    <App />
  </APIClientProvider>
</ApplicationProvider>

// Components access via hooks
export const useApp = () => useContext(ApplicationContext);
export const useAPIClient = () => useContext(APIClientContext);
```

**Usage Pattern:** All plugins can access the application instance via context, enabling cross-plugin communication and feature discovery.

---

## Key Reusable Utilities Summary

| Pattern                | File                                                                 | Purpose                     | Key Export                 |
| ---------------------- | -------------------------------------------------------------------- | --------------------------- | -------------------------- |
| Association Loading    | `data-source/collection/AssociationProvider.tsx`                     | Load nested relationships   | `AssociationProvider`      |
| Record Hierarchy       | `data-source/collection-record/CollectionRecord.ts`                  | Manage parent/child records | `CollectionRecord` class   |
| Collection Manager     | `data-source/collection/CollectionManager.ts`                        | Central collection registry | `getCollectionField()`     |
| Request Caching        | `api-client/hooks/useRequest.ts`                                     | Cache API responses         | `useRequest()` hook        |
| Data Source Headers    | `data-source/utils.ts`                                               | Cache data source info      | `useDataSourceHeaders()`   |
| Active Fields Tracking | `block-provider/hooks/useFormActiveFields.tsx`                       | Track visible form fields   | `FormActiveFieldsProvider` |
| Form Field Sync        | `block-provider/FormFieldProvider.tsx`                               | Bidirectional form sync     | `FormFieldContext`         |
| Field Interfaces       | `data-source/collection-field-interface/CollectionFieldInterface.ts` | Custom field types          | Abstract class             |
| Plugin Base            | `application/Plugin.ts`                                              | Plugin definition           | `Plugin` class             |
| Plugin Manager         | `application/PluginManager.ts`                                       | Plugin lifecycle            | `PluginManager` class      |
| Schema Initializer     | `application/schema-initializer/SchemaInitializerManager.ts`         | UI extensibility            | `SchemaInitializerManager` |
| Data Source Manager    | `data-source/data-source/DataSourceManager.ts`                       | Multi-source support        | `DataSourceManager` class  |
| Collection Templates   | `data-source/collection-template/CollectionTemplate.ts`              | Custom collection types     | Abstract class             |

---

## Implementation Tips for Phase 4

1. **Association Handling**: Use `AssociationProvider` wrapper to load nested relationships. Each nested level gets its own `CollectionProvider` context.

2. **Caching Strategy**: Implement request caching using `useRequest()` hook with unique `uid` identifiers. Cache headers for data source info in query parameters.

3. **Field Dependencies**: Track active fields using `FormActiveFieldsProvider`. Use Formily's reactive `autorun` for bidirectional synchronization between parent and nested forms.

4. **Plugin Architecture**: All extensions should extend the base `Plugin` class and override lifecycle hooks. Use managers (`schemaInitializerManager`, `dataSourceManager`) to register extensions.

5. **Data Source Abstraction**: Leverage `DataSourceManager` for multi-database support. Custom data sources can provide their own collection templates and field interfaces.
