# NeureCore Harness Data Governance v1

**Document ID:** NC-HARNESS-DATA-GOVERNANCE-001
**Version:** 1.1
**Status:** PHASE_0_BASELINE (rectified 2026-08-02)
**Audience:** Security, Compliance, Legal, Architecture, QA
**Decision Owner:** Security + Compliance
**Last Reviewed:** 2026-08-02

---

## 1. Purpose and Scope

This document defines data governance requirements for the NeureCore harness platform, including:
- Data classification for evidence and test artifacts
- Redaction requirements before persistence and display
- Retention policies and schedules
- Legal hold procedures
- Deletion and offboarding requirements

**In Scope:**
- Evidence artifacts (test results, logs, screenshots, videos, traces)
- Test data (tenant data, synthetic data, personal data)
- Audit records (waiver history, approval history, run history)
- Configuration (prompts, rubrics, policies)

**Out of Scope:**
- Production customer data (governed by separate data policy)
- Infrastructure configuration (governed by separate infrastructure policy)

---

## 2. Data Classification

### 2.1 Classification Levels

| Level | Name | Definition | Examples |
|-------|------|-----------|----------|
| **L1** | PUBLIC | No restrictions | Aggregate statistics, certification verdicts |
| **L2** | INTERNAL | NeureCore internal only | Run summaries, test configurations |
| **L3** | CONFIDENTIAL | Need-to-know access | Detailed test results, evidence bundles |
| **L4** | RESTRICTED | Highly sensitive | Tenant data in tests, personal information |
| **L5** | REGULATED | Legal/regulatory requirements | PII, financial data, health data |

The L1–L5 labels are aliases for the canonical `PUBLIC | INTERNAL | CONFIDENTIAL | RESTRICTED | REGULATED` classification (Section 7.1). The aliases exist only for documentation convenience and map 1:1.

### 2.2 Evidence Classification Matrix

| Evidence Type | Default Classification | Notes |
|---------------|----------------------|-------|
| Run outcome (PASS/FAIL) | L2 INTERNAL | |
| Run metadata (IDs, timestamps) | L2 INTERNAL | |
| Assertion results | L3 CONFIDENTIAL | May contain business logic |
| Error messages | L3 CONFIDENTIAL | May contain internal paths |
| Stack traces | L3 CONFIDENTIAL | Contains code structure |
| Screenshots | L4 RESTRICTED | May capture UI data |
| Videos | L4 RESTRICTED | May capture real data |
| API request/response bodies | L4 RESTRICTED | May contain tenant data |
| Logs | L3 CONFIDENTIAL | Must redact PII |
| Trace data | L3 CONFIDENTIAL | May contain correlation IDs |
| Evidence checksums | L2 INTERNAL | |
| Waiver records | L3 CONFIDENTIAL | Contains justifications |
| Certification verdicts | L2 INTERNAL | |
| **Model hidden reasoning / chain-of-thought** | **PROHIBITED** | **Never stored, never displayed** (Section 7.3) |

### 2.3 Classification Decision Tree

```
START
├── Is it model hidden reasoning / chain-of-thought?
│   └── YES → PROHIBITED — never stored
├── Does it contain PII?
│   └── YES → L4 RESTRICTED or L5 REGULATED
├── Does it contain tenant-specific business data?
│   └── YES → L4 RESTRICTED
├── Does it contain internal technical details?
│   └── YES → L3 CONFIDENTIAL
├── Is it aggregate/non-identifying?
│   └── YES → L2 INTERNAL or L1 PUBLIC
└── Default → L3 CONFIDENTIAL
```

---

## 3. Redaction Requirements

### 3.1 PII Fields (Must Redact)

| Field Type | Pattern | Replacement |
|------------|---------|-------------|
| Email addresses | `*@domain.com` | `redacted@example.com` |
| Phone numbers | `***-***-XXXX` | last 4 digits preserved |
| Credit cards | `****-****-****-XXXX` | last 4 digits preserved |
| SSN | `***-**-XXXX` | last 4 digits preserved |
| Names | `[REDACTED]` | anonymized |
| IP addresses | `xxx.xxx.xxx.xxx` | generalized |

### 3.2 Tenant Data — DISTINCT FROM TENANT ID

**CRITICAL DISTINCTION (per Section 7.1 + tenant isolation requirements):**

| Data Type | In Logs | In Evidence | In Screenshots |
|-----------|---------|-------------|----------------|
| **Tenant ID** | **PRESERVE** (correlation required) | **PRESERVE** (tenant isolation + ADR-002 evidence immutability) | **PRESERVE** (audit trail) |
| Tenant name | Generalize | Generalize | Blur/Redact |
| Project names | Generalize | Generalize | Blur/Redact |
| Task descriptions | Generalize | Generalize | Blur/Redact |
| File names | Generalize | Generalize | Blur/Redact |
| URLs with tenant | Generalize | Generalize | Blur/Redact |

**Tenant ID must be PRESERVED in evidence for:**
- Section 7.1 evidence envelope tenant field
- Tenant isolation correlation (EL-018)
- Cross-tenant denial detection
- Audit trail integrity (Section 5.2)
- Replay correctness (ADR-003 — sanitization must preserve tenant context for isolation verification)

Tenant NAMES, project names, task descriptions, file names, and URLs containing tenant context ARE redacted. Only the structured tenant ID is preserved.

### 3.3 Internal Path Redaction

| Pattern Type | Example | Replacement |
|--------------|---------|-------------|
| File paths | `/home/user/...` | `[PATH]` |
| Internal IPs | `192.168.x.x` | `[INTERNAL_IP]` |
| Internal hostnames | `*.internal` | `[INTERNAL_HOST]` |
| Environment variables | `$SECRET_NAME` | `[ENV_VAR]` |

### 3.4 Redaction Implementation Requirements

1. **Pre-Storage Redaction:** All evidence must be redacted before writing to storage
2. **Pre-Display Redaction:** All evidence displayed in UI must be redacted again
3. **Redaction Verification:** Automated tests must verify redaction is effective
4. **No Replay of Raw Data:** Raw (unredacted) data cannot be replayed

### 3.5 Hidden Reasoning — NEVER STORED

Per Section 7.3: "Never store model hidden reasoning; retain concise decision rationale, inputs, outputs, citations, and tool traces."

- **Model hidden reasoning / chain-of-thought is PROHIBITED in evidence.**
- Only concise decision rationale is retained.
- This rule applies before storage and before display.

---

## 4. Retention Policies

### 4.1 Evidence Retention — RECONCILIATION WITH IMMUTABILITY

ADR-002 establishes evidence as immutable: raw artifacts cannot be modified or deleted. This section defines what happens at retention expiry:

| Evidence Type | Production | Staging | CI | Local |
|--------------|------------|--------|-----|-------|
| Test results (passed) | 90 days | 30 days | 14 days | 0 days |
| Test results (failed) | 1 year | 90 days | 30 days | 0 days |
| Screenshots (failed) | 1 year | 90 days | 30 days | 0 days |
| Videos (failed) | 90 days | 30 days | 14 days | 0 days |
| Traces (failed) | 1 year | 90 days | 30 days | 0 days |
| Logs (failed) | 1 year | 90 days | 30 days | 0 days |
| All evidence (critical) | 3 years | 1 year | 90 days | 0 days |

**Retention expiry triggers ARCHIVE not deletion.** Original evidence content is preserved immutably per ADR-002; the retention expiry triggers cold-storage archival. The evidence ENVELOPE (with checksum, classification, correlation IDs) remains accessible for audit purposes indefinitely.

**Cryptographic Erasure:** For L4/L5 evidence subject to legal erasure, the encryption key is destroyed at retention expiry. The encrypted content remains (immutability preserved) but is rendered permanently unreadable. This satisfies both GDPR right-to-erasure AND evidence immutability.

### 4.2 Audit Record Retention (Immutable, NOT subject to retention deletion)

Per ADR-002, audit records are append-only and never deleted:

| Record Type | Retention Period | Rationale |
|-------------|------------------|-----------|
| Run history | 7 years | Certification history + compliance |
| Waiver history | 7 years | Audit trail |
| Approval history | 7 years | Audit trail |
| Certification verdicts | 7 years | Compliance |
| SLO metrics | 1 year (then aggregate only) | Performance history |

### 4.3 Retention Enforcement

1. **Automated Expiration:** Storage layer implements TTL or scheduled archival
2. **Archive Before Expiration:** Evidence is cold-archived (not deleted)
3. **Deletion Verification:** Cryptographic erasure is verified (key destruction)
4. **Deletion Logging:** All archival events logged immutably

---

## 5. Legal Hold Procedures

### 5.1 Legal Hold Triggers

Legal hold may be triggered by:
- Litigation or threatened litigation
- Regulatory investigation
- Internal audit requirement
- Security incident investigation
- Customer contract requirement

### 5.2 Legal Hold Process

1. **Trigger Received:** Legal or Compliance notifies harness team
2. **Scope Defined:** Legal specifies which evidence to preserve
3. **Hold Applied:** Evidence tagged with legal hold flag
4. **TTL Suspended:** Retention TTL-based archival disabled for held evidence
5. **Access Restricted:** Held evidence accessible only to authorized roles
6. **Duration:** Hold remains until explicitly released by Legal

### 5.3 Legal Hold Requirements

```yaml
legalHold:
  immutabilityLevel: ABSOLUTE
  # Cannot be archived, deleted, or moved without Legal approval
  # Even cryptographic erasure keys are preserved

  accessControl:
    - role: LEGAL
      permissions: [READ, EXPORT]
    - role: COMPLIANCE
      permissions: [READ]
    - role: SECURITY (incident related)
      permissions: [READ, EXPORT]

  metadata:
    holdId: string
    triggeredBy: actorId
    triggerReason: string
    triggeredAt: timestamp
    expectedReleaseDate: date
    legalReference: string

  audit:
    allAccess logged immutably
    exports logged with recipient
```

### 5.4 Release from Legal Hold

1. **Release Request:** Legal requests release
2. **Review:** Compliance reviews retention policy
3. **Reclassification:** Evidence reclassified to appropriate retention level
4. **Archival Scheduling:** Normal retention policies resume
5. **Documentation:** Release documented in audit log

### 5.5 Legal Hold Precedence

Legal hold ALWAYS supersedes retention policy and waiver expiry. While under hold:
- TTL archival is suspended
- Waiver expiry does not trigger archival
- Compliance attestation is required for any technical access

---

## 6. Deletion and Offboarding

### 6.1 Deletion Types

| Type | Trigger | Behavior |
|------|---------|----------|
| **Scheduled archival** | TTL expiration | Cold-archive (content preserved, accessibility reduced) |
| **Cryptographic erasure** | Retention expiry for L4/L5 | Encryption key destroyed |
| **Tenant offboarding** | Tenant deletion | Tenant-keyed cryptographic erasure |
| **Legal Hold Release** | Legal release | Reclassified, then normal archival |
| **Emergency** | Security incident | Immediate cryptographic erasure of compromised evidence |

### 6.2 Tenant Offboarding — RECONCILIATION WITH IMMUTABILITY

When a tenant is offboarded:

| Artifact Class | Disposition | Rationale |
|----------------|-------------|-----------|
| Test data for tenant | Cryptographic erasure | GDPR right-to-erasure |
| Evidence artifacts containing tenant DATA | Cryptographic erasure (key rotation) | Tenant data removed |
| **Evidence ENVELOPE structure** | **PRESERVED** | Audit trail integrity |
| **Tenant ID in evidence envelope** | **PRESERVED** | Audit trail (tenant is offboarded, but historical evidence is preserved) |
| Screenshots with tenant information | Cryptographic erasure | Personal data |
| Logs containing tenant data | Cryptographic erasure | Personal data |
| **Audit records** | **PRESERVED** with tenant marked as offboarded | Compliance trail |
| **Waivers associated with tenant** | **PRESERVED** with tenant marked as offboarded | Audit trail |
| **Certifications for tenant capabilities** | **REVOKED** (preserved as historical record) | Capability no longer applicable |

The tenant ID is preserved in evidence envelopes for audit trail integrity, but the ENCRYPTION KEY for tenant-keyed content is destroyed, rendering the underlying tenant data unreadable. This is the cryptographic erasure pattern that satisfies both immutability and right-to-erasure.

### 6.3 Deletion Verification

1. **Deletion Confirmation:** System confirms cryptographic erasure completed
2. **Verification Query:** Attempt to access deleted data (should fail at decryption)
3. **Storage Attestation:** Storage system confirms key destruction
4. **Certificate of Destruction:** For regulated data, certificate issued

### 6.4 Deletion Cannot Be Undone

**CRITICAL:** Cryptographic erasure is permanent. Before erasure:
- Verify retention policy has been followed
- Verify no legal hold is active
- Document erasure in audit log with justification

---

## 7. Data Handling for Test Artifacts

### 7.1 Test Data Classification

| Test Data Type | Classification | Notes |
|----------------|---------------|-------|
| Synthetic data | L2 INTERNAL | Designed for testing |
| Sanitized production data | L3 CONFIDENTIAL | Real data, anonymized |
| Real production data | L5 REGULATED | Requires special handling |
| Public test data | L1 PUBLIC | Benchmarks, open datasets |

### 7.2 Test Data Requirements

1. **Synthetic Data Preferred:** Use synthetic data over real production data
2. **Production Data Sanitization:** Real data must be sanitized before test use
3. **No Production PII in Tests:** PII must never appear in test data without Legal approval
4. **Data Minimization:** Use minimum data necessary for test coverage

### 7.3 Sensitive Data in Test Commands

When tests execute commands that may produce sensitive output:
1. Command is run in isolated environment
2. Output is captured and immediately scanned for PII
3. PII is redacted before evidence creation
4. Raw output is cryptographically erased after verification

---

## 8. Evidence Storage Security

### 8.1 Encryption Requirements

| Evidence Level | At Rest | In Transit |
|---------------|---------|------------|
| L5 REGULATED | AES-256 (tenant-keyed) + per-tenant key rotation | TLS 1.3 |
| L4 RESTRICTED | AES-256 (tenant-keyed) | TLS 1.3 |
| L3 CONFIDENTIAL | AES-128 | TLS 1.2 |
| L2 INTERNAL | AES-128 | TLS 1.2 |
| L1 PUBLIC | None | TLS 1.2 |

### 8.2 Access Control

| Evidence Level | Who Can Write | Who Can Read |
|----------------|---------------|---------------|
| L5 REGULATED | Harness system only | Owner + Security + Compliance + Legal |
| L4 RESTRICTED | Harness system only | Owner + Security + Compliance |
| L3 CONFIDENTIAL | Harness system | Owner + Domain Owner + QA + Security |
| L2 INTERNAL | Harness system | All authenticated users |
| L1 PUBLIC | Anyone | Anyone |

### 8.3 Integrity Protection

- All evidence artifacts include SHA-256 checksum
- Checksums verified on read
- Mismatch triggers security alert
- Evidence is append-only (no modifications)

---

## 9. Compliance Mapping

### 9.1 GDPR Considerations

| Requirement | Implementation |
|-------------|---------------|
| Data minimization | Only collect evidence needed for test |
| Purpose limitation | Evidence used only for testing/certification |
| Storage limitation | Retention policies enforced (archival, not deletion) |
| Right to erasure | Cryptographic erasure (key destruction) |
| Data portability | Evidence export capability (authorized users) |

### 9.2 SOC 2 Considerations

| Trust Principle | Implementation |
|-----------------|---------------|
| Security | Encryption, access controls, integrity |
| Availability | Retention policies, archive backups |
| Processing integrity | Checksums, append-only evidence |
| Confidentiality | Classification, access controls |
| Privacy | Redaction, minimization, cryptographic erasure |

---

## 10. Operational Requirements

### 10.1 Redaction Verification Tests

Automated tests must verify redaction is working:
- Test with known PII input
- Verify PII does not appear in output
- Verify redaction does not break test logic
- Run regularly (CI/CD)

### 10.2 Retention Enforcement Tests

Automated tests must verify retention is enforced:
- Create evidence with known creation date
- Verify TTL is set correctly
- Verify archival occurs after TTL
- Run periodically

### 10.3 Data Classification Tests

Automated tests must verify classification:
- Evidence is classified on creation
- Classification is preserved through processing
- Classification affects storage/retention correctly
- Run periodically

---

## 11. Incident Response

### 11.1 Data Breach Response

If evidence is suspected to be breached:
1. **Contain:** Isolate affected evidence immediately
2. **Assess:** Determine scope of breach
3. **Notify:** Security + Legal + Compliance
4. **Preserve:** Maintain evidence for investigation
5. **Remediate:** Fix vulnerability
6. **Document:** Incident report
7. **Notify Affected:** As required by regulation

### 11.2 Accidental Exposure Response

If evidence is accidentally exposed:
1. **Immediate Recall:** Revoke access if possible
2. **Assessment:** Determine exposure scope
3. **Remediation:** Fix access controls
4. **Documentation:** Incident report
5. **Prevention:** Add controls to prevent recurrence

---

## 12. Related Documents

- `harness-capability-inventory.yaml` - Capability definitions
- `harness-control-matrix.yaml` - Control definitions
- `harness-waiver-policy.md` - Waiver governance
- `harness-threat-model.md` - Threat analysis
- `memory-bank-arc/harness/runbooks/` - Operational runbooks
- `memory-bank-arc/harness/adrs/ADR-002-evidence-immutability.md` - Immutability rules

---

## 13. Honest Assessment

**Current State:**
- Redaction: PARTIAL (logging has some PII redaction, evidence redaction not standardized)
- Retention: NOT ENFORCED (no automated TTL, manual cleanup ad-hoc)
- Legal Hold: NO PROCEDURE (now defined in this document)
- Classification: NOT IMPLEMENTED (framework defined in this document)
- Storage Security: UNKNOWN (encryption at rest not verified)

**Phase 0 Deliverable:**
This policy provides the framework. Implementation requires:
1. Redaction library and integration (Phase 1-2)
2. Retention automation (Phase 2-3)
3. Legal hold procedures and tooling (Phase 7)
4. Classification enforcement (Phase 2)
5. Storage security verification (Phase 1)

**Rectifications Applied 2026-08-02:**
- Resolved tenant-ID redaction conflict: tenant ID is PRESERVED in evidence (not redacted) per Section 7.1, tenant isolation, and ADR-002/003 correlation requirements. Tenant NAMES, project data, file names are redacted.
- Resolved deletion/retention conflict via cryptographic erasure (key destruction preserves immutability while enabling erasure).
- Added L5 REGULATED to encryption and access control tables.
- Added explicit prohibition on storing model hidden reasoning / chain-of-thought (Section 7.3).
- Resolved offboarding conflict: encryption-key erasure preserves immutable audit envelope + historical records.
- Added legal hold precedence over TTL and waivers.
- Set PERMANENT retention to 7+ years for audit records (ADR-002 anchor).

**Status:** FRAMEWORK DEFINED - Implementation pending Phase 1-7