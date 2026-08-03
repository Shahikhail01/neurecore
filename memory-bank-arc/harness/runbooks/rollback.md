# Runbook: Rollback

**Document ID:** NC-RUNBOOK-ROLLBACK-001
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

This runbook defines procedures for rolling back harness configurations, evidence, and certifications when issues are discovered post-deployment.

---

## 2. Rollback Types

### 2.1 Rollback Categories

| Type | Scope | Impact | Frequency |
|------|-------|--------|----------|
| Evidence Rollback | Single evidence item | LOW | Rare |
| Certification Rollback | Single certificate | MEDIUM | Rare |
| Configuration Rollback | Harness configuration | HIGH | Rare |
| Policy Rollback | Gate policies | HIGH | Very Rare |
| Full Reset | Everything | CRITICAL | Emergency Only |

### 2.2 Rollback Decision Tree

```
ISSUE DISCOVERED
├── Is it a SECURITY issue?
│   └── YES → IMMEDIATE ROLLBACK (Gate, Evidence)
├── Is evidence integrity compromised?
│   └── YES → ROLLBACK evidence, REVOKE certificates
├── Is configuration incorrect?
│   └── YES → ROLLBACK configuration
├── Is policy incorrect?
│   └── YES → ROLLBACK policy (with approval)
└── Is full reset required?
    └── ONLY if directed by Architecture + Security
```

---

## 3. Evidence Rollback

### 3.1 Evidence Rollback Procedure

```bash
# 1. Identify evidence to rollback
harness-cli evidence list --run=<run-id>

# 2. Check if rollback is possible
harness-cli evidence can-rollback <evidence-id>

# 3. Create rollback point
harness-cli evidence rollback-point <evidence-id>

# 4. Perform rollback
harness-cli evidence rollback <evidence-id> --to=<version>

# 5. Verify
harness-cli evidence verify <evidence-id>
```

### 3.2 Evidence Rollback Limitations

| Evidence Type | Rollback Possible | Notes |
|--------------|-------------------|-------|
| Checksums | YES | Always |
| Metadata | YES | Version preserved |
| Content | NO | Immutable |
| Certificates | YES (revoke) | New version created |

---

## 4. Certification Rollback

### 4.1 Certificate Revocation

```bash
# 1. Identify certificate
harness-cli certification get <certificate-id>

# 2. Verify revocation is needed
harness-cli certification verify <certificate-id>

# 3. Create revocation record
harness-cli certification revoke <certificate-id> \
    --reason="<reason>" \
    --approved-by=<actor-id>

# 4. Notify stakeholders
harness-cli certification notify <certificate-id> \
    --recipients=<email-list>

# 5. Update dependent releases
harness-cli releases re-evaluate --certificate=<certificate-id>
```

### 4.2 Certificate Revocation Reasons

| Reason | Severity | Approval Required |
|--------|----------|------------------|
| Evidence integrity compromised | CRITICAL | Security + Architecture |
| Policy violation | HIGH | Security + Domain Owner |
| False positive discovered | MEDIUM | QA Lead + Domain Owner |
| Capability deprecated | LOW | Domain Owner |

---

## 5. Configuration Rollback

### 5.1 Configuration Rollback Procedure

```bash
# 1. List configuration versions
harness-cli config versions

# 2. Compare versions
harness-cli config diff --from=<version> --to=<version>

# 3. Create rollback plan
harness-cli config rollback-plan --to=<version>

# 4. Execute rollback (requires approval)
harness-cli config rollback --to=<version> --approved-by=<actor-id>

# 5. Verify configuration
harness-cli config verify

# 6. Run health check
harness-cli gate health
```

### 5.2 Configuration Rollback Approval

| Configuration Type | Approval Required |
|-------------------|------------------|
| Test configuration | QA Lead |
| Gate thresholds | Architecture + QA |
| Security policies | Security + Architecture |
| Evidence policies | Security + Compliance |

---

## 6. Policy Rollback

### 6.1 Policy Rollback Procedure

```bash
# 1. List policy versions
harness-cli policy versions

# 2. Identify policy to rollback
harness-cli policy get <policy-id>

# 3. Create rollback request
harness-cli policy rollback-request <policy-id> \
    --to-version=<version> \
    --reason=<reason>

# 4. Approval workflow (see approval matrix)
# 5. Execute rollback after approval
harness-cli policy rollback <policy-id> --to-version=<version>

# 6. Update dependent certificates
harness-cli certification re-evaluate --policy=<policy-id>
```

### 6.2 Policy Rollback Impact

```bash
# Assess impact before rollback
harness-cli policy impact --policy=<policy-id> --to-version=<version>

# Check affected certificates
harness-cli certification list --policy=<policy-id>

# Check affected releases
harness-cli releases list --policy=<policy-id>
```

---

## 7. Emergency Rollback

### 7.1 Emergency Rollback Criteria

Emergency rollback is justified when:
- **CRITICAL security vulnerability discovered**
- **Evidence tampering confirmed**
- **Complete system compromise suspected**
- **Regulatory compliance violation**

### 7.2 Emergency Rollback Procedure

```bash
# 1. Get emergency authorization
# Security + Architecture must approve
# Document authorization in ticket

# 2. Execute emergency rollback
harness-cli emergency rollback --scope=<scope> \
    --reason="<reason>" \
    --ticket=<ticket-id>

# 3. Verify rollback
harness-cli emergency verify

# 4. Notify stakeholders
harness-cli alerts send --severity=CRITICAL \
    --message="Emergency rollback executed: <reason>"

# 5. Document in incident report
```

### 7.3 Emergency Rollback Scope

| Scope | Command | Impact |
|-------|---------|--------|
| Evidence | `--scope=evidence` | Evidence rollback |
| Certificates | `--scope=certificates` | All certificate revocation |
| Configuration | `--scope=config` | Configuration rollback |
| Full | `--scope=full` | Complete system reset |

---

## 8. Post-Rollback

### 8.1 Verification Checklist

```bash
# Verify system health
harness-cli gate health
harness-cli providers health
harness-cli storage health

# Verify configuration
harness-cli config verify

# Verify evidence integrity
harness-cli evidence verify-all

# Verify certificates
harness-cli certification verify-all
```

### 8.2 Stakeholder Communication

| Audience | Message | Channel |
|----------|---------|---------|
| Engineering | Rollback executed, reason X | Slack #engineering |
| QA | Re-certification required | Slack #qa |
| Product | Release timeline impact | Email |
| Security | Security incident response | PagerDuty |
| Management | Incident summary | PagerDuty |

### 8.3 Follow-Up Actions

| Action | Owner | Due |
|--------|-------|-----|
| Root cause analysis | Security | 24 hours |
| Issue remediation | Engineering | 48 hours |
| Re-certification | QA | After fix |
| Incident report | SRE | 72 hours |

---

## 9. Related Runbooks

- [Evidence Corruption](./evidence-corruption.md)
- [Gate Outage](./gate-outage.md)
- [Stuck Run](./stuck-run.md)


---

## N. Rectifications Applied 2026-08-02

- Added owner/reviewer/cadence/severity header (Section 16 requirement)
- Marked all shell commands as PSEUDOCODE/PLANNED (Phase 1 implementation pending)
- Added Failsafe Default guidance (zero-tolerance failures block all operations)
- Normalized cross-references to actual paths under `memory-bank-arc/harness/`
