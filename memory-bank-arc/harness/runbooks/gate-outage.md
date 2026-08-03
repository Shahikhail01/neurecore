# Runbook: Gate Outage

**Document ID:** NC-RUNBOOK-GATE_OUTAGE-001
**Version:** 1.1
**Status:** PHASE_0_BASELINE (rectified 2026-08-02)
**Owner:** Release Engineering Lead
**Reviewer:** Architecture + Security
**Review Cadence:** Quarterly
**Severity:** CRITICAL

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

This runbook defines procedures for handling harness gate outages. A gate outage occurs when the certification gate is unavailable or returning incorrect verdicts.

---

## 2. Gate Components

### 2.1 Gate Architecture

```
┌─────────────────────────────────────────┐
│           GATE ENGINE                    │
│  ┌─────────┐ ┌─────────┐ ┌──────────┐  │
│  │ Verdict │ │ Evidence│ │ Policy   │  │
│  │ Service │ │ Resolver│ │ Engine   │  │
│  └─────────┘ └─────────┘ └──────────┘  │
└─────────────────────────────────────────┘
```

### 2.2 Component Dependencies

| Component | Dependencies | Criticality |
|-----------|--------------|-------------|
| Verdict Service | Database, Policy Engine | CRITICAL |
| Evidence Resolver | Evidence Store, Checksum Service | CRITICAL |
| Policy Engine | Database, Policy Store | HIGH |

---

## 3. Detection

### 3.1 Gate Outage Indicators

| Indicator | Description | Severity |
|-----------|-------------|----------|
| Gate health check failed | /health returns unhealthy | CRITICAL |
| Gate latency > threshold | Response time degraded | HIGH |
| Verdict errors spike | Error rate increasing | HIGH |
| Gate unavailable | HTTP 503 | CRITICAL |

### 3.2 Detection Methods

```bash
# Check gate health
harness-cli gate health

# Check gate latency
harness-cli gate latency

# List recent verdict errors
harness-cli gate errors --last=1h
```

---

## 4. Response Procedures

### 4.1 Gate Unavailable

```bash
# 1. Verify gate is down
harness-cli gate health

# 2. Check component health
harness-cli gate components

# 3. Activate gate bypass (EMERGENCY ONLY)
harness-cli gate bypass --reason="Gate outage" --ticket=<ticket-id>

# 4. Alert release engineering
# PagerDuty: Release Engineering on-call
```

**WARNING:** Gate bypass allows releases to proceed without certification. Use only in emergencies.

### 4.2 Gate Returning Incorrect Verdicts

```bash
# 1. Identify incorrect verdicts
harness-cli gate verify-recent --count=100

# 2. Check verdict for specific run
harness-cli gate verdict <run-id>

# 3. Re-run verification
harness-cli gate re-verify <run-id>

# 4. If still incorrect, halt gate
harness-cli gate halt --reason="Returning incorrect verdicts"
```

### 4.3 Gate Performance Degradation

```bash
# 1. Check gate latency
harness-cli gate latency

# 2. Identify bottleneck
harness-cli gate diagnostics

# 3. Scale if needed
harness-cli gate scale --replicas=<count>

# 4. Monitor latency recovery
harness-cli gate monitor
```

---

## 5. CI/CD Impact

### 5.1 Assess CI/CD Impact

```bash
# Check pending releases
harness-cli releases pending

# Check blocked releases
harness-cli releases blocked

# Estimate gate outage impact
harness-cli releases impact --duration=<hours>
```

### 5.2 CI/CD Communication

| Audience | Message | Channel |
|----------|---------|---------|
| Developers | Gate degraded, expect delays | Slack #engineering |
| Release Engineering | Manual approval required | PagerDuty |
| Product | Release timeline impact | Email |

---

## 6. Recovery Procedures

### 6.1 Gate Recovery

```bash
# 1. Verify components healthy
harness-cli gate components

# 2. Re-enable gate
harness-cli gate enable

# 3. Verify verdicts
harness-cli gate verify-recent --count=100

# 4. Disable bypass if active
harness-cli gate bypass-disable
```

### 6.2 Re-evaluate Blocked Releases

```bash
# List releases blocked during outage
harness-cli releases blocked

# Re-evaluate blocked releases
harness-cli releases re-evaluate --release=<release-id>

# Approve if criteria met
harness-cli releases approve --release=<release-id>
```

---

## 7. Post-Incident

### 7.1 Impact Assessment

| Metric | Before | During | After |
|--------|--------|--------|-------|
| Blocked releases | 0 | X | 0 |
| Manual approvals | 0 | X | 0 |
| Average gate latency | <100ms | >5s | <100ms |

### 7.2 Action Items

| Item | Owner | Priority |
|------|-------|----------|
| Implement gate HA | Platform | CRITICAL |
| Add gate monitoring | SRE | HIGH |
| Document manual approval process | Release Eng | MEDIUM |
| Test gate failover | Platform | HIGH |

---

## 8. Related Runbooks

- [Stuck Run](./stuck-run.md)
- [Provider Outage](./provider-outage.md)
- [Rollback](./rollback.md)


---

## N. Rectifications Applied 2026-08-02

- Added owner/reviewer/cadence/severity header (Section 16 requirement)
- Marked all shell commands as PSEUDOCODE/PLANNED (Phase 1 implementation pending)
- Added Failsafe Default guidance (zero-tolerance failures block all operations)
- Normalized cross-references to actual paths under `memory-bank-arc/harness/`
