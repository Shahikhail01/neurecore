# Phase 7 Revised Implementation Plan

**Date:** April 8, 2026  
**Status:** Dependency Analysis Complete  
**Action:** Reorder Phase 7 for Clean Integration

---

## Discovery: Dependency Structure

### Initial Findings

- **schema-initializer** (51 files) - Depends on: `modules/blocks/*` and `modules/actions/*`
- **schema-settings** (95 files) - Utility-focused, but relies on initialized schemas
- **hooks** (6 files) - Lightweight, standalone

### The Problem

`schema-initializer` is the core UI builder. It imports 40+ initializers from:

```
../modules/blocks/data-blocks/form/FormBlockInitializer
../modules/blocks/data-blocks/table/TableBlockInitializer
../modules/blocks/data-blocks/details-single/...
../modules/blocks/data-blocks/details-multi/...
../modules/blocks/data-blocks/list/ListBlockInitializer
../modules/blocks/data-blocks/grid-card/GridCardBlockInitializer
../modules/actions/add-new/CreateActionInitializer
../modules/actions/delete/DestroyActionInitializer
... [20+ more action initializers]
```

These modules are in Phase 8 (data blocks + action blocks), not Phase 7.

---

## Revised Phasing Strategy

### ✅ Phase 6 (COMPLETE)

- block-provider, data-source, record-provider, filter-provider
- **Status:** 51 files integrated, 0 errors

### 🟠 Phase 7 (REVISED)

**Copy Foundation Modules:**

1. **modules/blocks/data-blocks/** (core block implementations) - 7 block types
2. **modules/actions/** (action implementations) - 20+ actions
3. **hooks/** (React utilities) - 6 core hooks

**Estimated:** 100+ files, 1-2 days

### 🔵 Phase 8 (SCHEMA UL BUILDERS)

**Copy UI Builders:**

1. **schema-initializer/** (51 files) - Uses blocks from Phase 7
2. **schema-settings/** (95 files) - Uses initialized schemas
3. **collection-manager/** (40+ files) - Data management UI

**Estimated:** 186+ files, 2-3 days

---

## Updated Timeline

| Phase | Modules                                                         | Files | Status  | Timeline |
| ----- | --------------------------------------------------------------- | ----- | ------- | -------- |
| 6     | block-provider, data-source, record-provider, filter-provider   | 51    | ✅      | Done     |
| 7     | modules/blocks/data-blocks, modules/actions, hooks, application | 100+  | 🟠 NEXT | 1-2 days |
| 8     | schema-initializer, schema-settings, collection-manager         | 186+  | 🔵      | 2-3 days |
| 9+    | plugin-manager, acl, flow, advanced features                    | 100+  | Future  | 3+ days  |

---

## Phase 7 New Deliverables

### 1. modules/blocks/data-blocks/ (Core Blocks)

```
Source: nocobase-main/packages/core/client/src/modules/blocks/data-blocks/
Contains:
├── form/ - Form data input block
├── table/ - Table/grid display block
├── details-single/ - Single record details view
├── details-multi/ - Multiple record details
├── list/ - List view block
├── grid-card/ - Card grid layout block
└── table-selector/ - Table selection UI
```

**Impact:** Enables schema-initializer to function in Phase 8

### 2. modules/actions/ (Actions Framework)

```
Source: nocobase-main/packages/core/client/src/modules/actions/
Contains:
├── add-new/ - Create record action
├── delete/ - Delete record action
├── edit/ - Edit record action
├── filter/ - Filter data action
├── refresh/ - Refresh data action
├── link/ - Link records action
└── [20+ other actions]
```

**Impact:** Enables action configuration in blocks

### 3. hooks/ (Core React Hooks)

```
Source: nocobase-main/packages/core/client/src/hooks/
Contains:
├── useAdminSchemaUid - Schema UID access
├── useFullscreenOverlay - Fullscreen UI
├── useMenuItem - Menu item management
├── useParsedValue - Value parsing
├── useViewport - Viewport detection
```

**Impact:** Provides utilities for UI components

### 4. application/Plugin Enhanced

```
Needs: Proper Plugin class implementation
From: nocobase-main/packages/core/client/src/application/Plugin.ts
Impact: Required by schema-initializer
```

---

## Immediate Next Steps

### 1. Copy modules/blocks/data-blocks/

```bash
cp -r nocobase-main/.../modules/blocks/data-blocks/ \
    frontend-admin/src/modules/blocks/data-blocks/
```

**Files:** ~40  
**Dependencies:** block-provider (already have ✓)

### 2. Copy modules/actions/

```bash
cp -r nocobase-main/.../modules/actions/ \
    frontend-admin/src/modules/actions/
```

**Files:** ~50  
**Dependencies:** data-source, record-provider (already have ✓)

### 3. Copy hooks/

```bash
cp -r nocobase-main/.../hooks/ \
    frontend-admin/src/hooks/
```

**Files:** ~6  
**No external dependencies**

### 4. Update application/Plugin

```bash
cp -r nocobase-main/.../application/Plugin.ts \
    frontend-admin/src/application/
```

---

## Why This Order Works

1. **No Circular Dependencies:** Blocks don't depend on initializers
2. **Clean Imports:** Actions work standalone, initializers will find them in Phase 8
3. **Incremental Testing:** Each phase builds clean on previous
4. **Natural Progression:** Foundation → UI Builders → Advanced Features

---

## Roll-Forward from Current State

Phase 6 is complete and stable. Phase 7 refactoring:

- ❌ Do NOT copy schema-initializer yet (will fail imports)
- ✅ DO copy modules/blocks/data-blocks first
- ✅ DO copy modules/actions second
- ✅ DO copy hooks as utilities
- ✅ UPDATE application/Plugin class

Then Phase 8 can proceed as planned with schema-initializer, schema-settings, collection-manager.

---

**Recommendation:** Proceed with revised Phase 7 starting with modules/blocks/data-blocks

This ensures clean integration, zero broken imports, and proper architectural layering.
