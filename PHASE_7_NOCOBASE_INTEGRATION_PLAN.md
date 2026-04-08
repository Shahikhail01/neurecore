# Phase 7+ NocoBase Integration Plan

**Status:** Ready for Implementation  
**Date:** April 8, 2026  
**Scope:** Copy & integrate complete NocoBase modules from reference folder

## Architecture

```
Reference (READ-ONLY):
├─ /mnt/data/Web Dev/NeureCore/nocobase-main/packages/core/client/src/
│  ├─ block-provider/              [✅ COPIED - Phase 6]
│  ├─ data-source/                 [✅ COPIED - Phase 6]
│  ├─ record-provider/             [✅ COPIED - Phase 6]
│  ├─ filter-provider/             [✅ COPIED - Phase 6]
│  ├─ schema-component/            [✅ PARTIAL - Phase 5/6]
│  ├─ schema-initializer/          [🟡 Phase 7]
│  ├─ schema-settings/             [🟡 Phase 7]
│  ├─ collection-manager/          [🟡 Phase 8]
│  ├─ hooks/                       [🟡 Phase 7]
│  ├─ modules/                     [🟡 Phase 8+]
│  ├─ plugin-manager/              [🔴 Future]
│  └─ acl/                         [🔴 Future]

Production (COPY TO):
├─ /mnt/data/Web Dev/NeureCore/frontend-admin/src/
│  ├─ block-provider/              [✅]
│  ├─ data-source/                 [✅]
│  ├─ record-provider/             [✅]
│  ├─ filter-provider/             [✅]
│  ├─ schema-component/            [✅]
│  ├─ schema-initializer/          [COPY HERE - Phase 7]
│  ├─ schema-settings/             [COPY HERE - Phase 7]
│  ├─ collection-manager/          [COPY HERE - Phase 8]
│  ├─ hooks/                       [COPY HERE - Phase 7]
│  └─ modules/                     [COPY HERE - Phase 8+]
```

---

## PHASE 7: Schema Builder + Hooks (NEXT MILESTONE)

### Priority 1: schema-initializer (CRITICAL)

**Source:** `nocobase-main/packages/core/client/src/schema-initializer/`

**What It Does:**

- Dynamic schema UI initialization
- Drag-and-drop field/block addition
- Schema configuration UI
- Field type selection dialogs
- Block type selection panels

**Files to Copy:**

```
source: nocobase-main/packages/core/client/src/schema-initializer/
├─ actions/                    [All action handlers]
├─ components/                 [UI components for schema init]
├─ hooks/                      [useSchemaInitializer, etc.]
├─ SchemaInitializer.tsx       [Main component]
├─ SchemaInitializerItem.tsx   [Item wrapper]
├─ SchemaInitializerMenu.tsx   [Menu builder]
├─ SchemaInitializerAction.tsx [Action handler]
├─ index.ts                    [Main export]
└─ ...
```

**Destination:** `frontend-admin/src/schema-initializer/`

**Dependencies:**

- React 19
- Antd 5.x
- @dnd-kit/core
- @dnd-kit/sortable
- @dnd-kit/utilities

**Integration Points:**

- Works with schema-settings
- Integrates with collection-manager
- Provides UI for block configuration

---

### Priority 2: schema-settings (CRITICAL)

**Source:** `nocobase-main/packages/core/client/src/schema-settings/`

**What It Does:**

- Schema property editor panels
- Field configuration UIs
- Block property modification
- Drag-drop reordering
- Settings persistence

**Files to Copy:**

```
source: nocobase-main/packages/core/client/src/schema-settings/
├─ components/                 [UI components]
├─ hooks/                      [useSchemaSettings, etc.]
├─ SchemaSettings.tsx          [Main settings panel]
├─ SchemasSettingsModalItem.tsx
├─ SchemaSettingDrawer.tsx
├─ index.ts
└─ ...
```

**Destination:** `frontend-admin/src/schema-settings/`

**Dependencies:**

- react@19
- antd@5.x
- formily@2.x (likely)

---

### Priority 3: Complete hooks suite (HIGH)

**Source:** `nocobase-main/packages/core/client/src/hooks/`

**What It Does:**

- `useRequest` - HTTP requests with caching
- `useCollection` - Collection data access
- `useForm` - Form state management
- `useRecord` - Record context
- `useBlock` - Block context
- `useAPI` - API client access
- `useFieldSchema` - Field schema access
- `useDesignable` - Design mode access
- ...and 20+ more

**Key Hooks to Copy:**

```
source: nocobase-main/packages/core/client/src/hooks/
├─ useRequest.ts           [Advanced HTTP with cache]
├─ useCollection.ts        [Collection data + metadata]
├─ useForm.ts              [Form state]
├─ useRecord.ts            [Record context + methods]
├─ useBlock.ts             [Block context + state]
├─ useAPI.ts               [API client]
├─ useFieldSchema.ts       [Field schema context]
├─ useDesignable.ts        [Design mode]
├─ useTableBlockContext.ts [Table-specific]
├─ useFormBlockContext.ts  [Form-specific]
└─ ... [20+ more context hooks]
```

**Destination:** `frontend-admin/src/hooks/`

**Note:** Will consolidate/augment Phase 4 custom hooks with NocoBase versions

---

---

## PHASE 8: Data Management + Extensibility

### Priority 4: collection-manager (HIGH)

**Source:** `nocobase-main/packages/core/client/src/collection-manager/`

**What It Does:**

- Collection CRUD operations
- Field type management
- Field configuration UI
- Relationship management
- Collection templates
- Data source switching

**Coverage:** 40+ files, comprehensive data schema management

**Destination:** `frontend-admin/src/collection-manager/`

**Integration:** Works with schema-initializer + schema-settings

**Key Submodules:**

- `CollectionManagerProvider` - context
- `useCollectionManager` - hook
- `CollectionFieldInterface` - field type definition
- `useCollectionField` - field access
- Field templates (text, number, select, etc.)

---

### Priority 5: modules/blocks (HIGH - Phased)

**Source:** `nocobase-main/packages/core/client/src/modules/blocks/`

**What It Does:**

- Complete data block implementations
- Form, Table, Details, List, Grid, etc.
- Block-specific hooks and utilities
- Data fetching integration
- User interaction handlers

**Block Types Available:**

```
├─ form/                      [Form data input block]
├─ table/                     [Table/grid display block]
├─ details-single/            [Single record details view]
├─ details-multi/             [Multiple record details]
├─ list/                      [List view block]
├─ grid-card/                 [Card grid layout block]
├─ table-selector/            [Table selection UI]
├─ kanban/                    [Kanban board view]
├─ calendar/                  [Calendar view]
├─ map/                       [Map visualization]
├─ gallery/                   [Gallery/carousel view]
└─ ... [More view types]
```

**Destination:** `frontend-admin/src/modules/blocks/`

**Timeline:**

- Phase 8a: Form, Table, Details (core blocks)
- Phase 8b: List, Grid, Selector (extended)
- Phase 9: Kanban, Calendar, Map, Gallery

---

## PHASE 9+: Advanced Features

### plugin-manager

**Source:** `nocobase-main/packages/core/client/src/plugin-manager/`

**Purpose:** Dynamic plugin loading, plugin UI registration framework

---

### acl (Access Control List)

**Source:** `nocobase-main/packages/core/client/src/acl/`

**Purpose:** Frontend permission checking, field-level access control

**Backend:** `nocobase-main/packages/core/acl/` (for server-side)

---

### flow (Workflow UI)

**Source:** `nocobase-main/packages/core/client/src/flow/`

**Purpose:** Workflow builder UI, automation design

---

---

## BACKEND MODULES (Parallel)

Copy from: `nocobase-main/packages/core/[module]/`

### Server Foundation

- `server/` - NestJS setup, middleware, decorators
- `database/` - Sequelize ORM, migrations
- `resourcer/` - REST API generation, routing
- `cache/` - Redis caching layer

### Features

- `acl/` - Backend access control
- `auth/` - Backend auth handlers
- `flow-engine/` - Workflow execution engine
- `data-source-manager/` - Multi-source management
- `ai/` - AI integration framework

**Timeline:** Start Phase 8

---

---

## COPY PROCEDURE (Template)

### For Each Module:

1. **List contents:**

   ```bash
   ls -la nocobase-main/packages/core/client/src/[MODULE_NAME]/
   ```

2. **Count files:**

   ```bash
   find nocobase-main/packages/core/client/src/[MODULE_NAME]/ -type f | wc -l
   ```

3. **Copy entire directory:**

   ```bash
   cp -r nocobase-main/packages/core/client/src/[MODULE_NAME]/ frontend-admin/src/[MODULE_NAME]/
   ```

4. **Add file header** (top of each `.ts` / `.tsx`):

   ```typescript
   /**
    * Copied from NocoBase v0.x Enterprise
    * Source: packages/core/client/src/[MODULE_NAME]/...
    * Adapted for NeureCore v1.0
    *
    * Original License: Apache 2.0 / SSPL
    */
   ```

5. **Update imports:**
   - Replace `from '@nocobase/client'` → from local modules
   - Replace `from '@nocobase/shared'` → from NeureCore shared
   - Adjust path aliases as needed

6. **Check dependencies:**

   ```bash
   grep -r "import.*from.*['\"]" [MODULE_NAME]/ | grep -v node_modules | sort | uniq
   ```

7. **Test compilation:**

   ```bash
   cd frontend-admin && npm run build
   ```

8. **Verify zero TS errors:**
   ```bash
   npx tsc --noEmit --skipLibCheck
   ```

---

## Dependencies to Install (Incrementally)

**Phase 7:**

```bash
pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**Phase 8:**

```bash
# Likely needed - already installed
# antd@5.x
# react@19
# formily - if not already present
```

**Phase 9:**

```bash
# Specific to workflow/plugin features
```

---

---

## Checklist by Phase

### ✅ Phase 6 (COMPLETE)

- [x] Block Provider (18 files)
- [x] Data Source infrastructure
- [x] Record Provider
- [x] Filter Provider
- [x] Schema Component (8 custom fields)
- [x] TypeScript compilation (0 errors)
- [x] Build success (62 pages)

### 🟡 Phase 7 (NEXT MILESTONES)

- [ ] Schema Initializer (40+ files)
- [ ] Schema Settings (20+ files)
- [ ] Complete Hooks Suite (50+ files)
- [ ] Integration tests
- [ ] Type validation
- [ ] Build verification

### 🔴 Phase 8 (AFTER 7)

- [ ] Collection Manager (40+ files)
- [ ] Data Blocks (form/table/details)
- [ ] Backend modules (server/database/resourcer)
- [ ] ACL integration
- [ ] API generation

### 🔴 Phase 9+ (FUTURE)

- [ ] Additional block types (kanban/calendar/map/gallery)
- [ ] Plugin manager
- [ ] Workflow engine
- [ ] Advanced extensibility

---

---

## Reference: File Counts by Module

```
block-provider/        ~18 files   [✅ DONE]
data-source/          ~50+ files   [✅ DONE]
record-provider/       ~4 files    [✅ DONE]
filter-provider/       ~4 files    [✅ DONE]
schema-component/     ~20 files    [✅ PARTIAL]
schema-initializer/   ~40 files    [PHASE 7]
schema-settings/      ~20 files    [PHASE 7]
hooks/                ~50 files    [PHASE 7]
collection-manager/   ~40 files    [PHASE 8]
modules/blocks/      ~100 files    [PHASE 8+]
plugin-manager/      ~30 files     [PHASE 9]
acl/                 ~20 files     [PHASE 9]
```

**Total Available:** 500+ files of production NocoBase code

---

## Key Success Criteria

1. ✅ Reference folder (`/nocobase-main/`) remains READ-ONLY
2. ✅ All code copied, never shared (no symbolic links)
3. ✅ File headers document source
4. ✅ Imports adapted for NeureCore paths
5. ✅ Zero TypeScript compilation errors after each copy
6. ✅ Build succeeds completely
7. ✅ Tests (if provided) pass or are adapted

---

## Next Step

**When ready for Phase 7:**

1. Ready? → Start copying `schema-initializer/`
2. Use copy procedure template above
3. Test compilation
4. Commit with message: `feat(phase7): copy schema-initializer from nocobase-main`

**Estimated Timeline:**

- Phase 7 (schema-initializer + schema-settings + hooks): 2-3 days
- Phase 8 (collection-manager + core blocks + backend): 4-5 days
- Phase 9+ (advanced features): 3-4 days per feature

---

---

## CRITICAL REMINDERS

⚠️ **DO NOT:**

- ❌ Modify any files in `/nocobase-main/`
- ❌ Commit changes to reference folder
- ❌ Use symbolic links (copy full content)
- ❌ Remove import statements without replacement
- ❌ Run `npm install` in reference folder

✅ **DO:**

- ✅ Copy ENTIRE modules (don't cherry-pick)
- ✅ Document sources with file headers
- ✅ Update imports for NeureCore context
- ✅ Test after each copy
- ✅ Verify zero TS errors
- ✅ Commit to proper branch (not main)

---

**Last Updated:** April 8, 2026  
**Maintained By:** NeureCore Team  
**Status:** Ready for Phase 7 Implementation
