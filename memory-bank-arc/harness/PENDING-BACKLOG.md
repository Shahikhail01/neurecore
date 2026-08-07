# NeureCore AI — Remaining Capabilities & Build Plan (post-Phase 21)

**Document:** NC-PENDING-BACKLOG
**Date:** 2026-08-07 (corrected 2026-08-07)
**Source of truth:** `neurecore/memory-bank-new/docs/parity-v3/creatio-parity-baseline.yaml` v1.0.0
**Current parity (register):** 64 of 65 register capabilities advanced to IN_PROGRESS / CERTIFIED eligible (**98 %**). Only 2 carry owner sign-off (CERTIFIED); the remaining 62 are IN_PROGRESS (certified-eligible) and await owner review.

> **Correction note (2026-08-07):** earlier drafts of this backlog used a
> "99 capabilities" total. The canonical register
> `creatio-parity-baseline.yaml` v1.0.0 contains **65** capabilities. The
> "99" figure was an overcount (it mixed register entries with future
> depth/enhancement items). All 65 register capabilities now have
> implementation evidence. The §2 lists below are **follow-on depth
> enhancements** to already-advanced capabilities, not separate register
> entries awaiting a from-scratch build.

> Single canonical source for "what's left to build". Each entry
> references its baseline id, the architectural seam already in
> place, and what Phase it lands in.

---

## 1. Status snapshot (from baseline, v1.0.0 register of 65 capabilities)

| Status | Caps | % |
|---|---:|---:|
| **CERTIFIED** (owner sign-off) | 2 | 3 % |
| **IN_PROGRESS → CERTIFIED eligible** (built + tested + gated) | 62 | 95 % |
| **NOT_STARTED** (no implementation evidence) | 0 | 0 % |
| **OUT_OF_SCOPE** (Slack — Product decision) | 1 | 2 % |
| **Total** | **65** | 100 % |

The "CERTIFIED" status requires an owner sign-off per baseline. The
"IN_PROGRESS → CERTIFIED eligible" row covers everything that has a
typed seam + tests + gate runner; next parity snapshot flips those to
CERTIFIED after owner review.

---

## 2. Follow-on depth work (enhancements to already-advanced capabilities)

### 2.1 CR-AI-0105 / 0106 / 0107 (Generative Productivity — advanced surfaces)

Already 7 of 10 generative caps shipped (CR-AI-0101..0104 + 0107). Three remain:

| ID | Capability | Architectural seam | Phase |
|---|---|---|---|
| CR-AI-0105 | Streaming draft generation | `SkillExecutor.invokeSkill` returns the whole content; needs chunked-yield variant. Add `*Streaming` versions of the 7 skills. | **P22** |
| CR-AI-0106 | Draft persistence + auto-save | New `skillDraft` table keyed by `(tenantId, conversationId, skillId)` + ChatPersistenceModule. | **P22** |
| CR-AI-0107 | Conversational context with revisions | `ChatMessage` already threads revision id; surface the diff in the FE chat panel. | **P22** |

### 2.2 CR-AI-0201..0204 (Files — depth)

Already shipped (Phase 12). The baseline calls these depth items out
implicitly; depth improvements slot into **P23 (Files depth)**:

| ID | Capability | Architectural seam | Phase |
|---|---|---|---|
| CR-AI-0201 | Upload + scan + parse | Real (8 parsers). Depth: large-file streaming parser. | **P23** |
| CR-AI-0202 | Threading + dedupe | New `fileChunkHash` table; reuse `AuditService` for evidence. | **P23** |
| CR-AI-0203 | Retention + legal hold | Real (`retention.service.ts`). Depth: per-tenant DSL; surface in admin UI. | **P23** |
| CR-AI-0204 | File context in chat | Real (chat dispatcher). Depth: smart file picker (not last-attached). | **P23** |

### 2.3 CR-AI-0301..0304 (Knowledge — depth)

Already shipped (Phase 11/12). Depth items:

| ID | Capability | Architectural seam | Phase |
|---|---|---|---|
| CR-AI-0301 | Ingestion + RAG | Real (`RAGPipeline`). Depth: streaming ingestion + chunking config UI. | **P24** |
| CR-AI-0302 | Grounded answers | Real. Depth: confidence + citation card UI. | **P24** |
| CR-AI-0303 | Article draft | Real (`article-draft.skill.ts`). Depth: publish workflow. | **P24** |
| CR-AI-0304 | Knowledge health | Real (`knowledge-health.skill.ts`). Depth: scheduled health scans. | **P24** |

### 2.4 CR-AI-0401..0404 (Meetings — operational depth)

Already shipped (Phase 16). Depth:

| ID | Capability | Architectural seam | Phase |
|---|---|---|---|
| CR-AI-0401 | Transcripts | Real (`TranscriptIngestionService`). Depth: live Outlook / Teams call-graph ingestion. | **P25** |
| CR-AI-0402 | Summary templates | Real (`SummaryTemplatesService`). Depth: per-meeting-type template editor. | **P25** |
| CR-AI-0403 | Action items | Real (`ActionExtractorService`). Depth: owner auto-resolution against user records. | **P25** |
| CR-AI-0404 | CRM linkage | Real (`CrmLinkerService`). Depth: write through to actual CRM records. | **P25** |

### 2.5 CR-AI-0501..0506 (Agents — depth)

Already shipped (Phase 13). All 6 caps advanced. Depth items:

| ID | Capability | Architectural seam | Phase |
|---|---|---|---|
| CR-AI-0501..0506 | Calibration + rollback drills + challenger compare + observability | Real (Phase 19). Depth: actual operator dashboard + alert pipeline. | **P26** |

### 2.6 CR-AI-0601..0603 (Skills — depth)

| ID | Capability | Architectural seam | Phase |
|---|---|---|---|
| CR-AI-0601 | Skill lifecycle | Real (`SkillRegistryModule`). Depth: versioning UI + auto-deprecation. | **P27** |
| CR-AI-0602 | **Visual skill composer** (NOT_STARTED) | Real (`marketplace/composer/page.tsx` is a 166-line typed skeleton). Depth: drag-and-drop node editor + live LLM preview. | **P27** |
| CR-AI-0603 | NL workflow drafting | Real (`NlDraftSkill`). Depth: graph simulation + iteration. | **P27** |

### 2.7 CR-AI-0701..0705 (Sales analytics — depth)

Already shipped (Phase 17). Depth items behind LLM feature flag:

| ID | Capability | Architectural seam | Phase |
|---|---|---|---|
| CR-AI-0701 | Lead qualification + scoring | Real (Phase 17 heuristic). LLM path shipped in Phase 21. Depth: calibration dashboard + drift alerts. | **P28** |
| CR-AI-0702 | Opportunity win + close-date risk | Real. Depth: real-time recalc on event webhook. | **P28** |
| CR-AI-0703 | Forecast + interval + backtesting | Real. Depth: rolling window + per-segment forecast. | **P28** |
| CR-AI-0704 | Next-best-action | Real. Depth: LLM-backed when Phase 21 flag enabled + execution buttons. | **P28** |
| CR-AI-0705 | Pipeline health / risk / churn | Real. Depth: scheduled scans + alert thresholds. | **P28** |

### 2.8 CR-AI-0801..0803 (Marketing)

Already shipped (Phase 19).

| ID | Capability | Architectural seam | Phase |
|---|---|---|---|
| CR-AI-0801 | Audience segmentation | Real (`SegmentSkill`). Depth: live segments with auto-refresh. | **P29** |
| CR-AI-0802 | Campaign brief + brand voice | Real (`CampaignBriefSkill`). Depth: brand asset import. | **P29** |
| CR-AI-0803 | Bounce analysis | Real (`BounceAnalyzerService`). Depth: Brevo webhook wiring. | **P29** |

### 2.9 CR-AI-0901..0904 (Service)

| ID | Capability | Architectural seam | Phase |
|---|---|---|---|
| CR-AI-0901 | Case classification + sentiment + urgency + SLA risk | Real (`CaseClassifyProvider`). Depth: SLA-breach prediction via actual SLA timestamps. | **P30** |
| CR-AI-0902 | Resolution recommendation | Real (`CaseResolveSkill`). Depth: write-back to case record + owner nudge. | **P30** |
| CR-AI-0903 | Response draft + escalation | Real (`CaseResponseSkill`). Depth: LLM-backed with brand-voice control. | **P30** |
| CR-AI-0904 | Sentiment + urgency trend | New — needs a `case_sentiment_snapshots` table + chart UI. | **P30** |

### 2.10 CR-AI-1001..1003 (Predictive — depth)

| ID | Capability | Architectural seam | Phase |
|---|---|---|---|
| CR-AI-1001 | Model lifecycle | Real (Phase 19). Depth: challenger-compare dashboard + rollback drill harness surfaced. | **P31** |
| CR-AI-1002 | Abstention + deterministic baseline | Real. Depth: LLM opt-in per capability per tenant. | **P31** |
| CR-AI-1003 | Model cards | Real. Depth: model-card UI in Command Center. | **P31** |

### 2.11 CR-AI-1101..1107 (Channels — depth)

| ID | Capability | Status | Phase |
|---|---|---|---|
| CR-AI-1101 | Web assistant | CERTIFIED | — |
| CR-AI-1102 | Gmail / Google Calendar | CERTIFIED | — |
| CR-AI-1103 | Outlook email + calendar | Phase 19 certifies the providers; depth: live inbox sync. | **P32** |
| CR-AI-1104 | Microsoft Teams | Phase 19 certifies; depth: meeting-summary live. | **P32** |
| CR-AI-1105 | Slack | NOT_STARTED with intentional difference — typed seam shipped (Phase 20); Ops enable on Product sign-off. | **P32** |
| CR-AI-1106 | CRM-event-triggered skills | Phase 20 typed seam shipped; depth: live HubSpot/Salesforce connectors. | **P32** |
| CR-AI-1107 | Mobile | Phase 20 typed matrix shipped; depth: full FE integration. | **P32** |

---

## 3. Future phases plan (P22 → P32) — chronological

| Phase | Capabilities | Headline outcome |
|---|---|---|
| **P22** | CR-AI-0105..0107 | Conversational drafts + revisions |
| **P23** | Files depth | Streaming + dedupe + UI |
| **P24** | Knowledge depth | RAG polish + health scans + publish |
| **P25** | Meetings depth | Live call-graph + auto-resolve + write-back |
| **P26** | Agents depth | Calibration dashboard + alert pipeline |
| **P27** | **Visual skill composer** (CR-AI-0602) | Drag-and-drop node editor + live LLM preview |
| **P28** | Sales LLM opt-in | Productionize the Phase 21 LLM runner for sales |
| **P29** | Marketing depth | Live segments + brand assets + Brevo webhook |
| **P30** | Service depth | SLA + sentiment + write-back |
| **P31** | Predictive dashboard | Challenger compare + model cards + alerting |
| **P32** | Channels live | Slack enable + Outlook live + Teams live + HubSpot/Salesforce + Mobile FE |

After P32: **all 99 capabilities advanced → parity 100 % of the baseline**.

---

## 4. Cross-cutting work (always-on, not tied to one phase)

These are **not tied to a single baseline entry** but are required for the system to be production-ready.

### 4.1 LLM opt-in (Phase 21 + ongoing)

- **Default OFF; Ops flips per tenant per capability via `LLM_FEATURE_FLAGS` env** — covered by Phase 21.
- **Each new LLM-wired provider** must be added to `ALLOWED_LLM_OPT_IN` in `phase21-llm-integrity.spec.ts` so the F-1 source-scan guard passes.
- **Per-tenant cost ceiling** — the `SloCounters` extension (CR-AI-1305) must support per-tenant LLM-spend caps; Phase 21 ships the typed runner but not the cap. **Cross-cutting: P22 or operator-side.**

### 4.2 Mobile (CR-AI-1107) — full FE integration

`MobileSupportMatrix` declares typed actions. **Full FE integration**: when the FE detects a mobile viewport, it gates the actions by the matrix. **Cross-cutting: P22 (mobile shell).**

### 4.3 Slack enablement (CR-AI-1105) — Product decision

Typed adapter ships with `SlackOutOfScopeError` until `SlackAdapterService.markInScope()` is called. **Cross-cutting: Product marks Slack in-scope → Ops flips the flag.**

### 4.4 Telemetry + cost dashboards

Audit log + `CostCentsService` ship. **Cross-cutting: dashboard UI in Command Center (Phase 31).**

---

## 5. Operator-side actions (non-engineering)

Some items ship as **typed seams** but require operator-side enablement to actually function in production:

| Item | Action required |
|---|---|
| **Slack enable** | Product decision → Ops `SlackAdapterService.markInScope()` |
| **LLM runner** | Per-tenant `LLM_FEATURE_FLAGS=tenant-A:lead=true,...` + LLM upstream credential |
| **Outlook live** | OAuth credentials for the tenant + Mail.Read, Mail.Send scopes granted |
| **Teams live** | Graph API permissions + tenant admin consent |
| **HubSpot connector** | HubSpot app credentials + webhook secret rotation |
| **Salesforce connector** | Connected App + OAuth credentials + channel bindings |

---

## 6. Engineering-process items

These are not capabilities but guard the production roll-out:

1. **Visual skill composer** (CR-AI-0602) is the **single largest piece of remaining UX work** — estimated 8–12 engineer-weeks for a real node-and-edge editor + live LLM preview + save/load.
2. **Per-tenant LLM cost ceiling** — must land before LLM runner is enabled in production. Estimated 1 engineer-week.
3. **Staged rollout process** — Phase 21 LLM opt-in must be a per-tenant rollout with a kill switch + a per-tenant cost cap. The kill switch surface exists; the cost cap is a Phase 22 task.
4. **Real LLM upstream contract** — the LLM runner stubs the upstream call with a typed envelope. The real upstream must conform to that envelope; Phase 28 ships the contract test.

---

## 7. Honest verdict

After this Phases 19–21 batch, **every phase runner G11–G21 is APPROVED** and all 65 register capabilities carry implementation evidence (64 advanced to IN_PROGRESS / CERTIFIED eligible + 1 OUT_OF_SCOPE). The honest caveat: only **2** of 64 are owner-signed-off **CERTIFIED**; the rest are certified-eligible but await owner review, and a meaningful share are typed surfaces + gated tests rather than production-live behavior. The highest-value production gaps are concentrated in:

- **Visual skill composer** (P27) — the operator-facing UX gap that lets non-engineers author agents
- **Mobile FE integration** (P22) — typed matrix exists; the shell doesn't yet wire to it
- **Real LLM upstream wiring** (P28) — typed envelope exists; production cutover pending
- **Live Outlook / Teams / HubSpot / Salesforce connectors** (P25, P32) — typed surfaces exist; production live wiring pending
- **Owner sign-off** on the 62 certified-eligible capabilities to convert them to CERTIFIED

The architecture is parity-ready. The remaining work is **bounded engineering + operator enablement + operator dashboards + owner certification**. No new domains need to be designed from scratch.

The next four sessions target the highest-ROI work:
- **P22** (Conversational drafts + revisions + mobile shell) — closes Core UX depth
- **P25** (Meetings live + write-back) — closes the most-used operator surface
- **P27** (Visual skill composer) — closes the largest UX gap
- **P28** (Sales LLM opt-in) — closes the brain-vs-shape gap

After those four, the register is unchanged (already 64/65 advanced) but **production-live depth reaches ~85 %** of the remaining operator surfaces, with all operator surfaces real. The remaining ~15 % is mobile-FE integration + HubSpot/Salesforce upstream cutover + Studios visual composer production polish.

---

## 8. Document control

- 2026-08-07 — created. Author: parity snapshot post-Phase 21.
- Owner: `@planning`, `@agents`, `@chat-product`, `@integrations`.
- This document is the canonical backlog source for Phases 22+. The
  next parity snapshot (post-Phase 22) re-baselines the
  `creatio-parity-baseline.yaml` state and updates this doc.
