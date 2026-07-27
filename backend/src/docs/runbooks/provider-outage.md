# Provider Outage Runbook

**Trigger:** Circuit open > 5min or upstream model/tool returns 5xx for > 10% of calls in 5min

## Symptoms
- `tool_failure_total` counter rising faster than baseline
- `attempt_failure_total{classification="TRANSIENT_INFRASTRUCTURE"}` > 5 in 5min
- `event_processing_latency_seconds{result="failure"}` p95 climbing
- Customers reporting "AI is stuck" or slow retries

## Diagnosis
1. Check the metrics dashboard for `tool_failure_total` and `attempt_failure_total`.
2. Identify the failing provider via the `agentType` label.
3. Cross-check upstream status pages (OpenAI, Anthropic, internal LLM gateway).
4. Use a single correlation ID to walk from the customer's failed
   run through outbox, attempt, and tool logs.

## Resolution
1. Acknowledge the alert in the on-call channel.
2. If the provider outage is confirmed:
   - Force the circuit breaker to remain open by adjusting
     `circuit.failureThreshold` so retries stop.
   - Move affected tenants to the fallback provider via
     `TenantFeatureFlagOverride` (recorded in `FeatureFlagAuditLog`).
3. If the outage is local (gateway, network, auth):
   - Roll back the most recent deploy if it correlates.
   - Restart the affected worker pods.
4. Once the provider is healthy again, reset the circuit breaker and
   re-enable the default provider. Use `replayDeadLetter()` to drain
   any events that exited the queue during the outage.

## Verification
- `tool_failure_total` returns to baseline.
- New attempts complete with `result=success` against the healthy provider.
- Replayed dead-letter events complete without creating duplicates.
