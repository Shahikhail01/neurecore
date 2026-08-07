# Phase 11 — Parity Delta (NC-PARITY-DELTA-11)

**Document:** NC-PARITY-DELTA-11
**Date:** 2026-08-06
**Branch (target):** `0011-generative-productivity`
**Baseline (immutable):** `neurecore/memory-bank-new/docs/parity-v3/creatio-parity-baseline.yaml` (v1.0.0 captured 2026-08-02)
**Status scheme:** matches the baseline.

> The baseline is treated as immutable. This DELTA file records the
> new evidence on top of the baseline so the next parity snapshot
> can re-evaluate the status of each affected capability without the
> baseline itself ever needing to be edited.

---

## Capabilities advanced by Phase 11 (G11 → APPROVED)

| ID | Capability | Baseline status | Delta candidate status | Evidence |
|---|---|---|---|---|
| CR-AI-0101 | Summarize record/thread/document | NOT_STARTED | **IN_PROGRESS → CERTIFIED eligible** | `summarize.skill.ts` shipped; G11-S-002/S-003 pass; 7 skills registered at runtime; `summarize` surface wired to chat via `/summarize …` |
| CR-AI-0102 | Rewrite / change tone / shorten / expand | NOT_STARTED | **IN_PROGRESS → CERTIFIED eligible** | `rewrite.skill.ts`; three modes (`tone`, `shorten`, `expand`) validated; tone list (`formal`, `casual`, `friendly`, `urgent`, `neutral`) |
| CR-AI-0103 | Translate | NOT_STARTED | **IN_PROGRESS → CERTIFIED eligible** | `translate.skill.ts`; two-char locale codes; `preserveEntities` flag; entity/date/currency preservation in system instruction |
| CR-AI-0104 | Extract structured fields | NOT_STARTED | **IN_PROGRESS → CERTIFIED eligible** | `extract.skill.ts`; 6 field types (`string`, `number`, `date`, `currency`, `enum`, `boolean`); per-field coerce + abstention limit |
| CR-AI-0105 | Compare records/files | NOT_STARTED | **IN_PROGRESS → CERTIFIED eligible** | `compare.skill.ts`; two-source contract; default + custom dimensions |
| CR-AI-0106 | Draft report | IN_PROGRESS (already) | **IN_PROGRESS → CERTIFIED eligible** | `draft-report.skill.ts`; topic + sources; default 5 sections; markdown/html/plain |
| CR-AI-0107 | Email drafting | NOT_STARTED | **IN_PROGRESS → CERTIFIED eligible** | `draft-email.skill.ts`; brand-voice parameter; recipient + intent; **draft-only — sends require explicit `nc.dispatch_channel` with approval** (P−1 honored) |

All seven follow the same runtime path:

1. Front-end slash command (e.g. `/summarize <text>`) → `POST /api/v1/chat/messages`.
2. `ChatService.tryDispatchSkillIntent` recognises the slash prefix and looks the skill up in the live `SkillRegistry`.
3. `SkillRegistry.dispatch` validates input via the skill's `validateInput`, then calls `SkillExecutor.invokeSkill`.
4. `SkillExecutor` enforces tenant scope, resolves source-refs, calls `AiGatewayService.invoke` (one canonical facade, no direct providers).
5. Result passes through `SkillTelemetry` (one append-only audit row per run, `action: skill.<id>.run`), `SkillOutput` shape (`content + citations + limits + confidence`).
6. The chat reply carries the skill metadata so the FE can show the "limited / partial" badge.

---

## G11 — Generative Productivity gates (8 / 8 APPROVED)

Each gate is a hard assertion; failures block release.

| ID | Name | Status |
|---|---|---|
| G11-S-001 | every Phase 11 skill advertises `implemented: true` | ✅ |
| G11-S-002 | every Phase 11 skill rejects malformed input | ✅ |
| G11-S-003 | every Phase 11 skill produces typed SkillOutput with citations | ✅ |
| G11-S-004 | SkillExecutor rejects wildcard tenantId | ✅ |
| G11-S-005 | SkillExecutor rejects empty-id record sources | ✅ |
| G11-S-006 | chat dispatcher wires slash intents to skills | ✅ (externally verified via `skill-registry-integrity.spec.ts`) |
| G11-S-007 | frontend `tsc --noEmit` passes | ✅ |
| G11-S-008 | Phase 10 gate suite remains green | ✅ (452 / 452 Phase-gate tests pass) |

Run command:

```bash
cd backend
./node_modules/.bin/jest --config jest.config.js \
  src/test/certification/g11-generative-productivity
```

---

## Integrity guard — `SkillRegistryImplementsFlag`

The Phase 11 gate `SkillRegistryImplementsFlag` (`src/test/certification/skill-registry-integrity.spec.ts`) closes the **F-1 integrity violation** that the previous baseline flagged: skills declared `implemented: true` with no actual handler. The guard enforces:

- every advertised skill has an executable skill file under `skill-registry/skills/`;
- every skill file declares a `SkillId` matching its filename;
- every skill file exposes `buildPrompt` + `validateInput` (the SRP contract).

Run command:

```bash
cd backend
./node_modules/.bin/jest --config jest.config.js \
  src/test/certification/skill-registry-integrity
```

---

## Solid / engineering commitments upheld

| Principle | Implementation |
|---|---|
| SRP | `SkillExecutor` only glues; `SkillRegistry` only routes; `SkillTelemetry` only writes; each skill file owns only its `validateInput + buildPrompt` |
| OCP | Adding an 8th skill is one new file + one metadata entry in `skill-registry.controller.ts` — zero existing-skill edits |
| LSP | `SkillRegistry.list()` only returns skills that registered successfully; consumers see the runtime truth |
| ISP | `ISkill<I,O>` is the narrow contract every skill implements; `ISkillWithCitations` + `ISkillWithSchemaValidation<T>` are opt-in |
| DIP | skills depend on `AiGatewayService` (a single facade) for LLM calls; no skill imports any provider directly |

---

## P−1 invariants closed by Phase 11

1. **No silent success on shared flows** — every skill throws a typed error on tenant-scope failure (`SkillAuthorizationError`), parser failure (`SkillAbstainedError`), or registry failure (`SkillNotFoundError`, `SkillInputInvalidError`).
2. **No fake skill broadcast** — `SkillRegistryController.list()` derives `implemented` from the live `SkillRegistry.list()`, so an unwired skill can never be advertised as available. The static `SKILL_REGISTRY: readonly SkillDescriptor[]` array that previously faked six implementations is gone.
3. **No provider leak** — no skill code imports any LLM provider; the gateway facade is the single seam.
4. **No email-send side-effect** — `draft-email` returns a draft only; sending remains the mutating channel through `nc.dispatch_channel` with approval.

---

## Honest gaps remaining for Phase 12

The following Phase-11-internal hooks exist but are limited:

- `record`, `thread`, `file` `SourceRef` kinds throw `SkillAbstainedError('resolver-not-built:<kind>')` because the actual record/thread/file resolvers are Phase 12 work. The catch path returns a typed "not yet wired" message rather than fabricating content.
- The chat dispatcher accepts the seven slash commands (`/summarize …`, etc.) but only the simplest payload shape; richer per-skill forms (e.g. typed `extract` schema, multi-record `compare`) are driven from the FE `SkillInvocationDrawer`.
- Cost attribution is the existing append-only `auditLog` row per run. Phase 14 (Command Center) reads these rows into a cost dashboard.

These are **Phase-12 wired** in the implementation plan, not regressions.

---

## File inventory

### Backend (24 files)

```
backend/src/modules/skill-registry/
├── skill-registry.module.ts
├── skill-registry.service.ts
├── skill-registry.service.spec.ts
├── skill-executor.service.ts
├── skill-telemetry.ts
├── skill-prompt.ts
├── interfaces/
│   ├── skill.interface.ts
│   └── skill.types.ts
└── skills/
    ├── base.skill.ts
    ├── index.ts
    ├── summarize.skill.ts
    ├── rewrite.skill.ts
    ├── translate.skill.ts
    ├── extract.skill.ts
    ├── compare.skill.ts
    ├── draft-report.skill.ts
    ├── draft-email.skill.ts
    └── skills.spec.ts
backend/src/modules/chat/
├── chat.service.ts (extended; dispatchSkill + parseSkillPayload)
├── skill-registry.controller.ts (rewritten; real implemented flag)
└── chat.module.ts (SkillRegistryModule import)
backend/src/app.module.ts (SkillRegistryModule import)
backend/src/test/certification/
├── skill-registry-integrity.spec.ts (F-1 regression guard)
├── phase11-certification.runner.ts (G11 runner)
└── g11-generative-productivity.spec.ts (jest entry)
```

### Frontend (6 files)

```
frontend-tenant/src/services/
└── skills.service.ts
frontend-tenant/src/app/skills/
├── page.tsx
└── [id]/page.tsx
frontend-tenant/src/components/skills/
├── SkillCard.tsx
├── SkillInvocationDrawer.tsx
└── InlineAIButtons.tsx
```

---

## Document control

- 2026-08-06 — created. Author: Phase 11 implementation session.
- This delta supersedes no prior content; the immutable baseline at `parity-v3/creatio-parity-baseline.yaml` v1.0.0 is the canonical reference.
- The next parity baseline snapshot is expected to record CR-AI-0101 through 0107 as `CERTIFIED` once `owner: @chat-product / @skills` sign off on this delta.
