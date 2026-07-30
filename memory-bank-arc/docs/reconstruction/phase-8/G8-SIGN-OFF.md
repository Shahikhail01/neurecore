# G8 Sign-Off

**Date opened:** 2026-07-27
**Gate:** G8 — Security, Observability, and Operations
**Status:** TECHNICAL GREEN — formal reviewer sign-off pending

## Evidence Summary

- TypeScript `tsc --noEmit`: PASS
- ESLint on every Phase 8 file: clean
- `nest build`: succeeds
- Phase 8 dedicated test gate: **139 / 139 pass across 16 suites**

Test coverage by §10.6 G8 criterion:

| G8 Criterion | Test Suite | Cases |
|---|---|---|
| §10.6 (1) one correlation ID locates any failed golden run | `src/test/architecture/phase8-correlation-trace.spec.ts` | 5 |
| §10.6 (2) alerts for stuck / backlogged / failed core work | `src/modules/phase8/observability/golden-path-alerts.spec.ts` | 6 |
| §10.6 (3) dead-letter replay controlled and idempotent | `src/test/architecture/phase8-dead-letter-replay.spec.ts` | 4 |
| §10.6 (4) security tests show no cross-tenant access | `src/test/certification/phase8-tenant-isolation.spec.ts` | 11 |

Additional Phase 8 invariants:

| Concern | Suite | Cases |
|---|---|---|
| Role/permission matrix + self-approval | `src/modules/phase8/application/phase8-permission.service.spec.ts` | 8 |
| Side-effect approval gate | `src/modules/phase8/application/side-effect-approval.service.spec.ts` | 9 |
| Artifact access control | `src/modules/phase8/application/artifact-access.service.spec.ts` | 8 |
| Tenant scope enforcer | `src/modules/phase8/application/tenant-scope-enforcer.spec.ts` | 5 |
| PII / secret / bearer redaction | `src/modules/execution/application/pii-redactor.spec.ts` | 8 |
| Execution tool policy + budget | `src/modules/execution/application/execution-policy-enforcer.spec.ts` | 15 |
| Prompt injection detection | `src/modules/agents/security/validators/prompt-injection.validator.spec.ts` | 10 |
| Shell command allow / block | `src/modules/agents/security/validators/command-pattern.validator.spec.ts` | 10 |
| Resource / path allow / block | `src/modules/agents/security/validators/resource-access.validator.spec.ts` | 12 |
| Correlated logger entity IDs | `src/common/logging/phase8-correlation-logger.spec.ts` | 2 |
| Metrics catalog + exposition | `src/modules/phase8/observability/golden-path-metrics.service.spec.ts` | 3 |
| Architecture invariants (10 runbooks, no audit-log mutations, full deliverables surface) | `src/test/architecture/phase8-security-observability.spec.ts` | 23 |

New / changed artefacts:

- 27 golden-path metrics (`src/modules/phase8/observability/golden-path-metrics.ts`)
- 10 alert rules (`src/modules/phase8/observability/golden-path-alerts.ts`)
- 4 application services (permission, side-effect, artifact access, tenant scope)
- 1 ADR (`src/docs/adrs/ADR-008-phase8-role-permission-matrix.md`)
- 7 new runbooks + the 3 existing runbooks now asserted by
  architecture tests
- 1 global module (`src/modules/phase8/phase8.module.ts`),
  registered as `@Global` in `src/app.module.ts`

No DB migration was required for Phase 8 — all Phase 8 cross-cutting
concerns are application-layer code that reuses the existing
`AuditLog`, `ExecutionAttempt`, `EvidenceArtifact`, `OutboxEvent`,
`TimelineEvent`, and `EnterpriseInitiation` tables.

## Required Signatures

| Reviewer | Required Decision | Signature | Date | Notes |
|----------|-------------------|-----------|------|-------|
| Architecture Owner | Approve role × action matrix, self-approval invariant, cross-tenant safe-not-found policy, ADR-008 | PENDING | | |
| Backend Lead | Approve Phase8Module wiring + canonical command paths using `Phase8PermissionService.assertAllowed` | PENDING | | |
| Security | Approve tenant-isolation negative suite + artifact access + PII redaction + prompt-injection coverage | PENDING | | |
| Operations | Approve metric catalog + alert rules + 10 runbooks + correlated-log searchable fields | PENDING | | |
| Product Owner | Approve every §10.5 deliverable (the table on `G8-EVIDENCE.md`) | PENDING | | |

## Codex Attestation

Codex records technical evidence only. Codex cannot sign as a human
reviewer or mark G8 formally closed without the listed reviewer
approvals.

## G8 Closure Decision

**Current decision:** TECHNICAL GREEN; HOLD only for human signatures.

Required before closing G8:

- Collect all five human signatures above.
- Run the Phase 8 test suite (16 suites, 139 tests) against the
  deployed PostgreSQL on Contabo so the `-db.spec.ts` /
  `-integration.spec.ts` patterns continue to apply (no
  Phase 8 spec requires DB; the suite is fully in-memory).
- Confirm that the `phase8_alerts` rules and the
  `/observability/prometheus` exposition both surface to the
  Prometheus scraper via the existing observability controller.
- Confirm that the OPS runbook team has reviewed the 10 runbooks
  and accepted them into the on-call rotation.

## Next Phase

G8 closure unblocks **Phase 9 — Golden-Path Certification**
(NC-AWL-IMP-1 §11). Phase 9 is the certification harness
executor; it runs against the now-stable Phase 8 security,
observability, and operations surface.

The Strangler boundary introduced in earlier phases
(`executionEngineVersion: 'canonical-v1'`) is unchanged.
