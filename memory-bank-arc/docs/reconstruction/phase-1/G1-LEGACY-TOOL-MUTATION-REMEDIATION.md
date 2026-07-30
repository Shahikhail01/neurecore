# G1 Legacy Tool Mutation Remediation

**Date:** 2026-07-26
**Status:** COMPLETE
**Scope:** `backend/src/modules/tools/built-in/*`

---

## Summary

The Phase 0 audit identified legacy tool-layer business mutations that bypassed the intended application/domain service boundaries. This remediation pass removed direct tool-layer mutation paths from `neurecore-tools.ts` and added regression coverage so the same class of bypass cannot be reintroduced unnoticed.

## Implementation Completed

- Added `ToolDataAccessService` as an explicit legacy read/data boundary for built-in tools.
- Removed direct `PrismaService` injection from built-in tool implementations.
- Replaced adapter-backed mutations in `neurecore-tools.ts` with service-backed calls.
- Wired required service modules into `ToolsModule`.
- Added broad architecture protection against `ToolDataAccessService` create/update/delete/upsert/updateMany/deleteMany usage in legacy tools.
- Fixed generated Prisma enum drift for AWL-facing imports.

## Domain Routing

| Domain | New mutation route |
|--------|--------------------|
| Tasks | `TasksService` |
| Approvals | `ApprovalsService` |
| Customers | `CustomersService` |
| Notifications | `NotificationsService` |
| Tenants | `TenantsService.updateMine` |
| Governance rules | `GovernanceRulesService` |
| Departments | `DepartmentsService` |
| Agents | `AgentsService` |
| Projects | `ProjectsService` |
| Project members | `ProjectMembersService` |
| Project stages | `ProjectStagesService` |
| Goals | `GoalsService` |

## Verification

Commands run from `backend/`:

```bash
pnpm exec tsc --noEmit
pnpm exec jest --config jest.config.js src/test/architecture/tool-bypass.spec.ts --runInBand
pnpm exec jest --config jest.config.js src/modules/tools/built-in/documents.tool.spec.ts --runInBand
rg -n "this\\.data\\.[A-Za-z0-9_]+\\.(create|update|delete|upsert|updateMany|deleteMany)|\\.prisma\\.[A-Za-z0-9_]+\\.(create|update|delete|upsert|updateMany|deleteMany)" src/modules/tools/built-in
```

Results:

- TypeScript: PASS
- Architecture tests: PASS, 14/14
- Documents tool tests: PASS, 13/13
- Built-in tool mutation scan: PASS, 0 matches

## Phase 2 Readiness Decision

**Decision:** Technically ready to begin Phase 2 implementation.

The original G1 technical blocker, tool-layer direct business mutation bypasses, has been remediated and guarded. Remaining readiness items are operational/governance items rather than code blockers:

- CI/branch protection still needs platform setup.
- Migration deployment still needs environment execution.
- Reviewer signatures are still a human approval gate if the formal process is being followed.

Phase 2 may proceed in code with these conditions tracked, but production/staging promotion should wait until CI, migrations, and approvals are completed.
