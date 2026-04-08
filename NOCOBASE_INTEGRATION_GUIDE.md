# NeureCore + NocoBase Integration Guide

**Quick Start for Developers**

---

## 🔒 Folder Architecture

```
PROJECT ROOT
│
├─ nocobase-main/                          [🔴 READ-ONLY REFERENCE]
│  └─ packages/core/client/src/            [Source modules to copy FROM]
│
└─ frontend-admin/src/                     [🟢 PRODUCTION CODE]
   ├─ block-provider/                      [✅ from nocobase-main]
   ├─ data-source/                         [✅ from nocobase-main]
   ├─ record-provider/                     [✅ from nocobase-main]
   ├─ filter-provider/                     [✅ from nocobase-main]
   ├─ schema-component/                    [✅ from nocobase-main + Phase 5]
   ├─ schema-initializer/                  [🟡 Phase 7 - copy here]
   ├─ schema-settings/                     [🟡 Phase 7 - copy here]
   ├─ collection-manager/                  [🟡 Phase 8 - copy here]
   └─ modules/blocks/                      [🟡 Phase 8+ - copy here]
```

---

## ✅ RULE #1: REFERENCE FOLDER IS READ-ONLY

**The `/nocobase-main/` folder is REFERENCE ONLY.**

✅ **DO:**

- Read code from `/nocobase-main/`
- Understand architecture from reference
- Copy modules to production

❌ **DO NOT:**

- Modify files in `/nocobase-main/`
- Commit changes to reference folder
- Use symbolic links instead of copies
- Run npm/yarn in reference folder

---

## 📋 RULE #2: COPY ENTIRE MODULES

**Never cherry-pick files. Copy complete module directories.**

### Example: Copying schema-initializer (Phase 7)

```bash
# ✅ CORRECT - Copy entire module
cp -r nocobase-main/packages/core/client/src/schema-initializer/ \
    frontend-admin/src/schema-initializer/

# ❌ WRONG - Don't copy individual files
# cp nocobase-main/.../schema-initializer/components/... frontend-admin/src/...
```

---

## 🏷️ RULE #3: ADD SOURCE HEADERS

**Every file copied from NocoBase must have a source header.**

```typescript
/**
 * Copied from NocoBase v0.x Enterprise
 * Source: packages/core/client/src/schema-initializer/SchemaInitializer.tsx
 * Adapted for NeureCore v1.0
 *
 * Original License: Apache 2.0 / SSPL
 * Original Author: NocoBase Community
 * Adaptations: NeureCore Team
 *
 * Last synced: [DATE]
 */
```

---

## 🔗 RULE #4: UPDATE IMPORTS

**Adapt imports to NeureCore paths.**

### Before (NocoBase):

```typescript
import { useCollectionManager } from "@nocobase/client";
import { useRequest } from "@nocobase/client";
import { Button } from "@nocobase/client";
```

### After (NeureCore):

```typescript
import { useCollectionManager } from "@/collection-manager";
import { useRequest } from "@/hooks";
import { Button } from "antd"; // or @/components
```

---

## 📦 Phase 6: Completed Modules

**These are already copied and integrated:**

| Module          | Source                       | Status | Files |
| --------------- | ---------------------------- | ------ | ----- |
| BlockProvider   | `block-provider/`            | ✅     | 18    |
| DataSource      | `data-source/`               | ✅     | 50+   |
| RecordProvider  | `record-provider/`           | ✅     | 4     |
| FilterProvider  | `filter-provider/`           | ✅     | 4     |
| SchemaComponent | `schema-component/` + custom | ✅     | 20    |

All Phase 6 code:

- ✅ Compiles with zero TS errors
- ✅ Build succeeds (62 pages pre-rendered)
- ✅ Ready for production use

---

## 🟡 Phase 7: Current Priority

**Next modules to copy:**

### 1. schema-initializer (CRITICAL)

```
Source: nocobase-main/packages/core/client/src/schema-initializer/
Dest:   frontend-admin/src/schema-initializer/
Files:  ~40
```

_Dynamic UI schema initialization, drag-drop configuration_

### 2. schema-settings (CRITICAL)

```
Source: nocobase-main/packages/core/client/src/schema-settings/
Dest:   frontend-admin/src/schema-settings/
Files:  ~20
```

_Property editors, field configuration panels_

### 3. hooks (HIGH)

```
Source: nocobase-main/packages/core/client/src/hooks/
Dest:   frontend-admin/src/hooks/
Files:  ~50
```

_React hooks: useCollection, useForm, useRecord, useBlock, etc._

---

## 📅 Timeline

| Phase    | Modules                                                        | Timeline      | Status  |
| -------- | -------------------------------------------------------------- | ------------- | ------- |
| Phase 6  | block-provider, data-source, record-provider, filter-provider  | ✅ Complete   | DONE    |
| Phase 7  | schema-initializer, schema-settings, hooks                     | 2-3 days      | READY   |
| Phase 8  | collection-manager, form/table/details blocks, backend modules | 4-5 days      | PLANNED |
| Phase 9+ | kanban, calendar, map, gallery, plugins, acl                   | 3-4 days each | FUTURE  |

---

## 🧪 Testing After Copy

**Always verify after copying a module:**

```bash
# 1. Check TypeScript compilation
cd frontend-admin
npx tsc --noEmit --skipLibCheck

# 2. Build the project
npm run build

# 3. Run tests (if available)
npm run test

# 4. Start dev server
npm run dev
```

**Must have zero TS errors before committing.**

---

## 📖 Reference Locations

### Find modules to copy:

```
/mnt/data/Web Dev/NeureCore/nocobase-main/packages/core/client/src/
```

### Full reference documentation:

```
/mnt/data/Web Dev/NeureCore/PHASE_7_NOCOBASE_INTEGRATION_PLAN.md
/mnt/data/Web Dev/NeureCore/NOCOBASE_INTEGRATION_STRATEGY.md (memory)
```

### Current work:

```
/mnt/data/Web Dev/NeureCore/frontend-admin/src/
```

---

## 🚀 Quick Copy Template

```bash
#!/bin/bash
MODULE_NAME="schema-initializer"  # Change as needed

# 1. Copy module
cp -r nocobase-main/packages/core/client/src/${MODULE_NAME}/ \
    frontend-admin/src/${MODULE_NAME}/

# 2. Update imports (manual - list them first)
grep -r "from '@nocobase" frontend-admin/src/${MODULE_NAME}/

# 3. Add source headers (manual - to each file)
# Use template from RULE #3 above

# 4. Test
cd frontend-admin && npm run build && npx tsc --noEmit --skipLibCheck

# 5. Commit
git add -A
git commit -m "feat(phase7): copy ${MODULE_NAME} from nocobase-main"
```

---

## ❓ FAQ

### Q: Can I modify files in `/nocobase-main/`?

**A:** NO. It's read-only reference. Copy to NeureCore if you need changes.

### Q: Why copy instead of symbolic links?

**A:** Full isolation, clear separation, no accidental reference changes.

### Q: What if NocoBase updates?

**A:** Extract new version to `/nocobase-main/`, copy updated modules, test.

### Q: Why entire modules, not individual files?

**A:** Modules have internal dependencies. Partial copies break functionality.

### Q: How do I handle missing dependencies?

**A:** Listed in each module doc. Install via `pnpm add`.

---

## 📞 Support

- **Integration Plan:** `PHASE_7_NOCOBASE_INTEGRATION_PLAN.md`
- **Architecture Details:** Memory: `nocobase-integration-strategy.md`
- **Phase 6 Report:** `PHASE_6_COMPLETION_REPORT.md`

---

**Last Updated:** April 8, 2026  
**Current Phase:** 6 (Complete) → 7 (Ready)  
**Status:** ✅ Production Ready
