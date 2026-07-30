# NeureCore Comprehensive Remediation Plan — Hermes, Chat & Project Creation

**Date:** 2026-07-20
**Status:** Active — implementation pending
**Authors:** Deep audit (4 parallel investigators, 2026-07-20)
**Scope:** All issues blocking Hermes/Chat/AI Gateway/Project Creation pipeline since Neon→Contabo DB migration

---

## Executive Summary

The pipeline documented as "fully functional" in `hermes-project-creation-pipeline-audit-2026-07-19.md` and `chat-unification-refactor-plan.md` is **NOT actually functional in production**. The Neon→Contabo PostgreSQL migration was incomplete and several critical database tables and configurations are missing.

### Root Causes (one-line summary each)

1. **Missing tables**: `chat_sessions` and `chat_messages` were never migrated to Contabo PostgreSQL
2. **65 Prisma migrations reported as unapplied** — the DB was baselined via `db push` but never had migrations properly registered
3. **Live `.env` is a development configuration** — `NODE_ENV=development`, localhost CORS, debug logging, etc.
4. **Two server env files conflict** — `.env` points to local Redis, `.env.production` points to Upstash
5. **`SESSION_SECRET` is empty** in all env files
6. **AI Gateway chat-not-streaming path requires `AI_GATEWAY_V2=true`**, but it is `false` in both server env files
7. **`MiniMax is not configured on the server`** short-circuit fires before the gateway can use any other provider
8. **Backend does not honour `findById` race conditions or provider inactivity consistently** across the chain
9. **`createProject` tool still has direct-prisma fallback path** that bypasses `ProjectsService`
10. **Frontends' keyword fallback hides 401/500/503 as fake assistant messages** — masking all errors as user-visible "I'm offline"

### Severity Summary

| Severity | Count | Examples |
|---|---|---|
| **CRITICAL** | 6 | Missing chat tables, 65 unapplied migrations, dev `.env` in prod, MiniMax config shortcut, Hermes policy-after-execute, empty session secret |
| **HIGH** | 9 | Streaming never persists history, gateway V2 flag off, ToolGateway fail-open, graph retry loop repeats side effects, AI failures returned as 200, frontend keyword fallback, conversationId ownership missing, Redis URL conflict, `getLastResolved` cached without TTL |
| **MEDIUM** | 14 | Various code-quality, security, and reliability issues |
| **LOW** | 5 | Suggestions stub, naming inconsistencies, etc. |

### Time Estimate (rough)

- **Immediate fix (chat working):** 2–4 hours (apply missing migrations, fix `.env`, restart)
- **Full remediation:** 3–5 days (all phases below)

---

## Critical Context: What Worked Before vs. Now

### Before Neon→Contabo migration (assumed working):

- All 65 Prisma migrations applied to Neon PostgreSQL
- DB contained `chat_sessions`, `chat_messages`, all AI gateway tables, all Hermes tables
- Backend loaded `.env.production` (production settings)
- Backend had `AI_GATEWAY_V2=true` (or `false` but with working legacy MiniMax client)
- `SESSION_SECRET` populated
- Frontends received real AI responses

### After Neon→Contabo migration (current broken state):

- `_prisma_migrations` table seeded manually with 64/65 rows (the audit said this was done)
- BUT `chat_sessions` and `chat_messages` tables are MISSING from Contabo (Phase B chat persistence migration was apparently never run or applied)
- Backend loads `.env` (development), not `.env.production`
- `AI_GATEWAY_V2=false` — disables v2 gateway
- `SESSION_SECRET` empty
- Redis URL conflict between `.env` and `.env.production`
- Frontends receive "MiniMax is not configured" or "I'm offline"

---

## Phase 0 — Emergency Recovery (Get Chat Working)

**Goal:** Restore minimum functionality so chat/Hermes tools work end-to-end.
**Time estimate:** 2–4 hours
**Risk:** Medium (touches live DB and env)

### 0.1 Apply missing chat persistence migration

**Symptom:** `chat_sessions` and `chat_messages` tables missing from Contabo PostgreSQL.

**Action:**
```bash
ssh contabo
cd /opt/neurecore/backend/backend
ls prisma/migrations/ | grep 20260719_chat_persistence
# If missing, the file must exist locally first
```

**If the migration file `prisma/migrations/20260719_chat_persistence/migration.sql` exists locally:**
```bash
# Sync the migration file from local to server
rsync -avz /home/najeeb/Linux-Dev/neurecore-2026/neurecore/backend/prisma/migrations/20260719_chat_persistence/ \
  contabo:/opt/neurecore/backend/backend/prisma/migrations/20260719_chat_persistence/

# Apply
cd /opt/neurecore/backend/backend
npx prisma migrate deploy
# Should report: 1 new migration applied
```

**Verify:**
```bash
PGPASSWORD=neurecore_local_pass psql -h 127.0.0.1 -U neurecore -d neurecore -c '\d+ chat_sessions'
PGPASSWORD=neurecore_local_pass psql -h 127.0.0.1 -U neurecore -d neurecore -c '\d+ chat_messages'
```

### 0.2 Fix live `.env` configuration

**Symptom:** Backend uses development settings (NODE_ENV=development, localhost CORS, etc.)

**Action:** Create a production-safe `.env` for live deployment. Either:
- (a) Replace live `.env` with a copy of `.env.production` (preferred), OR
- (b) Manually patch each problematic variable in live `.env`

**Critical changes:**
```bash
ssh contabo
cd /opt/neurecore/backend/backend

# Backup current
cp .env .env.backup-$(date +%s)

# Option A: use production file as the live one
cp .env.production .env

# Verify MiniMax variables still present (they were in both)
grep MINIMAX .env
# Must show:
#   MINIMAX_API_KEY=...
#   MINIMAX_BASE_URL=https://api.minimax.io/v1
#   MINIMAX_MODEL=...
```

### 0.3 Enable AI Gateway V2 (CRITICAL for chat to work)

**Symptom:** `AI_GATEWAY_V2=false` disables the gateway that can resolve non-MiniMax providers. Combined with the "MiniMax not configured" short-circuit, chat fails before any provider is tried.

**Action:**
```bash
ssh contabo
cd /opt/neurecore/backend/backend

# Either edit live .env or set via PM2 environment
# In .env:
sed -i 's/AI_GATEWAY_V2=false/AI_GATEWAY_V2=true/' .env

# Or via PM2 (preferred for runtime override):
pm2 set neurecore-backend:AI_GATEWAY_V2 true
```

**Verify:** After restart, check logs:
```bash
pm2 logs neurecore-backend --lines 50 --nostream | grep -i "AI_GATEWAY\|feature.*flag"
# Should show AI_GATEWAY_V2: unset → true
```

### 0.4 Set SESSION_SECRET

**Symptom:** Empty `SESSION_SECRET` in all env files.

**Action:**
```bash
ssh contabo
cd /opt/neurecore/backend/backend

# Generate strong secret
SECRET=$(openssl rand -base64 48 | tr -d '\n=')
sed -i "s/^SESSION_SECRET=$/SESSION_SECRET=$SECRET/" .env

# Verify
grep SESSION_SECRET .env
```

### 0.5 Restart backend and verify chat

```bash
ssh contabo
pm2 restart neurecore-backend --update-env
sleep 5
pm2 logs neurecore-backend --lines 100 --nostream | grep -i "error\|warn\|bootstrap"
```

**Verify in browser:**
1. Open `https://hq.neurecore.com/home`
2. Open chat panel
3. Send a message
4. Expect a real AI response (not "MiniMax is not configured" or "I'm offline")

**If still failing**, check:
- `pm2 logs neurecore-backend | grep -i "ChatSseService\|model\|hermes"` for the specific error
- Database: `PGPASSWORD=neurecore_local_pass psql -h 127.0.0.1 -U neurecore -d neurecore -c "SELECT capabilities FROM ai_models;"` should show `{planning,conversation}`

---

## Phase 1 — Database Schema Reconciliation

**Goal:** Align live PostgreSQL with Prisma schema; ensure no remaining drift.
**Time estimate:** 4–6 hours
**Risk:** High (touches schema; backup first)

### 1.1 Audit migration state and reconcile

**Pre-check:**
```bash
ssh contabo
cd /opt/neurecore/backend/backend
npx prisma migrate status
```

The audit reported **65 migrations found, all 65 reported as not yet applied**. This is contradictory to the audit claim of "64 INSERT statements seeded into `_prisma_migrations`".

**Action:**
1. Backup the database NOW:
   ```bash
   ssh contabo
   pg_dump -U neurecore -h 127.0.0.1 neurecore | gzip > /root/backup/neurecore-$(date +%s).sql.gz
   ```

2. Compare actual schema with Prisma schema. Look for any tables/columns present in DB but missing from Prisma (drift).

3. Decide:
   - **Option A: Baseline existing schema** — mark migrations as applied without running them. Use `npx prisma migrate resolve --applied <migration_name>` for each.
   - **Option B: Clean slate** — drop all tables, run `npx prisma migrate deploy` from scratch. **DESTRUCTIVE — requires DB backup and data migration plan.**
   - **Option C: Selective re-application** — apply only the chat persistence migration (Phase 0.1), verify everything else works.

**Recommended: Option C** — minimal change, lowest risk. If later migrations fail to apply, escalate to Option A.

### 1.2 Fix nullability drift on arrays

**Symptom:** Prisma requires non-null `String[]` but DB allows null for:
- `ai_models.capabilities`
- `"HermesAgent".permissions`
- `"HermesAgent".allowedPaths`
- `"HermesAgent".blockedPaths`

**Action:** Create a new migration `20260720_array_not_null` that adds NOT NULL constraints with safe defaults:
```sql
-- For each affected column
ALTER TABLE ai_models ALTER COLUMN capabilities SET NOT NULL;
ALTER TABLE "HermesAgent" ALTER COLUMN permissions SET NOT NULL;
ALTER TABLE "HermesAgent" ALTER COLUMN allowedPaths SET NOT NULL;
ALTER TABLE "HermesAgent" ALTER COLUMN blockedPaths SET NOT NULL;

-- Set defaults
ALTER TABLE ai_models ALTER COLUMN capabilities SET DEFAULT '{}';
ALTER TABLE "HermesAgent" ALTER COLUMN permissions SET DEFAULT '{}';
ALTER TABLE "HermesAgent" ALTER COLUMN allowedPaths SET DEFAULT '{}';
ALTER TABLE "HermesAgent" ALTER COLUMN blockedPaths SET DEFAULT '{}';

-- Backfill any nulls to empty array (defensive)
UPDATE ai_models SET capabilities = '{}' WHERE capabilities IS NULL;
UPDATE "HermesAgent" SET permissions = '{}' WHERE permissions IS NULL;
UPDATE "HermesAgent" SET allowedPaths = '{}' WHERE allowedPaths IS NULL;
UPDATE "HermesAgent" SET blockedPaths = '{}' WHERE blockedPaths IS NULL;
```

### 1.3 Resolve tenant/user ID assumption drift

**Symptom:** Code/logs assume `tenant-mali` and `user-mali`, but DB has UUIDs.

**Live DB values:**
- Tenant: `726522f0-a9e4-4c13-b22f-a9a967b914dc` (slug: `test-corp`)
- User: `74a80f17-453c-448d-98de-78132914fad9`

**Audit logs show:** `userId="user-mali" tenantId="tenant-mali"` — these are LITERAL strings being used as IDs.

**Action:** Audit and fix every place in code that constructs these IDs. Likely candidates:
- `chat.service.ts:191` — `userId: 'user'` (hardcoded literal — should be `req.user.sub`)
- JWT token must carry real user/tenant IDs
- Test fixtures/seeds that produce these strings

**Verify after fix:**
```sql
SELECT id, email FROM users WHERE id = 'user-mali';
-- Should return 0 rows
SELECT id, slug FROM tenants WHERE id = 'tenant-mali';
-- Should return 0 rows
```

---

## Phase 2 — AI Gateway Hardening

**Goal:** Make model resolution robust against catalog drift, missing keys, and stale caches.
**Time estimate:** 1–2 days
**Risk:** Medium (core AI path)

### 2.1 Fix `FallbackChainBuilder` query consistency

**Issue:** Hard-coded fallback queries (`fallback-chain.ts:122`) don't filter on `provider.isActive`, but soft fallback (`fallback-chain.ts:148`) does. Inconsistent behaviour.

**File:** `backend/src/modules/ai-gateway/failover/fallback-chain.ts`

**Fix:** Add `provider: { isActive: true }` to all hard-coded and explicit model lookups.

### 2.2 Fix `findFirst` ambiguity on `modelId`

**Issue:** `modelId` is only unique per provider, but `findFirst({ where: { modelId } })` returns nondeterministic results if multiple providers expose the same model ID.

**Fix:** Either:
- (a) Add `@@unique` on `modelId` (globally), OR
- (b) Always specify `provider` in modelId-based lookups, OR
- (c) Use `findUnique({ where: { providerId_modelId: { providerId, modelId } } })`

**Recommended:** Option (c) — add a compound unique input to Prisma where available, fall back to `providerId` filter.

### 2.3 Fix `Settings AI` model creation that produces unusable models

**File:** `backend/src/modules/ai-gateway/controllers/ai-providers.controller.ts:268`

**Issue:** Creates models with `capabilities: []` — invisible to all capability lookups.

**Fix:** Either:
- (a) Remove this endpoint (consolidate to canonical admin), OR
- (b) Accept capabilities in body, validate with `isCapability()`, persist, OR
- (c) Auto-assign a default capability like `'conversation'` based on model type

**Recommended:** Option (b) — accept capabilities with validation.

### 2.4 Fix `Routing` controller logic that misapplies `isDefault`

**File:** `backend/src/modules/ai-gateway/controllers/ai-providers.controller.ts:361`

**Issue:** Marks a model as default for a capability even if it doesn't have that capability.

**Fix:** Validate that the selected model has the capability before marking it default.

### 2.5 Standardize error types

**Issue:** Empty chain and missing API keys throw plain `Error`. Caller cannot classify.

**Files:** `backend/src/modules/ai-gateway/selection/capability-resolver.ts:47,102`, `backend/src/modules/ai-gateway/ai-gateway.service.ts:195`

**Fix:** Use `AiGatewayUnconfiguredError` (already defined in `domain/errors.ts:111`).

### 2.6 Fix negative secret caching

**File:** `backend/src/modules/security/providers/secret.provider.ts:146`

**Issue:** Missing env vars cache as `""` for 5 minutes. Adding the var at runtime may not be picked up until TTL expiry.

**Fix:** Either:
- (a) Reduce TTL to 30 seconds for secrets, OR
- (b) Don't cache negative results at all, OR
- (c) Listen to file changes on `.env` and invalidate.

**Recommended:** Option (a) — short TTL for negative cache.

### 2.7 Fix provider test to actually test the selected provider

**File:** `backend/src/modules/ai-gateway/controllers/ai-providers.controller.ts:230`

**Issue:** `testProvider` calls global `gateway.ping(null, 'conversation')` instead of testing the selected provider's model.

**Fix:** Call `gateway.ping(providerId, 'conversation')` and add a `providerId` parameter to `ping()`.

### 2.8 Fix stream-path failure to fallback

**File:** `backend/src/modules/ai-gateway/ai-gateway.service.ts:346`

**Issue:** Streaming only uses the first resolved model. If it fails, no fallback to next chain member.

**Fix:** Wrap stream in retry-with-fallback loop, similar to non-streaming `invoke()`.

---

## Phase 3 — Chat & SSE Reliability

**Goal:** Make chat reliable, persistent, and accurate.
**Time estimate:** 1–2 days
**Risk:** Medium

### 3.1 Persist streaming chat messages

**File:** `backend/src/modules/chat/chat.service.ts:544`

**Issue:** `ChatService.stream()` does not save user or assistant messages. `/chat/history` will be empty.

**Fix:** After `stream()` produces its final chunk, call `chatHistory.saveMessage()` for both user and assistant turns.

### 3.2 Stream action-looking messages through graph

**File:** `backend/src/modules/chat/chat.service.ts:588`

**Issue:** Streaming always uses `capability: 'conversation'`. Action requests sent via streaming never execute tools.

**Fix:** Detect action intent (same keyword list as non-streaming), route through `OfficialAgentGraph` when action is detected.

### 3.3 Remove "MiniMax not configured" short-circuit

**File:** `backend/src/modules/chat/chat.service.ts:112-128`

**Issue:** Returns fallback BEFORE checking `AI_GATEWAY_V2`. If gateway V2 is on, other providers should be tried.

**Fix:** Move the check AFTER `AI_GATEWAY_V2` is checked. Or remove entirely — gateway handles its own provider availability.

### 3.4 Fix streaming terminal empty delta

**File:** `backend/src/modules/chat/chat-sse.service.ts:71-80`

**Issue:** Always emits `delta: { text: '' }` then `done`. Frontend sees an empty message.

**Fix:** Skip empty deltas in SSE service. Only emit `done`.

### 3.5 Validate conversationId ownership

**File:** `backend/src/modules/chat/chat-history.service.ts:65-75`

**Issue:** `conversationId` is globally upserted without tenant/user check. Two tenants can collide.

**Fix:** When session exists, verify its tenantId/userId matches the caller's. Reject if mismatch (401/403).

### 3.6 Use real JWT user ID in action execution

**File:** `backend/src/modules/chat/chat.service.ts:187-193`

**Issue:** Hardcoded `userId: 'user'` passed to `agentGraph.run()`.

**Fix:** Pass `userId: req.user.sub` from controller (already available as `req.user.sub`).

### 3.7 Distinguish streaming history persistence failure from no data

**File:** `backend/src/modules/chat/chat.controller.ts:92-99`

**Issue:** Missing tenant returns `{ data: [], total: 0 }` — same as DB error.

**Fix:** Return distinct codes (e.g., 401 for missing tenant, 503 for DB error).

### 3.8 Bound DTO parameters

**File:** `backend/src/modules/chat/dto/chat.dto.ts:33-43`

**Issue:** `temperature` and `maxTokens` are unbounded; `systemPrompt` is user-supplied.

**Fix:** Add `@Min(0) @Max(2)` for temperature, `@Min(1) @Max(32000)` for maxTokens, ignore/disallow `systemPrompt` for public callers.

### 3.9 Improve `ChatSseService` error classification

**File:** `backend/src/modules/chat/chat-sse.service.ts:82`

**Issue:** Catches all errors, emits raw message. No stable error code, may leak provider details.

**Fix:** Map known error types to public-safe messages:
- `AiGatewayUnconfiguredError` → "AI is being configured. Please try again in a moment."
- Network errors → "Connection issue. Please retry."
- Unknown → "Something went wrong. Our team has been notified."

---

## Phase 4 — Hermes Runtime & LangGraph

**Goal:** Make Hermes safe, observable, and aligned with the audit's intent.
**Time estimate:** 2–3 days
**Risk:** High (touches agent execution)

### 4.1 Move Hermes policy enforcement BEFORE tool execution

**File:** `backend/src/modules/hermes/services/hermes-runtime.service.ts:130-177` and `backend/src/modules/agents/langgraph/langgraph-official.ts:401-479`

**Issue:** Hermes validates tools after `OfficialAgentGraph` has already executed them. Audit identified this as the most critical issue.

**Fix:**
- Either pass allowed-tools subset to `OfficialAgentGraph.stream()` and filter `toolDefs` there.
- Or implement a pre-tool validator in `OfficialAgentGraph` that checks `ToolGatewayService` BEFORE calling `tool.execute()`.

**Recommended:** Pass allowed-tools to the graph and filter at the graph level. This is the architecturally correct fix.

### 4.2 Implement real approval suspension

**File:** `backend/src/modules/hermes/services/hermes-runtime.service.ts:160-175`

**Issue:** `APPROVAL_REQUIRED` is emitted but execution continues.

**Fix:**
- Detect approval-required tools in pre-tool-validation (4.1).
- Halt execution and emit `APPROVAL_REQUESTED` event with a resume token.
- Implement `resume(approvalToken, decision)` that continues execution.

**Note:** This is a significant architectural change. Consider implementing after Phase 0/1/2/3 ship.

### 4.3 Fix `ToolGatewayService` fail-open behavior

**File:** `backend/src/modules/hermes/services/tool-gateway.service.ts:19-32`

**Issue:** Unknown registered tool → allowed (fail-open).

**Fix:** Change to fail-closed: `return { allowed: false }`.

### 4.4 Fix graph retry loop

**File:** `backend/src/modules/agents/langgraph/langgraph-official.ts:640-654`

**Issue:** Tool calls remain in state → retries same tool with same input → infinite loop.

**Fix:**
- Clear or regenerate `toolCalls` on retry.
- Don't retry non-idempotent tools.
- Increment `iteration` correctly (audit identified this is ambiguous).

### 4.5 Treat `{ success: false }` as tool failure

**File:** `backend/src/modules/agents/langgraph/langgraph-official.ts:474-480, 493-519`

**Issue:** Stores entire result object as `output`. Doesn't check `output.success`.

**Fix:** Check `output.success === false` and treat as failure for retry counting.

### 4.6 Record correct `success` in Hermes steps

**File:** `backend/src/modules/hermes/services/hermes-runtime.service.ts:179-201`

**Issue:** Marks `success: true` even when `chunk.toolResults` has failures.

**Fix:** Set `hasError: true` if any tool result is failure.

### 4.7 Persist canonical final output

**File:** `backend/src/modules/hermes/services/hermes-runtime.service.ts:205-212`

**Issue:** Saves last graph chunk as output — may be partial state.

**Fix:** Persist the actual final assistant message after streaming completes.

---

## Phase 5 — Tool Execution (`createProject` and others)

**Goal:** Make tools safe, audited, and routed through Services (SOLID compliance).
**Time estimate:** 1–2 days
**Risk:** Medium

### 5.1 Remove direct Prisma fallback in `createProject`

**File:** `backend/src/modules/tools/built-in/neurecore-tools.ts:772-795`

**Issue:** When `ProjectsService` is undefined, tool writes directly to Prisma — bypasses automation.

**Fix:** Throw an error instead of falling back. Tool should never silently bypass Services.

### 5.2 Remove `AGENT_POLICY_CONFIGS['ai-assistant']` wildcard

**File:** `backend/src/modules/agents/security/providers/security-policy.provider.ts:162-186`

**Issue:** `allowedTools: ['*']` is overly permissive.

**Fix:** Replace with explicit allowlist or permission-derived set (e.g., `READ_ONLY + SELECT_INTERNAL_WRITE`).

### 5.3 Resolve 27 tools that bypass Services

From the audit's "Known Debt" section — these tools use direct `prisma.{entity}.create/update/delete` instead of routing through Services:
- Department tools (4): `updateDepartment`, `archiveDepartment`, `deleteDepartment`, `assignManager`, `unassignManager`
- Agent tools (5): `updateAgent`, `archiveAgent`, `assignAgentToDepartment`, `removeAgentFromProject`, `bulkCreateAgents`, `bulkAssignToDepartment`
- Project tools (4): `updateProject`, `archiveProject`, `deleteProject`, `cloneProject`
- Task tools (11): `updateTask`, `deleteTask`, `assignTask`, `unassignTask`, `markTaskComplete`, `markTaskInProgress`, `reopenTask`, `changeTaskPriority`, `addSubtask`, `bulkAssignTasks`, `bulkChangeStatus`, `cloneTask`
- Approval tools (5): `approveRequest`, `rejectRequest`, `bulkApprove`, `bulkReject`, `createApprovalRequest`, `resubmitApproval`, `cancelApprovalRequest`

**Action:** For each, add Service injection (matching the `createProject` fix from the audit) and route through it.

### 5.4 Validate `createProject` enum values

**File:** `backend/src/modules/tools/built-in/neurecore-tools.ts:52-93`

**Issue:** Audit confirmed the Zod enum was expanded to accept `fixed_fee`, `fixed-fee` plus `FIXED_FEE`, `HOURLY`, `RETAINER`. Verify this is still in place.

**Action:** Re-verify the audit's fix is still deployed.

---

## Phase 6 — Frontend Reliability

**Goal:** Stop hiding real errors behind fake assistant messages.
**Time estimate:** 1 day
**Risk:** Low

### 6.1 Remove or gate the keyword fallback

**Files:** `frontend-tenant/src/core/services/chat/ChatService.ts:74-82`, `frontend-admin/src/core/services/chat/ChatService.ts`

**Issue:** All backend errors become `KeywordFallbackReply.generate()` text. User sees "I'm offline" instead of real 401/500/503.

**Fix:**
- Remove catch-all and let errors surface.
- Or, gate fallback to specific `networkError` codes (after classification).

### 6.2 Surface real error messages in chat UI

**File:** Same as 6.1

**Fix:** Distinguish error categories in `ChatService`:
- Network down → "Connection issue"
- 401 → "Session expired, please log in again"
- 403 → "You don't have access"
- 500/503 → "Service temporarily unavailable"
- Other → "Something went wrong"

### 6.3 Persist streaming chat messages in `ChatStore`

**File:** `frontend-tenant/src/core/services/chat/ChatStore.ts`

**Issue:** When chat is sent via streaming, the local state may not include user message until completion.

**Fix:** Add user message to store immediately on send; replace with assistant message on completion.

---

## Phase 7 — Tests & Verification

**Goal:** Prove all fixes work; prevent regression.
**Time estimate:** 1 day

### 7.1 Backend e2e for chat persistence

```bash
ssh contabo
cd /opt/neurecore/backend/backend
npm run test -- chat.integration-spec
# Must include scenarios:
# 1. POST /chat/messages → GET /chat/history returns the message
# 2. POST /chat/stream → GET /chat/history returns the streamed message
# 3. DELETE /chat/history → GET /chat/history returns empty
```

### 7.2 Backend e2e for AI Gateway with each capability

```bash
npm run test -- ai-gateway
# Verify capability resolution for: planning, conversation, tools, reasoning, etc.
```

### 7.3 Backend e2e for createProject

```bash
npm run test -- create-project
# Verify:
# 1. Tool routes through ProjectsService.create() (not direct prisma)
# 2. Budget types FIXED_FEE / HOURLY / RETAINER all work
# 3. Derived shape synthesis works when projectTypeId absent
# 4. Idempotency prevents duplicate goals
```

### 7.4 Frontend Playwright e2e

```bash
cd frontend-tenant
npm run test:e2e -- tests/chat.spec.ts
# Scenarios:
# 1. Open chat → send → receive real AI response (not offline message)
# 2. Create project via chat → verify it appears in /projects
# 3. Refresh page → verify chat history persists
# 4. Slash commands return context-aware responses
```

### 7.5 Live verification checklist

Before declaring done:
- [ ] `curl POST /chat/messages` returns a real AI response (not "MiniMax not configured")
- [ ] `curl POST /chat/stream` streams chunks then `done`
- [ ] `curl GET /chat/history` returns previous messages
- [ ] Browser: send "Create a project" → project appears in /projects
- [ ] Browser: send "Hello" → real AI response (not offline fallback)
- [ ] No 401/500/503 errors in browser console
- [ ] `pm2 logs neurecore-backend` shows no errors

---

## Phase 8 — Documentation & Audit Updates

**Goal:** Keep memory-bank in sync with reality.

### 8.1 Update `hermes-project-creation-pipeline-audit-2026-07-19.md`

Add an "Update 2026-07-20" section documenting:
- Discovered issues from this audit
- What was previously marked "FIXED" but was actually broken
- Root cause: incomplete Neon→Contabo migration

### 8.2 Update `chat-unification-refactor-plan.md`

Add an "Update 2026-07-20" section documenting the Phase 0/1/2/3 findings and remediation status.

### 8.3 Update `neon-to-contabo-migration-plan.md`

Add a "Gaps Discovered Post-Migration" section:
- Missing `chat_sessions` and `chat_messages`
- `_prisma_migrations` not properly synced (only 64 of 65 entries)
- Live `.env` not updated to production values

### 8.4 Create `chat-ai-gateway-remediation-2026-07-20.md`

A new plan doc capturing the Phase 2/3/4 work.

---

## Appendix A — Live DB State (as of 2026-07-20)

```
ModelProvider: 1 row (minimax, active)
AiModel: 1 row (MiniMax-M2.7-highspeed, {planning,conversation}, default, priority=1)
TenantModelOverride: 0 rows
CapabilityConfig: 0 rows
HermesAgent: 0 rows (empty)
HermesSession: 0 rows
HermesMessage: 0 rows
chat_sessions: MISSING TABLE
chat_messages: MISSING TABLE
agents: 3 rows (all createdById=NULL)
projects: 3 rows (all customerId=NULL, projectTypeId=NULL)
tenants: 1 row (test-corp, UUID 726522f0-...)
users: 1 row (Mali, UUID 74a80f17-...)
_prisma_migrations: 64 rows (per audit; verify actual count)
```

## Appendix B — Live `.env` Issues

| Variable | Issue | Fix |
|---|---|---|
| `NODE_ENV` | `development` | Set `production` |
| `SESSION_SECRET` | empty | Generate random 48-byte secret |
| `AI_GATEWAY_V2` | `false` | Set `true` (gating chat) |
| `TENANT_FRONTEND_URL` | `http://localhost:3001` | Set `https://hq.neurecore.com` |
| `ADMIN_FRONTEND_URL` | `http://localhost:3002` | Set `https://cc.neurecore.com` |
| `SESSION_COOKIE_SECURE` | `false` | Set `true` |
| `LOG_LEVEL` | `debug` | Set `info` |
| `LOG_FORMAT` | `pretty` | Set `json` |
| `LOG_PRETTY_PRINT` | `true` | Set `false` |
| `FEATURE_DEBUG_MODE` | `true` | Set `false` |

## Appendix C — Code Files to Fix (Priority Order)

### Phase 0 (immediate)
- `prisma/migrations/20260719_chat_persistence/migration.sql` (sync to server, apply)
- `/opt/neurecore/backend/backend/.env` (replace with `.env.production`)
- `/opt/neurecore/backend/backend/.env` (set SESSION_SECRET, AI_GATEWAY_V2=true)

### Phase 1 (DB)
- New migration `20260720_array_not_null`
- New migration or manual fix for missing chat tables

### Phase 2 (AI Gateway)
- `backend/src/modules/ai-gateway/failover/fallback-chain.ts`
- `backend/src/modules/ai-gateway/controllers/ai-providers.controller.ts`
- `backend/src/modules/ai-gateway/selection/capability-resolver.ts`
- `backend/src/modules/ai-gateway/ai-gateway.service.ts`
- `backend/src/modules/security/providers/secret.provider.ts`

### Phase 3 (Chat/SSE)
- `backend/src/modules/chat/chat.service.ts`
- `backend/src/modules/chat/chat-history.service.ts`
- `backend/src/modules/chat/chat-sse.service.ts`
- `backend/src/modules/chat/dto/chat.dto.ts`
- `backend/src/modules/chat/chat.controller.ts`

### Phase 4 (Hermes/LangGraph)
- `backend/src/modules/hermes/services/hermes-runtime.service.ts`
- `backend/src/modules/hermes/services/tool-gateway.service.ts`
- `backend/src/modules/agents/langgraph/langgraph-official.ts`
- `backend/src/modules/agents/security/providers/security-policy.provider.ts`

### Phase 5 (Tools)
- `backend/src/modules/tools/built-in/neurecore-tools.ts`
- 27 tool files identified in audit "Known Debt"

### Phase 6 (Frontend)
- `frontend-tenant/src/core/services/chat/ChatService.ts`
- `frontend-tenant/src/core/services/chat/ChatStore.ts`
- `frontend-tenant/src/core/services/chat/fallback/KeywordFallbackReply.ts`
- Same files in `frontend-admin/`

---

## Appendix D — Key References

- **Original audit:** `memory-bank-new/audits/hermes-project-creation-pipeline-audit-2026-07-19.md`
- **Refactor plan:** `memory-bank-new/plans/chat-unification-refactor-plan.md`
- **Migration plan:** `memory-bank-new/plans/neon-to-contabo-migration-plan.md`
- **AI project shape plan:** `memory-bank-new/plans/ai-driven-project-shape-synthesis-2026-07-19.md`
- **Code paths from subagent output (saved to disk):**
  - `tool_f7f9dabf0001iprP9jLgjkVvWG` — AI Gateway deep audit
  - `tool_f7f9e13b1001plwqSigjBGlQGP` — Hermes/Chat deep audit
  - Contabo PostgreSQL schema comparison (in task result)

---

**End of Plan**