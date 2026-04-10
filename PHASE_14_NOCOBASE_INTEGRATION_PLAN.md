# Phase 14: NocoBase Full Integration Plan

**Date:** April 10, 2026  
**Status:** IN PROGRESS  
**Objective:** Complete functional NocoBase integration in frontend-tenant with login UI toggle  
**Branch:** `4-noco-2stage`

---

## Audit Summary

### Phase 13 Completion Status

| Task                                 | Status      | Notes                                      |
| ------------------------------------ | ----------- | ------------------------------------------ |
| Router compat layer (both frontends) | ✅ Complete | `router-compat.ts` exists in both          |
| @nocobase/\* import resolution       | ✅ Complete | `nocobase-client-shim.ts` + tsconfig paths |
| schema-initializer module            | ✅ Complete | Custom `index.tsx` in both frontends       |
| Wire NocoBase into admin pages       | ✅ Complete | `/admin/nocobase-demo` page created        |
| Frontend-admin build                 | ✅ Complete | `.next/build-manifest.json` exists         |
| Backend NocoBase module              | ✅ Complete | 3 files fixed, listening on port 3000      |
| Frontend-tenant dev server           | ✅ Complete | Running on port 3001                       |
| E2E verification tests               | ❌ Not done | Still pending                              |

### Frontend-Tenant NocoBase Module Inventory

**Present in both admin and tenant:**

- `acl/`, `api-client/`, `application/`, `block-provider/`, `collection-manager/`
- `common/`, `core/`, `data-source/`, `demo-utils/`, `filter-provider/`
- `flow/`, `formily/`, `hooks/`, `hooks-extra/`, `icon/`, `locale/`
- `modules/`, `plugins/`, `pm/`, `schema-component/`, `schema-initializer/`
- `schema-items/`, `schema-settings/`, `schema-templates/`

**Present in admin only (missing from tenant):**

- `ai/`, `antd-config-provider/`, `appInfo/`, `async-data-provider/`
- `block-configs/`, `china-region/`, `contexts/`, `css-variable/`
- `document-title/`, `flag-provider/`, `global-theme/`, `hoc/`, `i18n/`
- `lazy-helper/`, `nocobase-buildin-plugin/`, `plugin-manager/`
- `powered-by/`, `record-provider/`, `route-switch/`, `style/`
- `system-settings/`, `__tests__/`, `testUtils/`, `__types__/`, `user/`, `variables/`

### Critical Issues Found

1. **`frontend-tenant/src/application/AppProvider.tsx`** imports `CurrentUserProvider` from `../user`  
   → `user/` directory does NOT exist in frontend-tenant → TypeScript error

2. **`AppProvider.tsx`** is NOT used in the main Next.js `app/layout.tsx`  
   → NocoBase providers are not active anywhere in tenant app

3. **No NocoBase-based route** exists in frontend-tenant  
   → There is no "New UI" page to navigate to after login

4. **TypeScript `ignoreBuildErrors: true`** still set in `next.config.js`  
   → Hides real type errors during build

---

## Phase 14 Implementation Plan

### Priority 1: Login UI Toggle (IMMEDIATE)

**Objective:** Allow users to choose between Legacy UI and New UI (NocoBase-based) at login

**Implementation:**

- Modify `frontend-tenant/src/app/login/page.tsx`
- Add `uiMode: 'legacy' | 'nocobase'` state, persisted to `localStorage` key `ui_mode`
- Add toggle UI: two radio/tab buttons labeled "Legacy UI" and "New UI (NocoBase)"
- After login success: route to `/nocobase-ui` if `ui_mode === 'nocobase'`, else `/dashboard`

**Files:**

- `frontend-tenant/src/app/login/page.tsx` (modify)

---

### Priority 2: NocoBase Entry Route (IMMEDIATE)

**Objective:** Create the `/nocobase-ui` page as NocoBase-powered landing

**Implementation:**

- Create `frontend-tenant/src/app/nocobase-ui/page.tsx`
  - Standalone page (not using broken AppProvider)
  - Shows NocoBase-powered admin panel overview
  - Links back to Legacy UI (`/dashboard`)
  - Includes working NocoBase components: `SchemaInitializerProvider`, etc.

- Create `frontend-tenant/src/app/nocobase-ui/layout.tsx`
  - Wraps children in a clean NocoBase-safe provider stack

**Files to create:**

- `frontend-tenant/src/app/nocobase-ui/layout.tsx` (NEW)
- `frontend-tenant/src/app/nocobase-ui/page.tsx` (NEW)

---

### Priority 3: Fix AppProvider Import (HIGH)

**Objective:** Remove broken `../user` import from tenant AppProvider

**Problem:** Tenant's `AppProvider.tsx` imports from `../user` which doesn't exist.

**Fix:** Simplify tenant's `AppProvider.tsx` to remove `CurrentUserProvider` wrapper.  
Tenant uses Zustand `useAuthStore` for auth, not NocoBase's user provider pattern.

**Files:**

- `frontend-tenant/src/application/AppProvider.tsx` (modify)

---

### Priority 4: Missing `user` Module (HIGH)

**Objective:** Create a stub `user` module for compatibility

**Implementation:**

- Copy `frontend-admin/src/user/` to `frontend-tenant/src/user/`
- This enables proper NocoBase pattern where needed

**Files to create:**

- `frontend-tenant/src/user/CurrentUserProvider.tsx`
- `frontend-tenant/src/user/index.ts`

---

### Priority 5: Wire AppProvider into NocoBase Routes (MEDIUM)

**Objective:** Initialize NocoBase providers for the new UI route

**Implementation:**

- `nocobase-ui/layout.tsx` should use the `AppProvider` from `../../application`
- This provides the canonical NocoBase provider stack for all `/nocobase-ui/*` routes

---

### Priority 6: Port Remaining Admin Modules to Tenant (MEDIUM)

**Objective:** Bring tenant up to parity with admin for NocoBase modules

**Modules to copy from admin to tenant (in priority order):**

1. `user/` — NocoBase user context (required for AppProvider)
2. `record-provider/` — Record context system (required for data blocks)
3. `variables/` — Variable/expression evaluation
4. `async-data-provider/` — Async data handling
5. `block-configs/` — Block configuration
6. `route-switch/` — Route switching logic
7. `flag-provider/` — Feature flags
8. `global-theme/` — Theming
9. `css-variable/` — CSS variables
10. `contexts/` — React contexts
11. `system-settings/` — System settings UI
12. `nocobase-buildin-plugin/` — Built-in plugin registration
13. `plugin-manager/` — Plugin management UI
14. `i18n/` — Internationalization

---

### Priority 7: TypeScript Clean-up (MEDIUM)

**Objective:** Enable proper type checking and fix errors

**Actions:**

1. Run `pnpm exec tsc --noEmit --skipLibCheck` in both frontends
2. Fix errors category by category:
   - Missing module errors (fix imports or create stubs)
   - Type mismatch errors (fix type annotations)
   - Unused variable warnings (prefix with `_`)
3. Consider enabling `ignoreBuildErrors: false` in `next.config.js` only after errors are clean

---

### Priority 8: Backend NocoBase API Endpoints (LOW)

**Objective:** Build NocoBase API bridge between NestJS and NocoBase modules

**Backend endpoints needed:**

- `GET /api/nocobase/collections` — List all collections
- `GET /api/nocobase/collections/:name/records` — List records
- `POST /api/nocobase/collections/:name/records` — Create record
- Schema management endpoints

**Files:**

- `backend/src/modules/nocobase/nocobase.controller.ts` (add endpoints)
- `backend/src/modules/nocobase/nocobase.service.ts` (new service)

---

### Priority 9: E2E Verification (LOW)

**Objective:** Automated tests for the NocoBase integration

**Tests:**

- Login with NocoBase UI mode selected → redirects to `/nocobase-ui`
- Login with Legacy mode selected → redirects to `/dashboard`
- NocoBase page loads without runtime errors
- Backend `/api/nocobase/status` returns valid response

---

## Architecture Decision

### Two-Track UI Strategy

```
User logs in
    ├── ui_mode = 'legacy'   → /dashboard      (existing Zustand + TailwindCSS UI)
    └── ui_mode = 'nocobase' → /nocobase-ui    (NocoBase-powered UI)
```

**Rationale:**

- Allows gradual migration without breaking existing functionality
- Each track has its own layout, providers, and component tree
- Users can switch between tracks at any time via login preference
- NocoBase track can be developed/tested independently

### NocoBase Provider Stack (for `/nocobase-ui/*`)

```
RootLayout (app/layout.tsx) — no changes
  └── NocoBaseLayout (app/nocobase-ui/layout.tsx)
        └── ConfigProvider (antd)
              └── SchemaInitializerProvider
                    └── {page content}
```

---

## File Change Summary

### Immediate (Phase 14 Part 1)

| File                                               | Action                          | Priority |
| -------------------------------------------------- | ------------------------------- | -------- |
| `frontend-tenant/src/app/login/page.tsx`           | Modify — add UI toggle          | P1       |
| `frontend-tenant/src/app/nocobase-ui/page.tsx`     | Create — NocoBase UI entry      | P2       |
| `frontend-tenant/src/app/nocobase-ui/layout.tsx`   | Create — NocoBase layout        | P2       |
| `frontend-tenant/src/application/AppProvider.tsx`  | Fix — remove broken user import | P3       |
| `frontend-tenant/src/user/index.ts`                | Create — user module stub       | P4       |
| `frontend-tenant/src/user/CurrentUserProvider.tsx` | Create — user provider stub     | P4       |

### Short-term (Phase 14 Part 2)

| File                                                  | Action                   | Priority |
| ----------------------------------------------------- | ------------------------ | -------- |
| `frontend-tenant/src/user/`                           | Copy from admin          | P4       |
| `frontend-tenant/src/record-provider/`                | Copy from admin          | P6       |
| `frontend-tenant/src/variables/`                      | Copy from admin          | P6       |
| `frontend-tenant/src/route-switch/`                   | Copy from admin          | P6       |
| `backend/src/modules/nocobase/nocobase.controller.ts` | Add collection endpoints | P8       |

---

## Success Criteria

- [ ] Toggle on login page: "Legacy UI" | "New UI (NocoBase)"
- [ ] Login routes to correct UI based on selection
- [ ] `/nocobase-ui` page loads without JS errors
- [ ] `pnpm exec tsc --noEmit` has zero new errors in modified files
- [ ] Backend `GET /api/nocobase/status` returns 200 (with valid JWT)
- [ ] AppProvider in tenant has no broken imports
- [ ] `ui_mode` preference persists across browser sessions (localStorage)
