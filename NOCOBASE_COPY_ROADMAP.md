# NocoBase Code Integration Roadmap

**Status:** Phase 6 Complete (206 files copied) → Phase 7 Planning
**Date:** April 8, 2026
**Strategy:** Direct copy from `/nocobase-main/` — preserve architecture, adapt imports only

## Principles

1. **Copy, don't rebuild** — Use production NocoBase code as-is
2. **Read-only reference** — `/nocobase-main/` is locked from modifications
3. **Full feature set** — We will need ALL NocoBase functionality eventually
4. **Preserve patterns** — Maintain NocoBase architectural patterns and conventions
5. **Minimal adaptation** — Only change import paths and type references

## Completed (Phase 6)

✅ **Block Provider System** (18 files)
- Location: `/frontend-admin/src/block-provider/`
- Source: `/nocobase-main/packages/core/client/src/block-provider/`

✅ **Data Block Implementations** (7 block types)
- Location: `/frontend-admin/src/modules/blocks/`
- Source: `/nocobase-main/packages/core/client/src/modules/blocks/`

✅ **Record Provider**
- Location: `/frontend-admin/src/record-provider/`
- Source: `/nocobase-main/packages/core/client/src/record-provider/`

✅ **Filter Provider**
- Location: `/frontend-admin/src/filter-provider/`
- Source: `/nocobase-main/packages/core/client/src/filter-provider/`

✅ **Data Block Utilities**
- Location: `/frontend-admin/src/data-source/data-block/`
- Source: `/nocobase-main/packages/core/client/src/modules/blocks/`

**Total: 206 files, 0 TS compilation errors**

---

## Phase 7: Collection & Schema System (Next)

### Why First
- Foundation for all data operations
- Required for Phase 8+ features
- Needed for form/table rendering
- Powers dynamic UI generation

### What to Copy

#### 7.1 Collection Manager
```
Source: /nocobase-main/packages/core/client/src/collection-manager/
Target: /frontend-admin/src/collection-manager/
Files: ~40-50 files
Size: ~4,000 lines
Content:
  - CollectionManager class (registry + metadata)
  - CollectionContext + useCollection hook
  - Field interfaces + field manager
  - Association handlers
  - Collection templates
```

#### 7.2 Schema Component System
```
Source: /nocobase-main/packages/core/client/src/schema-component/
Target: /frontend-admin/src/schema-component/
Files: ~80-100 files
Size: ~12,000+ lines
Content:
  - Base schema components (Card, Form, Table, etc.)
  - Field rendering components (60+ field types)
  - Layout components (Space, Grid, Tabs, Collapse, etc.)
  - Form wrapper + validation
  - Display modes (read-only, edit, display)
  - Component registry + dynamic rendering
```

#### 7.3 Schema Initializer
```
Source: /nocobase-main/packages/core/client/src/schema-initializer/
Target: /frontend-admin/src/schema-initializer/
Files: ~20-30 files
Size: ~3,000 lines
Content:
  - SchemaInitializer class (button + dropdown generation)
  - Template system
  - Block initializers
  - Field initializers
  - Common initializer patterns
```

#### 7.4 Schema Settings
```
Source: /nocobase-main/packages/core/client/src/schema-settings/
Target: /frontend-admin/src/schema-settings/
Files: ~15-20 files
Size: ~2,500 lines
Content:
  - SchemaSettings context + hooks
  - Settings panel rendering
  - Component-specific settings
  - Layout settings
```

### Integration Points
- Connect with Phase 4 (QueryBuilder, useCollection hooks)
- Connect with Phase 5 (SchemaComponentRegistry)
- Connect with Phase 6 (BlockProvider, RecordProvider)
- Enable dynamic form/table rendering
- Support field visibility/dependency logic

### Verification Checklist
- [ ] Copy all files with directories intact
- [ ] Update import paths (@nocobase/* → relative paths)
- [ ] Verify TypeScript compilation (target: 0 errors)
- [ ] Test basic collection CRUD operations
- [ ] Verify form rendering from schema
- [ ] Verify table rendering from schema

---

## Phase 8: Data Operations Layer

### What to Copy
```
- Data modification handlers (create/update/delete)
- Relationship/association operations
- Bulk operations
- Transaction support
- Undo/redo system
- Change tracking
```

### Files
- Location: `/nocobase-main/packages/core/client/src/data-source/`
- Additional: `/nocobase-main/packages/core/client/src/hooks/`

---

## Phase 9: Plugin System

### What to Copy
```
Core plugin infrastructure:
- plugin-manager/
- pm/ (plugin container)
- application/ (app bootstrapping)

Example plugins to copy second:
- plugin-acl/ (access control)
- plugin-audit-logs/ (audit system)
- plugin-notifications/ (notifications)
```

### Strategic Order
1. Copy plugin-manager core
2. Copy essential plugins (ACL, Auth, Users, Files)
3. Copy workflow plugins (workflow, flow-engine)
4. Copy visualization plugins (charts, data-visualization)

---

## Phase 10: Data Visualization

### What to Copy
```
Plugins:
- plugin-charts/ (Recharts integration)
- plugin-data-visualization/ (visualization engine)
- plugin-data-visualization-echarts/ (ECharts)
- plugin-gantt/ (Gantt chart)
- plugin-kanban/ (Kanban board)
- plugin-calendar/ (Calendar)
- plugin-map/ (Map visualization)
- plugin-block-grid-card/ (Grid card layout)
```

---

## Phase 11: Advanced Features

### Priority 1 (Workflows)
- `plugin-workflow/` — Workflow definition + execution
- `plugin-flow-engine/` — Flow diagram editor
- `plugin-workflow-*` — Workflow actions/triggers/guards

### Priority 2 (User Features)
- `plugin-form-drafts/` — Draft saving
- `plugin-public-forms/` — Public form sharing
- `plugin-comments/` — Comments/annotations
- `plugin-backup-restore/` — Backup/restore

### Priority 3 (Field Types)
- `plugin-field-formula/` — Formula fields
- `plugin-field-markdown-vditor/` — Rich text editing
- `plugin-field-attachment-url/` — File attachments
- `plugin-field-code/` — Code editor field

---

## Adaptation Rules (When Copying)

### 1. Import Path Conversion
```typescript
// Before (NocoBase)
import { useField } from '@nocobase/client';

// After (NeureCore)
import { useField } from '@/schema-component';
```

### 2. Module Re-exports
Update target `index.ts` files to re-export all copied symbols:
```typescript
export * from './CollectionManager';
export * from './hooks/useCollection';
export * from './interfaces/ICollection';
// ... etc
```

### 3. Type Preservation
- Keep all interfaces/types exactly as-is
- Keep generics and constraints
- Keep JSDoc comments
- Only update import paths in types that reference other NocoBase modules

### 4. Theme/Styling
- Preserve CSS imports as-is (Ant Design tokens)
- Preserve Ant Design component usage
- Keep variable references (will use NeureCore's Ant Design config)

### 5. i18n/Localization
- Keep `useTranslation('moduleName')` calls (same pattern)
- Keep English default strings
- Extract to locale files later if needed

---

## Quality Assurance

### Per-Phase Checklist
- [ ] Files copied with directory structure intact
- [ ] Import paths updated for NeureCore structure
- [ ] TypeScript compilation: 0 errors on modified code
- [ ] Existing Phase X tests still pass
- [ ] New module exports documented in `index.ts`
- [ ] Integration points verified with previous phases

### Testing Strategy
1. **Compilation test** — `npx tsc --noEmit --skipLibCheck`
2. **Build test** — `npm run build` (frontend-admin)
3. **Integration test** — Create POC using new code
4. **Visual test** — Render basic UI with new components

---

## File Size Guide (for planning)

| Phase | Module | Files | Size (LOC) | Status |
|-------|--------|-------|-----------|--------|
| 6 | block-provider | 18 | ~3,500 | ✅ DONE |
| 6 | data blocks | 7 | ~2,000 | ✅ DONE |
| 6 | record-provider | 2 | ~800 | ✅ DONE |
| 6 | filter-provider | 3 | ~1,200 | ✅ DONE |
| 6 | utilities | 8 | ~2,000 | ✅ DONE |
| **6 TOTAL** | **206 files** | **12,500 LOC** | ✅ COMPLETE |
| 7 | collection-manager | 45 | ~5,000 | 📋 NEXT |
| 7 | schema-component | 95 | ~13,000 | 📋 NEXT |
| 7 | schema-initializer | 25 | ~3,500 | 📋 NEXT |
| 7 | schema-settings | 18 | ~2,500 | 📋 NEXT |
| **7 TOTAL** | **183 files** | **24,000 LOC** | 📋 PLANNED |

---

## Notes for Implementation

### Import Path Strategy
When copying files, use a systematic approach:
```bash
# 1. Copy directory with structure
cp -r /nocobase-main/packages/core/client/src/collection-manager /frontend-admin/src/

# 2. Find all @nocobase imports in copied files
grep -r "@nocobase/client" /frontend-admin/src/collection-manager/

# 3. Convert them based on target module location:
# @nocobase/client/collection-manager → ./collection-manager or ../ (relative)
# @nocobase/client/hooks → ../hooks (relative)
# @nocobase/client/schema-component → ../schema-component (relative)
```

### Handling Circular Dependencies
NocoBase has some circular imports. If encountered:
- Mirror the NocoBase structure (it's designed this way)
- Use index files for re-exports
- Create barrel exports at module boundaries

### Documentation During Copy
For each phase, document:
- What was copied and why
- What was modified (import paths)
- Any incompatibilities found and how resolved
- Integration verification steps performed
- Performance impact (if any)

---

## Next Command

When ready to proceed with Phase 7:
1. Read this document completely
2. Confirm all Phase 6 code is locked/committed
3. Begin Phase 7: Copy collection-manager/ (40-50 files, ~5,000 LOC)
4. Test TypeScript compilation after each sub-module (collection-manager, then schema-component, etc.)
5. Create POC integrating with Phase 4-6 code
6. Document results and move to next phase

**Estimated Timeline:** Phase 7 (3-4 hours), Phase 8-9 (2-3 hours each), Phase 10-11 (1-2 hours each)
