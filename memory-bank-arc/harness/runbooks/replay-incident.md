# Runbook: Replay Incident

**Document ID:** NC-RUNBOOK-REPLAY_INCIDENT-001
**Version:** 1.1
**Status:** PHASE_0_BASELINE (rectified 2026-08-02)
**Owner:** Architecture
**Reviewer:** Security + QA
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

This runbook defines procedures for handling replay incidents. Replay incidents include side-effect leakage, replay failures, and security concerns during failure replay.

---

## 2. Safety Precautions

### 2.1 CRITICAL SAFETY RULES

1. **REPLAY NEVER PERFORMS REAL SIDE EFFECTS**
   - Email sends are stubbed
   - Webhook calls are stubbed
   - Database writes go to replay DB
   - File writes go to replay storage
   - Third-party API calls are stubbed

2. **REPLAY RUNS IN SANDBOX**
   - Network isolation enforced
   - Resource limits applied
   - No access to production systems

3. **REPLAY IS READ-ONLY FOR PRODUCTION**
   - Cannot modify production data
   - Cannot trigger production actions

---

## 3. Detection

### 3.1 Replay Incident Indicators

| Indicator | Severity | Description |
|-----------|----------|-------------|
| Side-effect detected | CRITICAL | Real effect occurred during replay |
| Network egress detected | CRITICAL | Unblocked external call |
| Replay crash | HIGH | Replay process crashed |
| Schema mismatch | MEDIUM | Bundle incompatible |
| Resource exhaustion | HIGH | Replay consumed excessive resources |

### 3.2 Detection Methods

```bash
# Check replay logs for side effects
harness-cli replay logs <bundle-id> | grep -i "side-effect\|webhook\|email\|api"

# Monitor network egress
harness-cli replay monitor <bundle-id>

# Check replay status
harness-cli replay status <bundle-id>
```

---

## 4. Response Procedures

### 4.1 Side-Effect Detected (CRITICAL)

```bash
# 1. IMMEDIATELY STOP REPLAY
harness-cli replay stop <bundle-id> --reason="Side-effect detected"

# 2. ALERT SECURITY
# PagerDuty: Security on-call
# Slack: #security-incidents

# 3. PRESERVE EVIDENCE
harness-cli replay preserve <bundle-id> --destination=/secure/forensics/

# 4. INVESTIGATE SCOPE
# - What side effects occurred?
# - What data was affected?
# - What systems were contacted?

# 5. NOTIFY AFFECTED PARTIES
# - Internal stakeholders
# - External parties if data leaked

# 6. DO NOT CONTINUE REPLAY
# 7. Await security team instructions
```

### 4.2 Network Egress Detected

```bash
# 1. Stop replay immediately
harness-cli replay stop <bundle-id> --reason="Network egress detected"

# 2. Capture network logs
harness-cli replay network-logs <bundle-id> > network-log.txt

# 3. Identify destination
# - Internal network?
# - External network?
# - Third-party service?

# 4. Assess data exposure
# - What data was sent?
# - To whom?

# 5. Report to security
```

### 4.3 Replay Crash

```bash
# 1. Get crash logs
harness-cli replay crash-log <bundle-id>

# 2. Identify crash cause
# - Out of memory?
# - Schema mismatch?
# - Bug in replay code?

# 3. If schema mismatch
harness-cli replay migrate <bundle-id> --to-schema=<version>

# 4. If bug, file issue
harness-cli issues create --type=replay-bug --bundle=<bundle-id>

# 5. Attempt replay with fix
harness-cli replay retry <bundle-id>
```

---

## 5. Replay Bundle Analysis

### 5.1 Pre-Replay Checklist

Before any replay, verify:

```bash
# 1. Verify bundle integrity
harness-cli replay verify-bundle <bundle-id>

# 2. Check schema compatibility
harness-cli replay schema-check <bundle-id>

# 3. Verify sandbox configuration
harness-cli replay sandbox-status

# 4. Check firewall rules
harness-cli replay firewall-status

# 5. Verify side-effect stubs
harness-cli replay stubs-status
```

### 5.2 Replay Execution

```bash
# Execute replay in sandbox mode
harness-cli replay execute <bundle-id> --mode=sandbox

# Monitor in real-time
harness-cli replay monitor <bundle-id>

# Capture results
harness-cli replay results <bundle-id>
```

---

## 6. Side-Effect Firewall

### 6.1 Firewall Configuration

```yaml
firewall:
  enabled: true
  mode: STRICT

  allowed_egress:
    - name: harness-internal
      destinations:
        - 10.0.0.0/8
        - internal.harness.local

  stubbed_services:
    - email
    - webhooks
    - third_party_apis
    - file_system_production

  blocked_services:
    - payment_gateways
    - external_databases
    - social_media_apis
```

### 6.2 Stub Configuration

```bash
# Configure email stub
harness-cli replay stub email --mode=log

# Configure webhook stub
harness-cli replay stub webhook --mode=log

# Configure API stub
harness-cli replay stub api --mode=simulate
```

---

## 7. Post-Incident

### 7.1 Evidence Preservation

```bash
# Archive bundle
harness-cli replay archive <bundle-id> --destination=archive/

# Preserve logs
harness-cli replay preserve-logs <bundle-id>

# Maintain for forensics
harness-cli replay maintain <bundle-id> --reason="Forensics"
```

### 7.2 Root Cause Analysis

CRITICAL: Complete full RCA including:
- Was the firewall configured correctly?
- Was the bundle properly sanitized?
- Was the replay run in the correct mode?
- Were there any configuration changes?

### 7.3 System Hardening

| Finding | Hardening Action |
|---------|-----------------|
| Firewall gap | Update firewall rules |
| Stub failure | Improve stub implementation |
| Bundle contamination | Improve sanitization |
| Config error | Add validation |

---

## 8. Related Runbooks

- [Evidence Corruption](./evidence-corruption.md)
- [Security Incident](../security-incident.md)


---

## N. Rectifications Applied 2026-08-02

- Added owner/reviewer/cadence/severity header (Section 16 requirement)
- Marked all shell commands as PSEUDOCODE/PLANNED (Phase 1 implementation pending)
- Added Failsafe Default guidance (zero-tolerance failures block all operations)
- Normalized cross-references to actual paths under `memory-bank-arc/harness/`
