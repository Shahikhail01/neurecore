# Legacy Hermes Audit — 2026-07-30

## Scope

This audit documents every surviving `Hermes*` reference in the codebase
after Phase B (legacy in-process execution runtime deletion) as of
2026-07-30. References are classified into three categories:

| Category | Meaning |
|---|---|
| **DELETED** | Removed by Phase B; verified absent |
| **NON-RUNTIME (preserved)** | Live platform service; will be extracted from `modules/hermes/` in a future pass |
| **ADAPTER (active)** | Part of the `hermes-adapter/` bridge to upstream Hermes; intentionally named |

---

## DELETED — Verified Absent

These symbols were removed by Phase B and produce zero matches in
`backend/src/` and `backend/test/`:

| Symbol | Verification |
|---|---|
| `HermesRuntimeService` | `rg "HermesRuntimeService" backend/src/ backend/test/` → 0 |
| `HermesNode` | `rg "HermesNode" backend/src/ backend/test/` → 0 |
| `HermesRouter` | `rg "HermesRouter" backend/src/ backend/test/` → 0 |
| `HermesCheckpointer` | `rg "HermesCheckpointer" backend/src/ backend/test/` → 0 |
| `HermesApprovalResumeConsumer` | `rg "HermesApprovalResumeConsumer" backend/src/ backend/test/` → 0 |
| `HERMES_RUNTIME` env var prefix | `rg "HERMES_RUNTIME" backend/src/ backend/test/` → 0 |

---

## ADAPTER (Active) — Intentionally Named

These references are part of `backend/src/modules/hermes-adapter/`, the
NestJS gateway that bridges chat to the upstream Python sidecar. They are
NOT legacy and must be preserved.

| File Pattern | Match Count | Notes |
|---|---|---|
| `modules/hermes-adapter/**` | 10 source files | Gateway module, controllers, services, tools |
| `HermesAdapterModule` | 2 imports | `app.module.ts:155` + self |
| `HermesAdapterService` | ~5 references | Adapter service + tests |
| `HermesTokenService` | ~3 references | Token mint/verify |
| `HermesEventsIngestService` | ~2 references | Webhook event ingestion |
| `HermesScopedTokenClaims` | ~20 references | Token claims interface used across tools + tests |
| `HERMES_SIDECAR_URL` | `.env` + `.env.production` | Sidecar connection config |
| `HERMES_SIDECAR_SECRET` | `.env` + `.env.production` | Sidecar HMAC secret |
| `HERMES_SIDECAR_TOKEN_TTL_SECONDS` | `.env` | Token TTL config |
| `HERMES_SIDECAR_TIMEOUT_MS` | `.env` | HTTP timeout config |
| `HERMES_SIDECAR_WEBHOOK_TOLERANCE_SECONDS` | `.env` | Webhook tolerance |

---

## NON-RUNTIME (Preserved) — Live Platform Services

These services still live in `modules/hermes/` and use `Hermes*` naming.
They are NOT the deleted execution runtime — they provide real platform
capabilities and must be extracted into neutral modules before `Hermes*`
persistence models can be dropped.

### Module Importers

| Importer | Import | Reason |
|---|---|---|
| `app.module.ts:48` | `HermesModule` | Mounts the legacy module; non-runtime services are served through this |
| `context-plane.module.ts:21` | `HermesModule` (forwardRef) | Context plane depends on hermes services for activity/thread resolution |

### Preserved Services (in `modules/hermes/services/`)

| Service File | Purpose | Notes |
|---|---|---|
| `hermes-registry.service.ts` | Agent registry, persona linking, activity-memory mapping | Uses `HermesAgent` type from Prisma |
| `hermes-memory.service.ts` | Memory storage, summarization, FTS5 indexing | Comment references `HermesMemoryEntry` (Prisma model) |
| `hermes-session.service.ts` | Session lifecycle, checkpoints | Uses `HermesSession` type |
| `agent-messaging.service.ts` | Message routing between agents/users | Now returns "disabled" response since runtime deleted |
| `approval-workflow.service.ts` | Approval workflow engine (live) | Core platform capability |
| `activity.service.ts` | Activity feed aggregation | Used by chat + context plane |
| `thread.service.ts` | Thread management | Used by chat |
| `conversation-intelligence.service.ts` | Conversation analysis | Used by context plane |
| `presence.service.ts` | Agent/user presence tracking | Used by chat |
| `digest.service.ts` | Digest compilation | Scheduled job |
| `escalation.service.ts` | Escalation rules | Approval workflow |
| `follow-up.service.ts` | Follow-up scheduling | Activity tracking |

### Preserved Types / Interfaces (in `modules/hermes/`)

| Location | Matches | Type |
|---|---|---|
| `common/hermes.constants.ts` | `HERMES_ENABLED`, `HERMES_AUTO_LINK`, `HERMES_APPROVAL_REQUIRED`, `HERMES_SESSION_LOGGING` | Feature flags |
| `common/hermes.types.ts` | `HermesAgentProfile`, `HermesAgentType`, `HermesAgentStatus` | Domain types |
| `interfaces/` (12 files) | Various Hermes interfaces | Service contracts |
| `guards/hermes-tenant.guard.ts` | `HermesTenantGuard` | Tenant isolation guard |

### Preserved Prisma Models (NOT dropped)

| Model | Usage |
|---|---|
| `HermesAgent` (→ AgentProfile) | Agent registry linking |
| `HermesSession` | Session lifecycle |
| `HermesMessage` | Message routing |
| `HermesMemoryEntry` | Memory storage |
| `HermesAuditLog` | Audit records |
| `HermesCapability` | Agent capabilities |
| `HermesToolPermission` | Tool permission grants |

### Preserved Env Vars (in `.env`)

| Variable | Purpose |
|---|---|
| `HERMES_ENABLED` | Feature flag |
| `HERMES_AUTO_LINK` | Auto-linking feature |
| `HERMES_APPROVAL_REQUIRED` | Approval gate |
| `HERMES_SESSION_LOGGING` | Session debugging |

---

## Cross-Cutting References

### Frontend

| Location | Matches | Context |
|---|---|---|
| `frontend-tenant/src/` | ~18 references | Chat role `'HERMES'` (since renamed), component imports |
| `frontend-admin/src/` | ~21 references | Admin panel references |

### Tools (built-in)

| File | Reference |
|---|---|
| `modules/tools/built-in/hermes-tools.ts` | Tool definitions keyed by `HermesAgentType` |

### Feature Flag Service

| File | Reference |
|---|---|
| `common/feature-flag/feature-flag.service.ts` | `HERMES_AUTO_LINK` flag |

---

## CI Lint Rule (Proposed)

```javascript
// .eslintrc.js or equivalent
rules: {
  'no-restricted-imports': ['error', {
    patterns: [{
      group: ['**/modules/hermes/services/hermes-runtime*'],
      message: 'HermesRuntimeService was deleted by Phase B (ADR-0001). Use HermesAdapterService instead.',
    }],
    paths: [{
      name: '@prisma/client',
      importNames: ['HermesRuntimeService', 'HermesRuntime', 'IHermesRuntime'],
      message: 'Legacy Hermes runtime was deleted. No replacement.',
    }],
  }],
}
```

## Verdict

- **7 deleted symbols**: Verified absent (Grep → 0)
- **12 preserved non-runtime services**: Live platform dependencies on `HermesModule`
- **1 active adapter module**: `hermes-adapter/` (intentional, the bridge to upstream Hermes)
- **7 Prisma models + 3 enums**: Preserved because non-runtime services still reference them
- **4 HERMES_ feature flags**: Preserved in `.env` for non-runtime service configuration
- **0 `HermesRuntimeService` callers**: Confirmed — no code path invokes the deleted runtime

**Next step:** Extract the 12 non-runtime services from `modules/hermes/` into
neutral modules before dropping `Hermes*` Prisma persistence models.
