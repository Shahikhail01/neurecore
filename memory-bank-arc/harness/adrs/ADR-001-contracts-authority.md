# ADR-001: Harness Contracts Authority and Versioning

**Document ID:** NC-HARNESS-ADR-001
**Status:** ACCEPTED — Phase 0
**Type:** Architecture Decision
**Authors:** Architecture Team
**Date:** 2026-08-02

---

## 1. Context

Section 17 (First Implementation Increment) of `harness-elementsv1.md` requires an ADR for **contracts** as a Phase 0 deliverable. Section 6.3 mandates that contracts are runtime-validated and versioned, not TypeScript-only. Section 6.2 requires a `harness-contracts` module containing schemas and narrow ports only — with no framework dependencies.

Without an authoritative contracts decision the harness risks:
- silent schema drift between modules;
- unknown fields silently accepted by permissive Zod objects;
- framework dependencies leaking into the contracts package;
- incompatible versions consumed by downstream adapters;
- environment semantics conflicting across execution, certification, and replay.

---

## 2. Decision

### 2.1 Contracts Module Authority

The `backend/src/harness/contracts/` module is the **single authoritative source** for harness schemas and ports. It contains only:

- Zod schemas (single source of truth for runtime + compile-time);
- TypeScript types derived from schemas (not the other way around);
- Narrow port interfaces (segregated per consumer);
- Version constants and policy metadata.

It **must not** contain:

- Framework imports (NestJS, Prisma, Jest, Playwright);
- I/O code;
- Logging code;
- Side effects;
- Configuration loading.

### 2.2 Strict Validation Policy

All schemas are `.strict()`. Unknown fields are **rejected, not stripped**. Permissive parsing is prohibited because:
- Silent field loss hides integration errors.
- Strict parsing is required for the immutability claim of ADR-002.
- Conformance fixtures must reflect the canonical schema, not a weaker version.

Field-level constraints:
- IDs: `.uuid()` for primary identifiers; opaque strings for refs.
- Timestamps: `.datetime({ offset: true })` (ISO 8601).
- Checksums: regex `^sha256:[a-f0-9]{64}$`.
- Versions: semver regex.
- Storage refs: opaque string validated by storage adapter, not the contract.
- Tenant IDs: `.uuid()` (never redacted in contracts — redaction is a separate evidence-plane policy per `harness-data-governance.md`).

### 2.3 Versioning Policy

Two version axes exist:
- **Schema version** (`schemaVersion: string`): bumped on incompatible changes (added required field, removed field, narrowed enum, changed semantics). Recorded inside every envelope.
- **Module version** (`CONTRACTS_VERSION`): bumped per release; not required inside data.

Compatibility rules:
- Additive optional field: minor bump; old consumers continue to parse.
- Required field added, field removed, or type narrowed: major bump; migrator required.
- Enum value added: minor bump.
- Enum value removed or renamed: major bump.

Compatibility tests live in `contracts.conformance.spec.ts` and are run by Jest on every PR.

### 2.4 Environment Enum Policy

The canonical `ScenarioManifest.environmentClass` enum is **exactly**: `'LOCAL' | 'CI' | 'STAGING' | 'PRODUCTION_PROBE'`. Per Section 6.3, `'PRODUCTION'` is **not** a valid execution environment for the harness.

Certification scope and replay scope use a separate enum (`CertificateSchema.environmentScope.environmentClass`) which may include `'PRODUCTION'` because production *read-only* observation is conceptually distinct from harness execution.

### 2.5 State Machine Authority

`VALID_TRANSITIONS` is exported from the contracts module. Per Section 6.3:

```
QUEUED -> PROVISIONING -> RUNNING -> EVALUATING -> CLEANING_UP -> FINALIZED
```

Failure / cancel / timeout from any non-final state **must route through CLEANING_UP**. `EVALUATING -> FINALIZED` is prohibited. `CLEANING_UP -> RUNNING` is prohibited. `validateTransition` throws on unknown current state (no silent false).

Certification (per ADR-004) must reject non-finalized runs.

### 2.6 Adapter Conformance Policy

Adapters must:
- import only from `@harness/contracts` and authorized adapter ports;
- pass the adapter conformance kit (Section 6.2);
- surface conformance failures as `UNKNOWN` (Section 6.3 — never silently counted as pass).

### 2.7 Unknown and Insufficient Evidence Outcomes

`RunOutcome` includes `'UNKNOWN'` for adapter-level ambiguity. ADR-004 introduces `'INCONCLUSIVE'` for evidence-level ambiguity. Neither ever converts to `'PASSED'` per Section 11 gate rules.

---

## 3. Consequences

### 3.1 Positive

- Single authority eliminates drift.
- Strict parsing surfaces integration regressions at validation time.
- Versioning rules let adapters negotiate compatibility without per-call coordination.
- Forbidden states are unrepresentable at runtime.

### 3.2 Negative / Mitigations

- Strict schemas break callers that depend on silent field tolerance — mitigated by migration tooling and conformance fixtures.
- Two environment enums add cognitive load — mitigated by naming and ADR linkage.

---

## 4. Compliance

| Section 17 requirement | Satisfied by |
|---|---|
| ADR for contracts | This document |
| Runtime schemas | `backend/src/harness/contracts/index.ts` |
| Adapter conformance tests | `backend/src/harness/contracts/contracts.conformance.spec.ts` (renamed for Jest discovery) |

---

## 5. Related

- `ADR-002` Evidence Immutability — relies on strict schemas.
- `ADR-003` Safe Replay — relies on `RunProvenance` and `EnvironmentScope` versioning.
- `ADR-004` Certification Authority — relies on finalized-only certification.
- `harness-capability-inventory.yaml` — owners and element mapping.
- `harness-runbooks/cleanup-failure.md` — failure-to-cleanup routing.

---

## 6. Review History

| Date | Version | Status | Author |
|------|---------|--------|--------|
| 2026-08-02 | 1.0 | ACCEPTED (Phase 0) | Architecture |