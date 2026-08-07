# Phase 15 + 16 + 17 + 18 — Core UX / Meetings / Sales / Platform Implementation Plan

**Document:** NC-PLAN-PHASE-15-18
**Date:** 2026-08-06
**Branches:**
- `0015-core-ux` — Phase 15 (CR-AI-0001..0004) — first PR
- `0016-meetings` — Phase 16 (CR-AI-0401..0404) — second PR
- `0017-sales-analytics` — Phase 17 (CR-AI-0701..0705) — third PR
- `0018-platform` — Phase 18 (CR-AI-1301..1305) — fourth PR
**Baseline:** `neurecore/memory-bank-new/docs/parity-v3/creatio-parity-baseline.yaml` v1.0.0

> Four phases ship as four consecutive PRs. Each ships independently
> green and does not regress any prior phase's gate.

---

## 0. Executive summary — what each phase covers

| Phase | Capabilities | Outcome |
|---|---|---|
| **P15** Core UX | CR-AI-0001 + 0002 + 0003 + 0004 | 4 → IN_PROGRESS / CERTIFIED eligible |
| **P16** Meetings | CR-AI-0401 + 0402 + 0403 + 0404 | 4 → IN_PROGRESS / CERTIFIED eligible |
| **P17** Sales | CR-AI-0701 + 0702 + 0703 + 0704 + 0705 | 5 → IN_PROGRESS / CERTIFIED eligible |
| **P18** Platform | CR-AI-1301 + 1302 + 1303 + 1304 + 1305 | 5 → IN_PROGRESS / CERTIFIED eligible |

Total: **18 capabilities** advanced. After this batch the running
parity total becomes **~57 %** (38 of 99 → 56 of 99).

---

## 1. Phase 15 — Core UX (in flight)

Three new backend services + FE hardening:

- **`page-context.dto.ts` + `page-context.gateway.ts`** — typed page context, server-side re-authorization. Closes CR-AI-0002.
- **`multilingual/response-localizer.ts`** — locale negotiation, entity preservation. Closes CR-AI-0004.
- **`services/chat-export.service.ts`** — export/delete/redact pipeline for chat history. Closes CR-AI-0003.
- **FE** — `UnifiedChatPanel` (both frontends) gets typed PageContext + localization hint + retry/cancel buttons.
- **G15** — gate runner with 8 gates.

## 2. Phase 16 — Meetings (next)

Four new backend services + a Meetings module + FE surfaces:

- **`meetings/services/transcript-ingestion.service.ts`** — `MeetingTranscript` model + jurisdiction-aware consent record + storage adapter hook. Closes CR-AI-0401.
- **`meetings/services/summary-templates.service.ts`** — 4 templates (decisions, actions, risks, sentiment) per meeting type. Closes CR-AI-0402.
- **`meetings/services/action-extractor.service.ts`** — extracts action items with owner/due/confidence; ambiguous owners flagged. Closes CR-AI-0403.
- **`meetings/services/crm-linker.service.ts`** — links a meeting to account/contact/lead/opportunity/case + writes follow-ups through the work-runtime gate. Closes CR-AI-0404.
- **G16** — gate runner with 8 gates.

## 3. Phase 17 — Sales analytics (third)

The 5 baseline entries are mostly stubbed from prior phases. Phase 17 deepens the implementation behind each provider so the
typed envelope is real, not a placeholder:

- **`analytics/providers/lead-score.provider.ts`** — fill in real scoring math with calibration + explanation + abstention. Closes CR-AI-0701.
- **`analytics/providers/opportunity-win.provider.ts`** — fill in real win probability + close-date risk math. Closes CR-AI-0702.
- **`analytics/providers/forecast.provider.ts`** — fill in real forecast with interval + backtest harness. Closes CR-AI-0703 (already had Deal model wiring from R3).
- **`analytics/providers/nba-sales.provider.ts`** — finalize the Next-Best-Action provider's deterministic ranking. Closes CR-AI-0704 (was IN_PROGRESS).
- **`analytics/providers/pipeline-health.provider.ts`** — fill in pipeline health / risk / inactivity / churn. Closes CR-AI-0705.
- **G17** — gate runner with 10 gates.

## 4. Phase 18 — Platform (fourth)

Closures:

- **`agents/agents-tenant-scope.guard.ts`** — typed wildcard-rejecting guard, applied to every public `AgentsService` method. Closes CR-AI-1301 (the noted wildcard bypass).
- **`retention/retention-policies.service.ts`** — typed `RetentionPolicyDSL` + chat-history export/delete bridge. Closes CR-AI-1302.
- **`audit/audit-evidence-correlation.service.ts`** — append-only evidence chain per correlationId. Closes CR-AI-1303.
- **A11y:** `frontend-tenant/src/shared/a11y/{useFocusTrap,LiveAnnouncer,index}.ts` + `RoleGate.tsx` WCAG AA helper. Closes CR-AI-1304.
- **Resilience:** `service-gateway-v2/rollout/slo-counters.ts` extended with rate+cost per `(tenantId, capability)` pair. Closes CR-AI-1305.
- **G18** — gate runner with 10 gates.
- **`platform-integrity-guard.spec.ts`** — F-1 guard: every agents.* public method calls `assertTenantScope` exactly once at top.

---

## 5. SOLID commitments

| Principle | Application |
|---|---|
| **SRP** | Each new file owns ONE concern. The 4 Meeting services, 5 analytics providers, 3 platform wrappers — every one is independently testable. |
| **OCP** | New summary template = one row + one enum. New analytics provider = one file + one registry entry. New platform wrapper = one DI token + one method. |
| **LSP** | Every analytics provider substitutes the canonical `IAnalyticsProvider<I, O>`; every meeting service substitutes `ITranscriptIngestor` / `IActionExtractor` / etc. |
| **ISP** | Each interface is narrow. `RetentionPolicyDSL` is a small union type. `IGatedKillSwitch` is one method. |
| **DIP** | All services depend on injected interfaces + the canonical `PrismaService`. New `AGENT_TENANT_SCOPE` DI token. |

---

## 6. Verification

```bash
cd backend
./node_modules/.bin/nest build
./node_modules/.bin/jest --config jest.config.js \
  src/modules/chat \
  src/modules/meetings \
  src/modules/analytics \
  src/modules/agents \
  src/modules/audit \
  src/modules/retention \
  src/test/certification/g15-core-ux \
  src/test/certification/g16-meetings \
  src/test/certification/g17-sales-analytics \
  src/test/certification/g18-platform \
  src/test/certification/platform-integrity-guard
cd frontend-tenant && npx tsc --noEmit
cd frontend-admin && npx tsc --noEmit
```

---

## 7. Document control

- 2026-08-06 — created. Owner: `@chat-product`, `@meetings`, `@analytics`, `@platform`.
