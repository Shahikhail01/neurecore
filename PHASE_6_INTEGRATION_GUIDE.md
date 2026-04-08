# Phase 6: Block System Integration Guide

## Overview

Phase 6 implements the complete NocoBase block system for NeureCore. This system provides a declarative way to build data-driven UI components that automatically sync with your data layer.

## Architecture

```
Phase 6: Block System
├── Block Providers (18 files)
│   ├── BlockProvider - Base block container with context
│   ├── FormBlockProvider - Form-specific block
│   ├── TableBlockProvider - Table-specific block
│   ├── DetailsBlockProvider - Details view block
│   └── + 7 support providers
├── Data Block Implementations (7 types)
│   ├── form/ - Data input form
│   ├── table/ - Data table
│   ├── details-single/ - Single record details
│   ├── details-multi/ - Multiple records view
│   ├── list/ - List view
│   ├── grid-card/ - Grid card layout
│   └── table-selector/ - Selection UI
└── Supporting Systems
    ├── RecordProvider - Record context management
    └── FilterProvider - Filtering architecture
```

## Integration with Phase 4 & 5

**Phase 4 (Data Layer)** provides:

- `useCollection()` - Load and manage collection data
- `QueryBuilder` - Type-safe data queries
- `SchemaValidator` - Data validation

**Phase 5 (Schema Components)** provides:

- Field components (InputField, SelectField, etc.)
- Layout components (Form, FormItem, Space, etc.)
- Registry system for dynamic component rendering

**Phase 6 (Block System)** uses both:

- Receives data from Phase 4 via `useCollection` hooks
- Renders fields using Phase 5 schema components
- Manages block-level state and lifecycle

## Usage Example

### 1. Form Block

```typescript
import { FormBlockProvider } from '@/block-provider';
import { RecordProvider } from '@/record-provider';
import { useBlockContext } from '@/block-provider';

function MyFormBlock() {
  return (
    <RecordProvider collectionId="agents">
      <FormBlockProvider collectionId="agents">
        <FormContent />
      </FormBlockProvider>
    </RecordProvider>
  );
}

function FormContent() {
  const block = useBlockContext();
  // block.type === 'form'
  // block.records, block.loading, etc.
  return <div>Form block content</div>;
}
```

### 2. Table Block

```typescript
import { TableBlockProvider } from '@/block-provider';
import { RecordProvider } from '@/record-provider';

function MyTableBlock() {
  return (
    <RecordProvider collectionId="tasks">
      <TableBlockProvider collectionId="tasks">
        <TableContent />
      </TableBlockProvider>
    </RecordProvider>
  );
}
```

### 3. Combining with Phase 4 Data Layer

```typescript
import { useCollection } from '@/data-source';
import { TableBlockProvider } from '@/block-provider';

function SmartTableBlock() {
  const { records, loading, filters, setFilters } = useCollection({
    collectionName: 'agents',
    filters: [{ field: 'status', operator: 'eq', value: 'active' }]
  });

  return (
    <TableBlockProvider collectionId="agents">
      {loading ? <Spin /> : <TableContent records={records} />}
    </TableBlockProvider>
  );
}
```

## Block Provider Context

All blocks provide a context with these values:

```typescript
interface BlockContextValue {
  type: "form" | "table" | "details" | "list" | "grid" | "selector";
  records: any[];
  record: any | null;
  loading: boolean;
  error: Error | null;
  total: number;
  pageNumber: number;

  // Actions
  refresh: () => void;
  create: (data: any) => Promise<void>;
  update: (id: string, data: any) => Promise<void>;
  delete: (id: string) => Promise<void>;
}
```

## Field Rendering

Blocks automatically render fields using Phase 5 schema components:

```typescript
// In your block, define a schema
const schema = {
  type: "object",
  properties: {
    name: {
      type: "string",
      title: "Agent Name",
      "x-component": "InputField",
    },
    status: {
      type: "string",
      enum: ["active", "inactive", "archived"],
      title: "Status",
      "x-component": "SelectField",
    },
    createdAt: {
      type: "string",
      format: "date-time",
      title: "Created Date",
      "x-component": "DatePickerField",
    },
  },
};

// Blocks render fields based on schema
// using SchemaComponentRegistry from Phase 5
```

## Record Provider

The `RecordProvider` manages record-level state:

```typescript
<RecordProvider collectionId="agents" recordId={agentId}>
  <RecordContent />
</RecordProvider>
```

Provides context for:

- Current record data
- Parent record (for nested forms)
- Record hierarchy and breadcrumbs

## Filter Provider

The `FilterProvider` manages block-level filters:

```typescript
<FilterProvider>
  <FilterForm />
  <FilteredResults />
</FilterProvider>
```

Features:

- Dynamic filter UI generation
- Filter state management
- Integration with data layer queries

## Performance Features

All Phase 6 components optimize performance:

1. **Memoization** - Components wrapped with `React.memo`
2. **Context optimization** - Split contexts to prevent unnecessary re-renders
3. **Deferred loading** - `DataBlockRequest` delays data fetching
4. **Caching** - Integrates with Phase 4 `DataCache`
5. **Batch operations** - Via `OperationQueue` from Phase 4

## Common Patterns

### Read-Only Display

```typescript
<BlockProvider readOnly>
  <RecordContent />
</BlockProvider>
```

### Batch Operations

```typescript
const { create, delete } = useBlockContext();

// Create multiple records
await Promise.all(
  records.map(r => create(r))
);

// Delete multiple records
await Promise.all(
  selectedIds.map(id => delete(id))
);
```

### Custom Field Rendering

```typescript
// Override default field rendering
const { useSchemaComponent } = useBlockContext();

function CustomField() {
  const { InputField } = useSchemaComponent();
  return <InputField placeholder="Custom..." />;
}
```

## Testing

Phase 6 includes test utilities:

```typescript
// In src/lib/phase6-integration-test.ts
import { verifyPhase6Integration } from "@/lib/phase6-integration-test";

const results = await verifyPhase6Integration();
// Results include:
// - Phase 4 → Phase 6 data flow verification
// - Phase 5 → Phase 6 component integration
// - Block provider architecture validation
```

## Troubleshooting

### Block Context Not Available

Ensure you're inside a Block Provider:

```typescript
// ❌ Wrong - no Block Provider
function MyComponent() {
  const block = useBlockContext(); // Will throw
}

// ✅ Correct - wrapped in Block Provider
function Page() {
  return (
    <BlockProvider>
      <MyComponent />
    </BlockProvider>
  );
}
```

### Records Not Loading

Check that:

1. RecordProvider is initialized with correct `collectionId`
2. Collection exists in Phase 4 `CollectionRegistry`
3. Data fetching is not blocked by filters

### Schema Components Not Rendering

Verify:

1. SchemaComponentRegistry is initialized (Phase 5)
2. Field component is registered with correct name
3. Schema property `x-component` matches registered name

## Next Steps

1. **Create example pages** using each block type
2. **Add custom block implementations** extending base blocks
3. **Integrate with existing pages** replacing manual form/table code
4. **Add real-time updates** via WebSocket integration
5. **Build admin UI** for managing block configurations

## Files Reference

- `/src/block-provider/` - Core block provider system
- `/src/modules/blocks/` - Block implementations
- `/src/record-provider/` - Record context
- `/src/filter-provider/` - Filter architecture
- `/src/data-source/data-block/` - Block utilities
- `/src/app/phase6-demo/` - Demo page with examples

---

**Status**: Phase 6 implementation complete and production-ready.
