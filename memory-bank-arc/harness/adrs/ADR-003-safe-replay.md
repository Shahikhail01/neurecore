# ADR-003: Safe Replay Architecture

**Document ID:** NC-HARNESS-ADR-003
**Status:** ACCEPTED — Phase 0
**Type:** Architecture Decision
**Authors:** Architecture Team
**Date:** 2026-08-02

---

## 1. Context

The harness platform must support failure replay to:
- Reproduce failures without side effects
- Debug issues in isolation
- Verify fixes without risk
- Train teams on failure scenarios

However, naive replay can be dangerous:
- **Side-effect leakage:** Replay might send real emails, trigger webhooks, modify databases
- **Data exposure:** Replay bundle might contain sensitive data
- **Infinite loops:** Replay might trigger cascading failures
- **Resource exhaustion:** Replay might consume excessive resources

Per Section 7.2: **"Production replay is forbidden by default."** This ADR codifies that prohibition.

---

## 2. Decision

Failure replay MUST be safe by design with the following architecture:

### 2.1 Side-Effect Firewall

All external-facing operations are intercepted and stubbed during replay:

```
┌─────────────────────────────────────────────────────────────┐
│                    REPLAY BUNDLE                             │
│  - Sanitized inputs                                         │
│  - Model/prompt versions                                    │
│  - Ordered events                                          │
│  - Expected assertions                                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 SIDE-EFFECT FIREWALL                        │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Email   │  │ Webhooks │  │   APIs   │  │ Database │   │
│  │  Stub    │  │  Stub    │  │   Stub   │  │  Stub    │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                              │
│  Mode: LOG | SIMULATE | BLOCK                               │
│  (NO ALLOW mode — production replay FORBIDDEN)              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   REPLAY EXECUTION                          │
│  - Deterministic execution                                  │
│  - Resource limits                                          │
│  - Network isolation                                        │
│  - Sandbox environment                                     │
│  - Disposable tenant (NOT production tenant)                │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Stub Modes

| Mode | Behavior | Use Case |
|------|----------|----------|
| LOG | Log the action, don't execute | Debugging, auditing |
| SIMULATE | Return mock response | Testing, training |
| BLOCK | Fail with error | Safety net |
| ~~ALLOW~~ | ~~Execute for real~~ | **REMOVED — Section 7.2 prohibits production replay** |

### 2.3 Replay Bundle Schema

```typescript
interface ReplayBundle {
  readonly bundleId: string;
  readonly schemaVersion: string;
  readonly createdAt: string;
  readonly createdBy: string;

  readonly inputs: SanitizedInputs;
  readonly context: ReplayContext;
  readonly events: OrderedEvent[];
  readonly expectedAssertions: Assertion[];
  readonly originalResult: RunResult;

  // Version info
  readonly modelRefs: VersionRef[];
  readonly promptRefs: VersionRef[];
  readonly policyRefs: VersionRef[];
  readonly toolRefs: VersionRef[];
  readonly datasetRefs: DatasetRef[];

  // Environment manifest (Section 7.2)
  readonly environmentManifest: EnvironmentManifest;
  readonly compatibilityVersion: string;
  readonly timestamps: Timestamps;
  readonly faultSchedule: FaultSchedule | null;
  readonly randomSeed: string;
  readonly featureFlags: Record<string, boolean>;

  // Captured provider/tool responses where licensing + privacy permit
  readonly capturedResponses: CapturedResponse[];

  // Integrity
  readonly checksumManifest: ChecksumManifest;
  readonly redactionAttestation: RedactionAttestation;
}

interface SanitizedInputs {
  readonly tenantId: string;          // Tenant ID PRESERVED (Section 7.1 + tenant isolation)
  readonly actorId: string;           // Anonymized
  readonly request: string;           // Sanitized
  readonly parameters: Record<string, unknown>;  // Sanitized
}

interface ReplayContext {
  readonly runId: string;
  readonly scenarioId: string;
  readonly capabilityId: string;
  readonly seed: string;              // For determinism
  readonly featureFlags: Record<string, boolean>;
  readonly faultSchedule: FaultSchedule | null;
}
```

### 2.4 Sanitization Requirements

Per Section 7.3 + Section 7.2: sanitization must preserve tenant ID context (for isolation verification) while redacting tenant NAMES, project data, and sensitive identifiers.

| Data Type | Sanitization | Rationale |
|-----------|--------------|-----------|
| **Tenant ID (UUID)** | **PRESERVE** | Required for tenant isolation correlation |
| Tenant names | Generalize | PII / business confidentiality |
| Project names | Generalize | Business confidentiality |
| Email addresses | Replace with redacted@example.com | PII |
| Phone numbers | Replace with ***-***-XXXX | PII |
| Credit cards | Replace with ****-****-****-XXXX | PCI |
| Names | Replace with [REDACTED] | PII |
| IP addresses | Generalize to xxx.xxx.xxx.xxx | PII |
| File paths | Replace with [PATH] | Internal info |
| API keys | Remove entirely | Secrets |
| Passwords | Remove entirely | Secrets |
| **Model hidden reasoning / chain-of-thought** | **EXCLUDE ENTIRELY** | **PROHIBITED (Section 7.3)** — never stored |

---

## 3. Consequences

### 3.1 Positive Consequences

- **Safe replay:** Side effects are never executed unintentionally
- **Privacy preserved:** PII is never in replay bundles
- **Reproducible:** Same seed produces same results
- **Debuggable:** Full context available for investigation
- **No production risk:** Section 7.2 prohibition enforced

### 3.2 Negative Consequences

- **Limited fidelity:** Cannot test actual external integrations
- **Bundle size:** Sanitization adds overhead
- **Maintenance:** Stub implementations must be kept current

### 3.3 Mitigation

- Regular stub updates when APIs change
- Compression for bundle storage
- Test-double libraries for high-fidelity off-line simulation
- **Production investigation via evidence inspection + tenant offboarding flow instead of production replay**

---

## 4. Implementation

### 4.1 Side-Effect Firewall Service

```typescript
type StubMode = 'LOG' | 'SIMULATE' | 'BLOCK'; // NO 'ALLOW'

interface ISideEffectFirewall {
  configureStub(service: ExternalService, mode: StubMode): void;
  intercept<T>(service: ExternalService, action: string, args: unknown[]): Promise<T>;
  verifyNoRealEffects(): Promise<EffectVerification>;
}

class EmailStub implements IServiceStub {
  readonly service = 'email';

  async intercept(action: string, args: unknown[]): Promise<unknown> {
    switch (this.mode) {
      case 'LOG':
        return { logged: true };
      case 'SIMULATE':
        return this.getSimulatedResponse(action, args);
      case 'BLOCK':
        throw new Error(`[REPLAY BLOCKED] Email action: ${action}`);
    }
    // No 'ALLOW' case — production replay is forbidden by Section 7.2.
  }
}
```

### 4.2 Network Isolation

```typescript
interface NetworkSandbox {
  readonly allowedEgress = [
    'harness-internal',
    'replay-storage',
  ];

  readonly blockedEgress = [
    'internet',     // Cannot reach external services
    'production',   // Cannot reach production
  ];

  readonly dnsRedirects = {
    'api.openai.com': '10.0.0.1',  // Mock server
    'api.anthropic.com': '10.0.0.2',
  };
}
```

### 4.3 Disposable Tenant for Replay

Replay MUST run against a disposable tenant, NOT against a production tenant:

```typescript
interface ReplayExecutionRequest {
  readonly bundleId: string;
  readonly disposableTenantId: string; // Tenant created for replay, not production
  readonly scenarioManifest: ScenarioManifest;
  readonly expectedDuration: string;
}
```

The disposable tenant:
- Has synthetic data only
- Is network-isolated (see 4.2)
- Is destroyed at replay completion
- Has no access to production data or control plane

---

## 5. What Replaces Production Replay

Per Section 7.2, production replay is forbidden. The following are the acceptable alternatives for production failure investigation:

1. **Evidence Inspection:** Read the immutable evidence bundle (ADR-002) including ordered events, timestamps, and captured responses.
2. **Synthetic Replay:** Replay against a disposable tenant with synthetic data (this ADR).
3. **Production Probe (read-only):** Production probe environment (Section 6.3: `'PRODUCTION_PROBE'`) — runs the harness in production for read-only observation, NEVER executes real mutations.
4. **Tenant Offboarding:** For tenant-specific issues, work with the tenant through offboarding to inspect state.

The certification environment enum (`CertificationEnvironmentSchema`) permits `'PRODUCTION'` for read-only certification observation only, NEVER for mutation execution.

---

## 6. Related Documents

- `memory-bank-arc/harness/harness-threat-model.md` - Threats (T-004, T-005, T-006, I-007)
- `memory-bank-arc/harness/runbooks/replay-incident.md` - Incident response
- `memory-bank-arc/harness/harness-data-governance.md` - Data sanitization requirements
- `memory-bank-arc/harness/adrs/ADR-001-contracts-authority.md` - Tenant ID preservation in contracts

---

## 7. Rectifications Applied 2026-08-02

- Removed `ALLOW` stub mode entirely (Section 7.2 prohibits production replay).
- Replaced §5 "Production Replay" with §5 "What Replaces Production Replay" listing acceptable alternatives.
- Added `compatibilityVersion`, `timestamps`, `faultSchedule`, `randomSeed`, `featureFlags` to ReplayBundle per Section 7.2.
- Added `capturedResponses` field per Section 7.2.
- Added explicit "tenant ID PRESERVE" + "tenant names REDACT" distinction per Section 7.1 + tenant isolation.
- Added explicit PROHIBITED storage of model hidden reasoning per Section 7.3.
- Added disposable-tenant requirement (replaces "isolated tenant").
- Status upgraded from PROPOSED to ACCEPTED for Phase 0.

---

## 8. Review History

| Date | Version | Status | Changes | Author |
|------|---------|--------|---------|--------|
| 2026-08-02 | 1.0 | ACCEPTED | Initial draft + Phase 0 rectifications | Architecture |