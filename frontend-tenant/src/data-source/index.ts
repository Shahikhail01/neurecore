/**
 * Data Source Module Exports
 * Central export point for all data layer utilities
 */

// Legacy exports
export * from "./collection";
export * from "./data-block";

// Phase 4 Infrastructure Exports

// Collection & Metadata
export {
  CollectionRegistry,
  collectionRegistry,
  type CollectionMetadata,
} from "./CollectionRegistry";

// Query Building
export {
  QueryBuilder,
  QueryPatterns,
  query,
  type FilterCondition,
  type SortSpecification,
  type PaginationOptions,
  type FilterOperator,
} from "./QueryBuilder";

// Schema Validation
export { SchemaValidator, type ValidationRule } from "./schema/SchemaValidator";

// Collection Resource Management
export {
  useCollectionResource,
  type UseCollectionResourceOptions,
  type UseCollectionResourceResult,
} from "./hooks/useCollectionResource";

// Collection Management (High-level)
export {
  useCollection,
  useCollectionRecord,
  useCollectionRelation,
  type UseCollectionOptions,
  type UseCollectionResult,
} from "./hooks/useCollection";

// Relationships
export {
  useRelationship,
  useHasMany,
  useBelongsTo,
  useBelongsToMany,
  type RelationshipConfig,
  type RelationType,
  type RelationRecord,
  type UseRelationshipResult,
} from "./hooks/useRelationship";

// Dynamic Form Building
export {
  DynamicFormBuilder,
  useDynamicForm,
  type DynamicFormConfig,
  type FormFieldConfig,
  type FormSchema,
} from "./DynamicFormBuilder";

// Operation Auditing
export {
  useOperationAuditor,
  withOperationAuditor,
  type UseOperationAuditorOptions,
  type UseOperationAuditorResult,
  type AuditLog,
  type OperationType,
} from "./hooks/useOperationAuditor";

// Association & Eager Loading
export {
  AssociationProvider,
  useAssociationContext,
  useAssociationName,
  useParentCollectionName,
  useParentRecordId,
  useAssociationData,
  useEagerLoad,
  useNestedAssociation,
  useIsAssociation,
  useAssociationTarget,
  useCollectionAssociations,
  type AssociationContextValue,
  type AssociationProviderProps,
} from "./hooks/useAssociation";

// Data Caching
export {
  DataCache,
  getGlobalCache,
  useDataCache,
  generateCacheKey,
  type CacheEntry,
  type CacheConfig,
  type CacheStats,
} from "./DataCache";

// Form Field Dependencies
export {
  FormFieldDependenciesProvider,
  useFormFieldDependencies,
  useFieldVisibility,
  useFieldState,
  useRegisterActiveField,
  FieldDependencyBuilder,
  type FormFieldDependenciesContextValue,
  type FieldDependency,
  type FormFieldDependenciesProviderProps,
} from "./FormFieldDependencies";

// Plugin System & Extensions
export {
  Plugin,
  PluginManager,
  PluginManagerProvider,
  getPluginManager,
  usePluginManager,
  usePlugin,
  usePlugins,
  useIsPluginLoaded,
  useIsPluginActive,
  type PluginOptions,
  type PluginHooks,
  type PluginInstance,
  type PluginType,
  type PluginPhase,
  type PluginManagerProviderProps,
} from "./PluginManager";

// Operation Queue & Batch Processing
export {
  OperationQueue,
  getOperationQueue,
  useOperationQueue,
  type QueuedOperation,
  type OperationQueueConfig,
  type OperationQueueStats,
} from "./OperationQueue";

// Change Detection & Dirty State
export {
  ChangeDetector,
  ChangeDetectorProvider,
  useChangeDetector,
  useTrackFieldChange,
  useFormDirtyState,
  useFormSubmissionState,
  useUnsavedChangesWarning,
  type ChangeDetectorState,
  type ChangeDetectorContextValue,
  type FieldChange,
  type ChangeDetectorProviderProps,
} from "./ChangeDetector";

// Collection Record & Hierarchy
export {
  CollectionRecord,
  CollectionRecordProvider,
  RecordFactory,
  useCollectionRecord,
  useCollectionRecordData,
  useCollectionParentRecord,
  useCollectionParentData,
  useIsNewRecord,
  useCollectionAncestors,
  useCollectionBreadcrumb,
  useRecordFieldChange,
  type CollectionRecordProviderProps,
} from "./CollectionRecord";

// Block Provider System (from NocoBase)
export {
  BlockProvider,
  FormBlockProvider,
  TableBlockProvider,
  DetailsBlockProvider,
  useBlockContext,
  BlockResourceContext,
  BlockAssociationContext,
  useBlockResource,
  MaybeCollectionProvider,
  BlockRequestProvider_deprecated,
  useBlockRequestContext,
  RenderChildrenWithAssociationFilter,
  BlockContext,
  useBlockAssociationContext,
  useFilterByTk,
  useSourceIdFromRecord,
  useSourceIdFromParentRecord,
  useParamsFromRecord,
  RecordLink,
  type BlockElement,
} from "../block-provider";

// Data Block Request Management
export {
  DataBlockRequestProvider,
  useDataBlockRequest,
  useBlockData,
  useListBlockData,
  useDetailBlockData,
  useFormBlockData,
  useDeferredBlockData,
  type DataBlockRequestContextValue,
  type DataBlockRequestProviderProps,
  type BlockRequestOptions,
  type BlockRequestState,
} from "./DataBlockRequest";
