# Runbook: Provider Outage

**Document ID:** NC-RUNBOOK-PROVIDER_OUTAGE-001
**Version:** 1.1
**Status:** PHASE_0_BASELINE (rectified 2026-08-02)
**Owner:** SRE Lead
**Reviewer:** Platform + Architecture
**Review Cadence:** Quarterly
**Severity:** HIGH

---

## 0. Important Notes

### 0.1 Pseudocode Commands

All shell commands in this runbook are **PSEUDOCODE / PLANNED** for the harness control plane that does not yet exist (Phase 1+). They are intended to:
- Document the operational response procedure
- Identify required tooling and integration points
- Be reviewed and refined during Phase 1 implementation

Operators MUST NOT treat these commands as currently executable. Manual interim procedures are described below each command set.

### 0.2 Failsafe Default

When in doubt, fail CLOSED:
- Tenant isolation, authorization, audit integrity, evidence corruption, zero-tolerance failures: NO REPLAY, NO EXPORT, NO ROLLBACK until reviewed.
- Always preserve evidence first; analyze second.

---

## 1. Purpose

This runbook defines procedures for handling provider outages. Providers include external AI providers (OpenAI, Anthropic), infrastructure providers, and third-party services.

---

## 2. Provider Inventory

### 2.1 Critical Providers

| Provider | Service | Criticality | Fallback |
|----------|---------|-------------|----------|
| OpenAI | LLM API | HIGH | Anthropic, local model |
| Anthropic | LLM API | HIGH | OpenAI, local model |
| Prisma | Database | CRITICAL | None |
| Redis | Cache/Queue | HIGH | In-memory fallback |
| AWS S3 | Storage | HIGH | Alternative storage |
| Playwright | Browser | HIGH | None |

### 2.2 Health Monitoring

```bash
# Check provider health
harness-cli providers health

# Check specific provider
harness-cli providers health --provider=openai

# Check provider-specific runs
harness-cli runs list --provider=<provider> --status=FAILED
```

---

## 3. Detection

### 3.1 Outage Indicators

| Indicator | Description |
|-----------|-------------|
| Provider health check failed | Automated probe failed |
| Connection timeout | Provider not responding |
| Error rate spike | Provider errors increasing |
| Run failures | Runs failing with provider errors |

### 3.2 Alert Configuration

Configure alerts for:
- Provider health check failure
- Error rate > threshold
- Latency > threshold
- Connection pool exhaustion

---

## 4. Response Procedures

### 4.1 Provider Health Check Failure

```bash
# 1. Verify provider status
harness-cli providers status --provider=<provider>

# 2. Check external status page
# OpenAI: status.openai.com
# Anthropic: status.anthropic.com

# 3. If provider outage confirmed, activate contingency
harness-cli providers activate-contingency --provider=<provider>

# 4. Monitor error rates
harness-cli providers monitor --provider=<provider>
```

### 4.2 Partial Outage

```bash
# Enable fallback for affected operations
harness-cli providers fallback --provider=<provider> --operation=<operation>

# Route to fallback provider
harness-cli providers switch --provider=<provider> --to=<fallback>

# Monitor fallback health
harness-cli providers monitor --provider=<fallback>
```

### 4.3 Complete Outage

```bash
# 1. Alert all stakeholders
harness-cli alerts send --severity=HIGH --message="Provider outage: <provider>"

# 2. Enable degraded mode
harness-cli mode degraded --provider=<provider>

# 3. Queue runs for retry
harness-cli runs queue-retry --reason="Provider outage" --provider=<provider>

# 4. Set expected resolution
harness-cli providers set-eta --provider=<provider> --eta=<timestamp>
```

---

## 5. Run Impact Assessment

### 5.1 Identify Affected Runs

```bash
# List runs affected by provider outage
harness-cli runs list --provider=<provider> --status=FAILED

# List runs in progress
harness-cli runs list --provider=<provider> --status=RUNNING

# Estimate completion time
harness-cli runs estimate-completion --provider=<provider>
```

### 5.2 Determine Run Actions

| Run State | Action |
|-----------|--------|
| QUEUED | Hold, retry after outage |
| RUNNING | Cancel, reschedule |
| COMPLETING | Allow to complete |
| COMPLETED | Mark as provider-impacted |
| FAILED | Mark as provider-failed |

---

## 6. Recovery Procedures

### 6.1 Provider Recovery

```bash
# 1. Verify provider is healthy
harness-cli providers health --provider=<provider>

# 2. Verify external status
# Check status page

# 3. Disable degraded mode
harness-cli mode normal --provider=<provider>

# 4. Resume queued runs
harness-cli runs resume-queued --reason="Provider recovered"
```

### 6.2 Run Recovery

```bash
# Re-execute failed runs
harness-cli runs re-execute --reason="Provider outage recovery"

# Verify runs complete successfully
harness-cli runs monitor --recent
```

---

## 7. Communication

### 7.1 Stakeholder Communication

| Audience | Message | Channel |
|----------|---------|---------|
| Engineering | Provider outage in progress | Slack #incidents |
| QA | Some runs may be delayed | Slack #qa |
| Product | Timeline impact assessment | Email |
| Management | Incident summary | PagerDuty |

### 7.2 Customer Communication (if applicable)

- Status page update
- Estimated resolution time
- Workaround instructions

---

## 8. Post-Incident

### 8.1 Document Timeline

| Time | Event |
|------|-------|
| T+0 | Outage detected |
| T+X | Contingency activated |
| T+Y | Stakeholders notified |
| T+Z | Provider recovered |
| T+Z+1 | Normal operations resumed |

### 8.2 Action Items

| Item | Owner | Priority |
|------|-------|----------|
| Improve fallback detection | Platform | HIGH |
| Add provider redundancy | Architecture | HIGH |
| Improve run resilience | Backend | MEDIUM |
| Update runbook | SRE | LOW |

---

## 9. Related Runbooks

- [Stuck Run](./stuck-run.md)
- [Cleanup Failure](./cleanup-failure.md)
- [Gate Outage](./gate-outage.md)


---

## N. Rectifications Applied 2026-08-02

- Added owner/reviewer/cadence/severity header (Section 16 requirement)
- Marked all shell commands as PSEUDOCODE/PLANNED (Phase 1 implementation pending)
- Added Failsafe Default guidance (zero-tolerance failures block all operations)
- Normalized cross-references to actual paths under `memory-bank-arc/harness/`
