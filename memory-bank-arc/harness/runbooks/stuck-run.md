# Runbook: Stuck Run

**Document ID:** NC-RUNBOOK-STUCK_RUN-001
**Version:** 1.1
**Status:** PHASE_0_BASELINE (rectified 2026-08-02)
**Owner:** SRE Lead
**Reviewer:** Architecture + QA
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

This runbook defines procedures for handling stuck harness runs. A run is considered "stuck" when it exceeds its expected duration without completing.

---

## 2. Detection

### 2.1 Stuck Run Criteria

| Criterion | Threshold | Action |
|-----------|-----------|--------|
| Run exceeds expected duration | 2x expected duration | Investigate |
| Run exceeds maximum duration | 5x expected duration | Force cancel |
| No state change | 1 hour | Investigate |

### 2.2 Detection Methods

- **Automated:** Run monitor checks run status every 5 minutes
- **Manual:** User reports stuck run
- **Alert:** Stuck run alert fires after threshold

---

## 3. Investigation Procedure

### 3.1 Step 1: Identify the Stuck Run

```bash
# List runs in RUNNING state for more than threshold
harness-cli runs list --state=RUNNING --older-than=2h

# Get run details
harness-cli runs get <run-id>
```

### 3.2 Step 2: Gather Diagnostic Information

```bash
# Get run status and history
harness-cli runs status <run-id>

# Get evidence refs
harness-cli runs evidence <run-id>

# Get logs
harness-cli runs logs <run-id> --tail=100

# Get trace if available
harness-cli runs trace <run-id>
```

### 3.3 Step 3: Identify Root Cause

**Common Causes:**
| Cause | Indicators | Resolution |
|-------|------------|------------|
| Worker crashed | No heartbeat, sudden stop | Check worker health |
| Adapter hung | No progress, logs show wait | Force cancel, restart |
| Resource exhaustion | OOM, CPU maxed | Scale resources |
| External dependency down | Connection errors | Check dependencies |
| Infinite loop | 100% CPU, repeated operations | Force cancel |
| Deadlock | Threads blocked, no progress | Force cancel |

### 3.4 Step 4: Assess Impact

```bash
# Check if evidence was written
harness-cli evidence list --run-id=<run-id>

# Check if cleanup is needed
harness-cli cleanup check --run-id=<run-id>
```

---

## 4. Resolution Procedures

### 4.1 Force Cancel (Safe)

Use when the run can be safely terminated without side effects.

```bash
# Force cancel the run
harness-cli runs cancel <run-id> --force

# Verify cancellation
harness-cli runs status <run-id>
```

**Expected Outcome:**
- Run transitions to CANCELLED
- Evidence of partial execution is preserved
- Cleanup is triggered

### 4.2 Force Cancel with Orphan Cleanup

Use when the run may have left orphaned resources.

```bash
# Cancel and cleanup
harness-cli runs cancel <run-id> --force --cleanup

# List orphaned resources
harness-cli cleanup orphans --run-id=<run-id>

# Delete orphans
harness-cli cleanup delete --orphans=<orphan-list>
```

### 4.3 Manual Intervention

Use when automated cancellation fails.

```bash
# Escalate to manual
harness-cli runs escalate <run-id> --reason="Automated cancellation failed"

# Manual steps (documented per case)
# 1. SSH to worker node
# 2. Kill process tree
# 3. Clean up any remaining resources
# 4. Mark run as CANCELLED in database
```

---

## 5. Post-Incident Procedures

### 5.1 Evidence Preservation

```bash
# Preserve all evidence for analysis
harness-cli evidence preserve --run-id=<run-id> --destination=archive/<run-id>/

# Archive run metadata
harness-cli runs archive <run-id>
```

### 5.2 Root Cause Analysis

Complete RCA template:
- Timeline of events
- Root cause identification
- Contributing factors
- Impact assessment
- Corrective actions
- Preventive actions

### 5.3 Preventive Measures

| Issue | Preventive Action |
|-------|------------------|
| Worker crash | Add health monitoring |
| Adapter hung | Add timeout wrapper |
| Resource exhaustion | Add resource limits |
| External dependency | Add dependency health check |

---

## 6. Escalation Path

| Level | Contact | Response Time |
|-------|---------|--------------|
| L1 | On-call SRE | 15 minutes |
| L2 | QA Lead | 30 minutes |
| L3 | Architecture | 1 hour |
| L4 | VP Engineering | 4 hours |

---

## 7. Related Runbooks

- [Cleanup Failure](./cleanup-failure.md)
- [Provider Outage](./provider-outage.md)
- [Gate Outage](./gate-outage.md)


---

## N. Rectifications Applied 2026-08-02

- Added owner/reviewer/cadence/severity header (Section 16 requirement)
- Marked all shell commands as PSEUDOCODE/PLANNED (Phase 1 implementation pending)
- Added Failsafe Default guidance (zero-tolerance failures block all operations)
- Normalized cross-references to actual paths under `memory-bank-arc/harness/`
