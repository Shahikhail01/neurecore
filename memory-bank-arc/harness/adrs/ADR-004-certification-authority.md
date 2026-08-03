# ADR-004: Certification Authority

**Document ID:** NC-HARNESS-ADR-004
**Status:** ACCEPTED — Phase 0
**Type:** Architecture Decision
**Authors:** Architecture Team
**Date:** 2026-08-02

---

## 1. Context

The harness platform must provide certification that:
- **Scope is clear:** What was tested, where, when
- **Verdicts are independent:** Not influenced by development
- **Evidence is complete:** All required artifacts present
- **Expiry is enforced:** Certificates don't live forever
- **Revocation is possible:** Bad certificates can be invalidated
- **Finalized-only:** Only finalized runs can be certified (Section 6.3)
- **Insufficient evidence is distinct:** Cannot be silently converted to pass

Currently:
- Certification is claimed based on test runs (the previously-retracted G9 reports showed this pattern)
- Verdicts are based on test pass/fail (no insufficient-evidence distinction)
- No formal certificate structure
- No expiry or revocation mechanism

---

## 2. Decision

Certification will be implemented as an independent, evidence-driven service:

### 2.1 Certificate Structure

```typescript
interface Certificate {
  readonly certificateId: string;
  readonly schemaVersion: string;

  readonly capabilityId: string;
  readonly capabilityVersion: string;
  readonly riskTier: RiskTier;
  readonly environmentScope: EnvironmentScope;
  readonly testSuiteIds: string[];

  readonly runIds: string[];              // Only FINALIZED runs
  readonly evidenceRefs: EvidenceRef[];
  readonly evaluator: EvaluatorInfo;
  readonly evaluationDate: string;

  readonly verdict: CertificateVerdict;   // Includes INSUFFICIENT_EVIDENCE
  readonly score?: Score;
  readonly uncertainty?: Uncertainty;

  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly status: CertificateStatus;

  readonly signatures: Signature[];

  readonly unresolvedRisks: string[];
  readonly caveats: string[];
}

type CertificateVerdict =
  | 'PASSED'                    // All required checks passed
  | 'FAILED'                    // At least one required check failed
  | 'INCONCLUSIVE'              // Conflicting signals; human review required
  | 'BLOCKED'                   // Could not run (e.g., zero-tolerance failure)
  | 'INSUFFICIENT_EVIDENCE';    // Not enough evidence to determine — NEVER converted to pass

type CertificateStatus =
  | 'ACTIVE'           // Valid and current
  | 'EXPIRED'          // Past expiry date
  | 'REVOKED'          // Invalidated
  | 'SUPERSEDED';      // Replaced by newer certificate

interface EnvironmentScope {
  readonly environmentClass: 'LOCAL' | 'CI' | 'STAGING' | 'PRODUCTION_PROBE' | 'PRODUCTION';
  // PRODUCTION permitted only for read-only certification observation (not mutation)
  readonly modelProvider?: string;
  readonly modelVersion?: string;
  readonly buildId?: string;
}
```

### 2.2 Independent Verdict Service

The verdict service is independent of test execution:

```
┌─────────────────────────────────────────────────────────────┐
│                 VERDICT SERVICE                              │
│                                                              │
│  Input:                                                      │
│  - Run results (must be FINALIZED)                           │
│  - Evidence bundles                                          │
│  - Policy rules                                              │
│  - Baseline comparisons                                      │
│                                                              │
│  Process:                                                    │
│  1. Reject non-finalized runs (Section 6.3)                  │
│  2. Evidence integrity verification                          │
│  3. Policy evaluation                                        │
│  4. Baseline comparison                                      │
│  5. Statistical analysis (if applicable)                     │
│  6. Verdict determination                                    │
│  7. Multi-party signature collection (per risk tier)         │
│                                                              │
│  Output:                                                     │
│  - Independent verdict (PASSED|FAILED|INCONCLUSIVE|BLOCKED|  │
│                         INSUFFICIENT_EVIDENCE)               │
│  - Signed certificate                                        │
│  - Detailed rationale                                        │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 Finalized-Only Certification

Per Section 6.3: "Certification consumes only finalized runs."

The verdict service MUST reject any `runId` whose `run.status !== 'FINALIZED'`. This is enforced by:
1. Contract-level check: `runIds[]` must reference FINALIZED runs only
2. Schema-level: `CertificateSchema` could be refined to enforce this (future work)
3. Service-level: Verdict service queries run state before accepting

### 2.4 Certificate Lifecycle

```
┌─────────┐    evaluate     ┌────────────┐    issue    ┌─────────┐
│ RUNNING │ ──────────────▶│ PENDING    │ ──────────▶│ ACTIVE  │
│ (FINAL)│                  │            │             └─────────┘
└─────────┘                └────────────┘                  │
                              │                             │ expire
                              │ reject                     ▼
                              ▼                       ┌──────────┐
                         ┌──────────┐                 │ EXPIRED  │
                         │ REJECTED │                 └──────────┘
                         └──────────┘                       │
                                                            │ revoke
                              ┌─────────────────────────────┘
                              ▼
                         ┌──────────┐                 ┌──────────┐
                         │ REVOKED  │◀────────────────│ SUPERSEDED│
                         └──────────┘   supersede     └──────────┘
```

### 2.5 Expiry Rules

| Certificate Type | Default Expiry | Renewal Required |
|-----------------|----------------|------------------|
| CRITICAL capability | 30 days | Yes |
| HIGH capability | 60 days | Yes |
| MEDIUM capability | 90 days | Yes |
| LOW capability | 180 days | Optional |

Certificates cannot be renewed after expiry. A new evaluation is required.

### 2.6 Insufficient Evidence (Section 11 gate rules)

When a capability is asserted but evidence is missing, incomplete, or inconclusive:
- Verdict MUST be `'INSUFFICIENT_EVIDENCE'`, NOT `'PASSED'`
- Per Section 11: insufficient-evidence outcomes are tracked separately and NEVER converted to pass
- Certificate is issued with status reflecting the gap
- Cannot be used to authorize deployment
- Triggers review by Architecture or Domain Owner

### 2.7 Reviewer Independence (Section 10 + Section 13 RACI)

Per Section 10, an independent capability owner must accept CRITICAL capability certifications. Self-certification is prohibited.

The verdict service enforces:
- The `evaluator` (system that ran evaluation) cannot also be a human signer
- The `actorId` running the verdict request must not appear as a `signerId` on the certificate
- For CRITICAL tier: 6 independent signers required (per ADR-001): EVALUATOR, QA_LEAD, DOMAIN_OWNER, SECURITY, COMPLIANCE, ARCHITECTURE

---

## 3. Consequences

### 3.1 Positive Consequences

- **Clear scope:** Certificates explicitly state what is certified
- **Independent verdicts:** Not influenced by who ran tests
- **Verifiable provenance:** Evidence chain is traceable
- **Risk visibility:** Limitations are documented
- **Expiry enforcement:** Stale certifications don't persist
- **Insufficient evidence distinct:** Cannot be silently passed
- **Finalized-only:** Cannot certify incomplete runs

### 3.2 Negative Consequences

- **Complexity:** Certificate lifecycle adds overhead
- **Migration:** Existing certifications must be migrated or revoked (G9 retraction Phase 0)
- **Renewal burden:** Periodic renewal required

### 3.3 Mitigation

- Provide certificate management tooling
- Automate renewal reminders
- Plan migration carefully (G9 already retracted)

---

## 4. Implementation

### 4.1 Verdict Service

```typescript
interface IVerdictService {
  requestVerdict(request: VerdictRequest): Promise<VerdictRequestId>;
  getVerdictStatus(requestId: VerdictRequestId): Promise<VerdictStatus>;
  issueCertificate(requestId: VerdictRequestId): Promise<Certificate>;
}

interface VerdictRequest {
  readonly runIds: string[];              // Service verifies all are FINALIZED
  readonly capabilityId: string;
  readonly environmentScope: EnvironmentScope;
  readonly policyRefs: string[];
  readonly baselineRef?: string;
}
```

### 4.2 Certificate Store

```typescript
interface ICertificateStore {
  issue(certificate: Certificate): Promise<void>;
  verify(certificateId: string): Promise<CertificateVerification>;
  revoke(certificateId: string, reason: string, approvedBy: string): Promise<void>;
  expire(certificateId: string): Promise<void>;
  list(filter: CertificateFilter): Promise<Certificate[]>;
}
```

### 4.3 Signature Schema

```typescript
type SignerRole =
  | 'EVALUATOR'
  | 'QA_LEAD'
  | 'DOMAIN_OWNER'
  | 'SECURITY'
  | 'COMPLIANCE'
  | 'ARCHITECTURE';

const REQUIRED_SIGNATURES: Record<RiskTier, SignerRole[]> = {
  CRITICAL: ['EVALUATOR', 'QA_LEAD', 'DOMAIN_OWNER', 'SECURITY', 'COMPLIANCE', 'ARCHITECTURE'],
  HIGH: ['EVALUATOR', 'QA_LEAD', 'DOMAIN_OWNER'],
  MEDIUM: ['EVALUATOR', 'QA_LEAD'],
  LOW: ['EVALUATOR'],
};

interface Signature {
  readonly signerId: string;
  readonly signerRole: SignerRole;
  readonly signedAt: string;
  readonly signature: string;
  readonly publicKey: string;
}
```

Runtime enforcement (in `CertificateSchema`):
- `PASSED` verdict requires all required signatures for the risk tier
- `expiresAt` must be after `issuedAt`
- `ACTIVE` status cannot have past expiry
- `PASSED` verdict cannot have any `unresolvedRisks`

---

## 5. Release Gate Integration

### 5.1 Gate Check

```typescript
interface ReleaseGateCheck {
  readonly capabilityId: string;
  readonly requiredVerdict: CertificateVerdict; // PASSED for CRITICAL/HIGH
  readonly requiredExpiry: string;
  readonly certificate: Certificate | null;
  readonly isValid: boolean;
  readonly failureReason?: string;
}
```

### 5.2 Gate Policy

| Risk Tier | Certificate Required | Waiver Allowed |
|-----------|---------------------|----------------|
| CRITICAL | YES (PASSED + multi-sig) | NO |
| HIGH | YES (PASSED) | YES (with approval) |
| MEDIUM | YES (PASSED or INCONCLUSIVE) | YES |
| LOW | NO | YES |

### 5.3 Zero-Tolerance Failure Interaction

If any zero-tolerance dimension (Section 11 + ADR-001 + SLO policy) fails:
- No certificate is issued (verdict = BLOCKED or FAILED)
- No waiver applies (zero-tolerance is non-waivable)
- Release is blocked regardless of any other certificate

---

## 6. Related Documents

- `memory-bank-arc/harness/harness-control-matrix.yaml` - EVI-001..EVI-003 controls
- `memory-bank-arc/harness/harness-capability-inventory.yaml` - Capability definitions and risk tiers
- `memory-bank-arc/harness/harness-waiver-policy.md` - Waiver governance
- `memory-bank-arc/harness/harness-slo-policy.yaml` - Zero-tolerance dimensions
- `memory-bank-arc/harness/runbooks/rollback.md` - Revocation procedures
- `memory-bank-arc/harness/runbooks/gate-outage.md` - Gate outage handling
- `memory-bank-arc/harness/adrs/ADR-001-contracts-authority.md` - Certificate contract

---

## 7. Rectifications Applied 2026-08-02

- Added `INSUFFICIENT_EVIDENCE` verdict (Section 11 — never converted to pass).
- Added `PRODUCTION_PROBE` to environment scope alongside `PRODUCTION` (Section 6.3).
- Added explicit finalized-only certification enforcement.
- Added reviewer independence rules (no self-signing).
- Added `COMPLIANCE` and `ARCHITECTURE` signer roles for CRITICAL tier.
- Added runtime enforcement in `CertificateSchema` (superRefine) for signatures, expiry, and unresolved risks.
- Documented zero-tolerance failure interaction with certification.
- Runbook path corrected.
- Status upgraded from PROPOSED to ACCEPTED for Phase 0.

---

## 8. Review History

| Date | Version | Status | Changes | Author |
|------|---------|--------|---------|--------|
| 2026-08-02 | 1.0 | ACCEPTED | Initial draft + Phase 0 rectifications | Architecture |