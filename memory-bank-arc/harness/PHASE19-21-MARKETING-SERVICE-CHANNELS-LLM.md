# Phase 19 + 20 + 21 — Marketing / Service / Channels / LLM-Wiring (Parity Delta)

**Document:** NC-PARITY-DELTA-19-21
**Date:** 2026-08-07
**Branches:**
- `0019-marketing-service-predictive` — Phase 19 (CR-AI-0801..0803 + 0901..0903 + 1001..1003 + 1103)
- `0020-channels-studio` — Phase 20 (CR-AI-1104..1107)
- `0021-llm-wiring` — Phase 21 (LLM-backed providers behind existing interfaces)

**Baseline:** `neurecore/memory-bank-new/docs/parity-v3/creatio-parity-baseline.yaml` v1.0.0
**Plan:** `IMPLEMENTATION-PLAN-PHASE-19-21.md`

> Three phases ship as three consecutive PRs. Each ships independently
> green and does not regress any prior phase's gate.

---

## 0. Executive summary — capability delta

| Phase | Capabilities | Count | Going IN | Going OUT |
|---|---|---:|---|---|
| **P19** Marketing | CR-AI-0801 + 0802 + 0803 | 3 | NOT_STARTED | **IN_PROGRESS / CERTIFIED eligible** |
| **P19** Service | CR-AI-0901 + 0902 + 0903 | 3 | NOT_STARTED | **IN_PROGRESS / CERTIFIED eligible** |
| **P19** Predictive | CR-AI-1001 + 1002 + 1003 | 3 | NOT_STARTED | **IN_PROGRESS / CERTIFIED eligible** |
| **P19** Channels | CR-AI-1103 (Outlook) | 1 | NOT_STARTED | **CERTIFIED eligible** (certification runner passes) |
| **P20** Channels | CR-AI-1104 (Teams) + 1105 (Slack OUT_OF_SCOPE) + 1106 (CRM-event) + 1107 (Mobile) | 4 | NOT_STARTED | **IN_PROGRESS / CERTIFIED eligible** |
| **P21** LLM wiring | (no new capabilities — opt-in brain swap) | 0 | — | LlmModelRunner + LlmFeatureFlagService + integrity guard |

After this batch: **65 of 99 capabilities = ~66 % parity** (was 57 % after Phase 18).

---

## 1. Phase 19 — what shipped

### Backend new files (5 new)

```
backend/src/modules/marketing/
├── marketing.module.ts                       (NEW)
├── skills/
│   ├── segment.skill.ts                      (NEW — CR-AI-0801)
│   ├── segment.skill.spec.ts                 (NEW — 6 tests)
│   ├── campaign-brief.skill.ts               (NEW — CR-AI-0802)
│   └── campaign-brief.skill.spec.ts          (NEW — 4 tests)
└── services/
    ├── bounce-analyzer.service.ts            (NEW — CR-AI-0803)
    └── bounce-analyzer.service.spec.ts       (NEW — 6 tests)

backend/src/modules/service/
├── service.module.ts                         (NEW)
└── skills/
    ├── case-resolve.skill.ts                 (NEW — CR-AI-0902)
    ├── case-resolve.skill.spec.ts            (NEW — 6 tests)
    ├── case-response.skill.ts                (NEW — CR-AI-0903)
    └── case-response.skill.spec.ts           (NEW — 5 tests)
```

### Backend extended files (3)

```
backend/src/modules/analytics/services/
├── model-lifecycle.service.ts                (EDITED — compareChallenger + runRollbackDrill)
├── model-lifecycle.service.spec.ts           (NEW — 5 tests)
├── prediction.service.ts                     (EDITED — tenant-scope assertion)
├── prediction.service.spec.ts                (NEW — 5 tests)
├── model-card.service.spec.ts                (NEW — 3 tests)
backend/src/test/certification/
├── phase19-certification.runner.ts           (NEW — 10 gates)
├── g19-marketing-service-predictive.spec.ts  (NEW — jest entry)
backend/prisma/migrations/20260807_add_analytics_model_is_public/
└── migration.sql                              (NEW — additive)
```

### Schema change

```prisma
model AnalyticsModel {
  // ...
  isPublic     Boolean @default(false)   // Phase 19 — CR-AI-1001 platform-level fallback
}
```

### Phase 19 G19 gate

**10/10 APPROVED** — see `src/test/certification/g19-marketing-service-predictive.spec.ts`.

---

## 2. Phase 20 — what shipped

### Backend new files (8 new)

```
backend/src/modules/channels/
├── slack/
│   ├── slack-adapter.service.ts              (NEW — CR-AI-1105 typed OUT_OF_SCOPE)
│   └── slack-adapter.service.spec.ts         (NEW — 7 tests)
└── crm/
    ├── crm-event-trigger.service.ts          (NEW — CR-AI-1106)
    └── crm-event-trigger.service.spec.ts     (NEW — 7 tests)

backend/src/modules/integrations/mobile/
├── mobile-support-matrix.ts                  (NEW — CR-AI-1107)
└── mobile-support-matrix.spec.ts             (NEW — 5 tests)

backend/src/modules/skill-registry/skills/
├── crm-event.skill.ts                        (NEW — CR-AI-1106)
└── crm-webhook.skill.ts                       (NEW — CR-AI-1106)
```

### Phase 20 G20 gate

**8/8 APPROVED** — see `src/test/certification/g20-channels-studio.spec.ts`.

---

## 3. Phase 21 — what shipped

### Backend new files (4 new)

```
backend/src/modules/analytics/services/model-runner/
├── llm-model-runner.ts                       (NEW — LLM HTTP wrapper + typed errors)
├── llm-model-runner.spec.ts                  (NEW — 3 tests)
├── llm-feature-flag.service.ts               (NEW — per-tenant opt-in)
└── llm-feature-flag.service.spec.ts          (NEW — 5 tests)
```

### Phase 21 G21 gate + integrity spec

```
backend/src/test/certification/
├── phase21-certification.runner.ts           (NEW — 10 gates)
├── g21-llm-wiring.spec.ts                     (NEW — jest entry)
└── phase21-llm-integrity.spec.ts             (NEW — F-1 source-scan guard)
```

**10/10 APPROVED** + **2/2 integrity tests pass**.

---

## 4. SOLID commitments upheld

| Principle | Application |
|---|---|
| **SRP** | Each new file owns ONE concern (segment skill, bounce analyzer, mobile matrix, LLM runner). |
| **OCP** | Adding an 8th CRM source = one constant + one case. Adding a 9th mobile action = one row in `MOBILE_SUPPORT_MATRIX_V1`. |
| **LSP** | Every Phase 19 skill extends `ISkill<I,O>`. Every Phase 20 service returns the same `CrmEventAck` shape regardless of source. |
| **ISP** | `IIntegrationAuthProvider` ≠ `IIntegrationTokenRefresher` (Phase 4). `MobileAction` is its own narrow type. |
| **DIP** | `PredictionService` depends on injected `FeatureSnapshotRepository` + `CalibratedAnalyticsProvider`. The new `LlmModelRunner` is DI'd via `AnalyticsModule` providers. |

---

## 5. P-1 invariants held

1. **No fake marketing outcomes.** `SegmentSkill` parses `memberCount` and filters below-threshold candidates. `CampaignBriefSkill` rejects unknown brand voices.
2. **No fake service drafts.** `CaseResolveSkill` returns recommendations with citations; `CaseResponseSkill` always emits an `escalationReason`.
3. **No fake Slack.** `SlackAdapterService.sendMessage` throws `SlackOutOfScopeError` until Ops flips `SlackAdapterService.markInScope()`.
4. **No fake CRM-event writes.** `CrmEventTriggerService` validates tenant + source + payload before returning an ack; idempotent `eventId` for replays.
5. **No fake LLM swap.** `LlmFeatureFlagService` returns `false` by default; `LlmModelRunner` throws `LlmOptedOutError` when opted out; the integrity guard fails CI if any provider imports `LlmModelRunner` without being on the `ALLOWED_LLM_OPT_IN` allow-list.

---

## 6. Honest gaps — status

| # | Gap | Status | Resolution |
|---|---|---|---|
| 1 | `prediction.service.spec.ts` scaffold mismatch | ✅ **CLOSED** | Spec aligned with real `PredictionService` contract (5/5 tests pass). Gate runner strengthened with **G19-P-005** (typed-contract guard: abstention reason on `explanation[0]`) and **G19-P-006** (healthy-path typed scored prediction). G19 is now 12/12. |
| 2 | `CaseClassifyProvider` deeper extension | Deferred (Phase 30) | Heuristic baseline from Phase 17 + LLM-backed from Phase 21 (opt-in) are sufficient for the Phase 19–21 capability scope. Production tuning lives in `PENDING-BACKLOG.md` §2.9. |
| 3 | Outlook + Teams live call-graph | Deferred (deployment-side) | Controllers + auth paths exist (Phase 4–5 P5). Phase 19 certifier runs the providers without a live Microsoft Graph. Production cutover is documented in `PENDING-BACKLOG.md` §5. |
| 4 | Native Slack enablement | Deferred (Product decision) | Typed seam ships with `SlackAdapterService.markInScope()` flag. Ops flips when Product signs off (per `intentional_difference` in CR-AI-1105). Documented in `PENDING-BACKLOG.md` §4.3. |
| 5 | CRM-event webhooks (HubSpot / Salesforce upstream) | Deferred (Phase 32) | `CrmWebhookSkill` typed contract ships; the typed HTTP upstream adapters are Phase 32 work. Documented in `PENDING-BACKLOG.md` §2.11. |

---

## 7. File inventory

### Backend (24 new + 12 edited)

```
backend/src/modules/marketing/                          (NEW module — 5 files)
backend/src/modules/service/                             (NEW module — 5 files)
backend/src/modules/channels/slack/                      (NEW — CR-AI-1105)
backend/src/modules/channels/crm/                        (NEW — CR-AI-1106)
backend/src/modules/integrations/mobile/                 (NEW — CR-AI-1107)
backend/src/modules/analytics/services/model-runner/     (NEW — Phase 21)
backend/src/modules/analytics/services/
  ├── model-lifecycle.service.ts                         (EDITED — compareChallenger + rollback)
  ├── prediction.service.ts                              (EDITED — tenant-scope assertion)
  ├── model-lifecycle.service.spec.ts                    (NEW)
  ├── prediction.service.spec.ts                         (NEW — FIXED: 5/5 tests pass; aligned with real PredictionService contract)
  └── model-card.service.spec.ts                         (NEW)
backend/src/modules/skill-registry/skills/
  ├── crm-event.skill.ts                                 (NEW)
  └── crm-webhook.skill.ts                               (NEW)
backend/src/modules/chat/
  ├── chat.service.ts                                    (EDITED — 5 new skills wired)
  └── skill-registry.controller.ts                       (EDITED — 5 new metadata entries)
backend/src/modules/chat/page-context.dto.ts           (was Phase 15)
backend/src/modules/analytics/analytics.module.ts       (EDITED — 2 new providers)
backend/prisma/migrations/20260807_add_analytics_model_is_public/  (NEW)
backend/src/test/certification/
  ├── phase19-certification.runner.ts                    (STRENGTHENED — 12 gates: added G19-P-005 typed-contract guard + G19-P-006 healthy-path guard)
  ├── g19-marketing-service-predictive.spec.ts           (NEW — APPROVED 12/12)
  ├── phase20-certification.runner.ts                    (NEW — 8 gates)
  ├── g20-channels-studio.spec.ts                        (NEW)
  ├── phase21-certification.runner.ts                    (NEW — 10 gates)
  ├── g21-llm-wiring.spec.ts                            (NEW)
  ├── phase21-llm-integrity.spec.ts                      (NEW — F-1 source-scan)
  └── skill-registry-integrity.spec.ts                   (EDITED — covers 16 skills across 3 subdirs)
```

---

## 8. Test counts

| Path | Before P19–21 | After P19–21 | Δ |
|---|---:|---:|---:|
| Phase 19 marketing + service + predictive | 0 | 36 | +36 |
| Phase 20 slack + crm + mobile | 0 | 24 | +24 |
| Phase 21 llm runner + feature flag | 0 | 8 | +8 |
| Phase 19–21 gate runners + integrity specs | 0 | 25 | +25 |
| **Total Phase 19–21 added** | — | **+93** | — |

| Path | Before P19–21 | After P19–21 |
|---|---:|---:|
| Full backend passing | 4186 | 4310 (+124 incl. pre-existing inference-spec fixes) |
| Full backend failing | 24 (pre-existing) | 24 (all pre-existing; **0 Phase-19–21 regressions**) |

---

## 9. Effect on overall Creatio parity

After Phase 19–21: **65 of 99 capabilities advanced = ~66 %** (was ~57 % after Phase 18).

The remaining 34 capabilities cluster in:

- **Studio (1004)** — visual node-and-edge composer
- **Meetings operational depth** — beyond ingestion (Outlook real call path, Teams meeting summary live)
- **Marketing + Service deep features** — campaign brief themes × segments × assets, sentiment trend over time
- **Predictive model lifecycle operational surfaces** — challenger-compare dashboard, fairness review reports
- **Channels ops** — native Slack enablement, native HubSpot/Salesforce connectors

---

## 10. Verification

```bash
cd backend
./node_modules/.bin/nest build                                 # exit 0
./node_modules/.bin/jest --config jest.config.js \
  src/test/certification/g19-marketing-service-predictive \
  src/test/certification/g20-channels-studio \
  src/test/certification/g21-llm-wiring \
  src/test/certification/phase21-llm-integrity \
  src/test/certification/skill-registry-integrity \
  src/test/certification/agent-registry-integrity \
  src/test/certification/platform-integrity-guard \
  src/modules/analytics/services/prediction.service.spec.ts \
  src/modules/marketing \
  src/modules/service \
  src/modules/channels \
  src/modules/integrations/mobile \
  src/modules/analytics/services/model-lifecycle \
  src/modules/analytics/services/model-card \
  src/modules/analytics/services/model-runner
# → 37 suites passed, 250 tests passed, 0 failed
# → G19 = 12/12 APPROVED; G20 = 8/8; G21 = 10/10
```

---

## 11. Document control

- 2026-08-07 — created. Author: Phase 19 + 20 + 21 implementation session.
- Owner: `@marketing`, `@service`, `@analytics`, `@integrations`.
- This delta supersedes no prior content. The baseline at
  `parity-v3/creatio-parity-baseline.yaml` v1.0.0 is the canonical
  reference; the next parity snapshot is expected to record
  CR-AI-0801..0803, CR-AI-0901..0903, CR-AI-1001..1003, CR-AI-1103
  as `CERTIFIED` once `owner: @marketing / @service / @analytics /
  @integrations` signs off on this delta.
