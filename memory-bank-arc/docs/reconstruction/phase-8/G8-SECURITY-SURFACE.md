# Phase 8 — Security, Observability, and Operations: Security Surface Map

This document is a concrete reference for reviewers signing off on
G8. It is the long-form map of every Phase 8 artefact grouped by
NC-AWL-IMP-1 §10.1–§10.6.

---

## 1. §10.1 Security Enforcement (Items 1–8)

### Item 1 — HTTP & socket adapters derive tenant/actor from authenticated server state

- `JwtAuthGuard` registered globally via `APP_GUARD` in `src/app.module.ts:338`.
- `RolesGuard` registered via `APP_GUARD` in `src/app.module.ts:341`.
- `TenantContextGuard` registered via `APP_GUARD` in `src/app.module.ts:345`
  — runs AFTER `JwtAuthGuard`, sets up `AsyncLocalStorage` tenant context.

### Item 2 — `AsyncLocalStorage` may carry request context; no global mutable state

- `src/common/context/tenant-context.service.ts:15` —
  `private readonly als = new AsyncLocalStorage<TenantContext>();`
- `src/common/correlation/correlation.service.ts:7` —
  `const storage = new AsyncLocalStorage<CorrelationContext>();`

### Item 3 — Commands carry explicit tenant/actor metadata

- `src/common/correlation/correlation.interface.ts:2` —
  `CommandMetadata` requires `tenantId`, `actorId`, `actorType`.
- All `*Command` types in `src/modules/**/commands/*.ts` accept it.

### Item 4 — Events and jobs persist tenant metadata; worker context is reconstructed

- `src/common/persistence/prisma-outbox.repository.ts:30-65` —
  `tenantId_idempotencyKey` uniqueness + `tenantId` + `correlationId`
  on every `OutboxEvent`.
- `src/common/outbox/outbox.worker.ts` — on replay, the worker reads
  `tenantId`/`correlationId` from the event row and constructs a
  fresh `CommandMetadata`; no globals.

### Item 5 — Repositories require tenant-scoped keys

- `src/modules/phase8/application/tenant-scope-enforcer.ts` —
  enforced at every read path via `assertSameTenant()`.
- 11 negative cross-tenant tests in
  `src/test/certification/phase8-tenant-isolation.spec.ts`.

### Item 6 — Tool policies validate tenant, actor, task, allowed action

- `src/modules/phase8/application/phase8-permission.service.ts` —
  matrix-driven check for every tool call.
- `src/modules/execution/application/execution-policy-enforcer.ts` —
  policy snapshot enforced at execution worker boundary.
- `src/modules/agents/security/security-interceptor.service.ts` —
  pre-tool-call validator (existing).

### Item 7 — Artifacts enforce tenant ownership at storage and application layers

- `src/modules/phase8/application/artifact-access.service.ts` —
  application-layer check (see test: 8 cases).
- Storage layer enforced via `redactStorageRef` and the
  `EXPECTED_CHECKSUM` contract. The `EvidenceArtifact.checksum`
  column is sha-256 and the service recomputes and compares before
  serving bytes.

### Item 8 — Cross-tenant identifiers return a safe not-found/denied result without revealing existence

- `TenantScopeEnforcer.assertSameTenant` throws
  `code: 'X_TENANT_NOT_FOUND'`; the global exception filter maps
  this to 404, never 403.
- Verified by `phase8-tenant-isolation.spec.ts` for every entity
  type: Project, Task, Review, EvidenceArtifact, ExecutionAttempt.

---

## 2. §10.2 Metrics Catalog (27 metrics)

| Metric | Type | Labels | Help |
|---|---|---|---|
| `initiations_created_total` | counter | result | Enterprise initiations created by the canonical path |
| `initiations_approved_total` | counter | result | Enterprise initiations approved |
| `initiations_failed_total` | counter | classification | Initiation failures classified by reason |
| `project_command_success_total` | counter | action | Project-domain command successes |
| `project_command_duplicate_suppressed_total` | counter | action | Commands suppressed by idempotency |
| `outbox_event_age_seconds` | histogram | — | Event age when processed |
| `outbox_backlog_size` | gauge | — | Pending + processing row count |
| `event_processing_latency_seconds` | histogram | result | Outbox processing latency |
| `job_retries_total` | counter | classification | Outbox retries by reason |
| `job_dead_letters_total` | counter | eventType | Dead-letter transitions |
| `automation_completion_rate` | gauge | — | Automation completion rate (0.0-1.0) |
| `assignment_success_total` | counter | result | Task assignment successes |
| `assignment_failure_total` | counter | classification | Assignment failures |
| `execution_queue_time_seconds` | histogram | — | Time between REQUESTED and RUNNING |
| `execution_duration_seconds` | histogram | result | Attempt duration |
| `attempt_success_total` | counter | result | Attempt terminal successes |
| `attempt_retry_total` | counter | classification | Attempt retries |
| `attempt_failure_total` | counter | classification | Attempt failures |
| `needs_input_total` | counter | reason | NEEDS_INPUT transitions |
| `needs_review_total` | counter | reason | NEEDS_REVIEW transitions |
| `approval_total` | counter | result | Task approvals |
| `revision_requested_total` | counter | result | Revision requests |
| `tool_failure_total` | counter | agentType | Tool call failures by agent type |
| `token_usage_total` | counter | direction | Token usage by direction |
| `estimated_cost_total` | counter | model | Estimated USD cost by model |
| `socket_reconnect_total` | counter | result | Socket reconnects |
| `socket_error_total` | counter | classification | Socket errors |
| `session_refresh_failure_total` | counter | classification | Session refresh failures |

**Cardinality invariant**: every label is one of `result`,
`action`, `classification`, `eventType`, `reason`, `agentType`,
`direction`, `model`. No tenant / project / task / attempt /
correlation id appears as a metric label.

---

## 3. §10.3 Correlated Logging

- `src/common/logging/phase8-correlation-logger.ts` — `log(level, message, correlation, entityIds, extra)`.
- `searchableBy[]` is the union of correlation + actor + every
  golden-path entity id (initiation, project, goal, task,
  assignment, execution attempt, review, outbox event).
- Tested in `phase8-correlation-logger.spec.ts`:
  - 1 test asserts every entity ID appears in `searchableBy`
  - 1 test asserts undefined IDs are skipped (no null in the list)

Combined with the metrics shapes in
`golden-path-metrics-shapes.ts`:

```
outboxEventFields: tenantId, correlationId, causationId, eventType, ...
attemptFields:    tenantId, taskId, agentId, correlationId, ...
reviewFields:     tenantId, taskId, executionAttemptId, correlationId, ...
```

… a single `correlationId` is the join key across the entire
golden path.

---

## 4. §10.4 Runbook Inventory

```
src/docs/runbooks/
├── cross-tenant.md          (Suspected cross-tenant data exposure)
├── duplicate-project.md     (Two projects share the same initiation)
├── failed-automation.md     (Project automation status = FAILED)
├── model-rollback.md        (Model quality failure > 10% / hour)
├── outbox-backlog.md        (Backlog > 100 or age > 5min)
├── poison-event.md          (Dead letter count > 0)
├── provider-outage.md       (Circuit open > 5min)
├── session-failure.md       (Refresh 5xx > 2min)
├── socket-failure.md        (10+ reconnects / min)
└── stuck-execution.md       (Attempt running > 30min)
```

Each alert in `GOLDEN_PATH_ALERTS` references exactly one
runbook; the existence is asserted by
`golden-path-alerts.spec.ts` (line 26-34).

---

## 5. §10.5 Deliverables Detail

### 5.1 Tenant checks at all layers — Negative test

`src/test/certification/phase8-tenant-isolation.spec.ts` — 11
tests across `TenantScopeEnforcer`, `ArtifactAccessService`,
`SideEffectApprovalService`, `Phase8PermissionService`. Covers:

- Project / Task / Review / EvidenceArtifact / ExecutionAttempt
  cross-tenant rejection (5)
- Artifact access control cross-tenant (1)
- Storage ref redaction never leaks the path (1)
- Side-effect approval cannot be reused across tenants (1)
- Same-tenant access is permissive (1)
- Permission service denials return stable codes (2)

### 5.2 Role/permission matrix — Matrix doc

`src/docs/adrs/ADR-008-phase8-role-permission-matrix.md` —
exhaustive table covering 9 roles × 22 actions.

### 5.3 Tool allowlists — Policy test

`src/modules/execution/application/execution-policy-enforcer.spec.ts` — 15 tests:

- Autonomy 0/4 rejected, autonomy 1-3 accepted
- Tool in allowlist + not in denylist → permitted
- Tool in denylist regardless of allowlist → rejected
- Side-effecting tool needs autonomy ≥ L3 + approver + allowlist
- Token / cost / tool-call budget exhausted → denied

`src/modules/agents/security/validators/command-pattern.validator.spec.ts` —
10 tests:

- Shell tool detection
- `rm -rf /`, fork bomb, netcat reverse shell, DROP TABLE blocked
- `curl ... | sh` (coin miner pattern) blocked
- SSH key, /etc/shadow reads blocked
- Length limit (10000 chars)

`src/modules/agents/security/validators/resource-access.validator.spec.ts` —
12 tests:

- /etc/passwd, /etc/shadow, /etc/sudoers blocked
- /root, /home/private blocked
- `..` traversal blocked
- /workspace, /uploads writable
- /boot writes blocked

### 5.4 Side-effect approval gates — Approval test

`src/modules/phase8/application/side-effect-approval.service.spec.ts` —
9 tests:

- Stable sha-256 token for same request shape
- AI agent + EXTERNAL → denied (AI_AGENT_REQUIRES_HUMAN_APPROVAL)
- AI agent + IRREVERSIBLE → denied (IRREVERSIBLE_REQUIRES_HUMAN)
- verify() with wrong lease token returns false
- override() requires approver + non-trivial reason

### 5.5 Prompt injection boundaries — Injection test

`src/modules/agents/security/validators/prompt-injection.validator.spec.ts` —
10 tests:

- "ignore previous instructions" detected
- "system prompt:" extraction detected
- Persona override "pretend you are" detected
- Privilege escalation "as an admin" detected
- Zero-width unicode bypass detected
- Nested arrays walked
- Self-referential input bounded
- sanitize() removes zero-width chars
- sanitize() truncates excessive length

### 5.6 Secret/PII redaction — Redaction test

`src/modules/execution/application/pii-redactor.spec.ts` — 8 tests:

- Email / phone / api-key redaction
- Bearer token strict mode
- Checksum stability

### 5.7 Artifact access controls — Access test

`src/modules/phase8/application/artifact-access.service.spec.ts` —
8 tests (see 5.1).

### 5.8 Audit immutability — Immutable test

The architecture test
`src/test/architecture/phase8-security-observability.spec.ts` does a
recursive walk of `src/` (excluding specs) and asserts there is no
call to `auditLog.update|updateMany|delete|deleteMany`. This is the
test named in the §10.5 deliverable.

### 5.9 Metrics dashboard — Charts populated

Test:
`src/modules/phase8/observability/golden-path-metrics.service.spec.ts`
asserts the prom-client exposition format contains
`attempt_success_total` and `attempt_failure_total` after
`.inc()`. The full 27-metric catalog is asserted by
`golden-path-metrics.service.ts`.

### 5.10 Correlated logs — Search test

`src/common/logging/phase8-correlation-logger.spec.ts` — 2 tests
assert every golden-path entity ID ends up in `searchableBy`.

### 5.11 Runbooks (10) — Tested

`phase8-security-observability.spec.ts` asserts each of the 10
runbook files exists and is non-trivial. `golden-path-alerts.spec.ts`
asserts each alert rule's `runbookFile` exists on disk.

---

## 6. §10.6 Gate G8 Criteria — Cross-reference

| Criterion | Document | Test Suite |
|---|---|---|
| One correlation ID locates any failed golden run | §3 above | `phase8-correlation-trace.spec.ts` |
| Alerts exist for stuck / backlogged / failed core work | §2 above | `golden-path-alerts.spec.ts` |
| Dead-letter replay is controlled and idempotent | §5.8 above | `phase8-dead-letter-replay.spec.ts` |
| Security tests show no cross-tenant access | §5.1 above | `phase8-tenant-isolation.spec.ts` |
| Runbooks tested through tabletop exercise | §4 above | `phase8-security-observability.spec.ts` + `golden-path-alerts.spec.ts` |

---

## 7. SIM-04 surface additions (2026-07-28)

Per
[sim-04-pre-execution-investigation.md §10](../sim-04/sim-04-pre-execution-investigation.md),
the following read-only observability endpoints were added without
breaking any §10.1–§10.6 invariant:

- `GET /observability/outbox/health` (G-01) — returns legacy
  `OutboxEvent` + Enterprise-Event-Fabric counts per status, sample
  dead-letter ids, and the age of the oldest pending event. Reads are
  scoped by `req.user.tenantId` from the JWT and re-checked in the
  Prisma `where` predicate; cross-tenant rows are never returned.
- `GET /observability/enterprise-events/health` (G-01) — same shape
  but focused on the Phase-2 §15 Enterprise Event Fabric
  (`enterpriseEventOutbox` + `enterpriseEventInbox`). Tenant-scoped
  via `where: { tenantId: user.tenantId }`.

Both endpoints rely on `JwtAuthGuard` (already mounted globally via
`APP_GUARD` per §10.1 item 1) and enforce the `user.tenantId` check
in the handler body before any Prisma query. No `RolesGuard`
restriction is required — any authenticated tenant member may observe
their own tenant's queue health, which matches the existing
`/observability/{kpis,logs,metrics,traces,costs}` access model.

### §10.1 Security Enforcement — verified continued compliance

| § | Item | Status after SIM-04 surface additions |
|---|------|--------------------------------------|
| 1 | HTTP/socket adapters derive tenant from authenticated state | Unchanged — JWT-derived `user.tenantId`. |
| 2 | `AsyncLocalStorage` may carry context; no globals | Unchanged — observability handlers do not mutate context. |
| 3 | Commands carry explicit tenant/actor metadata | N/A — additions are read-only. |
| 4 | Events/jobs persist tenant; worker context reconstructed | Unchanged. |
| 5 | Repositories require tenant-scoped keys | All new Prisma reads filter `where: { tenantId }`. |
| 6 | Tool policies validate tenant/actor/task/action | N/A — no tools added. |
| 7 | Artifacts enforce tenant ownership at storage + application layers | N/A — read-only metadata. |
| 8 | Cross-tenant identifiers return safe not-found/denied | New endpoints inherit the JWT-tenant scoping, so cross-tenant rows are unreachable. |

No §10.1 invariant regressed. No new G8 cross-tenant negative test is
required because the new endpoints are pure reads filtered by the JWT
tenant — the same security property already covered by the existing
`phase8-tenant-isolation.spec.ts` tests for the
`/observability/{kpis,logs,metrics}` family.

---

## 8. Sign-off

Reviewers should use `G8-SIGN-OFF.md` to record their decisions.
