# Phase 6 Quick Start Guide

## 5-Minute Setup

### 1. Import Block Provider

```typescript
import { FormBlockProvider, TableBlockProvider } from "@/block-provider";
import { RecordProvider } from "@/record-provider";
```

### 2. Add Record Provider Wrapper

```typescript
<RecordProvider collectionId="agents">
  <FormBlockProvider collectionId="agents">
    {/* Your block content */}
  </FormBlockProvider>
</RecordProvider>
```

### 3. Use Block Context

```typescript
import { useBlockContext } from "@/block-provider";

function MyBlockContent() {
  const {
    records,
    loading,
    create,
    update,
    delete: deleteRecord,
  } = useBlockContext();

  // Your component logic
}
```

## Common Tasks

### Display a Form

```typescript
import { FormBlockProvider, useBlockContext } from '@/block-provider';
import { RecordProvider } from '@/record-provider';
import { Form } from '@/schema-component';

function AgentForm() {
  return (
    <RecordProvider collectionId="agents">
      <FormBlockProvider collectionId="agents">
        <FormContent />
      </FormBlockProvider>
    </RecordProvider>
  );
}

function FormContent() {
  const { record, update } = useBlockContext();

  const handleSubmit = async (values) => {
    await update(record.id, values);
  };

  return <Form onSubmit={handleSubmit}>{/* fields */}</Form>;
}
```

### Display a Table

```typescript
import { TableBlockProvider, useBlockContext } from '@/block-provider';
import { RecordProvider } from '@/record-provider';
import { Table } from 'antd';

function AgentTable() {
  return (
    <RecordProvider collectionId="agents">
      <TableBlockProvider collectionId="agents">
        <TableContent />
      </TableBlockProvider>
    </RecordProvider>
  );
}

function TableContent() {
  const { records, loading, total } = useBlockContext();

  const columns = [
    { dataIndex: 'name', title: 'Name' },
    { dataIndex: 'status', title: 'Status' },
  ];

  return <Table columns={columns} dataSource={records} loading={loading} />;
}
```

### Filter Data

```typescript
import { FilterProvider, useFilterContext } from '@/filter-provider';

function FilteredView() {
  return (
    <FilterProvider>
      <FilterForm />
      <Results />
    </FilterProvider>
  );
}

function FilterForm() {
  const { filters, setFilters } = useFilterContext();

  return (
    <Form onChange={(values) => setFilters(values)}>
      {/* filter fields */}
    </Form>
  );
}

function Results() {
  const { filters } = useFilterContext();
  // Use filters to fetch data
}
```

### Create Records

```typescript
const { create } = useBlockContext();

const newAgentData = {
  name: "New Agent",
  status: "active",
  type: "marketing",
};

await create(newAgentData);
```

### Update Records

```typescript
const { update } = useBlockContext();

const updatedData = {
  name: "Updated Name",
  status: "inactive",
};

await update(agentId, updatedData);
```

### Delete Records

```typescript
const { delete: deleteRecord } = useBlockContext();

await deleteRecord(agentId);
```

## Integration with Phase 4

### Using Data Layer Queries

```typescript
import { useCollection } from '@/data-source';
import { TableBlockProvider } from '@/block-provider';

function SmartTable() {
  // Phase 4: Load filtered data
  const { records } = useCollection({
    collectionName: 'agents',
    filters: [{ field: 'status', operator: 'eq', value: 'active' }],
  });

  // Phase 6: Display in block
  return (
    <TableBlockProvider collectionId="agents">
      <TableDisplay records={records} />
    </TableBlockProvider>
  );
}
```

### Custom Validation

```typescript
import { SchemaValidator } from '@/data-source';
import { FormBlockProvider, useBlockContext } from '@/block-provider';

function ValidatingForm() {
  return (
    <FormBlockProvider collectionId="agents">
      <FormWithValidation />
    </FormBlockProvider>
  );
}

function FormWithValidation() {
  const { update } = useBlockContext();
  const validator = new SchemaValidator('agents');

  const handleSubmit = async (values) => {
    const errors = validator.validate(values);
    if (errors.length > 0) {
      // Show errors
      return;
    }
    await update(recordId, values);
  };

  return <Form onSubmit={handleSubmit}>{/* fields */}</Form>;
}
```

## Integration with Phase 5

### Schema-Based Forms

```typescript
import { DynamicFormBuilder } from '@/data-source';
import { useSchemaComponent } from '@/schema-component';
import { FormBlockProvider, useBlockContext } from '@/block-provider';

function DynamicForm() {
  return (
    <FormBlockProvider collectionId="agents">
      <DynamicContent />
    </FormBlockProvider>
  );
}

function DynamicContent() {
  const { record } = useBlockContext();
  const builder = new DynamicFormBuilder('agents');
  const schema = builder.buildSchema();

  return <Form schema={schema} initialValues={record} />;
}
```

### Custom Field Rendering

```typescript
import { SchemaComponentRegistry } from '@/schema-component';

// Register custom field
SchemaComponentRegistry.register('CustomField', {
  component: CustomFieldComponent,
  defaultValue: null,
});

// Use in block
function MyForm() {
  const schema = {
    properties: {
      customField: {
        'x-component': 'CustomField',
      },
    },
  };

  return <Form schema={schema} />;
}
```

## Block Types Reference

| Block Type                     | Purpose            | Key Components                    |
| ------------------------------ | ------------------ | --------------------------------- |
| **FormBlockProvider**          | Data input form    | Form, FormItem, Input fields      |
| **TableBlockProvider**         | Data table/grid    | Table, columns, pagination        |
| **DetailsBlockProvider**       | Single record view | Read-only display, update actions |
| **FilterFormBlockProvider**    | Dynamic filters    | Filter conditions, operators      |
| **ListBlockProvider**          | Vertical list      | Card-based item list              |
| **GridCardBlockProvider**      | Card grid          | Responsive card layout            |
| **TableSelectorBlockProvider** | Record selection   | Checkboxes, selection state       |

## Block Context Methods

```typescript
interface BlockContext {
  // Data
  records: any[];
  record: any;
  loading: boolean;
  total: number;

  // Pagination
  pageNumber: number;
  pageSize: number;

  // Actions
  refresh(): void;
  create(data: any): Promise<any>;
  update(id: string, data: any): Promise<void>;
  delete(id: string): Promise<void>;

  // Sorting & filtering
  setSort(field: string, direction: "asc" | "desc"): void;
  setPage(page: number): void;
  setPageSize(size: number): void;
}
```

## Error Handling

```typescript
const { loading, error, refresh } = useBlockContext();

if (error) {
  return <ErrorMessage error={error} onRetry={refresh} />;
}

if (loading) {
  return <Spin />;
}

return <BlockContent />;
```

## Performance Tips

1. **Use key prop** on list items
2. **Memoize handlers** with `useCallback`
3. **Avoid inline functions** in render
4. **Use `DataCache`** from Phase 4 for expensive queries
5. **Split large records** across multiple blocks

## Demo Page

See live examples at `/phase6-demo` page with working form and table blocks.

---

**Phase 6 Status**: ✅ Production Ready
