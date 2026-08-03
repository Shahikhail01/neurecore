# Runbook: Evidence Corruption

**Document ID:** NC-RUNBOOK-EVIDENCE_CORRUPTION-001
**Version:** 1.1
**Status:** PHASE_0_BASELINE (rectified 2026-08-02)
**Owner:** Security
**Reviewer:** Architecture + Compliance
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

This runbook defines procedures for handling evidence corruption. Evidence corruption includes checksum mismatches, missing evidence, and tampering detection.

---

## 2. Detection

### 2.1 Corruption Indicators

| Indicator | Severity | Description |
|-----------|----------|-------------|
| Checksum mismatch | CRITICAL | Evidence content doesn't match checksum |
| Missing evidence | HIGH | Expected evidence not found |
| Integrity alert | CRITICAL | Tampering detected |
| Evidence verification failure | HIGH | Automated check failed |

### 2.2 Detection Methods

- **Automated:** Evidence verification runs on every read
- **Scheduled:** Periodic integrity scans
- **Manual:** User reports issue

---

## 3. Investigation Procedure

### 3.1 Identify Corrupted Evidence

```bash
# List evidence verification failures
harness-cli evidence verification-failures --last=24h

# Get evidence details
harness-cli evidence get <evidence-id>

# Compare checksums
harness-cli evidence checksum <evidence-id>
harness-cli evidence verify <evidence-id>
```

### 3.2 Assess Scope

```bash
# Check how many evidence items affected
harness-cli evidence corruption-stats --last=7d

# Check if specific run is affected
harness-cli runs get <run-id> --include-evidence

# Check if specific tenant is affected
harness-cli tenants evidence --tenant=<tenant-id>
```

### 3.3 Determine Root Cause

| Cause | Indicators | Evidence |
|-------|------------|----------|
| Storage corruption | Bit rot, disk errors | System logs |
| Network corruption | Transfer errors | Network logs |
| Application bug | Consistent pattern | Code review |
| Tampering | Unauthorized access | Access logs |
| Race condition | Sporadic, concurrent | Timeline analysis |

---

## 4. Response Procedures

### 4.1 CRITICAL: Tampering Suspected

**If tampering is suspected:**

```bash
# 1. ISOLATE immediately
harness-cli evidence isolate <evidence-id>

# 2. Alert security
# security-team@company.com
# PagerDuty: Security on-call

# 3. Preserve for investigation
harness-cli evidence preserve --evidence=<evidence-id> --destination=/secure/ forensics/

# 4. DO NOT delete or modify
# 5. Await security team instructions
```

### 4.2 HIGH: Storage Corruption

```bash
# 1. Mark evidence as corrupted
harness-cli evidence mark-corrupted <evidence-id> --reason="Storage corruption"

# 2. Attempt recovery from backup
harness-cli evidence restore <evidence-id> --source=backup

# 3. If restore fails, mark run for re-execution
harness-cli runs schedule-re-execution <run-id>

# 4. Document incident
harness-cli incidents create --type=evidence-corruption --evidence=<evidence-id>
```

### 4.3 MEDIUM: Missing Evidence

```bash
# 1. Check if evidence is being written
harness-cli evidence status <evidence-id>

# 2. If in progress, wait
# 3. If failed, check error
harness-cli evidence error <evidence-id>

# 4. If permanently missing, attempt re-generation
harness-cli evidence regenerate <evidence-id>

# 5. If cannot regenerate, mark as MISSING
harness-cli evidence mark-missing <evidence-id> --reason="Write failed"
```

---

## 5. Certification Impact

### 5.1 Assess Certification Impact

```bash
# Check if corrupted evidence affects certification
harness-cli certification impact --evidence=<evidence-id>

# List affected certificates
harness-cli certification list --evidence=<evidence-id>
```

### 5.2 Revoke Affected Certificates

```bash
# Revoke certificate if evidence is critical
harness-cli certification revoke <certificate-id> --reason="Evidence integrity compromised"

# Notify stakeholders
harness-cli certification notify <certificate-id> --recipients=<email-list>
```

---

## 6. Recovery Procedures

### 6.1 Restore from Backup

```bash
# List available backups
harness-cli evidence backups --evidence=<evidence-id>

# Restore from primary backup
harness-cli evidence restore <evidence-id> --backup=<backup-id>

# Verify restored evidence
harness-cli evidence verify <evidence-id>
```

### 6.2 Re-execute Run

```bash
# Schedule re-execution (if evidence cannot be recovered)
harness-cli runs re-execute <run-id>

# New run will generate fresh evidence
# Old corrupted evidence is preserved for forensics
```

---

## 7. Post-Incident

### 7.1 Evidence Preservation

```bash
# Archive all related evidence
harness-cli evidence archive --run=<run-id> --destination=archive/<run-id>/

# Maintain original corrupted evidence for forensics
harness-cli evidence preserve-original <evidence-id>
```

### 7.2 Root Cause Analysis

CRITICAL: Complete full RCA including:
- Timeline of access
- Access log analysis
- Code review
- Infrastructure review
- Security assessment

### 7.3 System Hardening

| Finding | Hardening Action |
|---------|-----------------|
| Storage vulnerability | Storage hardening, checksums |
| Access control gap | Add authorization checks |
| Detection gap | Add monitoring |
| Recovery gap | Improve backup strategy |

---

## 8. Related Runbooks

- [Stuck Run](./stuck-run.md)
- [Cleanup Failure](./cleanup-failure.md)
- [Security Incident](../security-incident.md)


---

## N. Rectifications Applied 2026-08-02

- Added owner/reviewer/cadence/severity header (Section 16 requirement)
- Marked all shell commands as PSEUDOCODE/PLANNED (Phase 1 implementation pending)
- Added Failsafe Default guidance (zero-tolerance failures block all operations)
- Normalized cross-references to actual paths under `memory-bank-arc/harness/`
