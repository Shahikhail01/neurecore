# NeureCore Comprehensive Harness Implementation Plan v1

**Document ID:** NC-HARNESS-ELEMENTS-V1  
**Version:** 1.1  
**Status:** Implementation-ready baseline  
**Audience:** Architecture, Backend, Frontend, AI/ML, QA, Platform/SRE, Security, Compliance, Product  
**Decision owner:** NeureCore Architecture  
**Last reviewed:** 2026-08-02  

## 1. Purpose and Success Definition

This document defines the architecture, controls, sequencing, and acceptance gates required to implement one comprehensive NeureCore AI harness platform spanning all 21 harness elements.

The program succeeds only when NeureCore can answer, with machine-verifiable evidence:

1. What was tested, against which tenant, build, model, prompt, policy, tool, dataset, and environment?
2. Was the result deterministic, statistically evaluated, or human-reviewed?
3. Did the run preserve security, tenant isolation, authorization, audit, and side-effect invariants?
4. Can a failure be reproduced without unsafe re-execution of external effects?
5. Can CI/CD make a trustworthy release decision from immutable evidence?
6. Can an operator inspect, waive, expire, or revoke a certification without changing historical evidence?

This is a reliability plan, not a claim that failures can be eliminated. “Failproof” means fail-closed defaults, bounded blast radius, deterministic evidence, explicit uncertainty, reproducible failures, safe rollback, and no silent pass.

## 2. Scope

The platform covers these 21 elements:

1. Test Harness
2. Evaluation Harness
3. Simulation Harness
4. Regression Harness
5. Browser / E2E Harness
6. Agent Harness
7. Workflow Harness
8. Tool-Calling Harness
9. RAG / Knowledge Harness
10. Prompt Harness
11. Security Harness
12. Compliance Harness
13. Performance Harness
14. Load Harness
15. Observability Harness
16. Certification Harness
17. Failure Replay Harness
18. Tenant Isolation Harness
19. Data Quality Harness
20. Release Gate Harness
21. Human Review Harness

Out of scope for this version: replacing product-domain services, replacing existing test frameworks, or allowing a SuperAdmin UI to mutate test evidence or bypass production authorization.

## 3. Repository-Evidenced Baseline

The plan must extend verified assets instead of inventing parallel systems.

| Asset | Repository evidence | Reuse decision |
|---|---|---|
| Phase 9 certification | `backend/src/test/certification/`, `certify:phase9*` scripts | Adopt as first certification adapter; do not treat simulated execution as full production certification |
| Additional certification suites | parity-v3 and domain-toolset scripts in `backend/package.json` | Register under the common certification catalog |
| G9 reports and dashboard | `backend/src/test/certification/reports/`, certification dashboard script | Migrate output to versioned evidence schema while preserving compatibility |
| Existing certification gap | latest report records 2 certified and 63 uncertified capabilities | Use as initial capability inventory; no aggregate “platform certified” claim |
| Failure injection | `backend/src/test/certification/fixtures/failure-injection.ts` | Extend through an adapter with scoped reset and typed fault plans |
| Tenant isolation | certification negative suites and Phase 8 isolation coverage | Preserve as mandatory gate; expand to all resources and connectors |
| Runtime governance/HITL | `backend/src/modules/work-runtime/`, approval modules, tenant Approval Hub | Reuse domain services through ports; harness must test, not duplicate, approval behavior |
| Browser testing | `frontend-tenant/playwright.config.ts`, tenant tests and SIM-04 runner | Standardize as FE-first browser lane; add Admin/CC coverage separately |
| Simulations | executable SIM-04 through SIM-11 assets and backend SIM-05 scenarios | Convert incrementally to a common manifest; preserve original scenario intent |
| RAG/knowledge | `backend/src/modules/knowledge/` and tenant guards | Add benchmark corpora and retrieval evidence adapters |
| Evaluation/model lifecycle | decision evaluations, scoring v1, model cards | Reuse useful domain scoring; create independent AI-evaluation contracts |
| Rollback/runbooks | model rollback and Phase 9 certification runbooks | Link release gates to tested rollback procedures |

Status language is strict:

- **Implemented:** executable, maintained, evidence-producing, gated, and owned.
- **Partial:** useful code exists but one or more production criteria are absent.
- **Planned:** approved design exists but no accepted implementation.
- **Unknown:** not yet evidenced; unknown never means passed.
- **Deprecated:** retained only for migration and excluded from certification.

## 4. Current Coverage and Required Closure

| Element | Baseline | Critical closure required |
|---|---|---|
| Test | Partial | Common kernel, fixture contracts, test taxonomy, flake controls, environment parity |
| Evaluation | Partial | Versioned rubrics, calibrated graders, golden sets, uncertainty and inter-rater checks |
| Simulation | Partial | Common manifest/runner, state assertions, FE-first classification, scenario coverage map |
| Regression | Partial | Defect-linked immutable corpus, mandatory promotion rules, quarantine expiry |
| Browser / E2E | Partial | HQ and CC critical journeys, accessibility, browser/session matrix, trace/video retention |
| Agent | Partial | Role/ToR, memory, delegation, autonomy, escalation and long-horizon tests |
| Workflow | Partial | Canonical state-machine assertions, compensation, retries, concurrency and recovery |
| Tool-Calling | Partial | Contract catalog, parameter semantics, authorization, failure and side-effect verification |
| RAG / Knowledge | Partial | Ingestion/retrieval benchmarks, grounding, freshness, ACL and deletion propagation |
| Prompt | Weak | Registry, immutable versions, lineage, canary comparison, rollback and secret scanning |
| Security | Partial | Threat model, adversarial corpus, injection/exfiltration, supply-chain and abuse testing |
| Compliance | Partial | Control matrix, evidence mapping, retention/legal hold, consent and jurisdiction tests |
| Performance | Partial | SLOs, representative workloads, percentile and cost regression gates |
| Load | Weak | Production-like concurrent tenant/queue/DB/provider scenarios and soak tests |
| Observability | Partial | End-to-end correlation, telemetry assertions, PII redaction and missing-signal detection |
| Certification | Partial | Capability-level scope, expiry/revocation, provenance, independent verdict service |
| Failure Replay | Missing | Sanitized replay bundle, virtual dependencies, side-effect firewall, schema migration |
| Tenant Isolation | Partial | Exhaustive resource/action/layer matrix including caches, vectors, files and telemetry |
| Data Quality | Partial | Data contracts, drift, lineage, referential/semantic validation and quarantine |
| Release Gate | Partial | Risk-tier policy, branch/deploy integration, waiver governance and rollback validation |
| Human Review | Partial | Policy matrix, reviewer independence, SLA/escalation, evidence quality and fail-closed timeout |

## 5. Non-Negotiable Engineering Protocols

### 5.1 SOLID, Enforced Rather Than Declared

| Principle | Required implementation rule | Enforcement |
|---|---|---|
| Single Responsibility | Runner, evaluator, evidence writer, gate engine, adapters, and UI are separate components | Architecture tests and module dependency checks |
| Open/Closed | Add scenarios, evaluators, adapters, and policies by registration and versioned manifests | Contract tests; core switch statements require architecture approval |
| Liskov Substitution | Local, CI, staging, and provider adapters obey identical behavioral contracts | Shared adapter conformance suites |
| Interface Segregation | Separate execution, evidence, replay, evaluation, policy, and cleanup ports | API review rejects broad service interfaces |
| Dependency Inversion | Orchestration depends on ports; Prisma, Playwright, Redis, queues, LLM SDKs, and storage are adapters | Import-boundary lint/architecture tests |

SOLID does not justify needless interfaces. Introduce an abstraction only at a real variation, test seam, or infrastructure boundary.

### 5.2 Additional Mandatory Properties

- Secure and tenant-scoped by default; missing tenant context is an error.
- Fail closed for authorization, policy, evidence integrity, and release verdicts.
- Idempotent orchestration and cleanup; retries cannot duplicate business effects.
- Immutable raw evidence; corrections create new versions or annotations.
- No secrets, credentials, raw tokens, unnecessary personal data, or hidden chain-of-thought in evidence.
- Explicit provenance for code SHA, build ID, schema, model/provider, prompt, policy, tools, dataset, environment, and evaluator.
- Clock, random seed, IDs, provider responses, and fault schedule are controllable where determinism is required.
- Probabilistic behavior is evaluated statistically, never mislabeled deterministic.
- Destructive and external-write scenarios use disposable tenants or approved sandboxes.
- A harness pass cannot override a product authorization denial.
- Cleanup failure is a run failure and triggers an orphan-resource alert.
- Unknown, skipped, flaky, or infrastructure-error results never silently count as pass.

## 6. Canonical Architecture

### 6.1 Bounded Contexts

```text
Harness Control Plane
  Catalog -> Scheduler -> Orchestrator -> Gate Engine -> Certification Ledger
                 |             |              |
                 v             v              v
Harness Execution Plane
  Test | Browser | Agent | Workflow | Tool | RAG | Security | Load adapters
                 |
                 v
Evidence Plane
  Event stream -> immutable artifacts -> metrics -> replay bundle -> reports
                 |
                 v
Governance Plane
  RBAC/ABAC | tenant policy | compliance | reviewer workflow | waivers/audit
```

The control plane may schedule and observe product behavior, but it must not become a second product workflow engine. Domain assertions use public APIs/events where practical; direct database inspection is limited to dedicated verification adapters.

### 6.2 Required Modules

- `harness-contracts`: schemas and narrow ports only; no framework dependencies.
- `harness-catalog`: versioned capabilities, scenarios, suites, ownership, tags, and dependencies.
- `harness-orchestrator`: lifecycle, cancellation, timeout, retry, concurrency, and cleanup.
- `harness-evidence`: append-only event and artifact metadata; content-addressed checksums.
- `harness-evaluation`: deterministic assertions, statistical evaluators, human-evaluation adapters.
- `harness-replay`: capture, sanitization, dependency virtualization, compatibility migration.
- `harness-policy`: risk classification, required suites, thresholds, waivers, expiry.
- `harness-certification`: independent verdicts, scope, provenance, expiry, revocation.
- `harness-adapters`: Jest, Playwright, provider, Prisma verification, queue, storage, telemetry, and load tools.
- `harness-control-api`: read-first administration endpoints with privileged mutation commands.
- `harness-control-ui`: SuperAdmin visibility and controlled configuration, never evidence mutation.

### 6.3 Core Contracts

Contracts must be runtime-validated and versioned, not TypeScript-only.

```ts
type RunOutcome =
  | 'PASSED' | 'FAILED' | 'BLOCKED' | 'CANCELLED'
  | 'INFRA_ERROR' | 'FLAKY' | 'SKIPPED' | 'UNKNOWN';

interface ScenarioManifest {
  schemaVersion: string;
  scenarioId: string;
  scenarioVersion: string;
  capabilityIds: string[];
  riskTier: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  executionMode: 'DETERMINISTIC' | 'STATISTICAL' | 'HUMAN';
  environmentClass: 'LOCAL' | 'CI' | 'STAGING' | 'PRODUCTION_PROBE';
  requiredFeatures: string[];
  requiredDatasets: DatasetRef[];
  steps: StepManifest[];
  assertions: AssertionManifest[];
  cleanupPolicy: CleanupPolicy;
  evidencePolicy: EvidencePolicy;
}

interface RunProvenance {
  runId: string;
  parentRunId?: string;
  tenantId: string;
  actorId: string;
  codeSha: string;
  buildId: string;
  environmentId: string;
  modelRefs: VersionRef[];
  promptRefs: VersionRef[];
  policyRefs: VersionRef[];
  toolRefs: VersionRef[];
  datasetRefs: DatasetRef[];
  seed?: string;
  startedAt: string;
}

interface HarnessResult {
  schemaVersion: string;
  outcome: RunOutcome;
  assertionResults: AssertionResult[];
  metrics: MetricValue[];
  evidenceRefs: EvidenceRef[];
  cleanupResult: CleanupResult;
  diagnostics: SanitizedDiagnostic[];
}
```

Required state machine:

```text
QUEUED -> PROVISIONING -> RUNNING -> EVALUATING -> CLEANING_UP -> FINALIZED
   |           |            |            |              |
   +---------- failure/cancel/timeout always routes through CLEANING_UP
```

A run is not final until cleanup and evidence finalization complete. Certification consumes only finalized runs.

## 7. Evidence, Replay, and Data Governance

### 7.1 Evidence Envelope

Every evidence item must include schema version, run/scenario/capability IDs, tenant, timestamp, producer, media type, classification, checksum, storage reference, retention class, redaction status, and correlation IDs. Raw artifacts are immutable and encrypted; annotations are append-only.

### 7.2 Replay Bundle

Each critical failure bundle includes:

- sanitized inputs and actor/tenant context;
- model, prompt, policy, tool, workflow, and dataset versions;
- ordered events, timestamps, random seed, feature flags, and fault schedule;
- captured provider/tool responses where licensing and privacy permit;
- expected assertions and original result;
- environment manifest and compatibility version;
- checksum manifest and redaction attestation.

Replay defaults to a side-effect firewall. Email, payments, webhooks, writes to third-party systems, and destructive tools must be stubbed or routed to approved sandboxes. Production replay is forbidden by default.

### 7.3 Privacy and Retention

- Classify evidence as public, internal, confidential, restricted, or regulated.
- Apply field-level redaction before persistence and again before UI display/export.
- Test erasure, retention expiry, legal hold, and tenant offboarding behavior.
- Preserve minimum evidence needed for audit without retaining raw prompts or documents unnecessarily.
- Never store model hidden reasoning; retain concise decision rationale, inputs, outputs, citations, and tool traces.

## 8. Evaluation Protocol

Evaluation must prevent attractive but unreliable scores.

### 8.1 Evaluation Types

- Deterministic assertions: schemas, state, authorization, citations, invariants, exact calculations.
- Reference-based metrics: expected facts, workflow outcomes, tool sequence constraints.
- Model graders: rubric-scored quality where deterministic checks are insufficient.
- Human evaluation: calibrated reviewers for safety, usefulness, ambiguous quality, and regulated decisions.
- Statistical evaluation: repeated trials with confidence intervals for stochastic behavior.

### 8.2 Grader Controls

- Version every rubric, grader prompt, grader model, threshold, and aggregation rule.
- Maintain blinded golden examples including pass, fail, borderline, and adversarial cases.
- Measure agreement against expert labels before promotion and on a scheduled cadence.
- Detect position, verbosity, style, self-preference, and shared-model bias.
- Use at least two independent signals for critical subjective gates; disagreement routes to human review.
- Report sample size, variance, confidence interval, and insufficient-evidence outcomes.
- Never use the same uncalibrated model as both system-under-test and sole judge.

### 8.3 Initial Score Dimensions

Correctness, task completion, grounding/citation, hallucination risk, instruction adherence, policy compliance, tool correctness, business usefulness, safety, latency, and cost. Dimension weights are capability-specific, not globally fixed.

## 9. Per-Element Implementation Requirements

| Element | Required implementation | Minimum release evidence |
|---|---|---|
| Test | Shared fixtures, builders, clocks, IDs, tenant provisioning, cleanup, adapter conformance | Unit/integration/contract results; deterministic rerun; zero orphan resources |
| Evaluation | Versioned datasets/rubrics/graders, calibration, statistical runner, adjudication | Golden-set accuracy, agreement metrics, confidence intervals, rubric provenance |
| Simulation | Manifest/DSL, personas, tenant presets, branching, pre/postconditions, state oracle | Executable scenario, full state/evidence trail, repeatability and coverage mapping |
| Regression | Defect catalog, promotion policy, immutable expected behavior, quarantine controls | Defect-to-test link, reproduced old failure, fixed pass, mandatory gate membership |
| Browser / E2E | FE-first Playwright adapters for HQ and CC, sessions, viewport/browser/accessibility/recovery | Trace, screenshot/video on failure, DOM assertions, backend correlation, no API fallback |
| Agent | ToR/role, memory, delegation/handoff, autonomy budget, escalation, long-horizon and loop tests | Boundary denials, expected completion, memory isolation, bounded steps/cost/time |
| Workflow | State-machine oracle, idempotency, retries, compensation, concurrency, timeout and recovery | Event/state sequence, duplicate suppression, compensation and terminal-state proof |
| Tool-Calling | Tool registry contracts, selection/argument/effect assertions, auth and error taxonomy | Correct tool/version/parameters, policy decision, side-effect and recovery evidence |
| RAG / Knowledge | Ingestion, parsing/chunking, retrieval, reranking, citation, ACL, freshness/deletion tests | Recall/precision-oriented metrics, grounded answer, citation validity, tenant denial |
| Prompt | Immutable registry, templates/variables, lineage, secret/injection scanning, compare/canary/rollback | Prompt diff, evaluation delta, approvals, deployment link and rollback rehearsal |
| Security | Threat-model suites, injection, exfiltration, authn/authz, SSRF, unsafe tools, rate/abuse tests | Zero critical findings, remediated highs, signed exception with expiry for lower risks |
| Compliance | Control-to-test matrix, audit completeness, consent, retention, legal hold, explainability | Control owner attestation and immutable evidence mapped to jurisdiction/product scope |
| Performance | SLO workload profiles, percentiles, cold/warm runs, token/cost/queue/provider breakdown | p50/p95/p99, error rate, cost/task and statistically significant regression verdict |
| Load | Concurrent tenants/agents, queue/DB/cache/provider pressure, spike/stress/soak/recovery | Saturation point, no isolation breach, backlog recovery, resource and error curves |
| Observability | Correlated logs/metrics/traces/events/actions, redaction and telemetry self-tests | Trace completeness, alert delivery, missing-signal detection, no restricted-data leak |
| Certification | Capability registry, evidence resolver, independent gate, signed verdict, expiry/revocation | Capability-scoped certificate with exact provenance and unresolved-risk list |
| Failure Replay | Bundle capture, sanitization, dependency virtualization, schema migration, diff engine | Original failure reproduced or explicit non-replayability reason; safe side-effect proof |
| Tenant Isolation | Resource x action x layer matrix for DB/cache/vector/files/queue/socket/log/export | 100% critical negative matrix; no existence leak; unique tenant correlation proof |
| Data Quality | Contracts, schema/referential/semantic checks, lineage, drift, quarantine and repair | Dataset version, validation report, drift status and downstream impact mapping |
| Release Gate | Risk-tier policies, changed-surface mapping, gate aggregation, waivers, rollback checks | Machine verdict, all required suites finalized, valid waivers, rollback readiness |
| Human Review | Policy routing, independent reviewer, complete evidence packet, SLA/escalation/timeouts | Approve/reject/revise/timeout paths, no self-approval, audit and resume idempotency |

## 10. Phased Delivery Roadmap

Phases are dependency-gated. Calendar estimates must be created only after team capacity and environment constraints are known.

### Phase 0: Governance, Inventory, and Threat Model

**Entry:** architecture and product owners assigned.  
**Deliverables:** capability inventory; owner/RACI; data classification; threat model; risk tiers; SLO candidates; existing-suite truth audit; ADRs for architecture, evidence, replay, and certification.  
**Exit:** all 21 elements have an owner, baseline, dependency map, and measurable definition of done; unsupported certification claims are removed or scoped.  
**Gate:** Architecture + Security + Compliance approval.

### Phase 1: Contracts and Harness Kernel

**Depends on:** Phase 0.  
**Deliverables:** runtime-validated schemas; catalog; lifecycle state machine; run/provenance IDs; deterministic utilities; cancellation/timeouts; cleanup manifests; tenant-aware execution context; adapter conformance kit.  
**Exit:** two heterogeneous existing suites execute through the kernel without losing native detail; crash recovery and idempotency tests pass.  
**Gate:** contract compatibility and architecture tests.

### Phase 2: Evidence, Observability, and Safe Replay Foundation

**Depends on:** Phase 1.  
**Deliverables:** append-only evidence metadata; artifact storage adapter; checksums; redaction; retention; correlation propagation; replay schema; side-effect firewall; evidence viewer API.  
**Exit:** a failed run is traceable end-to-end and replayable in isolation; tampering, missing evidence, redaction failure, and cleanup failure are detected.  
**Gate:** Security/privacy review and disaster-recovery test.

### Phase 3: Unified Test, Regression, and Data Quality

**Depends on:** Phases 1–2.  
**Deliverables:** shared fixture package; deterministic tenant/data builders; defect registry; automatic failure-to-regression workflow; test quarantine with owner/reason/expiry; data contracts and drift checks.  
**Exit:** critical known defects have replayable tests; flaky tests cannot be hidden indefinitely; fixture and cleanup reliability meet agreed thresholds.  
**Gate:** mandatory PR lane enabled for changed critical surfaces.

### Phase 4: Evaluation, Prompt, and RAG/Knowledge

**Depends on:** Phases 1–3.  
**Deliverables:** prompt registry and lineage; curated/versioned evaluation datasets; rubric registry; calibrated graders; RAG ingestion/retrieval/grounding/ACL benchmarks; model/provider comparison and rollback workflow.  
**Exit:** prompt/model/knowledge changes produce comparable reports with uncertainty; critical regressions block promotion; deletion and tenant-isolation propagation pass.  
**Gate:** AI Quality + Security approval.

### Phase 5: Agent, Tool, and Workflow Harnesses

**Depends on:** Phases 1–4.  
**Deliverables:** role/ToR matrices; tool contract catalog; policy-decision oracle; memory and handoff tests; workflow state oracle; side-effect ledger; retry/compensation/concurrency scenarios.  
**Exit:** every production agent role and mutating tool has positive, denial, failure, and recovery tests; loops and budgets are bounded.  
**Gate:** Product-domain owner + Governance approval.

### Phase 6: Simulation and Browser/E2E

**Depends on:** Phases 2–5.  
**Deliverables:** common SIM manifest; migration adapters for SIM-04–SIM-11; FE-first Playwright lanes for HQ and CC; browser/session/responsive/accessibility matrices; state assertions and evidence capture.  
**Exit:** critical business journeys execute without API substitution; UI, backend, tool, event, and evidence traces correlate; known SIM-04 defects remain explicit blockers until fixed.  
**Gate:** critical-journey certification candidate.

### Phase 7: Security, Compliance, Tenant Isolation, and HITL

**Depends on:** Phases 2–6.  
**Deliverables:** adversarial corpus; exhaustive isolation matrix; compliance control matrix; reviewer policy/queue/SLA/escalation tests; abuse and unsafe-action suites.  
**Exit:** zero critical security/isolation failure; regulated controls have evidence; rejected/expired reviews cannot execute; reviewer independence is enforced.  
**Gate:** Security + Compliance sign-off.

### Phase 8: Performance and Load

**Depends on:** stable functional scenarios from Phases 3–7.  
**Deliverables:** workload models; latency/cost/throughput profiles; spike, stress, soak, provider-throttle, queue/DB/cache pressure and recovery tests; capacity report.  
**Exit:** SLO/error-budget thresholds are approved; no correctness or isolation loss under supported load; recovery time is demonstrated.  
**Gate:** SRE/Platform capacity approval.

### Phase 9: Release Gates and Capability Certification

**Depends on:** Phases 0–8 for the capability being certified.  
**Deliverables:** risk-tier gate policy; changed-surface dependency selection; required full-suite schedule; signed capability certificates; expiry/revocation; waiver workflow; rollback certification.  
**Exit:** CI/CD blocks on missing/failed evidence; certificate claims are capability- and environment-scoped; stale evidence cannot authorize deployment.  
**Gate:** independent release verdict.

### Phase 10: SuperAdmin Harness Control Center

**Depends on:** stable APIs and governance from Phases 1–9.  
**Deliverables:** catalog/status dashboard; run launcher; evidence/replay viewer; policy/rubric/prompt/dataset management; approvals; certification and waiver management; audit trail.  
**Exit:** UI cannot mutate raw evidence, forge verdicts, bypass separation of duties, expose tenant data, or launch unsafe production runs; all commands are authorization-tested and audited.  
**Gate:** Security review, usability test, and operational readiness review.

### Phase 11: Production Pilot and Continuous Improvement

**Depends on:** Phase 9; Phase 10 is optional for initial automation.  
**Deliverables:** shadow gates, selected hard gates, incident drills, rollback drill, restore test, operational dashboards, monthly corpus refresh, quarterly control review.  
**Exit:** agreed pilot period completes without silent bypass; incidents generate regression cases; ownership and on-call coverage are operational.  
**Gate:** Production readiness and ongoing governance cadence.

## 11. CI/CD and Release Policy

| Lane | Trigger | Required scope | Blocking behavior |
|---|---|---|---|
| Developer | local/pre-push | affected unit, contract, prompt/data validation | local failure |
| PR fast | every PR | changed-surface deterministic, security, isolation smoke | blocks merge |
| PR AI | AI/prompt/RAG/agent/tool changes | focused eval corpus with baseline comparison | blocks critical regression; flags uncertainty |
| Mainline | merge | integration, workflow, regression, browser smoke | blocks deploy candidate |
| Nightly | scheduled | broad eval, adversarial, browser matrix, replay corpus | creates/updates release blockers |
| Weekly | scheduled | load, soak, full isolation and full SIM matrix | capacity/security blocker |
| Release | candidate | all required risk-tier suites plus rollback drill status | blocks promotion |
| Production probe | post-deploy | read-only/synthetic canaries only | automatic halt/rollback policy |

Gate rules:

- Critical safety, authorization, tenant isolation, audit integrity, or destructive-side-effect failures have zero tolerance.
- Aggregate scores cannot mask a critical dimension failure.
- Baselines are immutable per release candidate; moving thresholds requires reviewed policy change.
- Waivers require scope, owner, reason, compensating control, approvers, issue link, and automatic expiry.
- Flaky, skipped, blocked, infrastructure-error, and insufficient-evidence outcomes are tracked separately and resolved by policy; they are never converted to pass.
- Changed-surface selection accelerates PRs but does not replace scheduled full suites.

## 12. SuperAdmin Control Center Boundaries

A SuperAdmin interface is useful after the underlying harness contracts and governance exist. It should manage configuration and operations, not rewrite history.

Allowed with appropriate permission and separation of duties:

- view capability coverage, runs, evidence, trends, certification scope, and unresolved risks;
- create draft scenario/prompt/rubric/dataset/policy versions;
- request runs in approved environments;
- approve promotion according to workflow;
- revoke certification, issue time-bound waivers, or trigger safe replay;
- manage ownership, retention classes, and notification routing.

Forbidden:

- edit/delete immutable evidence or finalized results;
- change a failed result to passed;
- expose cross-tenant evidence through global search or exports;
- launch destructive production scenarios without an approved run policy;
- self-approve high-risk changes or waivers;
- alter production prompts/policies without versioning, evaluation, approval, and rollback data;
- hard-delete certifications, audit events, or active compliance holds.

Use soft deprecation and cryptographic integrity checks. Break-glass access must be time-bound, separately approved, fully audited, and alert Security.

## 13. Ownership and RACI

| Area | Accountable | Responsible partners | Mandatory reviewers |
|---|---|---|---|
| Kernel/contracts/catalog | Architecture | Platform, QA | Security, domain leads |
| Evaluation/prompt/RAG | AI Quality | Backend, domain SMEs | Security, Product |
| Agent/workflow/tools | Autonomous Work Layer owner | Backend, QA | Governance, domain owner |
| Browser/simulation | QA Automation | Frontend, Backend | Product, Accessibility |
| Security/isolation | Security | Platform, Backend, QA | Architecture |
| Compliance/HITL | Compliance/Governance | Product, Backend, QA | Security, Legal as required |
| Performance/load/observability | SRE/Platform | Backend, AI Quality | Architecture |
| Certification/release gates | Release Engineering | QA, Platform | Independent capability owner |
| Control Center | Platform Product owner | Admin FE, Backend | Security, Compliance, UX |

Every scenario, dataset, rubric, policy, prompt, waiver, and certificate also needs an individual owner and review date.

## 14. Risk Register and Controls

| Risk | Preventive control | Detection/recovery |
|---|---|---|
| False-green simulation | FE-first classification; explicit test doubles | Evidence audit; production-like rerun |
| Flaky AI scores | repetitions, confidence intervals, calibrated graders | Trend alarms; human adjudication |
| Judge bias/contamination | blinded held-out sets; independent signals | agreement/drift review; rotate holdouts |
| Replay repeats real side effects | side-effect firewall and sandbox allowlist | egress monitoring; kill switch |
| Cross-tenant evidence leak | tenant keying, ABAC, encrypted storage | negative matrix; access audit alerts |
| Evidence tampering | append-only records and checksums | integrity verifier; certificate revocation |
| Test data survives cleanup | manifest-driven idempotent cleanup | orphan scan, alert, quarantine environment |
| Provider/model drift | pinned versions where possible; canaries | scheduled benchmark; automatic rollback gate |
| Gate bypass/waiver abuse | separation of duties and expiry | immutable audit; periodic waiver review |
| Harness becomes production dependency | isolated control/execution planes | circuit breakers; product continues safely if harness is unavailable |
| Cost runaway | per-run budgets, concurrency caps, cancellation | cost alerts and automatic stop |
| Sensitive data in telemetry | pre-storage redaction and minimization | DLP scan; purge/incident runbook |
| Schema incompatibility | versioned contracts and migrators | compatibility suite; preserve raw bundle |
| Test poisoning | protected datasets and signed changes | review audit; anomalous score detection |

## 15. Definition of Done

A harness element is **Implemented** only when all conditions hold:

1. Canonical owner, capability mapping, threat considerations, and runbook exist.
2. Contracts are runtime-validated, versioned, and covered by conformance tests.
3. Positive, negative, boundary, failure, cancellation, timeout, retry, and cleanup paths are tested where applicable.
4. Tenant isolation and authorization are enforced at every touched layer.
5. Results include immutable evidence and complete provenance without prohibited sensitive data.
6. Determinism or statistical uncertainty is explicitly measured.
7. CI lane and release policy consume the result.
8. Operational alerts, retention, restore, and schema migration are tested.
9. Known limitations and unsupported environments are visible in the certificate.
10. Independent reviewer accepts the element; self-certification is prohibited for critical capabilities.

Program completion additionally requires:

- all 21 elements meet their definition of done;
- every production capability is mapped to required harness elements and risk tier;
- 100% of critical capabilities hold unexpired, non-revoked certificates;
- zero unresolved critical security, tenant-isolation, authorization, audit-integrity, or duplicate-effect failures;
- critical browser journeys cover both tenant HQ and control-center/admin surfaces as applicable;
- restoration, rollback, provider-outage, queue-recovery, and reviewer-timeout drills pass;
- a quarterly review process owns drift, corpus refresh, waivers, and certificate renewal.

## 16. Required Planning Artifacts

Create and maintain these artifacts before broad implementation:

1. `harness-capability-inventory.yaml`: capability, risk tier, owner, surfaces, dependencies, required suites.
2. `harness-contracts/`: runtime schemas, compatibility policy, conformance fixtures.
3. `harness-control-matrix.yaml`: security/compliance controls mapped to executable checks.
4. `harness-slo-policy.yaml`: thresholds, sample sizes, confidence rules, and error budgets.
5. `harness-waiver-policy.md`: authority, separation of duties, expiry, compensating controls.
6. `harness-data-governance.md`: classification, redaction, retention, legal hold, deletion.
7. `harness-threat-model.md`: control plane, execution plane, evidence store, replay, UI, CI/CD.
8. `harness-migration-map.md`: every existing suite and report mapped to its future adapter and retirement criteria.
9. `harness-runbooks/`: stuck run, cleanup failure, evidence corruption, provider outage, gate outage, replay incident, rollback.

## 17. First Implementation Increment

The first increment should prove the architecture without broad migration:

1. Complete Phase 0 inventory using the report’s 65 known capability records as a starting point.
2. Write ADRs for contracts, evidence immutability, safe replay, and certification authority.
3. Implement runtime schemas and adapter conformance tests.
4. Wrap Phase 9 certification and one Playwright SIM flow as two distinct adapters.
5. Persist correlated, checksummed, redacted evidence for both.
6. Replay one deterministic failure with all external effects blocked.
7. Produce a capability-scoped verdict that distinguishes pass, fail, infrastructure error, skipped, and insufficient evidence.
8. Add a shadow CI gate; do not hard-block releases until false-positive/false-negative behavior is reviewed.

Only after this increment passes architecture, security, and operational review should teams migrate the remaining suites or build the SuperAdmin interface.

## 18. Decision Summary

NeureCore should implement one shared harness platform with specialized adapters, not 21 disconnected products. Certification must remain capability-scoped and evidence-driven. The SuperAdmin interface is valuable as a governed control center, but it is Phase 10 because building it before immutable contracts, evidence, policy, and authorization would create a powerful but unsafe configuration surface.
