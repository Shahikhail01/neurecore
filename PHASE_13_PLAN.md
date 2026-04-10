# Phase 13: Functional NocoBase Integration

**Date**: April 10, 2026  
**Status**: IN PROGRESS  
**Objective**: Complete functional NocoBase integration into NeureCore

---

## Phase 13 Execution Plan

### Step 1: Router Compatibility Layer (IN PROGRESS)
- Create `frontend-admin/src/lib/router-compat.ts`
- Create `frontend-tenant/src/lib/router-compat.ts`
- Replace all `react-router-dom` imports with compatibility layer

### Step 2: Resolve @nocobase/* Imports
- Create path aliases in `tsconfig.json` for @nocobase packages
- Create wrapper files that re-export from local copies
- Update frontend packages to resolve local modules

### Step 3: Fill schema-initializer Module
- Copy 51 files from nocobase-main reference (if exists)
- Or create comprehensive schema-initializer implementation

### Step 4: Fix TypeScript Errors
- Remove `ignoreBuildErrors: true` from next.config.js files
- Surface and fix all TS compilation errors
- Enable ESLint during builds

### Step 5: Wire NocoBase into App Pages
- Create demo pages showing BlockProvider usage
- Integrate CollectionManager for schema management
- Add SchemaComponent rendering capabilities

### Step 6: Backend NocoBase Integration
- Initialize NocoBase plugin system in NestJS
- Create server-side module registration
- Wire database module into backend

---

## Expected Outcomes

✅ Zero TypeScript errors in frontend-admin  
✅ Zero TypeScript errors in frontend-tenant  
✅ Functional NocoBase components rendering in app  
✅ React Router → Next.js router compatibility layer working  
✅ Backend NocoBase modules accessible  

---

## Files to Create/Modify

### Frontend Admin
- `frontend-admin/src/lib/router-compat.ts` (NEW)
- `frontend-admin/next.config.js` (MODIFY - remove ignoreBuildErrors)
- `frontend-admin/tsconfig.json` (MODIFY - add path aliases)
- Multiple page components (UPDATE - wire NocoBase)

### Frontend Tenant  
- `frontend-tenant/src/lib/router-compat.ts` (NEW)
- `frontend-tenant/next.config.js` (MODIFY)
- `frontend-tenant/tsconfig.json` (MODIFY)

### Backend
- `backend/src/nocobase/nocbase-init.service.ts` (NEW)
- `backend/src/nocobase/nocobase.module.ts` (NEW)
- `backend/app.module.ts` (MODIFY - integrate NocoBase)

### Scripts
- `backend/scripts/fix-router-imports.js` (ALREADY CREATED)
- `backend/scripts/resolve-nocobase-imports.js` (NEW)

---

## Success Metrics

- [ ] All TS files compile without errors (tsc --noEmit)
- [ ] React Router imports replaced (0 remaining)
- [ ] @nocobase imports resolved (path aliases working)
- [ ] schema-initializer populated (51+ files)
- [ ] App pages render NocoBase components
- [ ] Backend loads NocoBase plugins
- [ ] Zero lint errors
- [ ] Build succeeds with errors enabled

