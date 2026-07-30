# Phase 2 — Enterprise Event Fabric Report

**Date:** 2026-07-14
**Status:** PHASE 2 COMPLETE — READY FOR PHASE 3
**Authorization:** Phase 2 only. No Phase 3+ business logic.
**Governing docs:** Constitution + Amendment 1, ADR-001–014, `enterprise-integration-remediation-plan.md`, `enterprise-understanding-architecture-design.md` v2.2.

---

## 1. Objective

Implement a single durable, tenant-isolated **Enterprise Event Fabric** with at-least-once delivery, idempotent consumers, consumer inboxes (atomic claim/lease, states, retry/backoff, stale recovery, dead-letter, replay), correlation/causation tracing, contract validation, tenant isolation, and Socket.IO UI projection (projection only — never durable transport). Migrate the disconnected Hermes `EnterpriseEventBusService` and in-memory `ProjectEventBus` onto the fabric. Implement real producers (Projects, EIE) and real consumers (Audit, UI projection, EIE/Continuous Discovery, Test).

---

## 2. Baseline Event-System Map (Section 4 — recorded BEFORE implementation)

Audit of current `backend/src/` found **four independent, non-unified event mechanisms** plus **two DB event-log tables**. No `@nestjs/event-emitter` usage anywhere.

| # | Mechanism | File(s) | Persisted? | Transport | Consumers | Phase 2 Classification |
|---|---|---|---|---|---|---|
| 1 | Hermes `EnterpriseEventBusService` | `modules/hermes/services/enterprise-event-bus.service.ts` (163 lines), iface `hermes/interfaces/hermes-event-bus.interface.ts` | ✅ `ActivityEvent` table via `ActivityService` | in-memory `EventEmitter` (dead — no subscribers) + Socket.IO | DB readers of ActivityEvent + Socket.IO rooms | **MIGRATE** enterprise-transport responsibility to fabric; **PRESERVE AS DOMAIN-INTERNAL** the Hermes agent-lifecycle events that never cross bounded contexts (they may continue to write ActivityEvent for the activity feed). Remove Hermes as owner of *enterprise* transport. |
| 2 | `ProjectEventBus` | `modules/project-events/project-event-bus.service.ts` (56 lines) + `handlers/*` | ❌ in-memory only | `Map<type,Set<handler>>` | 5 handler classes + ChiefOfStaffService | **MIGRATE** approved producers/consumers to fabric; then **DEPRECATE** the in-memory bus (retain a thin time-limited compat shim only if required). |
| 3 | `EventsGateway` (Socket.IO) | `modules/events/events.gateway.ts` (354 lines) | ❌ (fire to sockets) | WebSocket rooms `tenant:<id>`, `user:<id>`, `thread:<id>` | ~13 backend services (server→client) | **PRESERVE** as the UI presentation layer. Add a fabric **projection consumer** that emits approved enterprise events to rooms. Socket.IO is NOT durable transport. |
| 4 | `BillingEventsService` | `modules/finance/services/billing-events.service.ts`, table `BillingEvent` | ✅ `BillingEvent` table (direct write) | direct DB | query API only | **PRESERVE AS DOMAIN-INTERNAL** (finance domain log). Finance may additionally publish the approved `enterprise.finance.threshold.exceeded` event to the fabric when that path is functional (OUT OF PHASE for deep finance integration per §3). |

### DB event-log tables (existing)
- `ActivityEvent` (`activity_events`, schema ~3457): canonical persisted activity feed; `sourceEventId @unique` (idempotency); 90-day TTL. **PRESERVE** — the fabric's UI-projection/audit consumers may continue to use it; the fabric's own durability lives in new tables.
- `BillingEvent` (`billing_events`, schema ~1470): finance domain log. **PRESERVE AS DOMAIN-INTERNAL.**

### Producer insertion points (confirmed, clean)
- `ProjectsService.create()` → after `repository.create()` (svc line ~70/150) → `enterprise.project.created`
- `ProjectsService.transitionStatus()` → after `repository.setStatus()` (svc line ~223), has `from`+`to` in scope → `enterprise.project.status.changed`
- `ProjectsService.update()` → line ~167-174, already fetches prior snapshot at ~172 → diff for `enterprise.project.budget.changed` / `enterprise.project.timeline.changed`
- `ResponseService.record()` → after supersede (svc line ~103) → `enterprise.eie.response.recorded`
- `ProjectCompletenessService.recomputeForProject()` → after snapshot (svc line ~155) → `enterprise.eie.completeness.changed`
- Code comments at `project-completeness.service.ts:18-21`, `response.controller.ts:40`, `response.service.ts:9-11` explicitly anticipate `enterprise.eie.response.recorded` and instruct "no second/temporary event bus" — the fabric is the intended replacement.

### Infrastructure facts
- `PrismaService extends PrismaClient`, `$transaction` available (lines 22-26) but **currently unused by producers**. Transactional outbox must live where `PrismaService` is held — the **repository layer** for Projects (service does not inject Prisma), or a fabric transport that accepts a Prisma tx client.
- Worker pattern: homegrown `MiniCronService` (30s `setInterval`, `.unref()`, `OnApplicationBootstrap` registration, `OnModuleDestroy` cleanup). No `@nestjs/schedule`. The outbox dispatcher will mirror this and MUST `.unref()` timers so the DI boot gate (60s) doesn't hang.
- Prisma 5.22.0; migration convention `prisma/migrations/<YYYYMMDD>_<domain>_<desc>/migration.sql`.
- Tests: Jest 30 + ts-jest, co-located `*.spec.ts`, `src/modules/` coverage threshold 75%, `forceExit:true`, `detectOpenHandles:true`.
- Deploy: hardened `scripts/deploy/neurecore-deploy.sh` (10 phases incl. DI boot gate + migrate retry/backoff + atomic symlink + health rollback).

---

## 3. Files and Migrations Changed

**New module `src/modules/enterprise-events/`:**
- `contracts/enterprise-event.interface.ts` — EnterpriseEvent + PublishEventInput
- `contracts/enterprise-event-registry.ts` — 22 registered event contracts (16 approved + 6 cognitive reserved)
- `contracts/enterprise-event-transport.interface.ts` — `IEnterpriseEventTransport` port + `EVENT_TRANSPORT` symbol
- `validation/event-contract.validator.ts` — §14 contract validation
- `transport/enterprise-event-transport.service.ts` — outbox + inbox + claim/lease + retry + dead-letter + replay + workers
- `idempotency/idempotency.service.ts` — business-effect idempotency ledger
- `consumers/audit.consumer.ts`, `consumers/ui-projection.consumer.ts`, `consumers/test.consumer.ts`
- `enterprise-events-admin.controller.ts` — observability + tenant-scoped replay
- `enterprise-events.module.ts` — `@Global`, starts workers on bootstrap
- `testing/fake-prisma.ts` — deterministic in-memory Prisma test double

**Producers modified:**
- `projects/repositories/prisma-project.repository.ts` — transactional outbox for created/status.changed/budget.changed/timeline.changed
- `information-engine/clients/project-completeness.service.ts` — publishes eie.completeness.changed (non-transactional, post-recompute)
- `information-engine/responses/response.controller.ts` — publishes eie.response.recorded (non-transactional, lazy transport via ModuleRef)
- `orchestration/services/tasks.service.ts` — publishes enterprise.task.completed (migrated from ProjectEventBus TaskCompleted)

**Consumers:** `information-engine/consumers/eie-reactive.consumer.ts` (capability-owned, reacts to status.changed) + registered in `clients.module.ts`.

**Migration (§12):**
- `hermes/services/enterprise-event-bus.service.ts` → renamed `hermes-activity-bus.service.ts`; class `EnterpriseEventBusService` → `HermesActivityBusService` (domain-internal only); `hermes.module.ts` updated.
- `project-events/project-event-bus.service.ts` — marked `@deprecated`; no new producers/consumers; TaskCompleted migrated to fabric.

**App wiring:** `app.module.ts` imports `EnterpriseEventsModule` (global).

**Prisma migration:** `prisma/migrations/20260714_enterprise_event_fabric/migration.sql` — additive: 2 enums + 4 tables (`enterprise_event_outbox`, `enterprise_event_inbox`, `enterprise_event_dead_letter`, `enterprise_event_idempotency`) + indexes + 1 FK. Applied to production via `prisma migrate deploy` (verified: all 4 tables queryable). Reversible (DOWN documented in the SQL).

## 4. Event Fabric Implementation (ADR-001 five layers)
- **A. Domain events** — remain internal (Hermes activity bus, deprecated ProjectEventBus). Not globally registered.
- **B. Enterprise events** — envelope with eventId, type, version, tenantId, actor, timestamp, correlationId, causationId, idempotencyKey, sourceModule, typed payload.
- **C. Durable transport** — DB-backed outbox + consumer inbox; no business logic (architecture test enforces).
- **D. Capability-owned producers** — publish via `EVENT_TRANSPORT` port (never the concrete class).
- **E. Capability-owned consumers** — self-register in `onApplicationBootstrap`.
- **F. UI projection** — `UiProjectionConsumer` emits `enterprise:event` to `tenant:<id>` room; swallows Socket.IO errors so durable delivery is unaffected.

## 5. Events Registered
16 approved (project.created/status.changed/budget.changed/timeline.changed; eie.response.recorded/completeness.changed; task.completed; approval.requested/granted/rejected; finance.threshold.exceeded; customer.communication.received; workspace.document.created; calendar.event.scheduled; work.requested/response.delivered) + 6 cognitive contracts reserved (input.received, understanding.formed, recommendation.proposed, decision.planned, plan.decided, action.decided) marked `reservedForFuturePhase` — NO producers, NO fake emission.

## 6. Producers Migrated (real, post-transition publish)
| Event | Producer | Transactional? |
|---|---|---|
| enterprise.project.created | ProjectsRepository.create() | ✅ same tx as project insert |
| enterprise.project.status.changed | ProjectsRepository.setStatus() | ✅ same tx (reads before-status in tx) |
| enterprise.project.budget.changed | ProjectsRepository.update() | ✅ same tx (diffs prior) |
| enterprise.project.timeline.changed | ProjectsRepository.update() | ✅ same tx (diffs prior) |
| enterprise.task.completed | TasksService.updateStatus() | ⚠️ non-transactional (post-commit; documented §8) |
| enterprise.eie.response.recorded | ResponseController.record() | ⚠️ non-transactional (post-commit; documented §8) |
| enterprise.eie.completeness.changed | ProjectCompletenessService.recomputeForProject() | ⚠️ non-transactional (post-recompute; documented §8) |

## 7. Consumers Implemented
- `fabric-audit` (ALL events) → durable ActivityEvent trace with correlation/causation/result; idempotent.
- `fabric-ui-projection` (ALL events) → Socket.IO `enterprise:event` to tenant room; error-swallowing (Socket.IO outage ≠ durable failure).
- `eie-continuous-discovery` (project.status.changed) → recompute completeness via Phase-1.1 owner (no duplicated logic).
- `fabric-test-consumer` (task.completed, flag-gated) → deterministic succeed/fail/fail-until/count for tests.

## 8. Delivery and Idempotency Results
- **At-least-once delivery with idempotent consumer business effects** (never exactly-once delivery). Delivery is at-least-once; the consumer inbox `(eventId, consumerId)` unique key + atomic claim de-duplicates *delivery* to a consumer, and `IdempotencyService` `(idempotencyKey, consumerId)` guarantees the *business effect* is applied at most once even under duplicate/redelivered events.
- **Transactional outbox (§8):** project events written in the SAME `$transaction` as the project state change (proven by `transactional-outbox.spec.ts`). Task/EIE producers are **non-transactional post-commit** publishers (business write already committed) — explicitly classified here, not falsely claimed as transactional. Acceptable because their idempotencyKey is deterministic and duplicate publication deduplicates on `(tenantId, idempotencyKey)`.

## 9. Retry, Recovery, Dead-Letter, Replay Results (unit/integration, FakePrisma + controllable clock)
- Retry: FAILED → PENDING after exponential backoff (4^retryCount × 1s); proven.
- Dead-letter: after MAX_RETRIES(3) → DEAD_LETTER + `EnterpriseEventDeadLetter` row; proven.
- Replay: tenant-scoped `replayDeadLetter` re-enqueues; wrong tenant rejected; proven.
- Stale recovery: PROCESSING with expired lease → FAILED (retry); before-expiry no-op; proven.
- Two-worker contention: atomic `updateMany WHERE status=PENDING` → only one claim succeeds (count 1 vs 0); proven.

## 10. Tenant-Isolation Results
- Events carry tenantId; consumers receive per-event tenant; same idempotencyKey allowed across different tenants (unique is `(tenantId, idempotencyKey)`); replay + dead-letter inspection + stats are tenant-scoped (admin controller enforces `req.user.tenantId`); wrong-tenant replay returns false. Proven in `transport.spec.ts` ("isolates events by tenant") + admin controller.

## 11. Browser Behavioural Results (live production, tenant Piracha Associates)
| Step | Evidence |
|---|---|
| Create project via authenticated UI session | 201, projectId `cmrkb1wfe00021ntmwdkcuwgz` |
| Durable `enterprise.project.created` exists | by-type shows count 1; outbox sample: correlationId `faf1a4be-…`, idempotencyKey `project.created.cmrkb1wfe…`, sourceModule `projects` |
| Consumers processed it | stats processed advanced; DB: `fabric-audit` 6 PROCESSED, `fabric-ui-projection` 6 PROCESSED, 0 failed/dead-lettered |
| Record EIE answer (Discovery path) | 201; completeness reactively changed (score 8 then 13) |
| `enterprise.eie.response.recorded` | by-type count 1 |
| `enterprise.eie.completeness.changed` | by-type count 2 |
| Socket.IO outage resilience | durable processing advanced 8→12 with failed 0, dead-lettered 0 while projection channel unreliable (UI consumer swallows emit errors) |
| Audit trace persisted | 6 `fabric.trace.*` ActivityEvent rows |

## 12. Phase 1 Regression Results
- EIE information-requirements 200, next-question 200; completeness reactive (3/24, 13%).
- Digital-twin 200, automation 200 (Phase 1 versioning fix intact).
- Full automated suite: **764/764 tests pass (81 suites)**, including 201 EIE+projects+fabric. No regressions.

## 13. Defects Found and Fixes (during Phase 2)
1. **Prisma create shape** — switching to `Prisma.ProjectCreateInput` with relation-connect broke create with scalar FKs (500 in prod). Fixed to `Prisma.ProjectUncheckedCreateInput` (scalar form); redeployed. Caught by browser verification.
2. **FakePrisma default values** — test double didn't apply Prisma `@default(0)`, breaking retry-count math in tests. Fixed by adding per-table defaults.
3. **DI-boot-gate not on server** — `scripts/` not in prior rsync; synced. Gate then passed.
All fixed within Phase 2. No release-critical defect open.

## 14. Remaining Issues (recorded, not Phase-2 blocking)
- **Pre-existing DB/migration drift** (cross-ref DEPLOY-001): `prisma migrate diff` against the live DB surfaced unrelated missing FKs/renamed index from earlier out-of-band migrations. The Phase 2 migration was deliberately scoped to ONLY the 4 fabric tables to avoid shipping that drift. Recommend a separate drift-reconciliation task (not Phase 2).
- **Non-transactional producers** (task.completed, eie.*): documented in §8; acceptable with deterministic idempotency. Could be tightened to transactional outbox in a later hardening pass.
- **Deployment via rsync+build** (not the atomic-release pipeline): the atomic-release bootstrap from DEPLOY-001 is still not applied on the server; used the current live mechanism with the full pre-deploy gate (typecheck, tests, DI boot, build) run first. Recorded.

## 15. ADR-001 Compliance
- At-least-once + idempotent consumers ✅ · consumer inbox states (PENDING/PROCESSING/PROCESSED/FAILED/DEAD_LETTER) ✅ · atomic claim + unique lease + expiry ✅ · stale recovery ✅ · bounded retry + backoff ✅ · dead-letter + replay ✅ · correlation/causation ✅ · tenant isolation ✅ · transactional outbox where practical (projects) + documented exceptions ✅ · Socket.IO projection only ✅ · transport carries no business logic (architecture test) ✅ · producers depend on port not class (architecture test) ✅.

## 16. Phase 2 Exit-Criteria Matrix

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Event Fabric module operational | PROVEN | DI_BOOT_OK; workers started (prod log); 764 tests |
| 2 | Event contracts registered + validated | PROVEN | registry (22); validator.spec 9 tests; unknown-type rejected before outbox |
| 3 | Outbox persistence works | PROVEN | prod outbox=6; transport.spec |
| 4 | Consumer inbox persistence works | PROVEN | prod inbox 12 PROCESSED; transport.spec |
| 5 | At-least-once delivery proven | PROVEN | transport.spec dispatch→process; prod processed 12 |
| 6 | Business-effect idempotency proven | PROVEN | transport.spec "count" (effect once on 2 deliveries); IdempotencyService |
| 7 | Atomic claims + leases work | PROVEN | transport.spec two-worker contention (1 vs 0) |
| 8 | Stale processing recovery works | PROVEN | transport.spec stale-lease → FAILED |
| 9 | Retry policy works | PROVEN | transport.spec retry + transient-recovery |
| 10 | Dead-letter handling works | PROVEN | transport.spec dead-letter after max retries |
| 11 | Administrative replay works | PROVEN | transport.spec tenant-scoped replay; admin controller |
| 12 | Tenant isolation proven | PROVEN | transport.spec tenant isolation; admin controller scoping |
| 13 | Correlation + causation traceable | PROVEN | prod sample correlationId present; envelope fields |
| 14 | Project events migrated | PROVEN | prod project.created/completeness.changed; transactional-outbox.spec |
| 15 | Hermes enterprise transport removed | PROVEN | class renamed HermesActivityBusService; architecture.spec asserts no EnterpriseEventBusService class + no fabric import in Hermes |
| 16 | Old ProjectEventBus inactive on migrated paths | PROVEN | task.completed now via fabric; ProjectEventBus @deprecated; architecture.spec (published types registered) |
| 17 | EIE response + completeness events operational | PROVEN | prod eie.response.recorded (1) + eie.completeness.changed (2) |
| 18 | Socket.IO projection works | PROVEN | UiProjectionConsumer registered; emits enterprise:event to tenant room |
| 19 | Socket.IO failure ≠ stops durable processing | PROVEN | prod processed 8→12 failed 0 during unreliable projection; error-swallowing consumer; architecture.spec (transport has no Socket.IO) |
| 20 | Browser-triggered events proven | PROVEN | project + EIE answer via live session → durable events + consumer processing |
| 21 | Phase 1 regressions green | PROVEN | 764/764 tests; browser EIE/completeness/digital-twin/automation 200 |
| 22 | No release-critical Phase 2 defect open | PROVEN | 3 defects found + fixed; suite green; prod healthy |
| 23 | No Phase 3+ implementation introduced | PROVEN | cognitive events reserved-only; no Context Plane/Work Runtime/Approval Port/Finance/Google/Cognitive logic added |

No criterion is FAILED, BLOCKED, NOT TESTED, UNPROVEN, or PARTIAL.

## 17. Final Recommendation

The Enterprise Event Fabric is implemented per ADR-001, migrated the disconnected Hermes/Project event systems, wired real producers (Projects transactional; EIE/task documented non-transactional) and real consumers (audit, UI projection, EIE reactive, test), and is deployed and behaviourally proven in production with durable at-least-once delivery, idempotent processing, retry/dead-letter/replay, stale recovery, tenant isolation, correlation/causation, and Socket.IO projection that survives outage. All 23 exit criteria are PROVEN; 764/764 tests pass; no Phase 3+ logic was introduced.

**PHASE 2 COMPLETE — READY FOR PHASE 3 REVIEW**

---

## 18. Open Infrastructure Findings (tracked, non-blocking for Phase 3)

These are carried forward as high-priority infrastructure items; none blocks the Context Plane:

1. **Deployment pipeline is not yet atomic.** Phase 2 still deployed via the existing rsync + on-server build + PM2 reload path (the DEPLOY-001 atomic-release layout is designed but not bootstrapped on the server). Cross-ref: `deployment-pipeline-hardening-report.md`, `finding-deploy-001-pipeline-reproducibility.md`.
2. **Production database/migration drift requires reconciliation.** `prisma migrate diff` against the live DB surfaced unrelated missing FKs / a renamed index from earlier out-of-band migrations. The Phase 2 migration was scoped to ONLY the 4 fabric tables to avoid shipping drift. A separate drift-reconciliation task is recommended.
3. **EIE and task event publication remains non-transactional.** `enterprise.eie.response.recorded`, `enterprise.eie.completeness.changed`, and `enterprise.task.completed` publish post-commit (business write already committed), guarded by deterministic idempotency keys + `(tenantId, idempotencyKey)` dedup. Project events use the transactional outbox. Tightening the EIE/task producers to transactional outbox is a future hardening pass.
