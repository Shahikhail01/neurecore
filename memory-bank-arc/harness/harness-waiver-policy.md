# NeureCore Harness Waiver Policy v1

**Document ID:** NC-HARNESS-WAIVER-POLICY-001
**Version:** 1.1
**Status:** PHASE_0_BASELINE (rectified 2026-08-02)
**Audience:** Architecture, Security, Compliance, QA, Product, Release Engineering
**Decision Owner:** Architecture + Security + Compliance
**Last Reviewed:** 2026-08-02

---

## 1. Purpose and Scope

This policy governs the issuance, governance, and expiration of waivers for harness test failures, SLO violations, and control deficiencies. Waivers are temporary exceptions that allow limited, controlled deviation from established quality and security requirements.

**In Scope:**
- Test failures in CI/CD pipelines
- SLO threshold violations (non-zero-tolerance only)
- Control deficiencies in the control matrix
- Missing evidence for certification
- Timed-out or skipped tests

**Out of Scope:**
- **All zero-tolerance dimensions (Section 11)** — never waivable
- Regulatory compliance requirements that conflict with law
- Existing certifications that have already been issued

---

## 2. Guiding Principles

1. **Fail-Closed Defaults:** The default posture is to fail. Waivers are exceptions, not the norm.

2. **Temporary by Design:** Every waiver has an expiration date. Old waivers do not auto-renew.

3. **Explicit Uncertainty:** A waiver acknowledges that the system may have unknown risks. This must be visible.

4. **Compensating Controls:** A waiver without compensating controls is not acceptable.

5. **Separation of Duties:** The person who identifies the issue cannot approve the waiver.

6. **Tamper-Evident:** Waiver history is immutable. Modifications create new records; old records are preserved.

7. **No Pass Conversion:** Per Section 11, waived results NEVER convert to pass or certification evidence. They are tracked separately and resolved by policy.

---

## 3. Zero-Tolerance — NEVER Waivable

The following are **never waivable** under any circumstance (Section 11 + Section 14 zero-tolerance):

- **Tenant isolation failures** (cross-tenant data access)
- **Authorization bypasses**
- **Audit integrity failures** (including evidence tampering)
- **Duplicate business effects** (idempotency failures)
- **Destructive side effects**
- **AI self-approval**
- **Secrets/credentials exposure**
- **Unencrypted sensitive data at rest or in transit**

Zero-tolerance failures block release immediately. There is no waiver class, no approver set, and no escalation path. These are policy invariants.

---

## 4. Waiver Types and Authority (Non-Zero-Tolerance Only)

### 4.1 Waiver Classification by Severity

| Waiver Type | Risk Level | Required Approvers | Max Duration | Renewable |
|-------------|------------|-------------------|--------------|----------|
| HIGH | HIGH | Security + Architecture | 30 days | Up to 3 renewals |
| MEDIUM | MEDIUM | QA Lead + Domain Owner | 14 days | Up to 3 renewals |
| LOW | LOW | QA Lead | 7 days | Up to 3 renewals |
| INFRASTRUCTURE | OPERATIONAL | SRE Lead | 48 hours | Up to 2 renewals |

**CRITICAL tier cannot be waived.** Any failure classified as CRITICAL under zero-tolerance dimensions is rejected by policy; no waiver class exists for CRITICAL failures that fall under zero-tolerance. The only "UNSAFE" / "CRITICAL" entries are declarative reminders that those failure categories are NEVER waivable.

### 4.3 Approval Authority Matrix

| Risk Tier | Developer | QA Lead | Domain Owner | Security | Architecture | Compliance | Legal |
|-----------|-----------|---------|--------------|----------|--------------|------------|-------|
| LOW | Request | Approve | Notify | Notify | Notify | - | - |
| MEDIUM | Request | Approve | Approve | Notify | Notify | - | - |
| HIGH | Request | Recommend | Recommend | Approve | Approve | - | - |

Note: CRITICAL row removed — CRITICAL failures under zero-tolerance cannot be waived.

---

## 5. Waiver Request Requirements

### 5.1 Required Fields

Per Section 11: "Waivers require scope, owner, reason, compensating control, approvers, issue link, and automatic expiry."

Every waiver request must include:

```yaml
waiverRequest:
  waiverId: string (auto-generated UUID)
  createdAt: ISO8601 timestamp
  createdBy: actorId

  # What is being waived (scope)
  scope:
    testId: string
    controlId: string (optional)
    sloId: string (optional)
    suiteName: string
    environment: LOCAL | CI | STAGING | PRODUCTION

  # Why it's being waived
  justification:
    reason: string (min 50 characters)
    businessImpact: string (min 50 characters)
    userImpact: string (min 50 characters)

  # Risk acceptance
  riskAcknowledgment:
    isKnownRisk: boolean
    riskDescription: string
    compensatingControls: string[]

  # Duration
  requestedExpiry: ISO8601 date
  renewalCount: 0..3
  renewalEligible: boolean

  # Approval chain
  approvals: []

  # REQUIRED: issue link (per Section 11)
  issueLink: string  # URL to tracked issue, mandatory
  
  # Evidence
  evidence:
    screenshots: string[]
    logs: string[]
    runIds: string[]
```

### 5.2 Justification Quality Standards

**Insufficient Justifications (will be rejected):**
- "This is a known issue"
- "Time pressure"
- "Works in production"
- "False positive"
- "Not critical"

**Acceptable Justifications:**
- "Feature X is deprecated and being replaced in Sprint Y; maintaining test would require rework exceeding value"
- "Third-party provider API changed behavior; vendor ticket opened; workaround in place for 30 days"
- "Test is racy under high concurrency; race condition exists in production and is tracked as BUG-123"

### 5.3 Compensating Controls

At least one compensating control is required:

| Control Type | Examples |
|--------------|----------|
| DETECTIVE | Enhanced monitoring for the failing condition |
| PREVENTIVE | Manual review step added to process |
| CORRECTIVE | Rollback plan documented and tested |
| COMPENSATING | Alternative verification method in place |

### 5.4 Issue Link Requirement

Per Section 11, every waiver MUST include `issueLink` (URL to tracked issue). Waivers without an issue link are rejected at intake. The issue must remain open until the waiver expires or is resolved.

---

## 6. Waiver Workflow

### 6.1 States

```
DRAFT → PENDING_REVIEW → APPROVED → ACTIVE → EXPIRED/REVOKED
                ↓
            REJECTED
```

### 6.2 State Transitions

| State | Who Can Transition | Action |
|-------|-------------------|--------|
| DRAFT | Requester | Submit for review |
| PENDING_REVIEW | Approvers | Approve or Reject |
| APPROVED | Requester | Activate (after confirming controls) |
| ACTIVE | System | Monitor until expiry |
| EXPIRED | System | Automatic state change |
| REVOKED | Security/Architecture | Emergency revocation |

### 6.3 Approval Workflow

1. **Requester** creates waiver request with all required fields
2. **System** validates completeness and assigns risk tier
3. **System** rejects if failure category is zero-tolerance
4. **Required Approvers** receive notification
5. **Each Approver** approves or rejects with comments
6. **If All Required Approvers Approve:** → APPROVED
7. **If Any Required Approver Rejects:** → REJECTED
8. **Requester** activates waiver (confirms compensating controls in place)
9. **System** monitors for expiry

### 6.4 Emergency Revocation

Security or Architecture may revoke a waiver at any time if:
- New information reveals the risk is higher than initially assessed
- Compensating controls are not being maintained
- The waiver is being abused

Emergency revocation requires:
- Written justification
- Immediate notification to requester
- Incident report filed

---

## 7. Waiver Visibility and Audit

### 7.1 Visibility Rules

| Role | Can View |
|------|----------|
| Requester | Own waivers |
| QA Lead | All waivers in their domain |
| Domain Owner | Waivers affecting their domain |
| Security | All waivers |
| Architecture | All waivers |
| Compliance | All waivers |
| SuperAdmin | All waivers |

### 7.2 Audit Requirements

All waiver events are logged immutably:
- Creation
- State transitions
- Approval/rejection with comments
- Activation
- Expiry
- Revocation

### 7.3 Reporting

- **Weekly:** Waiver summary to Security and Architecture
- **Monthly:** Waiver trend analysis to Compliance
- **Per-Release:** Waiver impact on release certification

---

## 8. Waiver Limits

### 8.1 Active Waiver Limits

| Scope | Limit | Rationale |
|-------|-------|-----------|
| Per test ID | 1 active | Multiple waivers for same test = test is broken |
| Per domain | 5 active | Prevent domain from habitually waiving |
| Per release | 10 active | Prevent release from depending on waivers |
| Per SLO | 1 active | SLO waivers affect certification |

### 8.2 Renewal Limits

- **MAX Renewals:** 3 per waiver (per type)
- **Renewal requires:** Updated justification, evidence of progress on fix
- **Final Renewal:** After 3 renewals, issue must be resolved or test removed

---

## 9. Waiver Integration with CI/CD

### 9.1 Gate Behavior

| Waiver Status | CI/CD Behavior |
|---------------|----------------|
| DRAFT | Ignored |
| PENDING_REVIEW | Fail with "waiver pending" |
| APPROVED | Pass (with warning) |
| ACTIVE | Pass (with visibility) |
| EXPIRED | Fail with "waiver expired" |
| REVOKED | Fail immediately |

### 9.2 Failed Test with Active Waiver

When a test fails but has an active waiver:
1. Test reports as **WAIVED** (not PASSED or FAILED)
2. Evidence of waiver displayed in report
3. Waiver ID and expiry visible
4. Failure count preserved for metrics
5. **Waived results NEVER convert to PASSED** (Section 11)

### 9.3 Waiver in Release Certification

- Active waivers reduce certification confidence score
- WAIVED tests do not count toward pass rate
- Release cannot proceed with any active waivers on zero-tolerance dimensions
- WAIVED tests must be less than 5% of total tests

### 9.4 Zero-Tolerance Dimensions Always Block

Zero-tolerance failures (Section 3) cannot be waived. CI/CD must fail-closed on these regardless of any pending waiver.

---

## 10. Specific Waiver Scenarios (Non-Zero-Tolerance Only)

### 10.1 Flaky Test Waiver

**Definition:** Test that fails non-deterministically without code changes

**Requirements:**
- Evidence of flakiness (multiple runs with intermittent failures)
- Root cause investigation (not just "it's flaky")
- Plan to fix or remove test
- Maximum duration: 14 days (MEDIUM)

**Note:** Per Section 11, flaky / unknown / infra-error outcomes are tracked separately and never converted to pass.

### 10.2 Environment-Specific Failure

**Definition:** Test fails in CI but passes locally or in staging

**Requirements:**
- Evidence showing environment difference
- Investigation of root cause
- Plan to fix environment parity
- Maximum duration: 30 days (HIGH)

### 10.3 Third-Party Dependency Failure

**Definition:** Test fails due to external service (vendor API, OAuth provider, etc.)

**Requirements:**
- Vendor ticket or issue reference
- Workaround identified
- Fallback plan if vendor is down
- Maximum duration: 90 days, renewable with vendor communication (HIGH)

### 10.4 Performance Regression

**Definition:** Test fails due to performance regression (latency, throughput)

**Requirements:**
- Performance metrics before and after
- Investigation of root cause
- Performance improvement plan
- SLO impact assessment
- Maximum duration: 30 days (HIGH)

---

## 11. Anti-Patterns (Prohibited)

The following are explicitly prohibited:

1. **Waiver Stacking:** Creating multiple waivers for same issue to avoid limits
2. **Blanket Waivers:** Waiving entire suites without individual assessment
3. **Perpetual Waivers:** Renewing waivers indefinitely without fixing issues
4. **Self-Approval:** Approving your own waivers
5. **Retroactive Waivers:** Approving waivers after the release has shipped
6. **Waiver Shopping:** Submitting to multiple approvers until one approves
7. **Justification Inflation:** Padding justifications to pass review
8. **Zero-Tolerance Waiver Attempts:** Submitting waivers for any zero-tolerance dimension

---

## 12. Exceptions to This Policy

Any exceptions to this policy require:
- Architecture + Security + Compliance + Legal approval
- CEO sign-off for CRITICAL exceptions
- Documented in incident report

---

## 13. Policy Review

**Review Frequency:** Quarterly

**Review Owners:** Architecture + Security + Compliance

**Change Process:**
1. Proposed changes submitted to Architecture
2. Impact assessment conducted
3. Stakeholder review (2 weeks)
4. Policy update published
5. Training/update communications

---

## 14. Related Documents

- `harness-capability-inventory.yaml` - Capability definitions
- `harness-control-matrix.yaml` - Control definitions
- `harness-slo-policy.yaml` - SLO definitions (zero-tolerance dimensions)
- `harness-data-governance.md` - Data classification
- `harness-threat-model.md` - Threat analysis
- `memory-bank-arc/harness/runbooks/` - Operational runbooks

---

## 15. Definitions

| Term | Definition |
|------|------------|
| **Waiver** | Temporary exception to a non-zero-tolerance harness requirement |
| **Flaky Test** | Non-deterministic test that passes and fails without code changes |
| **Compensating Control** | Alternative measure that reduces risk when primary control fails |
| **Evidence** | Artifacts (screenshots, logs, run IDs) supporting waiver request |
| **Active Waiver** | Approved and activated waiver currently in effect |
| **Renewal** | Extension of waiver expiry date |
| **Zero-Tolerance Dimension** | Failure category that cannot be waived under any circumstance |
| **Issue Link** | Required URL to tracked issue preventing waiver acceptance |

---

## 16. Honest Assessment

**Current State:**
- No formal waiver policy exists
- Ad-hoc exceptions granted without documentation
- No tracking of waivers across releases
- No visibility into waiver patterns

**Phase 0 Deliverable:**
This policy provides the framework. Implementation requires:
1. Waiver tracking system (Phase 1)
2. CI/CD integration (Phase 1)
3. Dashboard visibility (Phase 10)
4. Automation of approval workflow (Phase 10)

**Rectifications Applied 2026-08-02:**
- Removed CRITICAL/UNSAFE waiver classes entirely (zero-tolerance dimensions cannot be waived)
- Added mandatory `issueLink` field per Section 11
- Added explicit "no pass conversion" rule for waived results
- Added zero-tolerance dimension cross-reference to SLO policy
- Aligned HIGH waiver rule with HIGH risk tier only (no HIGH→release contradiction)
- Fixed production environment terminology to align with Section 6.3 (uses `PRODUCTION_PROBE` for harness, separate `PRODUCTION` for certification scope per ADR-001)

**Status:** FRAMEWORK DEFINED - Implementation pending Phase 1