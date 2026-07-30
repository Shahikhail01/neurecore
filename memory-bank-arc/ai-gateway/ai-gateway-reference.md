# AI Gateway — Quick Reference

**Last updated:** 2026-07-28 18:05 PKT
**Status:** ✅ Deployed on Contabo (`AI_GATEWAY_V2=true`) — DeepSeek wired as primary provider (encrypted key in DB, DB-prefer over env). All 7 capabilities boot-probe OK against DeepSeek. **Chat streaming Zod-schema bug fixed** (was silently dropping every DeepSeek content chunk, leaving cc/hq bots unresponsive).
**Phase 2.8 added (2026-07-28):** SUPER_ADMIN can add/edit AI providers + rotate keys entirely from `cc.neurecore.com/settings/ai`. Keys persisted AES-256-GCM in `model_providers.encryptedKey`. Discover-Models auto-fetches `GET /models` and lets admin pick which to enable + which is default. Clicking a model badge promotes it to default.
**Sibling docs:** [ai-gateway.md](ai-gateway.md) (audit) · [ai-gateway-imp-plan.md](ai-gateway-imp-plan.md) (full plan + deploy log) · [backend.md §16](../backend.md) · [fixes.md FIX-037 + FIX-038](../fixes.md) · [pending-tasks.md §0g](../pending-tasks.md) (Phase 2.8 changelog) · [contabo-ops.md §3.8b](../contabo-ops.md) (`AI_GATEWAY_V2` must be in `.env.production`, not just `.env`)

---

## 1. Concept

### What

A single NestJS service — `AiGatewayService` — that is the **only** LLM invocation path in the NeureCore backend. Every chat message, agent decision, document summary, RAG query, and tool call routes through it.

### Why (before vs. after)

| Metric | Before | After |
|---|---|---|
| Places that decide which model to use | 35+ across 12 files | **1** (`AiGatewayService.select`) |
| `fetch()` implementations | 8 (4 in LLMFactory + 4 per-provider) | **1** (`HttpLlmTransport`) |
| Hardcoded model/provider strings | ~25 | **0** (DB-driven) |
| API key reads outside `SecretProviderService` | 6 sites in 4 files | **0** |
| CostRecord write coverage | ~10% (LangSmith only) | **100%** (every call) |
| Circuit breaker / failover | None | Per-provider, per-capability |
| Admin adds a model | Deploy required | DB row + admin UI |

### Architecture

```
Client (chat / agent / hermes / RAG / tools / COS)
        │
        ▼  capability="conversation" | tenantId | messages
┌───────────────────────────────────────┐
│          AiGatewayService              │  ← single entry point
│  select() / invoke() / stream()        │
│  invokeStructured() / invokeWithTools()│
└──────┬────────────────────────────────┘
       │
       ▼
┌──────────────────┐   ┌──────────────────┐
│ CapabilityResolver│──▶│  AiModelRepository │
│ (tenant override  │   │  (LRU cache 60s)   │
│  → default →      │   │  reads:             │
│  fallback chain)  │   │  model_providers    │
└──────┬───────────┘   │  ai_models          │
       │               │  tenant_model_      │
       ▼               │    overrides         │
┌──────────────────┐   └──────────────────┘
│  SecretProvider   │
│  Service          │  → resolves API key from env
└──────┬───────────┘
       │
       ▼
┌──────────────────┐   ┌──────────────────┐
│  HttpLlmTransport │──▶│  SseStreamParser   │
│  (single fetch)   │   │  (single SSE impl) │
└──────┬───────────┘   └──────────────────┘
       │
       ▼ errors → CircuitBreaker → RetryPolicy → FallbackChain
       │
       ▼ success → CostAttributorService → LangSmithSink → StructuredLogger
```

### Providers & capabilities

| Capability | Default | Fallback | Used by |
|---|---|---|---|
| `conversation` | MiniMax-M2.7-highspeed | → M2.5 → Text-01 | Chat, thread summarization |
| `planning` | gpt-4o-mini | → MiniMax-M2.7 → deepseek-chat | Agent planner, hermes registry |
| `execution` | gpt-4o-mini | → MiniMax-M2.7 → deepseek-reasoner | Agent executor, LangGraph |
| `evaluation` | gpt-4o-mini | → MiniMax-M2.7 → deepseek-chat | Agent evaluator |
| `reasoning` | deepseek-reasoner | → MiniMax-M2.7 → gpt-4o-mini | COS, project-health, digest, CI |
| `tools` | gpt-4o-mini | → MiniMax-M2.7 | Tool functions, LangGraph tools |
| `coding` | deepseek-coder | → MiniMax-M2.7 | Future: code agents |
| `embedding` | text-embedding-3-small | — | Future: vector search |

---

## 2. Present status

### Deployed (2026-07-28)

| Component | Status |
|---|---|
| Backend (NestJS) | ✅ Running on Contabo, port 3003, `AI_GATEWAY_V2=true` (in **both** `.env` and `.env.production`) |
| DB catalog | ✅ 5 providers + 12 models; `model_providers.encryptedKey` column for DB-stored keys |
| Boot probe (Phase 2.8) | ✅ 7/7 capabilities green against DeepSeek (conversation/planning/execution/evaluation/tools/reasoning/coding — 778–1065 ms each) |
| DB-stored encrypted API keys | ✅ AES-256-GCM via existing `CryptoService`; key resolved DB-prefer > env fallback. SUPER_ADMIN adds/edits keys at `cc.neurecore.com/settings/ai` |
| Discover Models endpoint | ✅ `POST /settings/ai/providers/:id/discover-models` calls `GET /models`, inserts rows as disabled, admin picks which to enable + default |
| Set Default per-model | ✅ Click any model badge on Settings/AI to promote it (clears siblings on shared capabilities) |
| Non-ASCII key guard | ✅ Rejects `apiKey` with codepoints > 255 at boundary with explicit codepoint + position; no more leaking undici `ByteString` errors |
| Admin APIs | ✅ All 10 gateway endpoints live + Settings compatibility endpoints + discover-models + per-model set-default |
| Admin UI — `/settings/ai` | ✅ Providers, Models, Routing, Test, Set-Default, Discover Models step, clickable model badges |
| Admin chat | ✅ Real DeepSeek responses; CSRF exemption added for chat endpoints |
| Tenant chat (ConversationPanel) | ✅ Routes through gateway → DeepSeek (DB-prefer key) → streams real deltas |
| Tenant chat (AIChatPanel) | ✅ Same path |
| **Chat streaming Zod-schema fix** | ✅ `HttpLlmTransport.CHOICE_SCHEMA.finish_reason` made `.nullable()` — previously every DeepSeek/OpenAI streaming chunk was silently rejected (Zod: "Expected string, received null"), gateway emitted only `event: done` with no deltas, browser showed "bot not responding" |
| Consumer migration | ✅ 12 services migrated (chat, COS, project-health, RAG, retail, tools, langgraph, evaluator, hermes, summarization, digest, CI) |
| Tests | ✅ 46/46 AI-gateway-related suites pass; 1834/1953 full suite (10 pre-existing google-sheets failures unrelated) |
| `nest build` + `tsc --noEmit` | ✅ Zero errors |

### Known issues

| Issue | Severity | Mitigation |
|---|---|---|
| DeepSeek API: `deepseek-chat` / `deepseek-reasoner` / `deepseek-coder` all alias to `deepseek-v4-flash` server-side | Low | DeepSeek's model-id aliases aren't 1:1. Reasoner returns CoT in `reasoning_content`, ignored by current Zod schema (only `delta.content` is parsed). Real R1 responses will look like empty chat unless schema is extended. |
| `model_providers` table owned by `postgres` role on Contabo | Low | Future `prisma migrate deploy` as `neurecore_app` will FAIL with `must be owner of table model_providers`. Either grant ALTER to `neurecore_app`, or apply future migrations as `postgres`. |
| Chat sanitizer strips short replies (`"4"` for "What is 2+2?") and falls back to "I'm here. What's on your mind?" | Medium | `chat.service.ts:521` `text.length < 2` fallback is too aggressive for math/short answers. |
| Auth lockout: 7 failed logins in 60 s → 5-min cooldown | Low | Not a bug, just FYI for users. Wait it out, then retry. |
| Anthropic client not yet implemented — registered in catalog but `isActive=false` | Low | Implement `AnthropicTransport` extending `HttpLlmTransport` |
| LangSmith not tracing streams yet — `stream()` not wrapped in span | Low | Wrap `AsyncIterable` in LangSmith span after v1 stabilization |
| CircuitBreaker is in-memory only — not shared across PM2 instances | Low | Add Redis-backed state when multi-instance needed |
| Admin `/models` page has basePath routing bug (sidebar link doubles `/admin` prefix) | Low | Navigate directly to `https://cc.neurecore.com/models` |

### Resolved issues (was: known)

| Issue | Resolution |
|---|---|
| ~~MiniMax API key returns 401/2049~~ | Fixed: correct base URL `api.minimax.io` (was `api.minimaxi.com`) + proper `sk-*` key |
| ~~Settings/AI Providers page shows "resource not found"~~ | Fixed: created `AiProvidersController` at path `settings/ai/`, added `unwrapList` to service |
| ~~Admin chat shows "Chat backend not yet deployed"~~ | Fixed: added chat endpoints to CSRF exemption lists (both middleware files) |

---

## 3. Configuration

### Environment variables

```bash
# In /opt/neurecore/backend/backend/.env:

# Feature flag (set to true for production)
AI_GATEWAY_V2=true

# Provider API keys — OPTIONAL since Phase 2.8 (2026-07-28).
# Keys can now be set per-provider in the admin UI at
# https://cc.neurecore.com/settings/ai → "Add Provider" → API key.
# DB-stored keys are AES-256-GCM encrypted using the existing
# ENCRYPTION_KEY / GOOGLE_TOKEN_ENCRYPTION_KEY / APP_SECRET (in that
# priority order). CapabilityResolver prefers DB keys over env vars.
MINIMAX_API_KEY=<sk-... proper API key>      # legacy fallback only
MINIMAX_BASE_URL=https://api.minimax.io/v1
MINIMAX_MODEL=MiniMax-M2.7-highspeed
DEEPSEEK_API_KEY=<optional>                  # legacy fallback only
OPENAI_API_KEY=<optional>                    # legacy fallback only
ANTHROPIC_API_KEY=<optional>                 # legacy fallback only

# Gateway tuning
AI_CACHE_TTL_SECONDS=60          # model catalog cache TTL
AI_CIRCUIT_THRESHOLD=5           # errors to open circuit
AI_CIRCUIT_COOLDOWN_SECONDS=60   # circuit stays open
AI_CIRCUIT_WINDOW_SECONDS=30     # rolling failure window
AI_STREAMING_ENABLED=true        # enable SSE streaming
AI_DEFAULT_TIMEOUT_MS=60000      # per-request timeout
```

### DB-stored API keys (Phase 2.8, 2026-07-28)

Per-provider keys can be entered via the admin UI instead of
`/opt/neurecore/backend/backend/.env`. They are encrypted at rest
with the same `CryptoService` used by `integration_credential`
(AES-256-GCM, key from `ENCRYPTION_KEY` / `GOOGLE_TOKEN_ENCRYPTION_KEY`
/ `APP_SECRET`).

Resolution order (in `CapabilityResolver` + `AiGatewayService`):
1. Decrypted `model_providers.encryptedKey` for the provider's slug.
2. `process.env[<apiKeyEnv>]` as fallback.

The negative-cache TTL (10s) ensures a freshly-set key is picked up
within seconds without a backend restart. `updateProvider` also
calls `gateway.invalidateSecret(...)` to flush immediately.

API surface:
- `PATCH /api/v1/settings/ai/providers/:id` — body `{ apiKey: 'sk-…' }`
  sets; `{ apiKey: '' }` clears; omitting leaves unchanged.
- `POST  /api/v1/settings/ai/providers/:id/discover-models` — calls
  the provider's OpenAI-compatible `GET /models` and inserts new
  rows as `isAvailable=false` (admin then enables + picks default).
- The list/get endpoints return `hasKey: bool` + `keyPreview: 'sk-d…test'`
  (first 4 + ellipsis + last 4 chars of the decrypted value).

### Adding a new provider/model

```bash
# Via admin API (no redeploy needed)
curl -sk https://brain.neurecore.com/api/v1/admin/models/providers \
  -H "Authorization: Bearer <superadmin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "new-provider",
    "name": "My Provider",
    "apiBaseUrl": "https://api.example.com/v1",
    "apiKeyEnv": "MY_PROVIDER_API_KEY"
  }'

curl -sk https://brain.neurecore.com/api/v1/admin/models \
  -H "Authorization: Bearer <superadmin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "providerId": "<provider-id>",
    "modelId": "model-name",
    "displayName": "My Model",
    "capabilities": ["conversation", "reasoning"],
    "contextWindow": 128000,
    "costPer1kInput": 0.003,
    "costPer1kOutput": 0.015,
    "isDefault": false
  }'
```

### Setting a per-tenant override

```bash
curl -sk https://brain.neurecore.com/api/v1/admin/tenants/<tenantId>/model-overrides \
  -H "Authorization: Bearer <superadmin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "capability": "conversation",
    "aiModelId": "<model-id>"
  }'
```

Override takes effect within 60s (LRU cache TTL). Invalidate immediately via admin mutation or cache expiry.

### Critical bug fix (2026-07-28): chat streaming Zod schema

**Symptom:** Both cc and hq chat bots silently stopped emitting text. Browser showed the user message + an empty bubble + `event: done` immediately. `POST /chat/messages` (non-streaming) returned real DeepSeek replies — only `/chat/stream` (the SSE endpoint used by the browser) was broken.

**Root cause:** `HttpLlmTransport.CHOICE_SCHEMA.finish_reason: z.string().optional()` rejected every non-final streaming chunk from DeepSeek (and OpenAI). Every chunk has `finish_reason: null` until the last one (which has `finish_reason: "stop"`). The Zod error message was "Expected string, received null" — but it was being silently dropped via `if (!parsedChoice.success) continue;`. So the gateway yielded only the final done chunk, the chat service emitted `event: done` with empty `tokens`, the browser rendered an empty bubble.

**Why my earlier "DeepSeek is wired" claim was wrong:** `ai-gateway.invoke` structured log only fires on the non-streaming `select()` path. The browser uses `/chat/stream` which goes through `stream()` — that path never logged. I tested `POST /chat/messages`, not `POST /chat/stream`.

**Fix:** `src/modules/ai-gateway/transport/http-llm.transport.ts:154`
```ts
// before:
finish_reason: z.string().optional(),
// after:
finish_reason: z.string().nullable().optional(),
```

**Verified end-to-end:**
- `cc.neurecore.com` — "Capital of France?" → `event: delta: "The capital of France is Paris."` + `event: done`
- `hq.neurecore.com` — chat streams real deltas
- Same fix unblocks every OpenAI-compatible provider (Anthropic once implemented, OpenAI, Mistral, etc.)

---

## 4. Operations

### Health check

```bash
# Quick probe
curl -sk https://brain.neurecore.com/api/v1/admin/models/health \
  -H "Authorization: Bearer <admin-jwt>"

# Response: { circuit: [{key, state, failures}], booted: true }
```

### Monitor in logs

```bash
# Boot probe results
ssh contabo 'pm2 logs neurecore-backend --nostream --lines 40 | grep -i "AiGateway"'

# Structured log line per invoke
ssh contabo 'pm2 logs neurecore-backend --nostream --lines 20 | grep "ai-gateway.invoke"'
# → { capability, provider, model, tenantId, sourceModule, latencyMs, costCents, ok, errorCode }
```

### Cost summary

```bash
# Last 30 days
curl -sk "https://brain.neurecore.com/api/v1/admin/models/cost-summary?days=30" \
  -H "Authorization: Bearer <admin-jwt>"

# Returns { days: 30, rows: [{provider, model, _sum: {costCents, inputTokens, outputTokens}, _count}] }
```

### Troubleshooting

| Symptom | Check |
|---|---|
| Chat returns "Provider auth failed: 401" | MiniMax key is invalid. Update `MINIMAX_API_KEY` in `.env` and restart backend. |
| "All candidates lack a configured API key" | No active provider for that capability. Add API keys for fallback providers or add a new model with a working provider. |
| "Capability X is unavailable" | No model in the catalog advertises that capability. Add a model row via admin API. |
| Circuit breaker is OPEN for a provider | Provider returned 5 errors in 30s. Check `GET /admin/models/health`. Circuit auto-closes after 60s of healthy half-open probe. |
| New model not being picked up | LRU cache TTL is 60s. Wait, or call an admin mutation to trigger `invalidate()` immediately. |

---

## 5. Feature-list reference

See [ai-gateway-imp-plan.md](ai-gateway-imp-plan.md) for the full numbered list. Quick highlights:

| Area | Features |
|---|---|
| Core | Single entry point, DB catalog (5/12), per-tenant overrides, 8 capabilities, feature-flagged (`AI_GATEWAY_V2`) |
| Invocation | `invoke()`, `stream()` (SSE), `invokeStructured()` (Zod), `invokeWithTools()` (tool calls) |
| Transport | Single `fetch()`, single SSE parser, OpenAI-compatible, per-call timeout (60s) |
| Resilience | Circuit breaker (per-provider), retry policy (3× exponential + jitter), fallback chain (per-capability), 10 error classes |
| Cost | Single writer (`CostAttributorService`), idempotent (`sourceEventId`), DB-backed rates (`costPer1kInput/Output`) |
| Observability | Structured JSON logs, LangSmith spans, boot probe (parallel) |
| Security | All keys via `SecretProviderService`, unconfigured providers marked as OPEN permanently |
| Admin API | 10 endpoints: CRUD providers/models/overrides, health, cost-summary; RBAC-guarded (`SUPER_ADMIN`) |
| Admin UI | `/admin/models` (4 tabs), `/admin/cost-summary`; Next.js 15 |
| Consumer migration | 12 services migrated (chat, COS, project-health, RAG, retail, tools, langgraph, evaluator, hermes, summarization, digest, CI) |
| Tests | 1834+ tests, 12 new in `test/unit/ai-gateway-key-resolution.spec.ts` (encryption round-trip, DB-prefer precedence, capability heuristic), `nest build` + `tsc --noEmit` clean |

---

## 6. Future opportunities

### Near-term (next sprint)

| # | Opportunity | Impact | Effort |
|---|---|---|---|
| F1 | ~~Replace MiniMax API key~~ ✅ **DONE 2026-07-11** — chat now routes through gateway | — | — |
| F2 | ~~Add DeepSeek API key~~ ✅ **DONE 2026-07-28** — stored encrypted in DB, all 7 capabilities green | — | — |
| F3 | **Add OpenAI/Anthropic API keys** — `planning`, `execution`, `evaluation`, `tools` can also route to OpenAI gpt-4o-mini for redundancy. | High | Low (admin UI → click Add Provider) |
| F4 | **Tenant adds their own provider + key** — per-tenant surface on `hq.neurecore.com` so a tenant can bring their own OpenAI key. `tenant_model_overrides` already supports per-tenant capability→model override from the global catalog. | High | Medium (2-3 days) |
| F5 | **Extend Zod schema for `delta.reasoning_content`** — DeepSeek reasoner's CoT comes back in a separate field. Currently ignored, so R1 calls return empty content. | Medium | Low (1 hour) |
| F6 | **Loosen chat sanitizer fallback** — `chat.service.ts:521` `text.length < 2` fallback is too aggressive; short replies (math, single digits) become "I'm here…" → bot looks dead. | Medium | Low (1 hour) |
| F7 | **Fix admin `/models` basePath routing bug** — sidebar links double `/admin` prefix. | Medium | Low (navigation.config.ts) |

### Medium-term

| # | Opportunity | Impact | Effort |
|---|---|---|---|
| M1 | **Anthropic client** — implement `AnthropicTransport` (Anthropic uses different API shape). Register as active provider. | High | Medium (2-3 days) |
| M2 | **Redis-backed circuit breaker** — state shared across PM2 instances. Currently memory-only, good for single-instance. | Medium | Medium (1-2 days) |
| M3 | **LangSmith stream tracing** — wrap `AsyncIterable` in spans for full streaming visibility. | Medium | Low (1 day) |
| M4 | **Per-model concurrency semaphore** — enforce `maxConcurrent` to prevent rate-limited providers from being hammered. | Medium | Medium (1-2 days) |
| M5 | **Cost-record batching** — batch `CostRecord` writes every 5s to reduce DB write pressure. Currently writes per-invoke. | Low | Low (1 day) |
| M6 | **Model benchmarking dashboard** — latency/P95/token-cost trends per provider/model by capability. Extends `/admin/cost-summary`. | Medium | Medium (2-3 days) |

### Long-term / strategic

| # | Opportunity | Impact | Effort |
|---|---|---|---|
| L1 | **Model warm/cold tiering** — route low-priority/review tasks to cheaper models (e.g. deepseek-chat) and high-stakes/executive to premium models. Configurable via admin UI with budget per tenant. | High | Large (1 week) |
| L2 | **Intelligent routing by prompt characteristics** — classify prompt type (chat, analysis, generation) and automatically select best model. Replace simple capability routing with ML-based selection. | High | Large (2 weeks) |
| L3 | **Provider-agnostic embeddings** — wire the `embedding` capability for RAG, semantic search, and memory. Use OpenAI `text-embedding-3-small` or open-source alternatives. | High | Medium (3-4 days) |
| L4 | **Multi-modal support** — extend `invoke()` to accept images/audio. Route to vision-capable models (GPT-4V, Claude Vision). First use: document OCR in project creation. | High | Large (1 week) |
| L5 | **Model fine-tuning infrastructure** — record conversation quality scores via chat feedback (👍/👎). Aggregate and trigger fine-tuning jobs on provider APIs. Admin UI for tuning status. | Medium | Very large (2 weeks) |
| L6 | **Tenant-specific custom models** — allow enterprise tenants to bring their own fine-tuned models. Store model endpoint + API key per tenant. Catalog row with `tenantId` FK. | Medium | Medium (3-4 days) |
| L7 | **A/B testing between models** — route a % of traffic to alternate models and compare latency/cost/quality. Admin UI for experiment config and result dashboard. | Medium | Large (1 week) |
| L8 | **Prompt catalog + versioning** — store prompt templates in DB with version history. Gateway `invoke()` accepts `promptTemplateId` which resolves to a versioned system + user prompt. | Medium | Large (1 week) |
| L9 | **Automatic cost optimization** — analyze historical usage patterns and suggest cheaper alternative models for low-impact capabilities. Auto-switch with admin approval. | Low | Medium (3-4 days) |
| L10 | **Global failover across regions** — route to region-specific provider endpoints (`openai-us`, `openai-eu`, `minimax-asia`) for latency optimization and regional compliance. | Medium | Medium (2-3 days) |

---

## 7. Quick commands

```bash
# All services status
ssh contabo 'pm2 list'

# Backend health
curl -sk https://brain.neurecore.com/api/v1/health | python3 -m json.tool

# Gateway health (needs superadmin JWT)
TOKEN=$(curl -sk https://brain.neurecore.com/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@neurecore.ai","password":"..."}' | \
  python3 -c "import json,sys; print(json.load(sys.stdin)['data']['tokens']['accessToken'])")

curl -sk https://brain.neurecore.com/api/v1/admin/models/health \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# List providers
curl -sk https://brain.neurecore.com/api/v1/admin/models/providers \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool | head -50

# Cost summary
curl -sk "https://brain.neurecore.com/api/v1/admin/models/cost-summary?days=30" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# Test admin chat (MiniMax response)
curl -sk https://brain.neurecore.com/api/v1/chat/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"Say hello"}' | python3 -m json.tool | head -20

# Settings/AI providers (compatibility layer)
curl -sk https://brain.neurecore.com/api/v1/settings/ai/providers \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d['data']),'providers')"

# Rebuild all (from local workspace)
cd /home/najeeb/Linux-Dev/neurecore-2026/neurecore
./scripts/deploy.sh all

# Rebuild backend only
./scripts/deploy.sh backend

# Local test suite
cd backend && ./node_modules/.bin/jest --config jest.config.js --silent

# Watch gateway logs
ssh contabo 'pm2 logs neurecore-backend | grep -i "AiGateway"'
```

---

**End of AI Gateway Quick Reference.**

- Audit: [ai-gateway.md](ai-gateway.md)
- Full implementation plan + deploy log: [ai-gateway-imp-plan.md](ai-gateway-imp-plan.md)
- Backend module details: [backend.md §16](../backend.md)
- Frontend admin UI: [frontend-admin.md §13](../frontend-admin.md)
- Deploy fixes: [fixes.md FIX-037 + FIX-038](../fixes.md)
