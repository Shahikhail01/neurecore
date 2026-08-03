# NeureCore Harness Threat Model v1

**Document ID:** NC-HARNESS-THREAT-MODEL-001
**Version:** 1.1
**Status:** PHASE_0_BASELINE (rectified 2026-08-02)
**Audience:** Security, Architecture, Engineering, QA
**Decision Owner:** Security + Architecture
**Last Reviewed:** 2026-08-02

---

## 1. Purpose and Scope

This threat model identifies security threats to the NeureCore harness platform and maps controls to mitigate those threats. The model follows the STRIDE methodology and covers the control plane, execution plane, evidence store, replay system, UI, and CI/CD integration.

**In Scope:**
- Harness control plane (orchestration, scheduling, gating)
- Harness execution plane (test adapters, runners, workers)
- Evidence store (persistence, integrity, access)
- Replay system (capture, sanitization, replay)
- Control UI (SuperAdmin interface)
- CI/CD integration

**Out of Scope:**
- Production application security (separate threat model)
- Infrastructure security (separate hardening guide)
- Developer workstation security

---

## 2. System Architecture Overview

### 2.1 Bounded Contexts

```
┌─────────────────────────────────────────────────────────────────┐
│                    HARNESS CONTROL PLANE                        │
│  Catalog -> Scheduler -> Orchestrator -> Gate Engine -> Ledger │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   HARNESS EXECUTION PLANE                       │
│  Test │ Browser │ Agent │ Workflow │ Tool │ RAG │ Security    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       EVIDENCE PLANE                             │
│  Event Stream -> Immutable Artifacts -> Metrics -> Replay       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     GOVERNANCE PLANE                             │
│  RBAC/ABAC │ Tenant Policy │ Compliance │ Reviewer Workflow   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Trust Boundaries and Data Flows

**Trust Zones:**
| Zone | Trust Level | Contents |
|------|-------------|----------|
| External (Internet) | UNTRUSTED | Provider APIs (LLM), webhooks |
| CI/CD | SEMI-TRUSTED | Pipeline secrets, runners |
| Control Plane | TRUSTED | Scheduler, orchestrator, gate engine |
| Execution Plane | TRUSTED | Test adapters, workers |
| Evidence Store | TRUSTED + IMMUTABLE | Append-only evidence, cryptographic checksums |
| Tenant Tenants (per-tenant) | TENANT-ISOLATED | Test fixtures, tenant data |

**Cross-Boundary Data Flows:**

```
External (LLM API)
   │
   │ [HTTPS/TLS, rate-limited, response cache]
   ▼
Control Plane ──[auth, request signing]──► Execution Plane
   │                                            │
   │                                            │ [adapter API, capability-scoped]
   │                                            ▼
   │                                       Test Runner (per-tenant sandbox)
   │                                            │
   │                                            │ [evidence write, signed]
   │                                            ▼
   ├─────────────────────────────────────► Evidence Store (append-only)
   │                                            │
   │                                            │ [read API, integrity verified]
   │                                            ▼
   │                                       Replay Engine (sandboxed)
   │
   └──[gated]──► CI/CD Pipeline
                │
                │ [OIDC, signed]
                ▼
            Release Gate
```

**Critical Crossings:**
1. External → Execution Plane (provider API): response is captured, sandboxed, signed.
2. Execution → Evidence: append-only, checksum, tenant-keyed encryption.
3. CI/CD → Control Plane: OIDC, signed, rate-limited.
4. Replay → External: BLOCKED by default (side-effect firewall).

### 2.3 Component Inventory

| Component | Trust Level | Description |
|-----------|-------------|-------------|
| Catalog | HIGH | Versioned capability/scenario registry |
| Scheduler | HIGH | Run scheduling and queuing |
| Orchestrator | HIGH | Run lifecycle management |
| Gate Engine | CRITICAL | Pass/fail determination |
| Certification Ledger | CRITICAL | Signed verdict storage |
| Test Adapter | MEDIUM | Executes test scenarios |
| Browser Adapter | MEDIUM | Playwright browser automation |
| Agent Adapter | MEDIUM | AI agent execution |
| Evidence Writer | HIGH | Append-only evidence storage |
| Replay Engine | MEDIUM | Failure reproduction |
| Control UI | HIGH | SuperAdmin interface |
| CI/CD Integration | HIGH | Automated gate checking |
| Provider Adapter | MEDIUM | External LLM / API provider |
| Runner Image | HIGH | Container/VM image for test execution |

---

## 3. Threat Model (STRIDE)

### 3.1 Spoofing Threats

| Threat ID | Threat | Affected Component | Likelihood | Impact | Control Mapping |
|-----------|--------|-------------------|------------|--------|-----------------|
| S-001 | Test runner impersonation | Execution Plane | MEDIUM | HIGH | SEC-AUTH-001, mTLS |
| S-002 | Evidence writer impersonation | Evidence Plane | LOW | CRITICAL | mTLS, service accounts |
| S-003 | CI/CD pipeline impersonation | CI/CD | LOW | HIGH | Signed pipelines |
| S-004 | SuperAdmin UI impersonation | Control UI | LOW | CRITICAL | MFA, session |
| S-005 | **Provider API impersonation** | Provider Adapter | MEDIUM | HIGH | Certificate pinning, response signing |

### 3.2 Tampering Threats

| Threat ID | Threat | Affected Component | Likelihood | Impact | Control Mapping |
|-----------|--------|-------------------|------------|--------|-----------------|
| T-001 | Evidence tampering | Evidence Store | LOW | CRITICAL | Append-only, checksums (EVI-002) |
| T-002 | Test result manipulation | Execution Plane | LOW | HIGH | Signed runs |
| T-003 | Certification verdict forgery | Certification Ledger | LOW | CRITICAL | Crypto signing, multi-party |
| T-004 | Replay bundle modification | Replay System | LOW | HIGH | Bundle checksums |
| T-005 | Test fixture poisoning | Test Adapter | MEDIUM | HIGH | Fixture signing |
| T-006 | Policy/rubric modification | Catalog | LOW | HIGH | Version control, approval |
| T-007 | **Supply chain compromise (runner image)** | Runner Image | MEDIUM | CRITICAL | SBOM, signed images, provenance (SLSA) |
| T-008 | **Poisoned dataset / dependency** | Test Adapter | MEDIUM | HIGH | Dependency pinning, signature verification |
| T-009 | **CI runner compromise** | CI/CD | MEDIUM | HIGH | Ephemeral runners, sandbox, attestation |

### 3.3 Repudiation Threats

| Threat ID | Threat | Affected Component | Likelihood | Impact | Control Mapping |
|-----------|--------|-------------------|------------|--------|-----------------|
| R-001 | Deny test execution | Execution Plane | MEDIUM | MEDIUM | Signed runs |
| R-002 | Deny evidence creation | Evidence Plane | MEDIUM | HIGH | Checksums, timestamp authority |
| R-003 | Deny approval action | Control UI | LOW | MEDIUM | Immutable approval audit |
| R-004 | Deny waiver request | Control UI | LOW | LOW | Immutable waiver audit |

### 3.4 Information Disclosure Threats

| Threat ID | Threat | Affected Component | Likelihood | Impact | Control Mapping |
|-----------|--------|-------------------|------------|--------|-----------------|
| I-001 | Cross-tenant evidence access | Evidence Store | LOW | CRITICAL | Tenant isolation, encryption |
| I-002 | PII in evidence | Evidence Plane | MEDIUM | HIGH | Pre-storage redaction |
| I-003 | Secrets exposure in logs | Logging | MEDIUM | HIGH | Secret scanning, redaction |
| I-004 | Test data leakage | Test Adapter | MEDIUM | HIGH | Data minimization, synthetic data |
| I-005 | Model hidden reasoning exposure | Agent Adapter | LOW | HIGH | Decision rationale only |
| I-006 | Prompt/policy exposure | Catalog | LOW | MEDIUM | Access controls, encryption |
| I-007 | **Egress during replay leaking tenant data** | Replay System | MEDIUM | CRITICAL | Side-effect firewall (ADR-003) |
| I-008 | **Snapshot / memory dump** | Runner | LOW | HIGH | Memory encryption, ephemeral runners |

### 3.5 Denial of Service Threats

| Threat ID | Threat | Affected Component | Likelihood | Impact | Control Mapping |
|-----------|--------|-------------------|------------|--------|-----------------|
| D-001 | Evidence store exhaustion | Evidence Plane | MEDIUM | HIGH | Retention, quotas |
| D-002 | Run scheduler overload | Control Plane | MEDIUM | MEDIUM | Rate limiting, queue mgmt |
| D-003 | Test execution timeout abuse | Execution Plane | MEDIUM | MEDIUM | Timeout enforcement |
| D-004 | Replay bundle amplification | Replay System | LOW | HIGH | Bundle size limits |
| D-005 | CI/CD gate blocking | CI/CD | LOW | LOW | Escalation, waiver |
| D-006 | **Cost runaway (LLM usage)** | Provider Adapter | MEDIUM | HIGH | Per-run budgets, concurrency caps |

### 3.6 Elevation of Privilege Threats

| Threat ID | Threat | Affected Component | Likelihood | Impact | Control Mapping |
|-----------|--------|-------------------|------------|--------|-----------------|
| E-001 | Unauthorized test execution | Execution Plane | LOW | HIGH | RBAC, ABAC |
| E-002 | Evidence modification privilege | Evidence Plane | LOW | CRITICAL | Write-once |
| E-003 | Certification signing abuse | Certification Ledger | LOW | CRITICAL | Separation of duties |
| E-004 | Waiver approval abuse | Control UI | LOW | HIGH | Separation of duties |
| E-005 | SuperAdmin privilege abuse | Control UI | LOW | CRITICAL | MFA, audit |
| E-006 | Test isolation bypass | Execution Plane | LOW | HIGH | Containerization |
| E-007 | **Container escape / runner escape** | Runner Image | LOW | CRITICAL | Sandboxing, seccomp, no privileged mode |

---

## 4. Control Plane Threats

### 4.1 Catalog Threats

| Threat | Description | Mitigations |
|--------|-------------|-------------|
| Unauthorized catalog modification | Attacker modifies scenario/policy definitions | Version control, approval workflow, signing |
| Catalog poisoning | Malicious scenarios added | Review process, signing, isolation |
| Version confusion | Old versions used inappropriately | Version pinning, compatibility checks |

### 4.2 Scheduler Threats

| Threat | Description | Mitigations |
|--------|-------------|-------------|
| Run hijacking | Attacker takes over scheduled run | Authentication, authorization, encryption |
| Priority manipulation | Attacker elevates run priority | RBAC, audit logging |
| Queue poisoning | Malicious runs added to queue | Authentication, validation, quotas |

### 4.3 Orchestrator Threats

| Threat | Description | Mitigations |
|--------|-------------|-------------|
| Run cancellation abuse | Attacker cancels legitimate runs | Authorization, audit logging |
| State manipulation | Attacker modifies run state | Immutable state, checksums |
| Timeout manipulation | Attacker extends timeouts | Time limits, monitoring |

### 4.4 Gate Engine Threats

| Threat | Description | Mitigations |
|--------|-------------|-------------|
| Verdict manipulation | Attacker forces pass verdict | Multi-party verification, signing |
| Gate bypass | Attacker skips gate | Mandatory gates, CI/CD enforcement |
| Threshold manipulation | Attacker lowers pass thresholds | Threshold immutability, approval required |

---

## 5. Execution Plane Threats

### 5.1 Test Adapter Threats

| Threat | Description | Mitigations |
|--------|-------------|-------------|
| Test isolation bypass | Tests affect each other | Containerization, clean environments |
| Resource exhaustion | Test consumes excessive resources | Resource limits, monitoring |
| Flaky test abuse | Flaky tests hide real failures | Flake detection, repetition requirements |

### 5.2 Browser Adapter Threats

| Threat | Description | Mitigations |
|--------|-------------|-------------|
| Browser exploitation | Malicious page compromises browser | Sandboxing, browser hardening |
| Session hijacking | Attacker steals browser session | Session isolation, encryption |
| Screenshot leakage | Sensitive data in screenshots | Redaction before capture |

### 5.3 Agent Adapter Threats

| Threat | Description | Mitigations |
|--------|-------------|-------------|
| Prompt injection | Malicious input manipulates agent | Input validation, injection detection |
| Tool abuse | Agent uses tools improperly | Tool authorization, auditing |
| Memory poisoning | Agent memory corrupted | Memory isolation, validation |
| Hidden reasoning exposure | Model chain-of-thought leaks | Reject hidden reasoning in evidence |

### 5.4 Runner Image Threats

| Threat | Description | Mitigations |
|--------|-------------|-------------|
| Supply chain compromise | Runner image contains malicious code | SBOM, signed images, SLSA provenance |
| Container escape | Runner escapes sandbox | seccomp, no privileged mode, user namespaces |
| Stale image | Runner uses outdated vulnerable image | Image refresh policy, CVE scanning |
| Base layer compromise | Base OS image compromised | Minimal base, distroless alternatives |

---

## 6. Evidence Store Threats

### 6.1 Storage Threats

| Threat | Description | Mitigations |
|--------|-------------|-------------|
| Evidence deletion | Attacker deletes evidence | Immutable storage, backups |
| Evidence modification | Attacker modifies evidence | Append-only, checksums |
| Storage exhaustion | Storage filled to cause DoS | Quotas, retention policies, cleanup |

### 6.2 Access Threats

| Threat | Description | Mitigations |
|--------|-------------|-------------|
| Cross-tenant access | Tenant accesses another tenant's evidence | Tenant isolation, access controls |
| Unauthorized export | Evidence exported without approval | Export approval, DLP scanning |
| Evidence enumeration | Attacker guesses evidence IDs | UUIDs, access controls |

---

## 7. Replay System Threats

### 7.1 Capture Threats

| Threat | Description | Mitigations |
|--------|-------------|-------------|
| Sensitive data capture | Replay contains sensitive data | Pre-capture sanitization |
| Side-effect capture | Real side effects recorded | Side-effect firewall during capture |
| Bundle inflation | Excessive data in bundle | Size limits, filtering |

### 7.2 Sanitization Threats

| Threat | Description | Mitigations |
|--------|-------------|-------------|
| Incomplete sanitization | Sensitive data remains in bundle | Automated scanning, manual review |
| False sanitization | Redaction breaks replay | Verification tests |

### 7.3 Replay Threats

| Threat | Description | Mitigations |
|--------|-------------|-------------|
| **Side-effect leakage (production)** | Replay performs real side effects | Side-effect firewall, sandboxed tenant, **PRODUCTION REPLAY FORBIDDEN by default** (ADR-003) |
| Replay amplification | Replay causes excessive load | Resource limits, monitoring |
| Schema mismatch | Old bundle incompatible with new system | Schema versioning, migration |
| Egress during replay | Replay leaks tenant data externally | Network sandbox, DNS redirect |

---

## 8. Control UI Threats

### 8.1 Authentication Threats

| Threat | Description | Mitigations |
|--------|-------------|-------------|
| Credential theft | Attacker steals SuperAdmin credentials | MFA, session management, monitoring |
| Session hijacking | Attacker takes over session | Session encryption, timeout, binding |
| Brute force | Attacker guesses passwords | Rate limiting, lockout |

### 8.2 Authorization Threats

| Threat | Description | Mitigations |
|--------|-------------|-------------|
| Privilege escalation | Attacker gains elevated privileges | RBAC, ABAC, separation of duties |
| Cross-tenant access | Admin accesses wrong tenant | Tenant context enforcement |
| Action authorization bypass | Admin performs unauthorized action | Action-level authorization |

### 8.3 UI-Specific Threats

| Threat | Description | Mitigations |
|--------|-------------|-------------|
| XSS in UI | Malicious script in UI | Input sanitization, CSP |
| CSRF on actions | Attacker triggers admin actions | CSRF tokens |
| Evidence forgery | Admin modifies evidence via UI | Immutable evidence, no edit capability |

---

## 9. CI/CD Integration Threats

### 9.1 Pipeline Threats

| Threat | Description | Mitigations |
|--------|-------------|-------------|
| Pipeline injection | Attacker modifies pipeline | Signed pipelines, secure storage |
| Secret exposure | Credentials in pipeline logs | Secret scanning, masking |
| Gate bypass | Attacker skips CI/CD gates | Mandatory gates, monitoring |

### 9.2 Integration Threats

| Threat | Description | Mitigations |
|--------|-------------|-------------|
| Webhook manipulation | Attacker sends fake webhooks | Signature verification |
| Status spoofing | Attacker fakes test status | Signed results, verification |
| Cache poisoning | Attacker poisons test cache | Cache validation, signing |

---

## 10. Provider / Supply Chain Threats

### 10.1 Provider Threats

| Threat | Description | Mitigations |
|--------|-------------|-------------|
| Provider API drift | Provider changes API | Pinned versions, contract tests |
| Provider compromise | Provider account compromised | Scoped credentials, audit |
| Provider rate-limit denial | Provider throttles calls | Budgets, fallback providers |
| Provider data leak | Provider-side data exposure | Minimal data sent, contract terms |

### 10.2 Dependency / Package Threats

| Threat | Description | Mitigations |
|--------|-------------|-------------|
| Malicious dependency | npm package contains malware | Lock files, signature verification, SCA |
| Dependency confusion | Attacker substitutes package | Namespace pinning, internal registry |
| Typo-squatting | Similar package name used | Approved package list, verification |
| Transitive vulnerabilities | Vulnerable transitive dep | SBOM, regular scanning, CVE tracking |

### 10.3 Runner / Image Threats

| Threat | Description | Mitigations |
|--------|-------------|-------------|
| Stale CVEs | Runner has unpatched CVEs | Image refresh, automated CVE scan |
| Compromised base layer | Base OS compromised | Minimal distroless base, signed images |
| Malicious plugins | Test plugins introduce code | Plugin allowlist, signing |
| Build-time injection | Code injected at build | Reproducible builds, attestations |

---

## 11. Security Requirements Summary

### 11.1 Authentication Requirements

| Requirement | Standard |
|-------------|----------|
| Service-to-service | mTLS + service tokens |
| User authentication | OIDC + MFA for privileged roles |
| CI/CD authentication | Signed pipelines + secrets manager |
| API authentication | Bearer tokens + signature |

### 11.2 Authorization Requirements

| Requirement | Standard |
|-------------|----------|
| Access control model | RBAC + ABAC |
| Tenant isolation | Mandatory tenant context |
| Separation of duties | No self-approval for high-risk |
| Least privilege | Default deny, explicit grant |

### 11.3 Integrity Requirements

| Requirement | Standard |
|-------------|----------|
| Evidence integrity | SHA-256 checksums |
| Evidence immutability | Append-only storage |
| Verdict signing | Cryptographic signatures |
| Audit logging | Immutable append-only log |
| Supply chain | SBOM + signed images + SLSA provenance |

### 11.4 Confidentiality Requirements

| Requirement | Standard |
|-------------|----------|
| Evidence encryption | AES-256 at rest (tenant-keyed for L4/L5) |
| Transport encryption | TLS 1.3 |
| PII redaction | Pre-storage + pre-display |
| Secret protection | No secrets in logs |
| Hidden reasoning | NEVER stored (Section 7.3) |

### 11.5 Availability Requirements

| Requirement | Standard |
|-------------|----------|
| Evidence retention | Configurable TTL per classification |
| Storage quotas | Per-tenant + per-type quotas |
| DoS protection | Rate limiting + resource quotas |
| Backup | Regular backups, tested restoration |

---

## 12. Threat Mitigation Status

| Threat Category | Mitigated | Partial | Missing |
|-----------------|-----------|---------|---------|
| Spoofing | 3 | 2 | 0 |
| Tampering | 4 | 2 | 3 |
| Repudiation | 2 | 1 | 1 |
| Information Disclosure | 3 | 3 | 2 |
| Denial of Service | 2 | 3 | 1 |
| Elevation of Privilege | 3 | 2 | 2 |

**Critical Missing Mitigations (rectification required at Phase 1+):**
- T-001 Evidence tampering detection (depends on EVI-002, EVI-003 in control matrix)
- E-002 Evidence modification prevention (depends on append-only infrastructure)
- T-007 Supply chain runner image signing (Phase 1)
- T-009 CI runner compromise detection (Phase 1)
- I-007 Replay egress protection (ADR-003 firewall — Phase 2)
- I-008 Memory dump prevention (Phase 1)

---

## 13. Testing Requirements

### 13.1 Security Test Categories

| Category | Frequency | Coverage Target |
|----------|-----------|-----------------|
| Tenant isolation tests | Every release | 100% of boundaries |
| Authorization tests | Every release | 100% of actions |
| Evidence integrity tests | Every release | 100% of evidence types |
| PII redaction tests | Every release | 100% of evidence types |
| Penetration testing | Quarterly | All components |
| Red team exercises | Semi-annually | All attack vectors |
| Supply chain scans | Every build | 100% of dependencies |
| Container image scans | Every build | 100% of images |

---

## 14. Related Documents

- `harness-capability-inventory.yaml` - Capability definitions
- `harness-control-matrix.yaml` - Control definitions
- `harness-data-governance.md` - Data governance
- `harness-waiver-policy.md` - Waiver governance
- `harness-slo-policy.yaml` - SLO definitions
- `memory-bank-arc/harness/runbooks/` - Operational runbooks
- `memory-bank-arc/harness/adrs/ADR-003-safe-replay.md` - Replay firewall

---

## 15. Honest Assessment

**Current State:**
- Threat model: NOW DOCUMENTED (Phase 0 deliverable)
- Security testing: PARTIAL (tenant isolation tested, supply-chain and runner integrity pending)
- Evidence integrity: MISSING (depends on append-only infrastructure Phase 2)
- PII redaction: PARTIAL
- Authorization: PARTIAL

**Phase 0 Deliverable:**
This threat model provides the framework. Implementation requires:
1. Security test implementation (Phase 1-7)
2. Evidence integrity mechanism (Phase 2)
3. Comprehensive authorization testing (Phase 1-7)
4. Penetration testing (Phase 7)
5. Red team exercises (Phase 11)
6. Supply chain SBOM + signing (Phase 1)
7. Runner image SLSA attestation (Phase 1)

**Rectifications Applied 2026-08-02:**
- Added asset/data-flow/trust-boundary diagrams
- Added supply chain threats (T-007, T-008, T-009, I-008, E-007)
- Added provider threats (S-005, D-006)
- Added egress-during-replay threat (I-007)
- Mapped every threat to control IDs in control matrix
- Added testing requirements section
- Aligned with zero-tolerance dimensions from SLO policy

**Status:** FRAMEWORK DEFINED - Implementation pending Phases 1-11