# Enterprise Communication Platform — Rollout Plan

**Document type:** Operational rollout guide  
**Audience:** Engineer executing the deployment  
**Replaces:** Nothing — this is the canonical rollout reference. For implementation details see [`enterprise-comms-chat.md`](enterprise-comms-chat.md). For architectural design see [`enterprise-communication.md`](enterprise-communication.md) Rev 4. For emergency procedures see [`operations.md`](../operations.md) and [`runbook.md`](../runbook.md).

**Date:** 2026-07-11 (rev 2 — post-deep-audit of all memory-bank docs + full codebase audit of backend services, interfaces, controllers, Prisma schema, module wiring, and both frontends)  
**Audit basis:** 25 backend service files, 8 interface files, 4 controller files, schema.prisma with 83 models, EventsGateway, both frontends (tenant + admin), feature-flag subsystem, socket infrastructure  
**Implementation status:** All 9 phases built, build/lint/typecheck clean, all endpoints serving 401 under JWT guard, all behind feature flags (zero prod impact until flags are flipped). **6 pre-rollout engineering tasks identified (see §0).**

---

## 0. Pre-Rollout Engineering Tasks

These gaps were found during the 2026-07-11 codebase audit. They **must** be completed before any phase begins rollout. Each is gated on code review + `tsc --noEmit` + `npm run build` passing.

### 0.1 No Prisma Migration Files Exist

**Finding:** `schema.prisma` contains all 8 comms models (`CommunicationThread`, `ThreadParticipant`, `ThreadReadState`, `ActivityEvent`, `AdapterCursor`, `WorkflowTemplate`, `NotificationPreference`, `RetentionPolicy`), plus modified `HermesMessage` and `HermesAuditLog` fields, plus new enums (`ParticipantType`, `ThreadStatus`), plus `REPORTS_TO`/`DELEGATES_TO` on `RelationshipType`. **Zero migration directories exist under `prisma/migrations/` for any of these.**

**Required:** Generate 6 additive migration files locally:

```bash
cd /home/najeeb/Linux-Dev/neurecore-2026/neurecore/backend

# 1. Thread model
npx prisma migrate dev --name 20260711_thread_model --create-only

# 2. Activity events
npx prisma migrate dev --name 20260711_activity_events --create-only

# 3. Workflow templates
npx prisma migrate dev --name 20260711_workflow_templates --create-only

# 4. Notification preferences
npx prisma migrate dev --name 20260711_notification_preferences --create-only

# 5. Retention policies
npx prisma migrate dev --name 20260711_retention_policies --create-only

# 6. Enum + relationship updates (must be last — depends on all models above)
npx prisma migrate dev --name 20260711_relationship_type_reports_delegates --create-only
```

**Validation per migration:**
```bash
for dir in prisma/migrations/20260711_*; do
  echo "=== $dir ==="
  cat "$dir/migration.sql"
  echo ""
done
# Verify: no DROP statements anywhere, no ALTER COLUMN (only ADD COLUMN), no DROP INDEX
# If any destructive SQL appears, delete the migration dir, fix the schema, and regenerate
```

Each migration must pass `npx prisma validate` before proceeding.

### 0.2 WebSocket thread:join / thread:leave Missing Participant Verification

**Finding:** `backend/src/modules/events/events.gateway.ts:167-189` handles `thread:join` and `thread:leave` by simply calling `client.join(room)` / `client.leave(room)` — **no verification that the user is a `ThreadParticipant`, no tenant-scope check.** Any authenticated user can join any thread room across tenants by emitting `thread:join` with any `threadId`.

**Required code change (before ANY rollout):**

In `events.gateway.ts`, inject `ThreadService` and verify membership before allowing subscription:

```typescript
// In handleThreadJoin (line 167), add BEFORE client.join():
// 1. Extract userId and tenantId from the authed socket
// 2. Verify the thread belongs to the socket's tenant
// 3. Verify the requesting user is a ThreadParticipant

@SubscribeMessage('thread:join')
async handleThreadJoin(
  @ConnectedSocket() client: Socket,
  @MessageBody() body: { threadId?: string },
): Promise<{ joined: boolean; room?: string }> {
  const authed = client as AuthedSocket;
  if (!authed.userId || !authed.tenantId) return { joined: false };

  const threadId = typeof body?.threadId === 'string' ? body.threadId : null;
  if (!threadId) return { joined: false };

  // GAP-FIX: verify thread belongs to this tenant + user is a participant
  const thread = await this.prisma.communicationThread.findFirst({
    where: { id: threadId, tenantId: authed.tenantId },
  });
  if (!thread) return { joined: false };

  const isParticipant = await this.prisma.threadParticipant.findUnique({
    where: {
      threadId_participantType_participantId: {
        threadId,
        participantType: 'USER',
        participantId: authed.userId,
      },
    },
  });
  if (!isParticipant) return { joined: false };
  // END GAP-FIX

  const room = `thread:${threadId}`;
  await client.join(room);
  return { joined: true, room };
}
```

Same verification must be added to `handleThreadLeave` (the leave operation should only succeed if the user was actually joined to that room — a no-op leave of a room the user never joined should return `{ left: false }`).

**Validation:** `npx tsc --noEmit` → 0 errors. `npm run build` → clean.

### 0.3 Feature-Flags Admin Page Missing 11 Comms Flags

**Finding:** `frontend-admin/src/app/feature-flags/page.tsx` only manages 5 flags: `HERMES_ENABLED`, `HERMES_AUTO_LINK`, `HERMES_APPROVAL_REQUIRED`, `HERMES_SESSION_LOGGING`, `DISABLE_AI_ACTIONS`. **None of the 11 comms flags are listed.** Without this, operators must use direct `curl` or `psql` to flip flags — no admin UI path exists.

**Required:** Add all 11 comms flags to the admin page. Each flag's toggle payload uses `COMM_THREADS_ENABLED`, `COMM_ACTIVITIES_ENABLED`, `AGENT_MESSAGING_ENABLED`, `COMM_AGENT_MESSAGING_ENABLED`, `COMM_PRESENCE_ENABLED`, `COMM_CONVERSATION_INTELLIGENCE_ENABLED`, `COMM_DIGEST_ENABLED`, `COMM_ESCALATION_ENABLED`, `COMM_FOLLOWUP_ENABLED`, `COMM_MENTIONS_ENABLED`, `COMM_WORKFLOW_TEMPLATES_ENABLED` (if registered). Group the flags under a "Enterprise Communication" section header with `AGENT_MESSAGING_ENABLED` marked as ⚠️ HIGH RISK.

The existing flags stay in the "Hermes" section. The page should show **16 total flags** after this change (5 existing + 11 new).

If time is short, the minimum viable change is to add only the 5 most-critical flags: `COMM_THREADS_ENABLED`, `COMM_ACTIVITIES_ENABLED`, `COMM_PRESENCE_ENABLED`, `COMM_MENTIONS_ENABLED`, and `AGENT_MESSAGING_ENABLED`. The remaining 6 can follow in a subsequent deploy.

### 0.4 Frontend Tenant useFeatureFlag Hook Lacks Comms Support

**Finding:** `frontend-tenant/src/hooks/useFeatureFlag.ts` supports only 7 flags (`commandCenter`, `workspace`, `marketplace`, `serviceDesk`, `intelligence`, `finance`, `departments`). The hook has no awareness of any comms flags. This is low-priority for rollout (the tenant UI doesn't gate any features on comms flags today) but should be addressed before any tenant-facing comms UI ships.

**Required:** Add the full `FeatureFlag` type to include comms flags:
```typescript
| 'COMM_THREADS_ENABLED'
| 'COMM_ACTIVITIES_ENABLED'
| 'COMM_PRESENCE_ENABLED'
// etc.
```

**Deferrable:** The rollout can proceed without this — the tenant UI currently has no feature-flag-gated comms components. Schedule this alongside the `ThreadView` / `AgentInboxPanel` frontend work.

### 0.5 AGENT_MESSAGING_ENABLED vs COMM_AGENT_MESSAGING_ENABLED Ambiguity

**Finding:** `feature-flag.service.ts` registers BOTH `AGENT_MESSAGING_ENABLED` (line 87) and `COMM_AGENT_MESSAGING_ENABLED` (line 91) as separate flags. `AgentMessagingGuard.check()` reads `AGENT_MESSAGING_ENABLED` (the non-COMM variant). The `COMM_AGENT_MESSAGING_ENABLED` variant is documented as a "legacy alias kept for back-compat."

**Decision required:** Pick ONE canonical flag for A2A messaging. Recommendation: use `AGENT_MESSAGING_ENABLED` as the canonical flag (matches spec §6.4 line 664 exactly). Mark `COMM_AGENT_MESSAGING_ENABLED` as a deprecated alias that the guard checks as an OR condition: if either flag is true, messaging is enabled.

**Required code change:** In `agent-messaging.guard.ts`, check BOTH flags:
```typescript
const enabled =
  (await this.featureFlags.isEnabled('AGENT_MESSAGING_ENABLED', tenantId)) ||
  (await this.featureFlags.isEnabled('COMM_AGENT_MESSAGING_ENABLED', tenantId));
```

**This rollout plan uses `AGENT_MESSAGING_ENABLED`** as the canonical name in all gates.

### 0.6 Frontend Missing thread:join / thread:leave Socket Emits

**Finding:** Neither frontend emits `socket.emit('thread:join', { threadId })` or `socket.emit('thread:leave', { threadId })`. The backend handlers exist but no client calls them. Without subscription, clients cannot receive per-thread broadcasts (`thread:message`, `thread:activity`, `thread:participant_added`, `thread:mention`). Note: `thread:mention` is emitted to `user:<id>` rooms (joined automatically at handshake), so mentions WILL work even without explicit thread subscription.

**Deferrable:** The rollout can proceed without this — thread-level WebSocket events cannot be received until frontend clients subscribe, but REST endpoints cover all read paths. Schedule this alongside the `ThreadView` / `AgentInboxPanel` frontend work. Document as a known limitation at each gate.

---

## 1. Overview

### 1.1 What Is Being Rolled Out

The Enterprise Communication Platform replaces three disconnected feed/message abstractions (`MissionFeedItem`, in-memory `ActivityStream`, mock-data `LiveFeedWidget`) with a single persisted, tenant-isolated, visibility-aware model. It ships 20 new backend services, 4 controllers, 8 new Prisma models, and rewired frontend hooks — all behind 11 feature flags.

### 1.2 Rollout Principles

| Principle | Application |
|---|---|
| **Additive only** | No column/table removals. No existing endpoint modifications. Rollback = flip flag off. |
| **Feature-flagged** | Every phase is off by default. Zero prod behaviour changes until a flag is deliberately flipped. |
| **Per-tenant, not global** | `AGENT_MESSAGING_ENABLED` must NEVER be flipped globally. All others can be flipped per-tenant via `PUT /feature-flags/tenant/:tenantId`. |
| **No downtime** | No migration requires a schema rollback or service restart beyond the normal PM2 restart cycle. |
| **SOLID contract preserved** | Every new service depends on interfaces (DIP). No existing consumer is broken by new code (LSP). Enums are extended, not modified (OCP). |
| **Security-first** | Tenant isolation at every read/write boundary. No `all` room fallback. WS room subscriptions require participant verification (§0.2). |

### 1.3 Rollout Prerequisites

Before beginning, confirm all of the following are true:

```bash
# 1. §0 engineering tasks completed (verified by code review)
# 2. Local build is clean
cd /home/najeeb/Linux-Dev/neurecore-2026/neurecore/backend && npm run build        # nest build → 0 errors
cd /home/najeeb/Linux-Dev/neurecore-2026/neurecore/frontend-tenant && npm run build   # next build → 0 errors
cd /home/najeeb/Linux-Dev/neurecore-2026/neurecore/frontend-admin && npm run build    # next build → 0 errors

# 3. TypeScript is clean
cd /home/najeeb/Linux-Dev/neurecore-2026/neurecore/backend && npx tsc --noEmit       # 0 errors

# 4. Prisma schema is valid
cd /home/najeeb/Linux-Dev/neurecore-2026/neurecore/backend && npx prisma validate     # valid

# 5. 6 migration files exist under prisma/migrations/20260711_*
ls /home/najeeb/Linux-Dev/neurecore-2026/neurecore/backend/prisma/migrations/20260711_*
# Must show 6 directories

# 6. Contabo is reachable and healthy
ssh contabo 'pm2 list | grep neurecore'                     # all neurecore processes online
curl -sk https://brain.neurecore.com/api/v1/health          # 200

# 7. Redis is reachable from Contabo backend (required for Phase 7/Presence)
ssh contabo 'redis-cli -u "$(grep REDIS_URL /opt/neurecore/backend/backend/.env | cut -d= -f2-)" PING'
# Expected: PONG

# 8. No uncommitted production changes on Contabo
ssh contabo 'cd /opt/neurecore/backend/backend && git status --short -- src/ prisma/'
# Must be empty (or only intended changes)
```

If any check fails, do not proceed. Fix the issue first.

---

## 2. Phase Gate Map

Each gate must pass before advancing to the next phase. Gates are numbered to match the implementation phase they enable.

| Gate | Flag to flip | Scope | How | Success criteria |
|---|---|---|---|---|
| **G0** | (none — baseline) | — | Pre-flight checks §1.3 + §0 tasks verified | All green |
| **G1** | `COMM_THREADS_ENABLED` | One test tenant only | `PUT /feature-flags/tenant/:id` | `POST /api/v1/threads` creates a thread; `GET /api/v1/threads/:id` returns it; participant membership enforced; WS `thread:join` verifies participant membership |
| **G2** | `COMM_ACTIVITIES_ENABLED` | Same test tenant | `PUT /feature-flags/tenant/:id` | `activity_events` table receives rows; `MissionFeedService.create()` write-through fires; `MissionFeedAiPrioritizer` does not crash on enum drift |
| **G3** | `COMM_PRESENCE_ENABLED` | Same test tenant | `PUT /feature-flags/tenant/:id` | Redis keys `presence:<tenantId>:*` appear with TTL 60-120s; after 5+ min stale entries swept to `offline`; Redis PING succeeds before gate activation |
| **G4** | `COMM_MENTIONS_ENABLED` | Same test tenant | `PUT /feature-flags/tenant/:id` | `mentions` JSON column populated in `hermes_messages`; `thread:mention` WS events emitted to `user:<id>` rooms (user rooms joined automatically at handshake) |
| **G5** | `COMM_ACTIVITIES_ENABLED` already active from G2 | All G2-enabled tenants | Frontend deploy verification | `LiveFeedWidget` renders real data from `useActivityFeed`; no mock/stub data; `activity:new` WS events received |
| **G6** | `COMM_CONVERSATION_INTELLIGENCE_ENABLED` | One staging tenant | `PUT /feature-flags/tenant/:id` | `ConversationIntelligenceService.summarize()` produces readable output; `scopeDepartmentId` returns dept-scoped answers |
| **G7** | `COMM_DIGEST_ENABLED` | Staging tenant | `PUT /feature-flags/tenant/:id` | `DigestService.generate()` returns structured tenant+dept+goal+project+agent narrative; no runtime errors |
| **G8** | `COMM_ESCALATION_ENABLED` | Staging tenant | `PUT /feature-flags/tenant/:id` | `EscalationService.tick()` walks `REPORTS_TO` chain correctly; `MissionFeedItem` created with `RISK_DETECTED` category |
| **G9** | `COMM_FOLLOWUP_ENABLED` | Test tenant | `PUT /feature-flags/tenant/:id` | `thread.followup` activity emitted for stale threads; `FollowUpService.tick()` runs without errors |
| **G10** | `AGENT_MESSAGING_ENABLED` | **Isolated test tenant — NEVER globally** | `PUT /feature-flags/tenant/:id` | Guard blocks at hop 5; cost ceiling enforced; idempotency works; per-tenant only |

**G5 is frontend-only** — once G2 passes, the frontend can be pointed at the canonical feed without touching any more flags. It requires a `frontend-tenant` deploy.

**G10 is the highest-risk gate.** `AGENT_MESSAGING_ENABLED` must NEVER be flipped globally. See §5.10 for the full guard pre-flight.

**Background ticker services** (`EscalationService`, `FollowUpService`, `ThreadSummarizationService`, `RetentionJobService`, `RiskDetectionService`, `WorkflowTemplateService`) are activated when their corresponding flags are flipped. They use `setInterval` internally. Verify each ticker starts in PM2 logs when its flag is enabled.

---

## 3. Migration Deployment

### 3.1 Migration File Verification

Before deploying, confirm all 6 migration directories exist:

```bash
ls -d /home/najeeb/Linux-Dev/neurecore-2026/neurecore/backend/prisma/migrations/20260711_*/
# Must show: 20260711_thread_model/ 20260711_activity_events/ 20260711_workflow_templates/
#            20260711_notification_preferences/ 20260711_retention_policies/
#            20260711_relationship_type_reports_delegates/

# Verify each migration.sql is non-empty and additive-only
for dir in /home/najeeb/Linux-Dev/neurecore-2026/neurecore/backend/prisma/migrations/20260711_*/; do
  echo "=== $(basename $dir) ==="
  wc -l "$dir/migration.sql"
  grep -c 'DROP\|DROP INDEX\|DROP COLUMN' "$dir/migration.sql" || echo "  (no destructive ops)"
done
# Every dir: lines > 0, "no destructive ops"
```

### 3.2 Pre-Migration Snapshot

Before applying any migration to production:

1. Take a database snapshot:
   ```bash
   ssh contabo "pg_dump -Fc neurecore > /tmp/pre-comms-rollout-$(date +%Y%m%d).dump"
   ```
2. Apply all 6 migrations against the snapshot first:
   ```bash
   DATABASE_URL="<snapshot-url>" npx prisma migrate deploy
   ```
3. Smoke-test the snapshot:
   ```bash
   DATABASE_URL="<snapshot-url>" node -e "
     const { PrismaClient } = require('@prisma/client');
     const p = new PrismaClient();
     (async () => {
       console.log('activity_events:', await p.activityEvent.count());
       console.log('communication_threads:', await p.communicationThread.count());
       console.log('thread_participants:', await p.threadParticipant.count());
       console.log('thread_read_states:', await p.threadReadState.count());
       console.log('adapter_cursors:', await p.adapterCursor.count());
       console.log('workflow_templates:', await p.workflowTemplate.count());
       console.log('notification_preferences:', await p.notificationPreference.count());
       console.log('retention_policies:', await p.retentionPolicy.count());
       await p.\$disconnect();
     })();
   "
   ```
   All counts must be `0` — new tables are empty at this stage.
7. Verify `HermesMessage` columns exist:
   ```bash
   DATABASE_URL="<neon-branch-url>" node -e "
     const { PrismaClient } = require('@prisma/client');
     const p = new PrismaClient();
     (async () => {
       const m = await p.hermesMessage.findFirst();
       console.log('has threadId:', 'threadId' in (m || {}));
       console.log('has idempotencyKey:', 'idempotencyKey' in (m || {}));
       console.log('has mentions:', 'mentions' in (m || {}));
       await p.\$disconnect();
     })();
   "
   # Expected: has threadId: true, has idempotencyKey: true, has mentions: true
   ```
8. If smoke-test passes, proceed to production apply
9. Keep the DB snapshot for 72 hours post-deploy; delete only after all gates (G1–G10) pass

### 3.3 Apply Migrations to Production

```bash
# TAKE A FRESH DR SNAPSHOT FIRST
ssh contabo 'SNAPDIR=/opt/neurecore/_archives/$(date +%Y%m%d-%H%M%S)-pre-comms-migration
mkdir -p $SNAPDIR
cd /opt/neurecore/backend/backend && tar -czf $SNAPDIR/backend-dist.tar.gz dist/
echo "Snapshot saved to $SNAPDIR"'

# Apply all 6 migrations
ssh contabo 'cd /opt/neurecore/backend/backend && \
  export $(grep -v "^#" .env | grep -E "DATABASE_URL|DIRECT_URL" | xargs) && \
  ./node_modules/.bin/prisma migrate deploy'

# Verify all 6 applied
ssh contabo 'cd /opt/neurecore/backend/backend && \
  export $(grep -v "^#" .env | grep -E "DATABASE_URL|DIRECT_URL" | xargs) && \
  ./node_modules/.bin/prisma migrate status'
# Must show all 6 migrations as "applied" and none as "pending"

# Regenerate Prisma client (critical — the deployed client must know about new models)
ssh contabo 'cd /opt/neurecore/backend/backend && \
  export $(grep -v "^#" .env | grep -E "DATABASE_URL|DIRECT_URL" | xargs) && \
  ./node_modules/.bin/prisma generate'

# Rebuild backend
ssh contabo 'cd /opt/neurecore/backend/backend && \
  export $(grep -v "^#" .env | grep -E "DATABASE_URL|DIRECT_URL" | xargs) && \
  ./node_modules/.bin/nest build'

# Restart
ssh contabo 'pm2 restart neurecore-backend'

# Verify backend comes back healthy
sleep 5
curl -sk https://brain.neurecore.com/api/v1/health
# Expected: {"status":"healthy",...}

# Verify new endpoints respond (should be 401 — JWT guard working, not 404 or 500)
curl -sk -o /dev/null -w "%{http_code}\n" https://brain.neurecore.com/api/v1/threads
# Expected: 401 (not 404, not 500)
curl -sk -o /dev/null -w "%{http_code}\n" https://brain.neurecore.com/api/v1/activity
# Expected: 401 (not 404, not 500)
curl -sk -o /dev/null -w "%{http_code}\n" https://brain.neurecore.com/api/v1/compliance/export/decisions
# Expected: 401 (not 404, not 500)

# Verify no DI failures in logs
ssh contabo 'pm2 logs neurecore-backend --lines 30 --nostream --raw | grep -i "UnknownDependenciesException\|Can.*resolve\|HermesNode\|DI"'
# Must be empty (no DI errors on boot)
```

### 3.4 Seed Initial RetentionPolicy Data

After migrations, seed default `RetentionPolicy` rows for every existing tenant:

```bash
ssh contabo 'cd /opt/neurecore/backend/backend && \
  export $(grep -v "^#" .env | grep -E "DATABASE_URL|DIRECT_URL" | xargs) && \
  node -e "
    const { PrismaClient } = require(\"@prisma/client\");
    const p = new PrismaClient();
    (async () => {
      const tenants = await p.tenant.findMany({ select: { id: true } });
      let seeded = 0;
      for (const t of tenants) {
        await p.retentionPolicy.upsert({
          where: { tenantId: t.id },
          create: { tenantId: t.id },
          update: {},
        });
        seeded++;
      }
      console.log(\"RetentionPolicy seeded for\", seeded, \"tenants\");
      await p.\$disconnect();
    })();
  "'
# Expected: "RetentionPolicy seeded for <N> tenants"
```

---

## 4. Deployment Steps

These deploy the actual code (services, controllers, hooks) to Contabo. Execute after §3 migrations are applied and verified.

### 4.1 Pre-Deploy Full Snapshot

```bash
ssh contabo 'SNAP=/opt/neurecore/_archives/$(date +%Y%m%d-%H%M%S)-pre-comms-code
mkdir -p $SNAP
cd /opt/neurecore/backend/backend && tar -czf $SNAP/backend-dist.tar.gz dist/ 2>/dev/null
cd /opt/neurecore/frontend-tenant && tar -czf $SNAP/frontend-tenant-.next.tar.gz .next/ 2>/dev/null
echo "Snapshot at $SNAP"'
```

### 4.2 Backend Deploy

```bash
cd /home/najeeb/Linux-Dev/neurecore-2026/neurecore
./scripts/deploy.sh backend
```

The deploy script rsyncs source → runs `npm install` → runs `prisma generate` → runs `prisma migrate deploy` → runs `nest build` → restarts `neurecore-backend`.

**Post-deploy verification:**

```bash
# Health check
curl -sk https://brain.neurecore.com/api/v1/health
# Expected: 200

# No new crashes in logs
ssh contabo 'pm2 logs neurecore-backend --lines 100 --nostream --raw | grep -iE "error|exception|Nest can.*resolve" | tail -20'
# Must be empty of NEW errors (pre-existing errors from other modules are noise)

# All comms endpoints returning 401 (not 404)
for path in threads 'threads/unread/count' activity 'hermes/explain/test-agent/decisions' 'compliance/export/decisions'; do
  code=$(curl -sk -o /dev/null -w "%{http_code}" "https://brain.neurecore.com/api/v1/$path")
  echo "$path → $code (expected: 401)"
done
# All must return 401
```

### 4.3 Frontend-Tenant Deploy

```bash
cd /home/najeeb/Linux-Dev/neurecore-2026/neurecore
./scripts/deploy.sh tenant
```

This deploys `frontend-tenant/` which includes the rewired `LiveFeedWidget` and `useActivityFeed` hook.

**Verify:**

```bash
curl -sk -o /dev/null -w "%{http_code}\n" https://hq.neurecore.com/   # 200
curl -sk -o /dev/null -w "%{http_code}\n" https://hq.neurecore.com/home   # 200
```

### 4.4 Frontend-Admin Deploy

```bash
cd /home/najeeb/Linux-Dev/neurecore-2026/neurecore
./scripts/deploy.sh admin
```

**Verify:**

```bash
curl -sk -o /dev/null -w "%{http_code}\n" https://cc.neurecore.com/   # 200
```

### 4.5 Final Pre-Gate Smoke Test

```bash
# Verify the DI graph is intact (no UnknownDependenciesException)
ssh contabo 'pm2 logs neurecore-backend --lines 50 --nostream --raw | grep -iE "UnknownDep|Can.*resolve|Nest can"'
# Expected: empty

# Verify HermesRuntimeService correctly injects IHermesEventBus (not concrete class)
ssh contabo 'pm2 logs neurecore-backend --lines 50 --nostream --raw | grep -i "HermesRuntimeService\|eventBus"'
# No errors related to event bus resolution

# Verify EnterpriseEventBusService started
ssh contabo 'pm2 logs neurecore-backend --lines 50 --nostream --raw | grep -i "EnterpriseEventBus\|event.bus"'
# Should show init/startup log (if service logs at boot)

# Verify the 6 symbol aliases resolved correctly
ssh contabo 'pm2 logs neurecore-backend --lines 100 --nostream --raw | grep -iE "THREAD_SERVICE|HERMES_EVENT_BUS|ACTIVITY_SERVICE|HERMES_RUNTIME|AGENT_MESSAGING_GUARD|PARTICIPANT_RESOLVER"'
# No DI resolution errors
```

---

## 5. Per-Phase Flag Rollout

Execute each gate in order. Skip no gates. Record results in the sign-off sheet (§13).

### 5.1 Gate G1 — Thread Model (Phase 1)

**Flag:** `COMM_THREADS_ENABLED`  
**Scope:** One test tenant only  
**REST endpoint:** `PUT /feature-flags/tenant/:tenantId`

```bash
TEST_TENANT_ID="<your-test-tenant-id>"

# Enable the flag
curl -sk -X PUT "https://brain.neurecore.com/api/v1/feature-flags/tenant/$TEST_TENANT_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"flags":{"COMM_THREADS_ENABLED":true}}'
```

**Verification — Thread CRUD:**

```bash
# 1. Create a thread (as test user)
THREAD=$(curl -sk -X POST https://brain.neurecore.com/api/v1/threads \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Rollout G1 test thread","contextType":"project","contextId":"g1-test-001"}')
echo "$THREAD" | python3 -m json.tool
# Expected: 201 with { id, tenantId, title, status:"ACTIVE", hopCount:0, createdAt, ... }
THREAD_ID=$(echo "$THREAD" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null || echo "$THREAD" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

# 2. Fetch the thread
curl -sk "https://brain.neurecore.com/api/v1/threads/$THREAD_ID" \
  -H "Authorization: Bearer $USER_TOKEN" | python3 -m json.tool
# Expected: 200 with thread object (not null, not [])
```

**Verification — Participant Membership Enforcement:**

```bash
# 3. Non-participant cannot read (silent null — prevents enumeration oracle)
curl -sk "https://brain.neurecore.com/api/v1/threads/$THREAD_ID" \
  -H "Authorization: Bearer $OTHER_USER_TOKEN"
# Expected: 200 but data is null (not 403, not the actual thread)

# 4. Add participant
curl -sk -X POST "https://brain.neurecore.com/api/v1/threads/$THREAD_ID/participants" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"participantType":"USER","participantId":"<other-user-id>"}'
# Expected: 201

# 5. Now the other user CAN read
curl -sk "https://brain.neurecore.com/api/v1/threads/$THREAD_ID" \
  -H "Authorization: Bearer $OTHER_USER_TOKEN"
# Expected: 200 with thread data (not null)
```

**Verification — WebSocket Security (§0.2):**

```bash
# 6. Unauthenticated thread:join must fail
# (Test via socket.io client or browser console — the handler must return {joined:false})
# If using a test script: emit 'thread:join' with no auth → must return {joined:false}

# 7. Authenticated but non-participant thread:join must fail
# AUTHENTICATED user who is NOT a ThreadParticipant for THREAD_ID
# Emit 'thread:join' with {threadId: THREAD_ID} → must return {joined:false}

# 8. Authenticated AND participant thread:join must succeed
# Emit 'thread:join' with {threadId: THREAD_ID} → must return {joined:true, room:"thread:<id>"}
```

**Verification — Read State:**

```bash
# 9. Mark read
curl -sk -X POST "https://brain.neurecore.com/api/v1/threads/$THREAD_ID/read" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
# Expected: 201

# 10. Get unread count
curl -sk "https://brain.neurecore.com/api/v1/threads/unread/count" \
  -H "Authorization: Bearer $USER_TOKEN"
# Expected: 200 with { count: <number> }
```

**Database checks:**

```sql
-- Thread was created
SELECT id, tenant_id, title, status, hop_count, created_at
FROM communication_threads WHERE tenant_id = '<test-tenant-id>';
-- Must show exactly 1 thread with title 'Rollout G1 test thread'

-- User is a participant
SELECT * FROM thread_participants WHERE thread_id = '<thread-id>';
-- Must show creator as USER participant

-- Read state recorded
SELECT * FROM thread_read_states WHERE thread_id = '<thread-id>';
-- Must show 1 row after mark-read call
```

### 5.2 Gate G2 — Activities (Phase 2)

**Flag:** `COMM_ACTIVITIES_ENABLED`  
**Scope:** Same test tenant

```bash
curl -sk -X PUT "https://brain.neurecore.com/api/v1/feature-flags/tenant/$TEST_TENANT_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"flags":{"COMM_ACTIVITIES_ENABLED":true}}'
```

**Verification — Write-Through:**

```bash
# 1. Trigger a MissionFeedItem creation (any backend action that creates one)
# Then check activity_events received the write-through
ssh contabo 'psql "$DATABASE_URL" -c "
  SELECT COUNT(*) AS event_count
  FROM activity_events
  WHERE tenant_id = '"'"'<test-tenant-id>'"'"'
    AND created_at > NOW() - INTERVAL '"'"'30 minutes'"'"';
"'
# Must be > 0

# 2. Verify MissionFeedItem → ActivityEvent correlation
ssh contabo 'psql "$DATABASE_URL" -c "
  SELECT mfi.id AS mission_feed_id, mfi.category,
         ae.id AS activity_id, ae.type, ae.source_event_id
  FROM mission_feed_item mfi
  LEFT JOIN activity_events ae
    ON ae.source_event_id = mfi.source_event_id
    AND ae.tenant_id = mfi.tenant_id
  WHERE mfi.tenant_id = '"'"'<test-tenant-id>'"'"'
    AND mfi.created_at > NOW() - INTERVAL '"'"'1 hour'"'"'
  LIMIT 10;
"'
# For every MissionFeedItem, at least one ActivityEvent row should exist
# with matching source_event_id
```

**Verification — Activity Feed REST:**

```bash
# 3. Read activity feed (visibility-scoped to this user)
curl -sk "https://brain.neurecore.com/api/v1/activity?limit=10" \
  -H "Authorization: Bearer $USER_TOKEN" | python3 -m json.tool
# Expected: 200 with activity list. Each event has actorType, type, title, visibility

# 4. Verify visibility scoping — tenant-level events visible
# (all returned events should have visibility='tenant' or the user is a targeted participant)

# 5. Since-based pagination (rev 3 fix)
curl -sk "https://brain.neurecore.com/api/v1/activity?limit=5&since=<event-id>" \
  -H "Authorization: Bearer $USER_TOKEN"
# Expected: returns only events created after the specified since ID
```

**Verification — MissionFeedAiPrioritizer Stability (FIX-008):**

```bash
# 6. Wait 5+ minutes, then check PM2 logs — no ONBOARDING_TASK enum crash
ssh contabo 'pm2 logs neurecore-backend --lines 200 --nostream --raw | grep -i "ONBOARDING_TASK\|MissionFeedAiPrioritizer.*ERROR\|Invalid.*enum"'
# Expected: empty (the defensive category filter + try/catch from FIX-008 prevents this)

# 7. The prioritizer tick should still produce results
ssh contabo 'pm2 logs neurecore-backend --lines 200 --nostream --raw | grep -i "MissionFeedAiPrioritizer.*updated\|prioritized"'
# Expected: log lines showing successful prioritization (no errors)
```

**Database checks:**

```sql
-- Activity events exist
SELECT COUNT(*) FROM activity_events WHERE tenant_id = '<test-tenant-id>';
-- Must be > 0

-- Visibility distribution
SELECT visibility, COUNT(*) FROM activity_events
WHERE tenant_id = '<test-tenant-id>'
GROUP BY visibility;
-- Should show 'tenant' (most), possibly 'thread', 'direct'
```

### 5.3 Gate G3 — Presence (Phase 7)

**Flag:** `COMM_PRESENCE_ENABLED`  
**Scope:** Same test tenant

**Pre-flight — Redis must be healthy:**

```bash
ssh contabo 'redis-cli -u "$(grep REDIS_URL /opt/neurecore/backend/backend/.env | cut -d= -f2-)" PING'
# Must return PONG. If not, do not proceed — fix Redis connectivity first.
```

```bash
curl -sk -X PUT "https://brain.neurecore.com/api/v1/feature-flags/tenant/$TEST_TENANT_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"flags":{"COMM_PRESENCE_ENABLED":true}}'
```

**Verification:**

```bash
# 1. Trigger an agent execution (creates a Hermes session that sets presence)
# Via REST: POST /api/v1/agents/:id/execute
# Or via internal test — any HermesRuntimeService.execute() call sets presence

# 2. Check Redis for presence keys
ssh contabo 'REDIS_URL=$(grep REDIS_URL /opt/neurecore/backend/backend/.env | cut -d= -f2-)
redis-cli -u "$REDIS_URL" --scan --pattern "presence:<test-tenant-id>:*"'
# Must show at least one key like: presence:<test-tenant-id>:AI_AGENT:<agent-id>

# 3. Check TTL on a presence key
ssh contabo 'REDIS_URL=$(grep REDIS_URL /opt/neurecore/backend/backend/.env | cut -d= -f2-)
KEY=$(redis-cli -u "$REDIS_URL" --scan --pattern "presence:<test-tenant-id>:*" | head -1)
if [ -n "$KEY" ]; then
  TTL=$(redis-cli -u "$REDIS_URL" TTL "$KEY")
  echo "Key: $KEY, TTL: $TTL (expected: 60-120)"
fi'
# Expected: TTL between 60 and 120 seconds

# 4. Wait 3+ minutes, check key is still alive (heartbeat refreshed it)
# OR if agent has stopped, TTL should be < 60 and approaching 0

# 5. Check for presence:updated WS events (tenant room)
# Connect a socket client → join tenant room → wait for 'presence:updated' event
```

**Background ticker verification:**

```bash
# 6. Check for presence-related logs (PresenceService sweep runs on a timer)
ssh contabo 'pm2 logs neurecore-backend --lines 200 --nostream --raw | grep -i "presence\|PresenceService"'
# Expected: presence:updated events logged, sweep logs showing stale entries detected
```

### 5.4 Gate G4 — Mentions (Phase 9c)

**Flag:** `COMM_MENTIONS_ENABLED`  
**Scope:** Same test tenant

```bash
curl -sk -X PUT "https://brain.neurecore.com/api/v1/feature-flags/tenant/$TEST_TENANT_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"flags":{"COMM_MENTIONS_ENABLED":true}}'
```

**Verification:**

```bash
# 1. Send a message with @mentions via Hermes session
# (HermesSessionService.addMessage(sessionId, role, content, metadata, threadId, idempotencyKey, mentions))
# mentions format: [{ participantType: 'USER', participantId: '<user-id>', mentionedBy: { type, id } }]

# 2. Check mentions column populated
ssh contabo 'psql "$DATABASE_URL" -c "
  SELECT id, thread_id, role,
         substring(content, 1, 100) AS content_preview,
         mentions
  FROM hermes_messages
  WHERE mentions IS NOT NULL
    AND mentions::text != '"'"'[]'"'"'
  ORDER BY created_at DESC
  LIMIT 5;
"'
# Must show rows with non-empty JSON arrays in mentions

# 3. Verify thread:mention WS event was fired
# The event is emitted to user:<participantId> rooms (joined automatically at WS handshake)
# User rooms don't require explicit thread:join subscription — this gates differently from other WS events
# Check via browser socket inspector or test script:
# Listen for 'thread:mention' event on the user's socket → must receive after message with @mention
```

**Database check:**

```sql
SELECT COUNT(*) FROM hermes_messages
WHERE mentions IS NOT NULL
  AND mentions::text != '[]'
  AND created_at > NOW() - INTERVAL '1 hour';
-- Must be > 0
```

**ThreadSummarizationService check:**

```bash
# 4. ThreadSummarizationService runs every 15 min (if threads have ≥100 messages)
# For this test, it likely won't fire (not enough messages) — that's expected
# Verify the service is loaded and the timer is started (check PM2 logs for init)

ssh contabo 'pm2 logs neurecore-backend --lines 300 --nostream --raw | grep -i "ThreadSummarization\|thread.summar"'
# If no results: expected if no threads have ≥100 messages
# If errors: investigate
```

### 5.5 Gate G5 — Frontend Feed Swap (Phase 5)

**No new flag.** Activated automatically when `COMM_ACTIVITIES_ENABLED` is true (G2). This gate verifies the frontend correctly consumes the real feed.

**Deploy the frontend-tenant if not already done (§4.3).**

**Verification (browser):**

```bash
# 1. Open https://hq.neurecore.com/home as the test user
# Open browser DevTools → Network tab → filter by "/api/v1/activity"
# Expected: XHR requests to /api/v1/activity with 200 responses

# 2. LiveFeedWidget (right panel) must show real ActivityEvent data
# Signs of mock data: all items have identical timestamps, always the same 3 items
# Signs of real data: timestamps vary, visibility varies, actorType varies

# 3. Check LiveFeedWidget for no mock fallback
# In frontend-tenant/src/components/home/LiveFeedWidget.tsx
# Search for "mock", "hardcoded", "dummy", "fake", "fallback", "demo"
# Expected: NO occurrences (verified in audit — file is clean)

# 4. WS activity:new events received
# In browser console: listen for 'activity:new' Socket.IO events
# Each new ActivityEvent created on the backend should appear as a WS push
```

**Known limitation:** `thread:message`, `thread:activity`, `thread:participant_added` WS events are emitted by the backend but will not reach the frontend until `thread:join` socket emits are implemented on the client side (§0.6). The REST endpoints (`GET /api/v1/activity`, `GET /api/v1/threads/:id/messages`) cover the same data via polling.

### 5.6 Gate G6 — Conversation Intelligence (Phase 8)

**Flag:** `COMM_CONVERSATION_INTELLIGENCE_ENABLED`  
**Scope:** One staging tenant (must have 3+ agents + message history)

```bash
STAGING_TENANT_ID="<staging-tenant-id>"

curl -sk -X PUT "https://brain.neurecore.com/api/v1/feature-flags/tenant/$STAGING_TENANT_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"flags":{"COMM_CONVERSATION_INTELLIGENCE_ENABLED":true}}'
```

**Verification:**

```bash
# 1. Trigger summarization (via internal service call or test endpoint)
# Expected: ConversationIntelligenceService.summarize() returns structured summary

# 2. Cross-department Q&A with scopeDepartmentId
# Requires departments with OPERATES_IN edges and agents assigned to those departments
# curl -sk "https://brain.neurecore.com/api/v1/...?scopeDepartmentId=..." \
#   -H "Authorization: Bearer $USER_TOKEN"
# Expected: answer scoped to that department's agents only

# 3. Check PM2 logs for ConversationIntelligenceService activity
ssh contabo 'pm2 logs neurecore-backend --lines 200 --nostream --raw | grep -i "ConversationIntelligence\|conv.intel\|summarize"'
# Expected: log lines from map-reduce or single-pass summarization (no errors)
```

### 5.7 Gate G7 — Digest + Org Intelligence (Phase 9a + 9d)

**Flag:** `COMM_DIGEST_ENABLED`  
**Scope:** Staging tenant

**Note:** The original rollout plan incorrectly referenced a non-existent `entity_health_rollup` database table. `EntityHealthRollupService` is a runtime computation service that queries existing `EntityHealth` records and aggregates them — there is no dedicated table. The G7 verification below uses the correct approach: query `entity_health` records instead.

```bash
curl -sk -X PUT "https://brain.neurecore.com/api/v1/feature-flags/tenant/$STAGING_TENANT_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"flags":{"COMM_DIGEST_ENABLED":true}}'
```

**Verification:**

```bash
# 1. Digest generation — check PM2 logs for output
ssh contabo 'pm2 logs neurecore-backend --lines 300 --nostream --raw | grep -i "DigestService\|digest.*generat"'
# Expected: digest generation logs showing tenant/dept/goal/project/agent sections

# 2. Entity health data exists (prerequisite for rollup)
ssh contabo 'psql "$DATABASE_URL" -c "
  SELECT COUNT(*) AS health_entries,
         COUNT(DISTINCT entity_type) AS entity_types,
         COUNT(DISTINCT tenant_id) AS tenants
  FROM entity_health
  WHERE tenant_id = '"'"'<staging-tenant-id>'"'"';
"'
# Must show some data (entity_health is the source table for EntityHealthRollupService)

# 3. CostCenterService — check audit log aggregation
ssh contabo 'psql "$DATABASE_URL" -c "
  SELECT COUNT(*) AS audit_entries,
         SUM(cost_usd) AS total_cost
  FROM hermes_audit_log
  WHERE tenant_id = '"'"'<staging-tenant-id>'"'"'
    AND thread_id IS NOT NULL
    AND created_at > NOW() - INTERVAL '"'"'24 hours'"'"';
"'
# Expected: data for cost aggregation (may be 0 if no A2A messaging has occurred)

# 4. RiskDetectionService tick (runs every 5 min)
ssh contabo 'pm2 logs neurecore-backend --lines 500 --nostream --raw | grep -i "RiskDetection\|risk.*detect"'
# Should show tick activity — look for CRITICAL health detection + MissionFeedItem creation

# 5. Dependency-aware alerts: dependency:updated WS events
# Check EnterpriseEventBusService logs for DEPENDS_ON edge walking
ssh contabo 'pm2 logs neurecore-backend --lines 300 --nostream --raw | grep -i "dependency:updated\|DEPENDS_ON\|DependencyGraph"'
```

### 5.8 Gate G8 — Escalation (Phase 9b)

**Flag:** `COMM_ESCALATION_ENABLED`  
**Scope:** Staging tenant

```bash
curl -sk -X PUT "https://brain.neurecore.com/api/v1/feature-flags/tenant/$STAGING_TENANT_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"flags":{"COMM_ESCALATION_ENABLED":true}}'
```

**Verification:**

```bash
# 1. Create a stale approval:requested or risk:detected activity with severity='critical'
# 2. Ensure REPORTS_TO edges exist in entity_relationships for the target entity
# 3. Wait 1 minute for tick
# 4. Check MissionFeedItem was created for escalation target

ssh contabo 'psql "$DATABASE_URL" -c "
  SELECT COUNT(*) AS escalated_items
  FROM mission_feed_item
  WHERE tenant_id = '"'"'<staging-tenant-id>'"'"'
    AND category = '"'"'RISK_DETECTED'"'"'
    AND created_at > NOW() - INTERVAL '"'"'10 minutes'"'"';
"'
# Must be > 0 if escalation triggered

# 5. Check EscalationService ticker logs
ssh contabo 'pm2 logs neurecore-backend --lines 200 --nostream --raw | grep -i "EscalationService\|escalat"'
# Expected: tick logs showing escalation scan + results
```

### 5.9 Gate G9 — Follow-Up + Workflow Templates (Phase 9b)

**Flag:** `COMM_FOLLOWUP_ENABLED`  
**Scope:** Test tenant

```bash
curl -sk -X PUT "https://brain.neurecore.com/api/v1/feature-flags/tenant/$TEST_TENANT_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"flags":{"COMM_FOLLOWUP_ENABLED":true}}'
```

**Verification:**

```bash
# 1. Create a stale thread (no messages for >24h) — use database to backdate a thread
# 2. Wait 5 minutes for FollowUpService tick
# 3. Check for thread.followup activity

ssh contabo 'psql "$DATABASE_URL" -c "
  SELECT COUNT(*) AS followup_events
  FROM activity_events
  WHERE tenant_id = '"'"'<test-tenant-id>'"'"'
    AND type = '"'"'thread.followup'"'"'
    AND created_at > NOW() - INTERVAL '"'"'10 minutes'"'"';
"'
# If a stale thread was created, must be > 0

# 4. WorkflowTemplateService — create a template with cron + due time
# 5. Wait for the template's next run time
# 6. Verify a new thread was created by the template

ssh contabo 'psql "$DATABASE_URL" -c "
  SELECT wt.id, wt.title, wt.cron, wt.next_run_at, wt.last_run_at
  FROM workflow_templates wt
  WHERE wt.tenant_id = '"'"'<test-tenant-id>'"'"';
"'
# Should show template with next_run_at updated after tick
```

### 5.10 Gate G10 — A2A Messaging (Phase 4) — HIGHEST RISK

**Flag:** `AGENT_MESSAGING_ENABLED`  
**Scope:** **One isolated test tenant only. NEVER enable globally. NEVER enable without guard pre-flight.**

This is the highest-risk gate. The circuit breaker (`AgentMessagingGuard`) must be verified against a synthetic runaway before any tenant is enabled.

#### 5.10.1 Guard Pre-Flight — Hop Limit

```bash
# 1. Set hop_count to 4 on a test thread (manually — simulating 4 prior hops)
ssh contabo 'psql "$DATABASE_URL" -c "
  UPDATE communication_threads
  SET hop_count = 4
  WHERE id = '"'"'<test-thread-id>'"'"'
    AND tenant_id = '"'"'<test-tenant-id>'"'"';
"'

# 2. Attempt A2A send — should hit guard at hop 5
# Use AgentMessagingService.send() or a test endpoint
# Expected: guard returns false, message NOT sent

# 3. Verify hop_count did NOT reach 5
ssh contabo 'psql "$DATABASE_URL" -c "
  SELECT id, hop_count FROM communication_threads
  WHERE id = '"'"'<test-thread-id>'"'"';
"'
# hop_count must still be 4 (not 5, not 6)
```

#### 5.10.2 Guard Pre-Flight — Cost Ceiling

```bash
# 1. Set a low cost ceiling in the tenant's feature flags (test only)
# 2. Generate enough HermesAuditLog.costUsd entries for the test thread
# 3. Send an A2A message — guard must block
# 4. Verify cost aggregation is by threadId (not sessionId)
ssh contabo 'psql "$DATABASE_URL" -c "
  SELECT thread_id, SUM(cost_usd) AS total_cost,
         COUNT(*) AS message_count
  FROM hermes_audit_log
  WHERE tenant_id = '"'"'<test-tenant-id>'"'"'
    AND thread_id IS NOT NULL
  GROUP BY thread_id;
"'
# Each thread row shows total cost across ALL sessions on that thread
```

#### 5.10.3 Guard Pre-Flight — Message Count Ceiling

```bash
# 1. Set a low message ceiling in the tenant's settings
# 2. Create enough messages on a thread to exceed the ceiling
# 3. Attempt A2A send — guard must block
```

#### 5.10.4 Guard Pre-Flight — Idempotency

```bash
# 1. Send an A2A message with idempotencyKey = 'test-dedup-001'
# 2. Send the SAME message again with the SAME idempotencyKey
# 3. Verify only ONE HermesMessage row was created
ssh contabo 'psql "$DATABASE_URL" -c "
  SELECT COUNT(*) FROM hermes_messages
  WHERE idempotency_key = '"'"'test-dedup-001'"'"';
"'
# Must be exactly 1
```

#### 5.10.5 Enable for Test Tenant (only after 5.10.1–5.10.4 all pass)

```bash
curl -sk -X PUT "https://brain.neurecore.com/api/v1/feature-flags/tenant/$TEST_TENANT_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"flags":{"AGENT_MESSAGING_ENABLED":true}}'
```

#### 5.10.6 Live Verification

```bash
# Send a real A2A message between two test agents
# hop_count must increase by exactly 1 per send (server-side increment)
ssh contabo 'psql "$DATABASE_URL" -c "
  SELECT id, hop_count FROM communication_threads
  WHERE tenant_id = '"'"'<test-tenant-id>'"'"'
  ORDER BY created_at DESC LIMIT 5;
"'

# A2A chain must stop at hop 5
# After 5 legitimate sends, the 6th must be blocked by the guard
```

#### 5.10.7 Production Tenant Prohibition

> **NEVER** set `AGENT_MESSAGING_ENABLED=true` as a global default or for all tenants. Both `AGENT_MESSAGING_ENABLED` and `COMM_AGENT_MESSAGING_ENABLED` (legacy alias) are honoured by the guard — flipping EITHER flag enables A2A.

Process for enabling a production tenant:
1. Obtain written sign-off from the tenant owner
2. Run all 4 guard pre-flight checks (§5.10.1–§5.10.4) against their tenant
3. Enable only that tenant's flag
4. Monitor `hop_count` hourly for 24 hours after enabling
5. Set up a database alert: `SELECT 1 FROM communication_threads WHERE hop_count >= 5 AND tenant_id = '<prod-tenant-id>' LIMIT 1` — if any row returns, kill the flag immediately

---

## 6. Rollback Procedures

Each step below is independent. Execute only the ones relevant to the phase being rolled back.

### 6.1 Disable a Feature Flag (Instant — No Rebuild, No Restart)

```bash
curl -sk -X PUT "https://brain.neurecore.com/api/v1/feature-flags/tenant/$TENANT_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"flags":{"<FLAG_NAME>":false}}'
```

Takes effect immediately. Feature flag reads are per-request from `Tenant.settings.featureFlags` JSONB column. No PM2 restart needed.

### 6.2 Mass-Disable A2A Messaging (Emergency)

If `AGENT_MESSAGING_ENABLED` or `COMM_AGENT_MESSAGING_ENABLED` has been accidentally enabled for multiple tenants:

```bash
# Via database — instant, no restart, one-shot
ssh contabo 'psql "$DATABASE_URL" <<'"'"'SQL'"'"'
UPDATE tenants
SET settings = jsonb_set(
  jsonb_set(settings, '"'"'{featureFlags,AGENT_MESSAGING_ENABLED}'"'"', '"'"'false'"'"'),
  '"'"'{featureFlags,COMM_AGENT_MESSAGING_ENABLED}'"'"',
  '"'"'false'"'"'
)
WHERE settings->'"'"'featureFlags'"'"'->>'"'"'AGENT_MESSAGING_ENABLED'"'"' = '"'"'true'"'"'
   OR settings->'"'"'featureFlags'"'"'->>'"'"'COMM_AGENT_MESSAGING_ENABLED'"'"' = '"'"'true'"'"';
SQL
'

# Verify
ssh contabo 'psql "$DATABASE_URL" -c "
  SELECT COUNT(*) FROM tenants
  WHERE settings->'"'"'featureFlags'"'"'->>'"'"'AGENT_MESSAGING_ENABLED'"'"' = '"'"'true'"'"'
     OR settings->'"'"'featureFlags'"'"'->>'"'"'COMM_AGENT_MESSAGING_ENABLED'"'"' = '"'"'true'"'"';
"'
# Must return 0

# Last resort: env-var kill (requires backend restart)
# Add both lines to /opt/neurecore/backend/backend/.env:
#   AGENT_MESSAGING_ENABLED=false
#   COMM_AGENT_MESSAGING_ENABLED=false
# Then: ssh contabo 'pm2 restart neurecore-backend'
```

### 6.3 Full Code Rollback

If a code defect is suspected (not just a flag issue), restore from the pre-rollout snapshot:

```bash
# Restore backend dist from snapshot
ssh contabo 'SNAP=$(ls -td /opt/neurecore/_archives/*pre-comms-code* | head -1)
if [ -n "$SNAP" ] && [ -f "$SNAP/backend-dist.tar.gz" ]; then
  cd /opt/neurecore/backend/backend && tar -xzf $SNAP/backend-dist.tar.gz
  pm2 restart neurecore-backend
  echo "Rolled back from $SNAP"
else
  echo "No pre-comms snapshot found — redeploy from local"
fi'

# If no snapshot: redeploy from local
cd /home/najeeb/Linux-Dev/neurecore-2026/neurecore
git log --oneline -5                      # identify known-good commit
ssh contabo 'cd /opt/neurecore/backend/backend && git checkout <good-commit>'
./scripts/deploy.sh backend
```

### 6.4 Database Schema Rollback (Rare)

Schema migrations for this rollout are **strictly additive** — new tables, new columns. No existing data is modified. Rolling back the schema is unnecessary unless a migration introduced a column-name conflict.

If a column-name conflict is suspected (e.g., two migrations both added `thread_id` to the same table):

```bash
# Check which columns were added by these migrations
ssh contabo 'psql "$DATABASE_URL" -c "
  SELECT table_name, column_name
  FROM information_schema.columns
  WHERE table_schema = '"'"'public'"'"'
    AND column_name IN ('"'"'thread_id'"'"', '"'"'hop_count'"'"', '"'"'idempotency_key'"'"', '"'"'mentions'"'"');
"'

# If duplicate columns exist, rename the conflicting one:
# ALTER TABLE <table_name> RENAME COLUMN <conflict_col> TO <safe_name>;
```

---

## 7. Monitoring Plan

After each gate passes, monitor for 24 hours before advancing to the next gate.

### 7.1 Health Checks (Every Gate)

```bash
# Backend
curl -sk https://brain.neurecore.com/api/v1/health
# Must return 200

# Backend logs — no new errors since gate activation
ssh contabo 'pm2 logs neurecore-backend --lines 200 --nostream --raw | grep -iE "error|exception|Nest can.*resolve|UnknownDep" | tail -20'

# Frontends
curl -sk -o /dev/null -w "%{http_code}\n" https://hq.neurecore.com/
curl -sk -o /dev/null -w "%{http_code}\n" https://cc.neurecore.com/
```

### 7.2 Database Monitoring (Per-Gate)

```bash
# After G1 — threads growing
ssh contabo 'psql "$DATABASE_URL" -c "
  SELECT COUNT(*) FROM communication_threads
  WHERE created_at > NOW() - INTERVAL '"'"'1 hour'"'"';
"'

# After G2 — activity events growing
ssh contabo 'psql "$DATABASE_URL" -c "
  SELECT COUNT(*) FROM activity_events
  WHERE created_at > NOW() - INTERVAL '"'"'1 hour'"'"';
"'

# After G4 — mentions persisting
ssh contabo 'psql "$DATABASE_URL" -c "
  SELECT COUNT(*) FROM hermes_messages
  WHERE mentions IS NOT NULL
    AND mentions::text != '"'"'[]'"'"'
    AND created_at > NOW() - INTERVAL '"'"'1 hour'"'"';
"'

# ALWAYS — A2A guard: hop_count must never reach 5
ssh contabo 'psql "$DATABASE_URL" -c "
  SELECT COUNT(*) AS guard_violations
  FROM communication_threads
  WHERE hop_count >= 5;
"'
# Must ALWAYS be 0. Any non-zero result → §6.2 emergency kill immediately.

# After G7 — entity_health data growing (no dedicated table, queries EntityHealth)
ssh contabo 'psql "$DATABASE_URL" -c "
  SELECT COUNT(*) AS health_entries
  FROM entity_health
  WHERE updated_at > NOW() - INTERVAL '"'"'24 hours'"'"';
"'
```

### 7.3 Redis Monitoring (After G3)

```bash
# Presence keys exist
ssh contabo 'REDIS_URL=$(grep REDIS_URL /opt/neurecore/backend/backend/.env | cut -d= -f2-)
redis-cli -u "$REDIS_URL" --scan --pattern "presence:*" | wc -l'
# Must be > 0 when agents are active

# Presence TTL healthy (non-blocking SCAN, not KEYS)
ssh contabo 'REDIS_URL=$(grep REDIS_URL /opt/neurecore/backend/backend/.env | cut -d= -f2-)
KEY=$(redis-cli -u "$REDIS_URL" --scan --pattern "presence:*" | head -1)
[ -n "$KEY" ] && echo "TTL: $(redis-cli -u "$REDIS_URL" TTL "$KEY")s (expected: 60-120)"'
```

### 7.4 Background Job Monitoring (After G8, G9)

```bash
# EscalationService (1-min tick) — after G8
ssh contabo 'psql "$DATABASE_URL" -c "
  SELECT COUNT(*) FROM mission_feed_item
  WHERE category = '"'"'RISK_DETECTED'"'"'
    AND created_at > NOW() - INTERVAL '"'"'10 minutes'"'"';
"'

# FollowUpService (5-min tick) — after G9
ssh contabo 'psql "$DATABASE_URL" -c "
  SELECT COUNT(*) FROM activity_events
  WHERE type = '"'"'thread.followup'"'"'
    AND created_at > NOW() - INTERVAL '"'"'10 minutes'"'"';
"'

# ThreadSummarizationService (15-min tick) — after G4 (needs ≥100 msg threads)
ssh contabo 'pm2 logs neurecore-backend --lines 300 --nostream --raw | grep -i "ThreadSummarization\|summary"'

# RetentionJobService (24-h tick) — after G9e
# No quick check possible. Verify after 24+ hours:
ssh contabo 'psql "$DATABASE_URL" -c "
  SELECT COUNT(*) FROM activity_events WHERE expires_at < NOW();
"'
# Must be 0 (expired events cleaned by retention job)

# RiskDetectionService (5-min tick) — after G7
ssh contabo 'pm2 logs neurecore-backend --lines 300 --nostream --raw | grep -i "RiskDetection"'

# WorkflowTemplateService (1-min tick) — after G9
ssh contabo 'psql "$DATABASE_URL" -c "
  SELECT id, title, cron, last_run_at, next_run_at
  FROM workflow_templates
  WHERE tenant_id = '"'"'<test-tenant-id>'"'"';
"'
```

---

## 8. Alerting Thresholds

Set these in your monitoring system (Prometheus/Grafana/PagerDuty if available, or manual hourly checks):

| # | Metric | Warning | Critical | Action |
|---|---|---|---|---|
| A1 | `communication_threads.hop_count >= 5` | — | 1+ row | **IMMEDIATE:** Disable `AGENT_MESSAGING_ENABLED` for affected tenant (§6.2). This is a guard bypass. |
| A2 | `activity_events` row count flat for 30+ min (post-G2) | G2 may not have fired | No growth in 60 min | Check `MissionFeedService` write-through; verify flag is set on the tenant |
| A3 | `presence:*` Redis keys zero for 10+ min with active agents (post-G3) | G3 not working | No keys in 30 min | Check Redis connectivity (`PING`); verify `COMM_PRESENCE_ENABLED` |
| A4 | Backend restart loop | 3 restarts in 5 min | 5 restarts in 10 min | Rollback to pre-comms snapshot (§6.3); check DI graph for new services |
| A5 | `hermes_messages.mentions` always null (post-G4) | G4 not working | — | Verify `COMM_MENTIONS_ENABLED`; check `HermesSessionService.addMessage` is called with mentions param |
| A6 | `thread_participants` not growing after thread creation (post-G1) | G1 partially broken | — | Check `ThreadService.create()` adds creator as participant + `addParticipant` is called |
| A7 | `HermesAuditLog` with threadId grows disproportionately fast (post-G10) | Growth > 100/hr | Growth > 500/hr | Potential runaway A2A chain — check `hop_count`; disable guard if needed |
| A8 | `activity_events` with `expires_at < NOW()` count > 0 (post-G9e) | RetentionJobService stalled | > 1000 stale rows | Verify `RetentionPolicy` rows exist per-tenant; restart backend |

---

## 9. SOLID Verification Checklist

Run these before rollout and after every gate. All must pass.

### 9.1 Single Responsibility (SRP)

```bash
cd /home/najeeb/Linux-Dev/neurecore-2026/neurecore/backend
for svc in src/modules/hermes/services/{thread,activity,enterprise-event-bus,participant-resolver,agent-messaging,agent-messaging.guard,presence,conversation-intelligence,digest,entity-health-rollup,cost-center,risk-detection,escalation,follow-up,workflow-template,notification-preference,thread-summarization,retention-job,entity-graph,dependency-graph}.ts; do
  [ -f "$svc" ] && echo "$(basename $svc): $(grep -cE '^\s+(async\s+)?(public\s+)?[a-zA-Z_]+\(' "$svc") methods"
done
# Every service: ≤8 public methods
```

### 9.2 Interface Segregation (ISP)

```bash
cd /home/najeeb/Linux-Dev/neurecore-2026/neurecore/backend
for iface in src/modules/hermes/interfaces/{IThreadService,IActivityService,IParticipantResolver,IAgentMessaging,IAgentMessagingGuard,IPresenceService,IConversationIntelligence,IDependencyGraph}.ts; do
  [ -f "$iface" ] && echo "$(basename $iface): $(grep -cE '^\s+[a-zA-Z_]+\(' "$iface") methods"
done
# Every interface: ≤8 methods
```

### 9.3 Dependency Inversion (DIP)

```bash
cd /home/najeeb/Linux-Dev/neurecore-2026/neurecore/backend
grep -rE "new\s+(Thread|Activity|EnterpriseEventBus|AgentMessaging|Presence|ConversationIntelligence|Digest|Entity|Dependency|Risk|Escalation|Follow|Workflow|Notification|Retention)(Service|Guard)" \
  src/modules/hermes/services/ \
  src/modules/threads/ \
  src/modules/activity/ \
  --include="*.ts" | grep -v '\.spec\.ts' || echo "DIP CHECK: PASS (no concrete instantiation of comms services)"
```

### 9.4 Liskov Substitution (LSP)

```bash
cd /home/najeeb/Linux-Dev/neurecore-2026/neurecore/backend
grep -rE 'message\.threadId|message\.contextType|message\.idempotencyKey|message\.mentions' \
  src/modules/ --include="*.ts" \
  | grep -v 'hermes/services' \
  | grep -v '\.spec\.ts' \
  | grep -v 'enterprise-comms' || echo "LSP CHECK: PASS (additive fields not required by legacy consumers)"
```

### 9.5 Open/Closed (OCP)

```bash
cd /home/najeeb/Linux-Dev/neurecore-2026/neurecore/backend
grep -A15 '^enum ParticipantType' prisma/schema.prisma
# Must show: USER, AI_AGENT, SYSTEM, WORKFLOW, EXTERNAL (5 values — no existing values changed)

grep -A15 '^enum ThreadStatus' prisma/schema.prisma
# Must show: ACTIVE, ARCHIVED, CLOSED (3 values — new enum, extends nothing)
```

### 9.6 Tenant Isolation — Cross-Tenant Thread Access

```bash
# Thread of tenant A must not be accessible to tenant B
THREAD_A="<thread-id-of-tenant-a>"
TOKEN_B="<jwt-for-tenant-b-user>"

curl -sk "https://brain.neurecore.com/api/v1/threads/$THREAD_A" \
  -H "Authorization: Bearer $TOKEN_B" | python3 -c "import sys,json; d=json.load(sys.stdin); print('LEAK' if d.get('data') else 'PASS (null)')"
# Must print: PASS (null) — NOT the thread data

# Activity of tenant A must not be visible to tenant B
curl -sk "https://brain.neurecore.com/api/v1/activity?limit=5" \
  -H "Authorization: Bearer $TOKEN_B" | python3 -m json.tool
# Must contain only tenant B's data (or empty if no activity)
```

### 9.7 A2A Circuit Breaker Verification (Post-G10)

```bash
ssh contabo 'psql "$DATABASE_URL" -c "
  SELECT COUNT(*) AS guard_violations
  FROM communication_threads WHERE hop_count >= 5;
"'
# Must be 0. Any non-zero → guard bypass detected → §6.2 emergency kill

ssh contabo 'psql "$DATABASE_URL" -c "
  SELECT thread_id, SUM(cost_usd) AS total_cost
  FROM hermes_audit_log
  WHERE thread_id IS NOT NULL
  GROUP BY thread_id
  HAVING SUM(cost_usd) > 10
  ORDER BY total_cost DESC
  LIMIT 5;
"'
# Review any thread with >$10 cost — confirms cost aggregation is by threadId
```

---

## 10. Known Limitations & Deferred Work

These items are known to be incomplete. They do not block rollout but inform what to expect.

| # | Item | Impact | When to fix |
|---|---|---|---|
| L1 | No frontend `thread:join`/`thread:leave` socket emits | Per-thread WS broadcasts unreceived until subscribed. REST covers all read paths. | With `ThreadView`/`AgentInboxPanel` UI work |
| L2 | `useFeatureFlag` hook missing comms flags | No tenant-side feature gate for comms yet — no comms UI components exist to gate | With L1 |
| L3 | Admin feature-flags page missing comms flags | Operators must use `curl`/`psql` to flip flags (documented in each gate) | §0.3 (pre-rollout task) |
| L4 | No unit/integration tests for comms services | Manual verification gates cover the gap | Post-rollout follow-up |
| L5 | `ConversationIntelligenceService.search/ask` uses ILIKE fallback, not vector search | Functional but less precise than embeddings | Post-rollout follow-up (RAG team) |
| L6 | LangSmith `stream()` not wrapped | Non-blocking; structured logger carries equivalent context | Post-rollout follow-up |
| L7 | Background jobs use `setInterval`, not BullMQ | No retry semantics; job failures are logged but not re-queued | Post-rollout follow-up |

---

## 11. Glossary

| Term | Definition |
|---|---|
| **Gate** | A verification checkpoint that must pass before the next rollout phase can begin. Named G0–G10. |
| **Feature flag** | A boolean stored in `Tenant.settings.featureFlags` JSONB that gates a feature on/off per-tenant. |
| **A2A** | Agent-to-agent messaging — `AgentMessagingService.send()` where one AI agent sends a message to another. |
| **Canonical feed** | The unified `ActivityEvent` table that replaces `MissionFeedItem`, in-memory `ActivityStream`, and mock-data `LiveFeedWidget`. |
| **Circuit breaker / Guard** | `AgentMessagingGuard.check()` — enforces hop count, message count, and cost ceilings on A2A paths, using authoritative server-side counters. |
| **DB snapshot** | A copy of the production database used to test migrations before applying to production. |
| **Write-through adapter** | A modification to `MissionFeedService.create()` that writes to `ActivityEvent` in addition to `MissionFeedItem` — no polling, no cursor. |
| **Symbol alias / useExisting** | A NestJS DI pattern where an interface token (`THREAD_SERVICE`) resolves to the concrete implementation (`ThreadService`) via `{ provide: TOKEN, useExisting: Impl }`. |

---

## 12. References

| Document | Purpose |
|---|---|
| [`enterprise-comms-chat.md`](enterprise-comms-chat.md) | Full implementation reference — all phases, all files, all interfaces, all DI edges |
| [`enterprise-communication.md`](enterprise-communication.md) Rev 4 | Architectural specification — SOLID contracts, service contracts, data model |
| [`../deployment.md`](../deployment.md) | General deployment procedure |
| [`../operations.md`](../operations.md) | Contabo operations reference |
| [`../runbook.md`](../runbook.md) | Quick health checks |
| [`../disaster-recovery.md`](../disaster-recovery.md) | DR snapshots and restore procedures |
| [`../fixes.md`](../fixes.md) | Historical fix log (FIX-001 through FIX-038) |

---

## 13. Rollout Sign-Off Sheet

Complete and date each gate before advancing. Record the tenant ID used, the engineer who verified, and any notes.

| Gate | Flag | Tenant ID | Date | Engineer | Notes |
|---|---|---|---|---|---|
| G0 | (pre-flight + §0 tasks) | — | | | |
| G1 | `COMM_THREADS_ENABLED` | | | | |
| G2 | `COMM_ACTIVITIES_ENABLED` | | | | |
| G3 | `COMM_PRESENCE_ENABLED` | | | | |
| G4 | `COMM_MENTIONS_ENABLED` | | | | |
| G5 | (frontend feed swap) | — | | | |
| G6 | `COMM_CONVERSATION_INTELLIGENCE_ENABLED` | | | | |
| G7 | `COMM_DIGEST_ENABLED` | | | | |
| G8 | `COMM_ESCALATION_ENABLED` | | | | |
| G9 | `COMM_FOLLOWUP_ENABLED` | | | | |
| G10 | `AGENT_MESSAGING_ENABLED` | | | | |

---

## 14. Implementation Completion Notes — 2026-07-11

All §0 pre-rollout engineering tasks completed. Verification: zero TypeScript errors, zero NestJS build errors, zero Next.js build errors across all three projects.

### Completed Tasks

| Task | Files Changed | Verification |
|---|---|---|
| **§0.1 — Migration files** | `prisma/migrations/20260711_comms_01_thread_model/` through `_06_relationship_type_extend/` (6 directories) | `prisma migrate status` → 47 migrations, "Database schema is up to date" |
| **§0.2 — WS security** | `backend/src/modules/events/events.gateway.ts` (lines 167–207) | `tsc --noEmit` → 0 errors; `handleThreadJoin` now verifies tenant + participant; `handleThreadLeave` verifies tenant ownership |
| **§0.3 — Feature-flags admin UI** | `frontend-admin/src/services/adminFeatureFlags.service.ts` (interface +11 flags), `frontend-admin/src/app/feature-flags/page.tsx` (labels + grouped sections) | `tsc --noEmit` → 0 errors; `npm run build` → 47 routes compiled |
| **§0.5 — A2A flag ambiguity** | `backend/src/modules/hermes/services/agent-messaging.guard.ts` (lines 63–71) | `tsc --noEmit` → 0 errors; guard now checks `AGENT_MESSAGING_ENABLED \|\| COMM_AGENT_MESSAGING_ENABLED` |

### Deferred to G0 (next session)

| Task | Reason |
|---|---|
| **§0.4** — `useFeatureFlag` hook comms support | ✅ **RESOLVED 2026-07-11**: Extended `ServerFeatureFlag` type in `useServerFeatureFlag.ts` with all 11 comms flags |
| **§0.6** — Frontend `thread:join`/`thread:leave` socket emits | ✅ **RESOLVED 2026-07-11**: Added `joinThread()`/`leaveThread()` exports in `services/socket.ts` with thread event listeners bridged through EventBus |

### Migration Note

The comms tables (`communication_threads`, `thread_participants`, etc.) already existed in the production database from a prior `prisma db push`. The 6 migration files created today capture the full schema state for disaster recovery and future `prisma migrate dev` workflows. All were marked as applied via `prisma migrate resolve --applied` to maintain migration history integrity without re-creating existing objects.

### Comms-Gated Tenant UI — 2026-07-11

The following comms-gated tenant UI was designed and implemented to complete the comms rollout. All code follows existing tenant UI patterns (SOLID, Zustand stores, defensive hydration, socket bridge, feature-flag gating).

| Layer | File | Purpose |
|---|---|---|
| **API client** | `frontend-tenant/src/services/threads.service.ts` | `IThreadService` interface + implementation wrapping all 8 thread REST endpoints. Unwrap helper handles NestJS `{status, data}` envelope. |
| **State store** | `frontend-tenant/src/stores/threadStore.ts` | Zustand with `persist` middleware, `partialize` for serialization, defensive `merge` for corrupted localStorage recovery, `Array.isArray` guards. |
| **Data hook** | `frontend-tenant/src/hooks/useThreads.ts` | SRP: fetch + WS lifecycle. DIP: depends on `IThreadService` interface. Module-level `fetchInFlight` dedup. Auto-joins thread WS rooms on selection. |
| **Feature flags** | `frontend-tenant/src/hooks/useServerFeatureFlag.ts` | Extended `ServerFeatureFlag` type with all 11 comms flags (`COMM_THREADS_ENABLED`, etc.) |
| **Socket events** | `frontend-tenant/src/services/socket.ts` | Added `joinThread()`/`leaveThread()` exports, 8 thread event listeners (`thread:message`, `thread:created`, `thread:participant_added`, `thread:mention`, `thread:closed`, `thread:activity`, `presence:updated`, `activity:new`) all bridged through EventBus |
| **Event bus** | `frontend-tenant/src/core/infrastructure/socket/EventBus.ts` | Extended `HQSocketEvents` with 8 thread event types |
| **Store bridge** | `frontend-tenant/src/core/infrastructure/socket/storeEventBridge.ts` | Bridges `thread:created` → `threadStore.addThread()`, `thread:closed` → `threadStore.removeThread()`, `thread:message` → `threadStore.updateThread()`, `thread:mention` → notification store |
| **Thread list** | `frontend-tenant/src/components/threads/ThreadInboxPanel.tsx` | Two-panel layout: sidebar thread list + detail view. Gated behind `useServerFeatureFlag('COMM_THREADS_ENABLED')`. Loading/error/empty states. Active thread selection. Create/close actions. |
| **Thread messages** | `frontend-tenant/src/components/threads/ThreadView.tsx` | Chat-style message rendering with role icons (User/Agent/System), consecutive-message grouping, auto-scroll, mark-read on mount, WS-driven message reload. |
| **Navigation** | `frontend-tenant/src/app/service-desk/page.tsx` | Added `threads` tab (5-tab layout: Inbox, Approvals, Audit, Activity, **Threads**). Tab persisted to URL query param. |

**SOLID compliance:**
- **SRP:** Each file owns one concern (API client, state store, data hook, socket bridge, component rendering)
- **OCP:** Thread tab extends the service-desk tab system without modifying existing tabs; new thread WS events added to EventBus without changing existing listeners
- **LSP:** `ThreadInboxPanel` renders any `ThreadData`; follows existing component patterns
- **ISP:** `IThreadService` exports only the 8 methods consumers need; `useThreads` returns only the state the UI requires
- **DIP:** `useThreads` accepts `{ threadService?: IThreadService }` for testability; components depend on the hook interface, not the concrete service

**Build verification:** `tsc --noEmit` → 0 errors (backend + frontend-tenant + frontend-admin), `next build` → all routes compiled, `nest build` → clean.

**Contabo deploy (2026-07-11 20:07 PKT):** All 3 services rsync'd source → rebuilt → PM2 restarted. Backend: `prisma generate`, `prisma migrate deploy` (47 migrations, no pending), `nest build`, PM2 id 4. Tenant: `npm install`, `next build`, PM2 id 1. Admin: `npm install`, `next build`, PM2 id 2. All services healthy: `brain` 200, `hq` 200, `cc` 200. DR snapshot at `/opt/neurecore/_archives/20260711-200735-pre-comms-deploy/`. PM2 saved.

### Next Session

Proceed to §5 Per-Phase Flag Rollout — start with G1 (`COMM_THREADS_ENABLED` on test tenant) to activate the threads UI.
