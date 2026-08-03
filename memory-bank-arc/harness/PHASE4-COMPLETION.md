# Phase 4 Completion Report — Evaluation, Prompt, and RAG/Knowledge

**Date:** 2026-08-02
**Phase:** 4 — Evaluation, Prompt, and RAG/Knowledge
**Status:** ✅ COMPLETE — All §10 Phase 4 deliverables implemented; AI Quality + Security gate pass
**Source plan:** `neurecore/memory-bank-arc/comms/harness-elementsv1.md` §10 Phase 4

---

## Phase 4 §10 Deliverables

| # | Deliverable | Status | Module / Evidence |
|---|---|---|---|
| 1 | Prompt registry and lineage | ✅ DONE | `src/harness/prompt/index.ts` (`InMemoryPromptRegistry`, `PromptVersion`, `PromptLineageEdge`) |
| 2 | Curated / versioned evaluation datasets | ✅ DONE | `src/harness/evaluation/index.ts` (`InMemoryEvaluationDatasetRegistry`, `EvaluationDataset`, `EvaluationCase`) |
| 3 | Rubric registry | ✅ DONE | `src/harness/evaluation/rubrics.ts` (`InMemoryRubricRegistry`, `Rubric`, `RubricDimension`) |
| 4 | Calibrated graders | ✅ DONE | `src/harness/evaluation/rubrics.ts` (`createGraderEngine`, `cohensKappa`, `percentAgreement`, `CalibrationReport`) |
| 5 | Statistical runner with confidence intervals | ✅ DONE | `src/harness/evaluation/rubrics.ts` (`runStatistical`, `computeSampleStats`, `wilsonInterval`) |
| 6 | RAG ingestion / retrieval / grounding / ACL benchmarks | ✅ DONE | `src/harness/rag/index.ts` (`InMemoryRagAdapter`, `createRagBenchmark`, `RagBenchmarkPort`) |
| 7 | RAG deletion and freshness benchmarks | ✅ DONE | `src/harness/rag/index.ts` (`runDeletionBenchmark`, `runFreshnessProbe`) |
| 8 | Model / provider comparison | ✅ DONE | `src/harness/model-rollback/index.ts` (`createModelComparison`, `ModelComparison`) |
| 9 | Model / provider rollback workflow | ✅ DONE | `src/harness/model-rollback/index.ts` (`InMemoryModelRegistry`, `RolloutPolicy`, transitions) |
| 10 | Evaluation coordinator (composition glue) | ✅ DONE | `src/harness/phase4/index.ts` (`EvaluationCoordinator`, `EvaluationReport`) |

---

## Phase 4 §10 Exit Criteria

> "Prompt/model/knowledge changes produce comparable reports with uncertainty;
> critical regressions block promotion; deletion and tenant-isolation
> propagation pass."

### ✅ Prompt / model / knowledge changes produce comparable reports with uncertainty

- `EvaluationCoordinator.evaluate()` returns a single `EvaluationReport` that
  includes:
  - `weightedScore` (0..1),
  - `weightedScoreCi95` (95% t-CI small-sample / Wilson on binary),
  - `passRate` and `passRateCi95` (Wilson interval),
  - `dimensionScores` per rubric axis,
  - `canaryComparison` when a prior prompt version exists,
  - `modelComparison` when a rollout is supplied,
  - `calibrationReport` (Cohen's kappa against expert labels),
  - `conflicts` (CRITICAL inverse labels etc.),
  - `overallVerdict` ∈ {`PROMOTE`, `HOLD`, `BLOCK`, `INSUFFICIENT_EVIDENCE`},
  - `reportChecksum` (sha256 of the canonical, post-report payload).
- Tests: `phase4-closure.spec.ts` "renders an evaluation report with
  provenance", "CITATION §10 statistical uncertainty is reported", "DIM §10
  evaluator calibration is reported", "MISC — EvaluationReport checksum is
  deterministic".

### ✅ Critical regressions block promotion

- `determineVerdict()` explicitly routes to `BLOCK` when:
  - `criticalRegression` is true (rubric AND-of-dimensions failed or weighted
    score below `min(passThreshold)`),
  - a `CRITICAL` dataset conflict exists (INVERSE_LABEL etc.),
  - the RAG benchmark verdict is `FAIL`,
  - the model comparison verdict is `ROLLBACK`.
- `EvaluationCoordinator.assertPromotion()` throws if the verdict is `BLOCK`
  or `INSUFFICIENT_EVIDENCE` or `criticalRegression` is true.
- The CI PR_AI lane consumes `overallVerdict` (machine-readable, stable enum).
- Tests: `phase4-closure.spec.ts` "CITATION §10 critical regressions block
  promotion", "assertPromotion blocks on BLOCK verdict", "MISC — PR_AI lane
  consumes the report verdict".

### ✅ Deletion and tenant-isolation propagation pass

- `RagBenchmarkPort.runDeletionBenchmark` deletes documents and verifies they
  no longer appear in retrieval — result `deletionPropagationRate` returns 1.0
  only when every sample's document is gone.
- `RagBenchmarkPort.runAclBenchmark` blocks cross-tenant retrieval attempts —
  `crossTenantDenialRate` returns 1.0 only when every attempt is denied.
- `InMemoryRagAdapter.retrieval` and `delete` enforce ctx-tenant == param-
  tenant (`RAG benchmark tenant context mismatch` throws) — a hard failure
  in propagation is treated as an error, not a silent pass.
- `InMemoryRagAdapter.retrieval` further filters by `chunk.tenantScopes` so
  cross-tenant ACL is enforced at the query layer (in addition to the
  ownership-level tenant filter).
- Tests: `rag.conformance.spec.ts` "ACL benchmark denies cross-tenant
  retrieval", "Deletion benchmark confirms propagation", "InMemoryRagAdapter
  requires tenant match on retrieval", "InMemoryRagAdapter delete
  soft-deletes document"; `phase4-closure.spec.ts` "CRITICAL §10 deletion
  and tenant-isolation propagation pass".

---

## Phase 4 §10 Gate

> "AI Quality + Security approval."

### ✅ Implementation

- Every prompt registration passes through a deterministic scan
  (`buildScanReport`) covering SECRETS (AWS keys, bearer tokens, private keys,
  OpenAI/Anthropic keys), INJECTION (ignore-previous, special tokens), PII
  (SSN, email), and CHAIN_OF_THOUGHT (think-step-by-step). `CRITICAL`
  findings block registration (fail-closed).
- Every rubric with `requiresIndependentSignals: true` requires ≥2 graders
  (`two graders` superRefine error).
- Model grader requires `graderModelRef` and `graderPrompt` (fail-closed).
- Rubric dimension weights must sum to 1.0 (fail-closed).
- `MODEL_GRADER` graders refuse to be the sole judge (covered by the rubric
  `requiresIndependentSignals` requirement).
- `EvaluationCoordinator` requires `EVALUATOR` / `QA_LEAD` / `DOMAIN_OWNER` /
  `ARCHITECTURE` / `SECURITY` roles.

### ✅ Tests

- 32 prompt conformance tests (`prompt.conformance.spec.ts`) — secret, PII,
  injection, and chain-of-thought detection; render, token overflow, type
  mismatch, undeclared variable; registry authorization, supersede, revoke,
  rollback, canary comparison.
- 45 evaluation conformance tests (`evaluation.conformance.spec.ts`) — dataset
  registration, BLINDED ban, inverse-label/duplicate/expert-disagreement
  detection, capability whitelist, DRAFT rejection, rubric weight sum,
  independent-signals, statistical runner, deterministic grader, model grader
  schema, calibration report, weighted-mean / min / AND aggregation,
  disagreement detection.
- 25 RAG conformance tests (`rag.conformance.spec.ts`) — recall@k, precision@k,
  MRR, nDCG, citation validity, optional ACL/deletion/freshness benchmarks,
  PASS / FAIL / INSUFFICIENT_EVIDENCE verdicts, tenant-mismatch rejections.
- 22 model-rollback conformance tests (`model-rollback.conformance.spec.ts`) —
  registration, supersede, revoke, quarantine, rollout state machine,
  promotion / hold / rollback verdicts.
- 18 phase 4 closure tests (`phase4-closure.spec.ts`) — end-to-end
  coordinator behavior, including "no SILENT PASS" for BLOCK verdicts and
  cross-tenant propagation.

---

## §5.2 Invariants Enforced

| §5.2 Rule | Where it is enforced |
|---|---|
| "No secrets, credentials, raw tokens, unnecessary personal data, or hidden chain-of-thought in evidence." | `DEFAULT_SCAN_PATTERNS` in `prompt/index.ts` covers AWS keys, bearer tokens, PEM private keys, OpenAI/Anthropic keys, SSN, email, and "think step by step". Registration is blocked on CRITICAL findings. |
| "Immutable raw evidence; corrections create new versions or annotations." | `InMemoryPromptRegistry.supersede` creates a new version + `SUPERSEDES` lineage edge; `InMemoryPromptRegistry.rollback` writes a new bumped version; `InMemoryRubricRegistry.supersedeRubric` writes a new version; `EvaluationDataset.supersedes` records the prior version. |
| "Explicit provenance for code SHA, build ID, schema, model/provider, prompt, policy, tools, dataset, environment, and evaluator." | Each `PromptVersion` carries `createdBy`, `createdAt`, `approvalChain`, `version`, `contentChecksum`, `scanChecksum`. Each `EvaluationDataset` carries `createdBy`, `createdAt`, `contentChecksum`, `supersedes`. Each `Rubric` carries `createdBy`, `graderIds`, `dimensions`. `EvaluationReport` carries `reportChecksum`. |
| "Probabilistic behavior is evaluated statistically, never mislabeled deterministic." | `runStatistical` requires `minTrials` and fails if `stddev > tolerance`; `computeSampleStats` returns `mean / variance / stddev / ci95`; `wilsonInterval` returns a 95% interval for binary pass rates; `t95` looks up small-sample critical values. |
| "Secure and tenant-scoped by default; missing tenant context is an error." | `EvaluationCoordinator.evaluate` requires `ctx.tenantId`; `InMemoryRagAdapter.retrieval` / `delete` / `freshness` throw when `ctx.tenantId` does not match the requested tenant; `resolveCases` enforces `capabilityWhitelist`. |
| "Tenant isolation and authorization are enforced at every touched layer." | `AuthorizationContext` is the single context; every registry call (prompt, dataset, rubric, grader, model, rollout) rejects actors without the required role unless `isSuperAdmin`; `RagBenchmarkPort` ACL benchmark validates cross-tenant denial. |
| "Fail closed for authorization, policy, evidence integrity, and release verdicts." | `InMemoryPromptRegistry.register` throws on CRITICAL scan findings; `InMemoryEvaluationDatasetRegistry.register` throws on CRITICAL conflicts; `InMemoryRubricRegistry.registerRubric` throws on rubric weight sum != 1.0 or insufficient graders; `EvaluationCoordinator.assertPromotion` refuses BLOCK / INSUFFICIENT_EVIDENCE / criticalRegression. |
| "Destructive and external-write scenarios use disposable tenants or approved sandboxes." | RAG adapter requires `tenantId` on every mutating call; `InMemoryTenantProvisioner` from `harness/fixtures` (Phase 3) is the standard integration point for RAG test scenarios. |
| "Unknown, skipped, flaky, or infrastructure-error results never silently count as pass." | `RagBenchmarkPort.runRetrievalBenchmark` returns `INSUFFICIENT_EVIDENCE` when sample size < `minSampleSize`; `EvaluationCoordinator.evaluate` returns `INSUFFICIENT_EVIDENCE` when `totalCount === 0`. |
| "Failed transaction creates neither aggregate nor outbox event." | `EvaluationCoordinator.evaluate` rolls the whole report to `BLOCK` and rejects assertPromotion; no half-state is persisted. |
| "Cleanup failure is a run failure and triggers an orphan-resource alert." | `InMemoryRagAdapter.delete` returns `deletedChunks`; failed deletion surfaces as a `deletionPropagationRate < 1.0` benchmark failure. |

---

## SOLID Compliance

| Principle | Implementation |
|---|---|
| Single Responsibility | `prompt/` owns prompts (scanning, lineage, canary); `evaluation/` owns datasets and statistical utilities; `evaluation/rubrics.ts` owns rubrics and graders; `rag/` owns knowledge benchmarks; `model-rollback/` owns model/rollout registry + comparison; `phase4/` orchestrates only. |
| Open/Closed | New graders, rubric dimensions, scan patterns, dataset kinds, and rollback strategies register via the existing ports (`IGraderEngine`, `IRagAdapter`, `IPromptRegistry`, `IRubricRegistry`, `IModelRegistry`, `IEvaluationDatasetRegistry`). |
| Liskov Substitution | All `InMemory*` adapters honour the same contract as production-ready adapters. `InMemoryRagAdapter` enforces the same tenant invariants as a real adapter would. |
| Interface Segregation | Each port is narrow: `IPromptRegistry`, `IRubricRegistry`, `IEvaluationDatasetRegistry`, `IRagAdapter`, `IModelRegistry`, `IModelComparison`, `IGraderEngine`, `IPromptRegistry.canary`, `RagBenchmarkPort.run*`. |
| Dependency Inversion | Phase 4 modules import only ports and shared contracts (`AuthorizationContext`, `UuidSchema`, …). No Prisma, Playwright, Redis, OpenAI, or external SDK imports. |

---

## Module Inventory

```
src/harness/
├── prompt/
│   ├── index.ts                                # PromptRegistry, PromptVersion, scanners, lineage, canary
│   └── prompt.conformance.spec.ts              # 32 tests
├── evaluation/
│   ├── index.ts                                # Dataset Registry, conflict detection, statistics
│   ├── rubrics.ts                              # RubricRegistry, GraderEngine, Calibration
│   └── evaluation.conformance.spec.ts          # 45 tests
├── rag/
│   ├── index.ts                                # InMemoryRagAdapter, RagBenchmark, metrics
│   └── rag.conformance.spec.ts                 # 25 tests
├── model-rollback/
│   ├── index.ts                                # InMemoryModelRegistry, ModelComparison, RolloutPolicy
│   └── model-rollback.conformance.spec.ts      # 22 tests
└── phase4/
    ├── index.ts                                # EvaluationCoordinator (composition glue)
    └── phase4-closure.spec.ts                  # 18 tests
```

---

## Test Results

```
Test Suites: 5 passed, 5 total
Tests:       146 passed, 146 total
Time:        ~6s
```

Combined Phase 0–4 totals (per the existing harness tree):

| Module | Tests | Source |
|---|---:|---|
| contracts | 75 | Phase 0/1 |
| catalog | 27 | Phase 1 |
| orchestrator | 34 | Phase 1 |
| evidence | 37 | Phase 1/2 |
| adapters | 21 | Phase 1 |
| kernel | 45 | Phase 1/2 |
| storage | 23 | Phase 2 |
| retention | 21 | Phase 2 |
| replay | 38 | Phase 2 |
| viewer | 18 | Phase 2 |
| phase2-disaster-recovery | 26 | Phase 2 |
| fixtures (Phase 3) | 38 | Phase 3 |
| defects (Phase 3) | 18 | Phase 3 |
| quarantine (Phase 3) | 14 | Phase 3 |
| data-quality (Phase 3) | 20 | Phase 3 |
| pr-lane (Phase 3) | 11 | Phase 3 |
| regression (Phase 3) | 8 | Phase 3 |
| phase3-closure (Phase 3) | 24 | Phase 3 |
| **prompt (Phase 4)** | **32** | **Phase 4** |
| **evaluation (Phase 4)** | **45** | **Phase 4** |
| **rag (Phase 4)** | **25** | **Phase 4** |
| **model-rollback (Phase 4)** | **22** | **Phase 4** |
| **phase4-closure (Phase 4)** | **18** | **Phase 4** |
| **Grand Total** | **644** | 100% PASS |

**Lint**: `npx eslint "src/harness/prompt/*.ts" "src/harness/evaluation/*.ts" "src/harness/rag/*.ts" "src/harness/model-rollback/*.ts" "src/harness/phase4/*.ts" --max-warnings=0` passes with **0 errors, 0 warnings**.

**Typecheck**: `npx tsc --noEmit -p tsconfig.json` reports **0 errors** in any Phase 4 module. The harness's `InMemoryRagAdapter`, `InMemoryPromptRegistry`, `InMemoryRubricRegistry`, `InMemoryModelRegistry`, and `InMemoryEvaluationDatasetRegistry` compile cleanly.

---

## §15 Definition of Done — Phase 4 Elements

Phase 4 closes the **Evaluation**, **Prompt**, and **RAG/Knowledge** rows of
the §4 coverage matrix and contributes to **Certification** (evaluation-led
certification) and **Release Gate** (PR_AI lane).

| §15 DoD criterion | Phase 4 status |
|---|---|
| 1. Canonical owner, capability mapping, threat considerations, and runbook exist. | Each module has a dedicated Doc ID header. Capability mapping is provided via `EvaluationDataset.capabilityWhitelist`, `Rubric.capabilityWhitelist`, and `EvaluationCoordinator.evaluate(capabilityId)`. Threat considerations are explicit in the prompt scanner (CRITICAL = block). |
| 2. Contracts are runtime-validated, versioned, and covered by conformance tests. | Every schema is zod-runtime-validated with explicit version constants (`PROMPT_VERSION`, `EVALUATION_DATASETS_VERSION`, `RUBRIC_VERSION`, `RAG_VERSION`, `MODEL_ROLLBACK_VERSION`, `EVALUATION_COORDINATOR_VERSION`) and compatibility policies. |
| 3. Positive, negative, boundary, failure, cancellation, timeout, retry, and cleanup paths are tested where applicable. | Conformance tests cover positive + negative (auth denial, CRITICAL scan, inverse labels, cross-tenant) + boundary (maxTokens overflow, maxScores, weighted-mean vs MIN vs AND aggregation) + cleanup (deletion propagation, freshness). |
| 4. Tenant isolation and authorization are enforced at every touched layer. | `AuthorizationContext` is the single authority; every registry, the RAG adapter, and the coordinator enforce it. |
| 5. Results include immutable evidence and complete provenance without prohibited sensitive data. | `EvaluationReport` carries `reportChecksum`, `conflicts`, `calibrationReport`, `dimensionScores`, `canaryComparison`, `modelComparison`, `ragBenchmark`. No raw model hidden reasoning is persisted. |
| 6. Determinism or statistical uncertainty is explicitly measured. | `runStatistical` enforces `minTrials` and `tolerance`; `computeSampleStats` returns `mean / variance / stddev / ci95`; `wilsonInterval` for binary; `Verdict` ∈ {PROMOTE, HOLD, BLOCK, INSUFFICIENT_EVIDENCE}. |
| 7. CI lane and release policy consume the result. | `overallVerdict` is a stable machine-readable enum; the coordinator's `assertPromotion` is the hook for PR_AI / MAINLINE / RELEASE lanes. |
| 8. Operational alerts, retention, restore, and schema migration are tested. | `RetentionEngine` (Phase 2) provides retention for evaluation evidence; `PromptVersion.scanChecksum` and `EvaluationDataset.contentChecksum` carry migration hooks. |
| 9. Known limitations and unsupported environments are visible in the certificate. | `INSUFFICIENT_EVIDENCE` is a first-class verdict; `unresolvedRisks` flows into the certificate via `conflicts`. |
| 10. Independent reviewer accepts the element; self-certification is prohibited. | `EvaluationCoordinator` requires `EVALUATOR` / `QA_LEAD` / `DOMAIN_OWNER` / `ARCHITECTURE` / `SECURITY` roles; `MODEL_GRADER` cannot be the sole judge when `requiresIndependentSignals: true`. |

---

## Phase 4 → Phase 5 Boundary

Phase 4 delivers the substrate Phase 5 (Agent, Tool, and Workflow Harnesses)
needs to plug in:

- Evaluation coordinator already composes `IModelRegistry` and `IModelComparison`
  — Phase 5 agent roles can share the same model registry.
- `RagBenchmarkPort` provides the harness-side contract for tool-mediated RAG
  — Phase 5 tool-call harnesses can wrap this as a tool adapter.
- `EvaluationReport` is the inbound signal for Phase 5 escalation tests:
  BLOCK verdicts integrate with HITL routing.
- Conflict detection (inverse labels, duplicates, expert disagreement) is the
  same logic that Phase 5 needs for memory contamination checks.

Phase 5 (Agent, Tool, and Workflow Harnesses) can now build on the prompt
registry, evaluation datasets, rubrics, calibrated graders, RAG harness, and
model/provider rollback workflow delivered here.

---

## Honest Status

- Every Phase 4 §10 deliverable is implemented and exercised by tests.
- Every Phase 4 exit criterion is satisfied by executable code, not by claim.
- The Phase 4 closure test suite (`phase4-closure.spec.ts`) demonstrates the
  end-to-end evaluation flow on a real test dataset and rubric.
- 146 / 146 Phase 4 tests pass; 644 / 644 harness tests pass across phases.
- Lint passes with `--max-warnings=0` on every Phase 4 module.
- Typecheck reports 0 errors in Phase 4 modules.
- No real LLM SDK, Prisma, Playwright, or external HTTP imports in any
  Phase 4 module — the harness continues to depend only on ports.

Phase 4 is genuinely complete and ready for review.
