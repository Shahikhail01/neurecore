# NocoBase Reference Folder - LOCKED & READ-ONLY

**Lock Date:** April 8, 2026  
**Status:** ✅ SECURED

---

## Architecture Lock

### Reference Folder (READ-ONLY)

```
/mnt/data/Web Dev/NeureCore/nocobase-main/
├─ Purpose: Source reference ONLY
├─ Modifications: FORBIDDEN
├─ Commits: EXCLUDED from git
└─ Access: READ-ONLY (chmod 444 recommended)
```

### Production Folders (ACTIVE)

```
/mnt/data/Web Dev/NeureCore/frontend-admin/src/    [COPY HERE]
/mnt/data/Web Dev/NeureCore/backend/src/           [COPY HERE]
```

---

## Files Currently Locked from Reference

**Phase 6 Modules (Already Copied):**

| Module            | Source Path                          | Dest Path                             | Files  | Status |
| ----------------- | ------------------------------------ | ------------------------------------- | ------ | ------ |
| block-provider    | `nocobase-main/.../block-provider/`  | `frontend-admin/src/block-provider/`  | 18     | ✅     |
| data-source       | `nocobase-main/.../data-source/`     | `frontend-admin/src/data-source/`     | 25     | ✅     |
| record-provider   | `nocobase-main/.../record-provider/` | `frontend-admin/src/record-provider/` | 3      | ✅     |
| filter-provider   | `nocobase-main/.../filter-provider/` | `frontend-admin/src/filter-provider/` | 5      | ✅     |
| **TOTAL PHASE 6** |                                      |                                       | **51** | **✅** |

---

## Modules Available to Copy (Next Phases)

**Phase 7 Ready:**

- schema-initializer (40 files)
- schema-settings (20 files)
- hooks (50+ files)

**Phase 8 Ready:**

- collection-manager (40+ files)
- modules/blocks (100+ files)

**Phase 9+ Ready:**

- plugin-manager (30 files)
- acl (20 files)
- flow (30 files)
- And more...

---

## Lock Enforcement

### Git Configuration

```bash
# Add to .gitignore
echo "/nocobase-main/" >> .gitignore
```

### File Permissions (Optional Unix Security)

```bash
# Make reference folder read-only
chmod -R 555 /nocobase-main/

# Restore if copying needed
chmod -R 755 /nocobase-main/
```

---

## Copy Authorization Matrix

| Action    | Reference Folder | Production Folder | Backend Folder   |
| --------- | ---------------- | ----------------- | ---------------- |
| Read      | ✅ YES           | ✅ YES            | ✅ YES           |
| Copy FROM | ✅ YES           | ❌ NO             | ❌ NO            |
| Copy TO   | ❌ NO            | ✅ YES            | ✅ YES           |
| Modify    | ❌ NO            | ✅ YES            | ✅ YES           |
| Commit    | ❌ NO            | ✅ YES            | ✅ YES           |
| Delete    | ❌ NEVER         | ✅ (if breaking)  | ✅ (if breaking) |

---

## Verification Checklist

### ✅ Phase 6 Verification

- [x] 51 files copied from reference
- [x] All files retain original NocoBase headers
- [x] Zero TypeScript compilation errors
- [x] Build successful (62 pages pre-rendered)
- [x] Production code in correct location
- [x] Reference folder untouched

### ✅ Phase 7 Ready

- [ ] schema-initializer copy procedure documented
- [ ] schema-settings copy procedure documented
- [ ] hooks copy procedure documented
- [ ] Dependencies identified
- [ ] Test plan established

---

## Developer Workflow

### When Copying New Module

```bash
# 1. Confirm module exists in reference
ls -la nocobase-main/packages/core/client/src/[MODULE_NAME]/

# 2. Copy to production (NEVER modify in reference)
cp -r nocobase-main/packages/core/client/src/[MODULE_NAME]/ \
    frontend-admin/src/[MODULE_NAME]/

# 3. Adapt imports in production folder ONLY
cd frontend-admin/src/[MODULE_NAME]/
# Edit files here - NEVER touch reference

# 4. Test
cd frontend-admin && npm run build

# 5. Commit production code ONLY
git add frontend-admin/src/[MODULE_NAME]/
git commit -m "feat(phase[X]): copy [MODULE_NAME] from nocobase-main"

# DO NOT COMMIT:
# git add nocobase-main/      ← WRONG
# git rm -r nocobase-main/    ← WRONG
```

---

## Reference Contents Summary

**Location:** `/mnt/data/Web Dev/NeureCore/nocobase-main/`

**Packages Available:**

- `packages/core/client/` → Frontend modules (47 directories)
- `packages/core/server/` → Backend modules
- `packages/core/database/` → Database layer
- `packages/plugins/` → Plugin examples
- `packages/presets/` → Preset configurations

**Total Modules Available:** 100+  
**Production Code in Scope:** ~20 high-priority modules

---

## Status Dashboard

| Item                    | Status | Verified | Date          |
| ----------------------- | ------ | -------- | ------------- |
| Reference folder exists | ✅     | Yes      | April 8, 2026 |
| Production copies exist | ✅     | Yes      | April 8, 2026 |
| Phase 6 complete        | ✅     | Yes      | April 8, 2026 |
| TypeScript: 0 errors    | ✅     | Yes      | April 8, 2026 |
| Build success           | ✅     | Yes      | April 8, 2026 |
| Lock policy documented  | ✅     | Yes      | April 8, 2026 |
| Architecture secured    | ✅     | Yes      | April 8, 2026 |

---

## What NOT To Do

❌ **FORBIDDEN ACTIONS:**

1. Modify files in `/nocobase-main/`

   ```bash
   # ❌ WRONG
   nano nocobase-main/packages/core/client/src/block-provider/BlockProvider.tsx
   git commit -m "fix bug in nocobase-main"
   ```

2. Use symbolic links to reference folder

   ```bash
   # ❌ WRONG
   ln -s nocobase-main/packages/core/client/src/hooks/ frontend-admin/src/hooks
   ```

3. Cherry-pick individual files

   ```bash
   # ❌ WRONG
   cp nocobase-main/packages/core/client/src/hooks/useCollection.ts \
      frontend-admin/src/hooks/
   ```

4. Commit reference folder
   ```bash
   # ❌ WRONG
   git add nocobase-main/
   git commit -m "add reference"
   ```

---

## What TO Do

✅ **CORRECT PROCEDURES:**

1. Copy entire modules

   ```bash
   # ✅ CORRECT
   cp -r nocobase-main/packages/core/client/src/schema-initializer/ \
       frontend-admin/src/schema-initializer/
   ```

2. Adapt imports in production code

   ```bash
   # ✅ CORRECT - Edit only in frontend-admin/
   cd frontend-admin/src/schema-initializer/
   # Update imports from @nocobase/* to @/*
   ```

3. Commit production code

   ```bash
   # ✅ CORRECT
   git add frontend-admin/src/schema-initializer/
   git commit -m "feat(phase7): copy schema-initializer from nocobase-main"
   ```

4. Keep reference pristine
   ```bash
   # ✅ CORRECT - Never loop back
   # Changes stay in production code only
   ```

---

## Emergency Procedures

### If Reference Folder Was Modified

1. **Restore from backup/git:**

   ```bash
   # If git history exists, reset to clean state
   cd nocobase-main && git reset --hard HEAD
   ```

2. **Re-download from source:**
   ```bash
   # Download fresh NocoBase archive
   # Extract to nocobase-main/
   # Verify structure matches reference
   ```

### If Production Code Needs Update

1. **Keep changes in production only:**

   ```bash
   # Edit in frontend-admin/src/[module]/
   # Never edit in nocobase-main/
   # Commit production changes
   ```

2. **Upgrade reference if needed:**
   ```bash
   # Later, when upgrading NocoBase version:
   # 1. Download new NocoBase release
   # 2. Extract to temporary folder
   # 3. Replace nocobase-main/
   # 4. Copy updated modules to production
   # 5. Test and commit production changes
   ```

---

## Support & Questions

**For lock enforcement issues:** See `.gitignore`  
**For copy procedure:** See `PHASE_7_NOCOBASE_INTEGRATION_PLAN.md`  
**For architecture:** See memory file `nocobase-integration-strategy.md`  
**For quick reference:** See `NOCOBASE_INTEGRATION_GUIDE.md`

---

**Lock Status:** ✅ ACTIVE  
**Last Verified:** April 8, 2026  
**Next Review:** After Phase 7 completion  
**Maintained By:** NeureCore Team
