# Phase 19 + 20 + 21 — Marketing / Service / Channels / Predictive / LLM-Wiring Implementation Plan

**Document:** NC-PLAN-PHASE-19-21
**Date:** 2026-08-07
**Branches:**
- `0019-marketing-service-predictive` — Phase 19 (CR-AI-0801..0803 + 0901..0903 + 1001..1003 + 1103)
- `0020-channels-studio` — Phase 20 (CR-AI-1104..1107 + remaining Studio)
- `0021-llm-wiring` — Phase 21 (LLM-backed providers behind existing `IProvider` interfaces)
**Baseline:** `neurecore/memory-bank-new/docs/parity-v3/creatio-parity-baseline.yaml` v1.0.0

> Three consecutive PRs. Each ships independently green and does not
> regress any prior gate.

---

## 0. Executive summary

| Phase | Capabilities | Count | Domain |
|---|---|---:|---|
| **19** | CR-AI-0801 + 0802 + 0803 | 3 | Marketing |
| **19** | CR-AI-0901 + 0902 + 0903 | 3 | Service |
| **19** | CR-AI-1001 + 1002 + 1003 | 3 | Predictive (model lifecycle + abstention + model cards) |
| **19** | CR-AI-1103 | 1 | Channels — Outlook + Teams (real wiring + 12-boundary probe) |
| **20** | CR-AI-1105 + 1106 + 1107 | 3 | Channels — Slack stub, CRM-event-triggered skills, Mobile |
| **21** | — | 0 | LLM swap behind existing `IProvider` interfaces (no new capabilities) |

After this batch: **65 of 99 capabilities = ~66 % parity** (was 57 %).

---

## 1. Audit before change

| Surface | Status today | What Phase adds |
|---|---|---|
| `analytics/services/prediction.service.ts` | real, IN_PROGRESS (CR-AI-1002) | Phase 19 certifies abstention envelope + deterministic-rule fallback baseline + writes regression spec |
| `analytics/services/model-lifecycle.service.ts` | real, NOT_STARTED (CR-AI-1001) | Phase 19 ships the 11-stage lifecycle state machine + challenger compare + rollback drill harness |
| `analytics/services/model-card.service.ts` | real, NOT_STARTED (CR-AI-1003) | Phase 19 surfaces model cards with version + scope + limitations + monitoring surface |
| `integrations/microsoft/outlook-email.service.ts` | real, NOT_STARTED (CR-AI-1103) | Phase 19 certifies the Graph OAuth + thread/correlation + attachment safety path |
| `integrations/microsoft/teams-adapter.service.ts` | real, NOT_STARTED (CR-AI-1104) | Phase 19 certifies Teams chat + meeting summary path |
| `integrations/brevo/{brevo-email,brevo-webhook,brevo-usage,brevo-suppression,admin-brevo}.service.ts` | real | Phase 19 adds `bounce-analyzer.service.ts` (CR-AI-0803) + skills (CR-AI-0801 + 0802) |
| Channels (1105/1106/1107) | NOT_STARTED | Phase 20 ships Slack stub + CRM-event skills + mobile support-matrix declaration |

---

## 2. SOLID commitments

| Principle | Application |
|---|---|
| **SRP** | Each new file owns ONE concern: a skill, a provider, a service. `ModelLifecycleService` ≠ `ModelCardService` ≠ `BounceAnalyzerService`. |
| **OCP** | Adding an 8th lifecycle stage = one enum + one transition map. Adding an 8th model-card field = one prop in the typed envelope. |
| **LSP** | All marketing/service skills extend `ISkill<I,O>`. All providers implement the canonical `IPredictionProvider` interface (Phase 21 swaps the brain without touching consumers). |
| **ISP** | `IOutlookAuth` ≠ `IOutlookMail` ≠ `IOutlookCalendar`. `IModelLifecycleEvent` is a small union type, not a fat object. |
| **DIP** | All new services depend on injected interfaces; no direct Prisma calls in skill code. The LLM runner (Phase 21) is a single injectable token. |

---

## 3. Architecture

### Phase 19 — Marketing / Service / Predictive / Channels

```
                ┌────────────────────────────────────────┐
                │  Marketing module (P19.1)               │
                │   - SegmentSkill (CR-AI-0801)            │
                │   - CampaignBriefSkill (CR-AI-0802)      │
                │   - BounceAnalyzerService (CR-AI-0803)    │
                └────────────────────────────────────────┘
                ┌────────────────────────────────────────┐
                │  Service module (P19.2)                 │
                │   - CaseClassifyProvider refresh       │
                │     (CR-AI-0901 — sentiment + SLA)     │
                │   - CaseResolveSkill (CR-AI-0902)       │
                │   - CaseResponseSkill (CR-AI-0903)     │
                └────────────────────────────────────────┘
                ┌────────────────────────────────────────┐
                │  Predictive module (P19.3)             │
                │   - ModelLifecycleService (CR-AI-1001) │
                │   - PredictionService final             │
                │     (CR-AI-1002 — abstention + rules)  │
                │   - ModelCardService (CR-AI-1003)      │
                └────────────────────────────────────────┘
                ┌────────────────────────────────────────┐
                │  Outlook + Teams (P19.4)                │
                │   - outlook-email.service cert         │
                │   - outlook-calendar.service cert      │
                │   - teams-adapter.service cert         │
                └────────────────────────────────────────┘
```

### Phase 20 — Channels (Slack/CRM/Mobile)

```
                ┌────────────────────────────────────────┐
                │  Slack adapter (CR-AI-1105 — stub)      │
                │   - typed OUT_OF_SCOPE; mark at boot    │
                └────────────────────────────────────────┘
                ┌────────────────────────────────────────┐
                │  CRM-event skills (CR-AI-1106)          │
                │   - HubSpot trigger skill              │
                │   - Salesforce trigger skill           │
                │   - Generic webhooks service            │
                └────────────────────────────────────────┘
                ┌────────────────────────────────────────┐
                │  Mobile support-matrix declaration      │
                │  (CR-AI-1107)                           │
                │   - frontend-tenant/MobileNav.tsx       │
                │   - support matrix typed file            │
                └────────────────────────────────────────┘
```

### Phase 21 — LLM wiring

```
                ┌────────────────────────────────────────┐
                │  Existing providers (Phase 5)            │
                │   - LeadScoreProvider                   │
                │   - OpportunityWinProvider              │
                │   - ForecastProvider                    │
                │   - PipelineHealthProvider              │
                │   - CaseClassifyProvider                │
                └────────────────────────────────────────┘
                                │
                                ▼
                ┌────────────────────────────────────────┐
                │  IModelRunner (existing)                │
                │   - InProcessMockModelRunner            │
                │   - HttpModelRunner                     │
                │   - NEW: LlmModelRunner (P21.1)        │
                └────────────────────────────────────────┘
                                │
                                ▼
                ┌────────────────────────────────────────┐
                │  Feature flag: provider.useLlmRunner    │
                │  per (tenantId, capability)             │
                │  (default OFF; opt-in for first 3)     │
                └────────────────────────────────────────┘
```

---

## 4. Contracts (typed)

```ts
// Phase 19 — Model Lifecycle (CR-AI-1001)
type ModelLifecycleStage =
  | 'PROBLEM_DEFINITION'
  | 'DATA_COLLECTION'
  | 'BASELINE'
  | 'CANDIDATE_TRAIN'
  | 'CALIBRATION'
  | 'SUBGROUP_REVIEW'
  | 'FAIRNESS_REVIEW'
  | 'SHADOW'
  | 'GATED_PRODUCTION'
  | 'MONITOR'
  | 'ROLLED_BACK';

interface LifecycleTransition {
  readonly stage: ModelLifecycleStage;
  readonly enteredAt: string;
  readonly actor: string;
  readonly notes: string;
  readonly shadowOutcome?: { challengerScore: number; winnerScore: number; winnerModelId: string };
}

// Phase 19 — Bounce Analyzer (CR-AI-0803)
type BounceCategory = 'HARD_BOUNCE' | 'SOFT_BOUNCE' | 'COMPLAINT' | 'BLOCK' | 'OTHER';

interface BounceFinding {
  readonly category: BounceCategory;
  readonly explanation: string;
  readonly recommendedRemediation: string;
  readonly confidencePercent: number;
}

// Phase 20 — CRM-event skills
interface CrmEventSkillInput {
  readonly tenantId: string;
  readonly source: 'hubspot' | 'salesforce' | 'webhook';
  readonly eventType: string;       // 'lead.created' | 'deal.stage_changed' | ...
  readonly payload: Record<string, unknown>;
}

interface CrmEventSkillOutput {
  readonly eventId: string;
  readonly actionsTaken: ReadonlyArray<string>;
  readonly followUpTasks: ReadonlyArray<string>;
}

// Phase 21 — LlmModelRunner contract
interface LlmProviderRequest {
  readonly tenantId: string;
  readonly capability: string;
  readonly promptTemplate: string;
  readonly inputFeatures: Record<string, unknown>;
  readonly temperature?: number;
  readonly responseSchema?: Record<string, unknown>;
}

interface LlmProviderResponse {
  readonly content: string;
  readonly confidence: number;
  readonly tokensIn: number;
  readonly tokensOut: number;
  readonly durationMs: number;
}
```

---

## 5. Data model (additive only)

### 5.1 `model_lifecycle_history` table (CR-AI-1001)

```prisma
model ModelLifecycleHistory {
  id                String   @id @default(cuid())
  tenantId          String
  modelId           String
  stage             String                       // ModelLifecycleStage
  enteredAt         DateTime @default(now())
  actor             String
  notes             String  @default("")
  shadowWinnerModelId String?
  shadowChallengerScore Decimal?
  shadowWinnerScore    Decimal?

  @@index([tenantId, modelId, enteredAt])
  @@map("model_lifecycle_history")
}
```

### 5.2 `model_cards` table (CR-AI-1003)

```prisma
model ModelCard {
  id                String   @id @default(cuid())
  tenantId          String
  modelId           String
  modelVersion      String
  scope             String                       // human-readable scope
  limitations       String
  monitoringUrl     String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@unique([tenantId, modelId, modelVersion])
  @@map("model_cards")
}
```

### 5.3 `bounce_findings` table (CR-AI-0803)

```prisma
model BounceFinding {
  id                String   @id @default(cuid())
  tenantId          String
  recipientEmail    String
  category          String
  explanation       String
  recommendedAction String
  confidencePercent Int
  createdAt         DateTime @default(now())

  @@index([tenantId, createdAt])
  @@map("bounce_findings")
}
```

---

## 6. Verification matrix

| Gate | Required |
|---|---|
| `nest build` exit 0 | yes |
| `frontend-tenant tsc --noEmit` exit 0 | yes |
| Phase 11–18 G11–G18 stay APPROVED | yes |
| **Phase 19 G19 APPROVED** | yes (10 gates) |
| **Phase 20 G20 APPROVED** | yes (8 gates) |
| **Phase 21 G21 APPROVED** | yes (10 gates — LLM runner contract) |
| `TenantIsolationProbe` integrity guard covers Outlook/Teams | yes |
| `SkillRegistryImplementsFlag` integrity guard covers new skills | yes (13 skills after P19+P20) |
| LLM runner typed envelope + zero mock fallback | yes |
| Marketing skills (3) + Service skills (2) + new module surface | yes |

---

## 7. File inventory (≤ 60 new + ≤ 15 edited)

### Phase 19 (≤ 30 new)

```
backend/src/modules/marketing/
├── marketing.module.ts                          (NEW)
├── skills/
│   ├── segment.skill.ts                        (NEW — CR-AI-0801)
│   ├── segment.skill.spec.ts                   (NEW)
│   ├── campaign-brief.skill.ts                 (NEW — CR-AI-0802)
│   └── campaign-brief.skill.spec.ts            (NEW)
└── services/
    ├── bounce-analyzer.service.ts              (NEW — CR-AI-0803)
    └── bounce-analyzer.service.spec.ts         (NEW)

backend/src/modules/service/
├── service.module.ts                            (NEW)
└── skills/
    ├── case-resolve.skill.ts                   (NEW — CR-AI-0902)
    ├── case-resolve.skill.spec.ts              (NEW)
    ├── case-response.skill.ts                  (NEW — CR-AI-0903)
    └── case-response.skill.spec.ts             (NEW)

backend/src/modules/analytics/services/
├── model-lifecycle.service.ts                  (EXTEND — CR-AI-1001)
├── model-lifecycle.service.spec.ts             (NEW)
├── prediction.service.ts                        (EXTEND — CR-AI-1002)
├── prediction.abstention.spec.ts               (NEW)
├── model-card.service.ts                        (EXTEND — CR-AI-1003)
└── model-card.service.spec.ts                   (NEW)

backend/src/modules/integrations/microsoft/
├── outlook-email.service.ts                    (EXTEND — CR-AI-1103 cert + tenant guard)
├── outlook-email.service.spec.ts               (NEW)
├── teams-adapter.service.ts                    (EXTEND — CR-AI-1104 cert + tenant guard)
└── teams-adapter.service.spec.ts               (NEW)

backend/src/test/certification/
├── phase19-certification.runner.ts             (NEW)
└── g19-marketing-service-predictive.spec.ts    (NEW)

backend/prisma/migrations/20260808_add_marketing_service_predictive/
└── migration.sql                                (NEW — 4 tables)
```

### Phase 20 (≤ 18 new)

```
backend/src/modules/channels/
├── channels.module.ts                           (NEW)
├── slack-adapter.service.ts                    (NEW — CR-AI-1105 typed OUT_OF_SCOPE)
├── slack-adapter.service.spec.ts               (NEW)
├── crm-event-trigger.service.ts                (NEW — CR-AI-1106)
└── crm-event-trigger.service.spec.ts           (NEW)

backend/src/modules/skill-registry/skills/
├── crm-event.skill.ts                          (NEW — HubSpot trigger)
├── crm-event.skill.spec.ts                     (NEW)
├── crm-webhook.skill.ts                        (NEW — generic webhook)
└── crm-webhook.skill.spec.ts                   (NEW)

backend/src/modules/integrations/mobile/
├── mobile-support-matrix.ts                    (NEW — CR-AI-1107)
└── mobile-support-matrix.spec.ts               (NEW)

backend/src/test/certification/
├── phase20-certification.runner.ts             (NEW)
└── g20-channels-studio.spec.ts                 (NEW)

frontend-tenant/src/shared/mobile/
└── SupportMatrix.tsx                            (NEW — CR-AI-1107)
```

### Phase 21 (≤ 12 new + 5 edited)

```
backend/src/modules/analytics/services/
├── model-runner/
│   ├── llm-model-runner.ts                    (NEW — P21.1)
│   ├── llm-model-runner.spec.ts               (NEW)
│   └── llm-feature-flag.service.ts            (NEW — per-tenant opt-in)
├── prediction.service.ts                       (EDIT — LLM-aware path)
├── lead-score.provider.ts                      (EDIT — wire LLM runner)
├── opportunity-win.provider.ts                 (EDIT — wire LLM runner)
├── forecast.provider.ts                        (EDIT — wire LLM runner)
└── case-classify.provider.ts                   (EDIT — wire LLM runner)

backend/src/test/certification/
├── phase21-certification.runner.ts             (NEW)
└── g21-llm-wiring.spec.ts                     (NEW)
```

### Documentation (2)

```
neurecore/memory-bank-arc/harness/
├── IMPLEMENTATION-PLAN-PHASE-19-21.md        (NEW — this file)
└── PHASE19-21-MARKETING-SERVICE-LLM.md        (NEW — parity delta)
```

---

## 8. Run commands

```bash
cd backend
./node_modules/.bin/nest build
./node_modules/.bin/jest --config jest.config.js \
  src/modules/marketing \
  src/modules/service \
  src/modules/analytics/services/model-lifecycle \
  src/modules/analytics/services/prediction \
  src/modules/analytics/services/model-card \
  src/modules/integrations/microsoft \
  src/modules/channels \
  src/test/certification/g19-marketing-service-predictive \
  src/test/certification/g20-channels-studio \
  src/test/certification/g21-llm-wiring \
  src/test/certification/skill-registry-integrity
cd frontend-tenant && npx tsc --noEmit
```

---

## 9. Document control

- 2026-08-07 — created. Owner: `@marketing`, `@service`, `@analytics`, `@platform`.
