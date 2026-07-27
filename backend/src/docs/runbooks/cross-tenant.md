# Cross-Tenant Incident Runbook

**Trigger:** Any suspected cross-tenant data exposure — manual report
or a negative certification test failure on
`test/certification/tenant-isolation.spec.ts`.

## Symptoms
- A user can read/write a record owned by a different tenant.
- A negative test in `tenant-isolation.spec.ts` reports a 200/201
  where a 404 was expected.
- `AuditLog` shows an `actor` from tenant A performing an action on
  a `resourceId` that belongs to tenant B.

## Diagnosis
1. Capture the failing request — method, path, headers, body,
   and the `correlationId`.
2. Run the canonical negative test:
   ```bash
   pnpm test:unit -- test/certification/tenant-isolation.spec.ts
   ```
3. Identify the missing tenant predicate by reading the failing
   repository / service code.
4. Check whether the path bypasses
   `TenantScopeEnforcer.assertSameTenant` (Phase 8 §10.1).
5. Look for a recent change to auth, guards, or repository
   adapters that may have removed a `tenantId` predicate.

## Resolution
1. **DO NOT** roll forward with the leaked data — preserve the
   evidence in a sealed incident bucket.
2. Patch the missing `tenantId` predicate and add a regression
   test in `tenant-isolation.spec.ts` that fails without the fix.
3. If any customer-visible data was exposed, notify the security
   team within 15 minutes per the customer-facing incident policy.
4. If the leak is structural (affecting more than one boundary),
   page the architecture owner to coordinate a Phase 8 §10.1
   enforcement sweep.

## Verification
- The negative test passes.
- A live cross-tenant probe returns 404 (not 200, not 403).
- All Phase 8 §10.1 items 1-8 are re-checked in the next
  certification run.
