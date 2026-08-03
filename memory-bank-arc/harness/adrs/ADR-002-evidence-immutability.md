# ADR-002: Evidence Immutability

**Document ID:** NC-HARNESS-ADR-002
**Status:** ACCEPTED — Phase 0
**Type:** Architecture Decision
**Authors:** Architecture Team
**Date:** 2026-08-02

---

## 1. Context

The harness platform must produce evidence that is:
- **Immutable:** Cannot be modified after creation
- **Verifiable:** Tampering is detectable
- **Auditable:** Access is logged
- **Complete:** All required evidence is present

Currently, evidence (test results, reports, certificates) can be:
- Modified after creation
- Deleted without trace
- Created without proper checksums
- Accessed without logging

This undermines certification trust and compliance requirements.

---

## 2. Decision

All harness evidence MUST be immutable with the following properties:

### 2.1 Immutability Rules

1. **Append-Only Creation:** Evidence is created once, never modified
2. **Content Addressing:** Evidence content is identified by its checksum
3. **Tamper Detection:** Any modification is detectable via checksum mismatch
4. **Immutable Metadata:** Evidence metadata is also append-only
5. **Deletion Prevention:** Evidence cannot be deleted, only deprecated

### 2.2 Evidence Schema

```typescript
// Evidence envelope
interface EvidenceEnvelope {
  readonly schemaVersion: string;
  readonly evidenceId: string;           // UUID
  readonly runId: string;                 // Reference to run
  readonly scenarioId: string;             // Reference to scenario
  readonly capabilityId: string;          // Capability tested
  readonly tenantId: string;              // Tenant context
  readonly timestamp: string;             // ISO8601
  readonly producer: string;               // Who created it
  readonly mediaType: string;             // MIME type
  readonly classification: EvidenceClassification;
  readonly checksum: string;             // SHA-256
  readonly storageRef: string;            // Storage location
  readonly retentionClass: RetentionClass;
  readonly redactionStatus: RedactionStatus;
  readonly correlationIds: string[];        // For tracing
}

// Classification levels
type EvidenceClassification =
  | 'PUBLIC'
  | 'INTERNAL'
  | 'CONFIDENTIAL'
  | 'RESTRICTED'
  | 'REGULATED';

// Retention classes
type RetentionClass =
  | 'SHORT_TERM'    // 14 days
  | 'MEDIUM_TERM'    // 90 days
  | 'LONG_TERM'     // 1 year
  | 'PERMANENT';    // 7+ years (audit-trail anchors); cold-archived but never deleted
```

### 2.3 Corrections Instead of Modifications

When evidence needs correction:
1. Original evidence is preserved (immutable)
2. New evidence version is created with reference to original
3. Annotation is created explaining the correction
4. Both original and corrected evidence are accessible

```typescript
// Evidence annotation (new record)
interface EvidenceAnnotation {
  readonly annotationId: string;
  readonly evidenceId: string;          // Original evidence
  readonly annotationType: 'CORRECTION' | 'DEPRECATION' | 'NOTE';
  readonly content: string;             // Explanation
  readonly annotatedBy: string;
  readonly annotatedAt: string;
  readonly annotationChecksum: string;  // For annotation integrity
}
```

---

## 3. Consequences

### 3.1 Positive Consequences

- **Certification trust:** Evidence cannot be tampered with
- **Compliance:** Meets audit requirements
- **Reproducibility:** Historical evidence always available
- **Debugging:** Can always reference original evidence

### 3.2 Negative Consequences

- **Storage growth:** Evidence accumulates, never deleted
- **Correction complexity:** Corrections require new records
- **Legacy migration:** Existing evidence must be migrated or archived

### 3.3 Mitigation

- Implement retention policies to cold-archive old evidence (content remains, accessibility reduced via cryptographic erasure per data-governance)
- Provide clear correction workflow
- Plan legacy migration carefully

---

## 4. Implementation

### 4.1 Storage Layer

```typescript
// Evidence storage adapter
interface IEvidenceStore {
  // Create (append-only)
  create(evidence: EvidenceEnvelope, content: Buffer): Promise<void>;

  // Read (checksum verified)
  read(evidenceId: string): Promise<{ evidence: EvidenceEnvelope; content: Buffer }>;

  // List (filtered by metadata)
  list(filter: EvidenceFilter): Promise<EvidenceEnvelope[]>;

  // Annotate (new record)
  annotate(annotation: EvidenceAnnotation): Promise<void>;

  // Verify integrity
  verify(evidenceId: string): Promise<boolean>;

  // Get annotations
  getAnnotations(evidenceId: string): Promise<EvidenceAnnotation[]>;
}
```

### 4.2 Verification

```typescript
// Evidence verification
async function verifyEvidence(evidenceId: string): Promise<VerificationResult> {
  const { evidence, content } = await store.read(evidenceId);

  // Verify checksum
  const calculatedChecksum = sha256(content);
  if (calculatedChecksum !== evidence.checksum) {
    return {
      valid: false,
      reason: 'CHECKSUM_MISMATCH',
      evidenceId,
      expected: evidence.checksum,
      actual: calculatedChecksum,
    };
  }

  // Check if deprecated
  const annotations = await store.getAnnotations(evidenceId);
  const deprecation = annotations.find(a => a.annotationType === 'DEPRECATION');

  return {
    valid: true,
    evidenceId,
    deprecation: deprecation || null,
  };
}
```

---

## 5. Enforcement

### 5.1 Storage Enforcement

- Storage layer enforces append-only semantics
- No UPDATE or DELETE operations exposed
- Database constraints prevent modification

### 5.2 Audit Logging

```typescript
// All access is logged
interface EvidenceAccessLog {
  readonly accessId: string;
  readonly evidenceId: string;
  readonly accessedBy: string;
  readonly accessType: 'READ' | 'ANNOTATE' | 'VERIFY';
  readonly timestamp: string;
  readonly success: boolean;
  readonly metadata?: Record<string, unknown>;
}
```

---

## 6. Related Documents

- `memory-bank-arc/harness/harness-data-governance.md` - Data classification, retention, cryptographic erasure
- `memory-bank-arc/harness/harness-control-matrix.yaml` - EVI-001, EVI-002, EVI-003 controls
- `memory-bank-arc/harness/runbooks/evidence-corruption.md` - Corruption response

---

## 7. Rectifications Applied 2026-08-02

- `scenarioId` and `capabilityId` are now REQUIRED in evidence envelope (Section 7.1) — runtime schema enforces this.
- `PERMANENT` retention clarified as 7+ years, cold-archived but never deleted.
- Type/Chinese-character typo `归档` corrected to `cold-archive`.
- Runbook path corrected to actual location.
- Status upgraded from PROPOSED to ACCEPTED for Phase 0.

---

## 8. Review History

| Date | Version | Status | Changes | Author |
|------|---------|--------|---------|--------|
| 2026-08-02 | 1.0 | ACCEPTED | Initial draft + Phase 0 rectifications | Architecture |
