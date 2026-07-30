# Chat Unification — Monitoring & Alert Rules

**Phase G — Production rollout**
**Last updated:** 2026-07-19
**Scope:** Backend metrics for `/chat/*` endpoints + Hermes agent execution path

---

## Metrics (Prometheus)

Exposed at `/api/v1/metrics` via `MetricsController`.

### Chat metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `neurecore_chat_messages_total` | Counter | `role`, `endpoint` | Total chat messages persisted. `role=user\|assistant\|system`, `endpoint=messages\|stream`. |
| `neurecore_chat_history_ops_total` | Counter | `operation`, `result` | Total chat history operations. `operation=get\|delete`, `result=ok\|error`. |
| `neurecore_chat_message_duration_seconds` | Histogram | (none) | End-to-end duration of `POST /chat/messages`. Buckets: 50ms–30s. |

### Hermes execution metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `neurecore_hermes_execution_path_total` | Counter | `hermes_enabled`, `executor`, `result` | Agent execution decisions. `hermes_enabled=true\|false`, `executor=hermes_runtime\|official_agent_graph`, `result=success\|error`. |

### Pre-existing AI action metrics (untouched)

- `neurecore_ai_action_invocations_total`
- `neurecore_ai_action_duration_seconds`
- `neurecore_ai_action_tokens_total`
- `neurecore_ai_action_cost_usd_total`
- `neurecore_ai_action_errors_total`

---

## Alert Rules (Prometheus alertmanager)

### Critical — Page on-call

```yaml
- alert: ChatBackendDown
  expr: up{job="neurecore-backend"} == 0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "NeureCore backend is unreachable"
    runbook: "Check PM2 process `neurecore-backend` and `/tmp/rebuild.log`"

- alert: ChatEndpointDown
  expr: |
    rate(neurecore_chat_messages_total[5m]) == 0
  for: 10m
  labels:
    severity: critical
  annotations:
    summary: "No chat messages in last 10 minutes (possible outage)"
    runbook: "Check chat.controller.ts + ChatService logs"
```

### Warning — Investigate during business hours

```yaml
- alert: ChatHistoryErrorsHigh
  expr: |
    rate(neurecore_chat_history_ops_total{result="error"}[10m]) > 0.05
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Chat history error rate >5% over 10 minutes"
    runbook: "Check Postgres connectivity + PrismaService logs"

- alert: ChatLatencyP95High
  expr: |
    histogram_quantile(0.95, rate(neurecore_chat_message_duration_seconds_bucket[5m])) > 5
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "Chat P95 latency > 5s"
    runbook: "Check MiniMax API latency + Hermes execution path"

- alert: HermesExecutionErrors
  expr: |
    rate(neurecore_hermes_execution_path_total{result="error"}[10m]) > 0.05
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Hermes execution error rate >5%"
    runbook: "Roll back Hermes with `scripts/chat-unification-rollout.sh rollback stage1` if errors persist"
```

### Info — Track during 7-day rollout

```yaml
- alert: HermesRolloutTracking
  expr: |
    sum by (hermes_enabled) (rate(neurecore_hermes_execution_path_total[1h]))
  for: 1h
  labels:
    severity: info
  annotations:
    summary: "Hermes execution path distribution (1h window)"
    description: |
      Track daily ratio of `hermes_enabled=true` to `hermes_enabled=false`.
      Goal: 100% true by day 7 of rollout.

- alert: ChatPersistenceGrowth
  expr: |
    rate(neurecore_chat_messages_total[24h]) > 1000
  for: 24h
  labels:
    severity: info
  annotations:
    summary: "Chat persistence writing >1000 msg/day (expected growth signal)"
    runbook: "Monitor Postgres disk usage on chat_messages table"
```

---

## 7-Day Monitoring Checklist

| Day | Check | Expected | Action if Fail |
|-----|-------|----------|----------------|
| 1 | `rate(neurecore_hermes_execution_path_total{hermes_enabled="false"}[1h])` | ~0 (only opt-out tenants) | Investigate why legacy path is being hit |
| 1 | `rate(neurecore_chat_history_ops_total{result="error"}[1h])` | 0 or near 0 | Check Prisma + DB connection |
| 1 | Backend health `https://brain.neurecore.com/api/v1/health` | 200 | Roll back via script |
| 3 | `histogram_quantile(0.95, rate(neurecore_chat_message_duration_seconds_bucket[6h]))` | < 5s | Investigate Hermes queue depth |
| 7 | Ratio `hermes_enabled=true / total` | ≥ 95% | If low, check per-tenant override DB column |

---

## Grafana Dashboard (recommended)

JSON dashboard file at `neurecore/scripts/grafana-chat-dashboard.json` (TODO: create in production monitoring repo).

Panels:
1. **Chat Volume** — `rate(neurecore_chat_messages_total[5m])` by role
2. **Chat Latency** — `histogram_quantile(0.5, 0.95, 0.99, rate(neurecore_chat_message_duration_seconds_bucket[5m]))`
3. **History Error Rate** — `rate(neurecore_chat_history_ops_total{result="error"}[5m]) / rate(neurecore_chat_history_ops_total[5m])`
4. **Hermes Execution Path** — stacked bar of `neurecore_hermes_execution_path_total` by `hermes_enabled` × `executor`
5. **Token Cost (USD)** — `rate(neurecore_ai_action_cost_usd_total[1h]) * 3600` (existing metric, but useful in same dashboard)

---

## Rollback Decision Tree

```
Issue detected?
├─ Chat endpoint down (no /chat/messages traffic for 10min)?
│  └─ YES → bash scripts/chat-unification-rollout.sh rollback stage1
│           (reverts to HERMES_ENABLED=false, legacy path)
│
├─ Hermes execution error rate > 5%?
│  ├─ All tenants affected → rollback stage1
│  └─ Single tenant → set Tenant.settings.featureFlags.HERMES_ENABLED = false
│
└─ Latency P95 > 10s sustained?
   └─ Check MiniMax API status first, escalate if not their issue
```

---

## Pre-Production Smoke Test (after deploy)

```bash
# 1. Health check
curl -fsS https://brain.neurecore.com/api/v1/health
# Expected: {"status":"ok",...}

# 2. Chat send (requires auth token — extract from browser devtools)
TOKEN=$(...)
curl -fsS -X POST https://brain.neurecore.com/api/v1/chat/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"rollout smoke test","conversationId":null}'
# Expected: {"data":{"reply":"...","conversationId":"...","tokens":{...}}}

# 3. Chat history
curl -fsS https://brain.neurecore.com/api/v1/chat/history \
  -H "Authorization: Bearer $TOKEN"
# Expected: {"data":[{...}],"total":N}

# 4. Verify Hermes default-on in logs
ssh contabo 'pm2 logs neurecore-backend --lines 100 --nostream --raw | grep -i hermes'
# Expected: FeatureFlag HERMES_ENABLED: unset → true
```

---

## Production Smoke Verification (post-deploy, t+0)

| Item | Expected | Verify |
|------|----------|--------|
| Backend health | 200 | `curl /api/v1/health` |
| Chat endpoint | 200 + reply | `curl -X POST /api/v1/chat/messages` |
| Hermes feature flag | `unset → true` | `pm2 logs \| grep HERMES` |
| Prisma migration | `chat_sessions` + `chat_messages` created | `psql -c "\dt chat_*"` |
| Metrics endpoint | new metrics present | `curl /api/v1/metrics \| grep neurecore_chat` |
| Frontend tenant | unified panel renders | browser smoke test |
| Frontend admin | unified panel renders | browser smoke test |
