# Runbook: Cleanup Failure

**Document ID:** NC-RUNBOOK-CLEANUP_FAILURE-001
**Version:** 1.1
**Status:** PHASE_0_BASELINE (rectified 2026-08-02)
**Owner:** SRE Lead
**Reviewer:** QA + Architecture
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

This runbook defines procedures for handling cleanup failures. Cleanup failures occur when a run completes but its resources cannot be properly cleaned up.

---

## 2. Detection

### 2.1 Cleanup Failure Indicators

| Indicator | Description | Severity |
|-----------|-------------|----------|
| CleanupResult shows failure | Cleanup step failed | HIGH |
| Orphan scan finds resources | Cleanup incomplete | HIGH |
| Storage quota warning | Resources not freed | MEDIUM |
| Tenant quota warning | Per-tenant limits approached | HIGH |

---

## 3. Investigation Procedure

### 3.1 Identify Cleanup Failure

```bash
# Check run cleanup status
harness-cli runs cleanup-status <run-id>

# List recent cleanup failures
harness-cli cleanup failures --last=24h

# Get cleanup details
harness-cli cleanup details <run-id>
```

### 3.2 Identify Orphaned Resources

```bash
# Scan for orphaned resources
harness-cli cleanup scan --run-id=<run-id>

# List all orphans
harness-cli cleanup orphans --run-id=<run-id>

# Orphan categories:
# - database: Leftover database records
# - storage: Leftover files/blobs
# - cache: Leftover cache entries
# - queue: Leftover queue messages
# - process: Leftover processes
```

### 3.3 Assess Resource Impact

```bash
# Check storage impact
harness-cli cleanup impact --orphans=<orphan-list> --type=storage

# Check database impact
harness-cli cleanup impact --orphans=<orphan-list> --type=database

# Check quota status
harness-cli quotas status
```

---

## 4. Resolution Procedures

### 4.1 Automatic Retry

```bash
# Retry cleanup for specific run
harness-cli cleanup retry <run-id>

# Retry with extended timeout
harness-cli cleanup retry <run-id> --timeout=30m

# Monitor retry
harness-cli cleanup status <run-id>
```

### 4.2 Manual Cleanup

```bash
# Delete specific orphan
harness-cli cleanup delete --orphan=<orphan-id>

# Delete by category
harness-cli cleanup delete --orphans=<orphan-list> --category=storage

# Force delete (bypass safety)
harness-cli cleanup delete --orphan=<orphan-id> --force
```

**CAUTION:** Force delete bypasses safety checks. Use only when automatic cleanup has failed.

### 4.3 Full Environment Reset

Use when cleanup cannot isolate the issue.

```bash
# Reset run environment
harness-cli runs reset-environment <run-id>

# Verify reset
harness-cli runs status <run-id>
```

---

## 5. Post-Cleanup Verification

### 5.1 Verify Cleanup Complete

```bash
# Re-scan for orphans
harness-cli cleanup scan --run-id=<run-id>

# Verify storage freed
harness-cli storage usage

# Verify database clean
harness-cli database tables --tenant=<tenant-id>
```

### 5.2 Verify System Health

```bash
# Check quotas
harness-cli quotas verify

# Check storage health
harness-cli storage health

# Run cleanup health check
harness-cli cleanup health-check
```

---

## 6. Root Cause Analysis

Complete RCA template:

| Field | Description |
|-------|-------------|
| Run ID | The run that failed cleanup |
| Cleanup Step | Which step failed |
| Error | Error message |
| Timeline | When failure occurred |
| Resources | What resources remain |
| Impact | Quota/system impact |
| Root Cause | Why cleanup failed |
| Corrective | Immediate fix |
| Preventive | Long-term fix |

---

## 7. Preventive Measures

| Issue | Preventive Action | Phase |
|-------|------------------|-------|
| Cleanup timeout | Increase timeout, add retry | P1 |
| Resource lock | Add timeout to locks | P1 |
| Cleanup race condition | Add idempotency | P1 |
| Quota exhaustion | Add pre-check | P2 |
| Orphan detection | Add periodic scan | P2 |

---

## 8. Alerting

Configure alerts for:
- Cleanup failure rate > 1%
- Orphan count > threshold
- Storage usage > 80%
- Database connection leaks

---

## 9. Related Runbooks

- [Stuck Run](./stuck-run.md)
- [Evidence Corruption](./evidence-corruption.md)


---

## N. Rectifications Applied 2026-08-02

- Added owner/reviewer/cadence/severity header (Section 16 requirement)
- Marked all shell commands as PSEUDOCODE/PLANNED (Phase 1 implementation pending)
- Added Failsafe Default guidance (zero-tolerance failures block all operations)
- Normalized cross-references to actual paths under `memory-bank-arc/harness/`
