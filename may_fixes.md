# May 2026 SOLID Implementation Plan

**Date:** May 17, 2026  
**Project:** NeureCore  
**Goal:** Apply 100% SOLID principles to resolve three architectural gaps and ensure zero-error builds across the codebase.

---

## Audit Findings

| # | Issue | Severity | SOLID Violation |
|---|---|---|---|
| 1 | Frontend has no unit test framework (only Playwright e2e) | High | **D**ependency Inversion — tests depend on nothing (no framework) |
| 2 | Tailwind 4.x beta exists but 3.4.17 stable is current | Low | **L**iskov Substitution — using an older Tailwind is fine; not a violation |
| 3 | Prisma 6.x in preview but 5.22.0 stable is current | Low | Same as above — 5.22 is production-stable |

> Only Issue #1 is a genuine SOLID violation. Issues #2 and #3 are **status-quo confirmations** — current versions are appropriate.

---

## SOL[ID] Checklist

### S — Single Responsibility
- Each test file has one responsibility (one hook, one util, one component)
- No mega-test files

### O — Open/Closed
- Test utilities are open for extension, closed for modification

### L — Liskov Substitution
- Tailwind 3.4.17 and Prisma 5.22.0 are the correct stable choices for production; they substitute cleanly

### I — Interface Segregation
- Test runner uses only Vitest's minimal public API surface

### D — Dependency Inversion
- High-level test modules depend on abstractions (`@testing-library/react`, not DOM)
- No direct `document.` calls — use RTL queries

---

## Implementation Steps

### Step 1 — Install Vitest + Testing Libraries (frontend-tenant)

```bash
pnpm add -D vitest @testing-library/react @testing-library/dom @testing-library/jest-dom jsdom @types/testing-library__jest-dom
```

**Why Vitest?**  
- ESM-first, compatible with Next.js 15 (Vite-based bundler)
- Drop-in compatible with Jest API (easy migration later)
- Faster than Jest in watch mode
- Full TypeScript support out of the box

**Why @testing-library/react?**  
- Queries (`getByRole`, `getByLabelText`) are accessible by default
- Follows D — Dependency Inversion: tests depend on component behavior, not implementation details

### Step 2 — Configure `vitest.config.ts` (frontend-tenant)

- Environment: `jsdom`
- Setup files: `src/setupTests.ts` for `@testing-library/jest-dom` matchers
- Aliases: same as `tsconfig.json` paths (e.g., `@/` → `./src/`)
- Reporters: standard verbose
- Coverage: disabled for now (can add V8 later)

### Step 3 — Update `package.json` Scripts (frontend-tenant)

```json
{
  "test": "vitest",
  "test:run": "vitest run",
  "test:ci": "vitest run --reporter=default",
  "type-check": "tsc --noEmit"
}
```

### Step 4 — Create `src/setupTests.ts`

```ts
// src/setupTests.ts
import '@testing-library/jest-dom';
```

Import this in every test file via `setupFilesAfterEnv` in vitest config.

### Step 5 — Write First Placeholder Test

Create `src/utils/__tests__/format.test.ts` with a simple smoke test to validate the framework works end-to-end.

### Step 6 — Verify Tailwind 3.4.17 (frontend-tenant)

```bash
cat frontend-tenant/package.json | grep tailwind
# Expected: "tailwindcss": "^3.4.17"
```

No change needed — 3.4.17 is stable and production-ready.

### Step 7 — Verify Prisma 5.22.0 (backend)

```bash
cat backend/package.json | grep '"@prisma/client"'
# Expected: "@prisma/client": "5.22.0"
```

No change needed — 5.22 is production-stable.

### Step 8 — Full pnpm Install + Build Verification

```bash
# Frontend
cd frontend-tenant && pnpm install && pnpm run build

# Backend
cd backend && pnpm install && pnpm run build
```

Both builds must complete with **zero errors** before considering this plan complete.

---

## Files to Create / Modify

| File | Action |
|---|---|
| `frontend-tenant/vitest.config.ts` | **CREATE** |
| `frontend-tenant/src/setupTests.ts` | **CREATE** |
| `frontend-tenant/src/utils/__tests__/format.test.ts` | **CREATE** |
| `frontend-tenant/package.json` | **MODIFY** — add test scripts |
| `may_fixes.md` | **CREATE** — this plan |

## Success Criteria

- [ ] `vitest.config.ts` created and valid
- [ ] `setupTests.ts` imports `@testing-library/jest-dom`
- [ ] `pnpm --dir frontend-tenant test:run` exits 0 with ≥1 passing test
- [ ] `pnpm --dir frontend-tenant build` exits 0 with zero errors
- [ ] `pnpm --dir backend build` exits 0 with zero errors
- [ ] Tailwind 3.4.17 remains unchanged
- [ ] Prisma 5.22.0 remains unchanged