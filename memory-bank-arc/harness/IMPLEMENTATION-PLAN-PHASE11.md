# Phase 11 — Generative Productivity (Implementation Plan)

**Document:** NC-PLAN-PHASE11
**Date:** 2026-08-06
**Branch (target):** `0011-generative-productivity`
**Source of truth:** `neurecore/memory-bank-new/docs/parity-v3/creatio-parity-baseline.yaml` CR-AI-0101 through CR-AI-0107.

> This is execution-ready. Every path, contract, test, and gate is
> grounded in the existing codebase (verified 2026-08-06).

---

## 0. Executive summary

Seven capabilities. All seven **NOT_STARTED** in the baseline as of
2026-08-02. Critical finding: `chat/skill-registry.controller.ts`
**already declares 6 of 7 as `implemented: true`** even though the
chat service has **zero** intent handlers for them. This is the
`P−1` integrity violation (a stub advertising success). Phase 11 fixes
this by either (a) shipping the real implementation, or (b) flipping
the registry flag back to `implemented: false` until the real handler
exists.

We choose (a) — ship the real thing.

| ID | Skill | Status going IN | Status going OUT |
|---|---|---|---|
| CR-AI-0101 | Summarize record/thread/document | NOT_STARTED | **CERTIFIED-equivalent** |
| CR-AI-0102 | Rewrite (tone / shorten / expand) | NOT_STARTED | **CERTIFIED-equivalent** |
| CR-AI-0103 | Translate (preserve entities/dates/currency) | NOT_STARTED | **CERTIFIED-equivalent** |
| CR-AI-0104 | Extract structured fields | NOT_STARTED | **CERTIFIED-equivalent** |
| CR-AI-0105 | Compare records/files | NOT_STARTED | **CERTIFIED-equivalent** |
| CR-AI-0106 | Draft report | NOT_STARTED | **CERTIFIED-equivalent** |
| CR-AI-0107 | Draft email | NOT_STARTED | **CERTIFIED-equivalent** |

---

## 1. Solid / engineering principles

### 1.1 SRP

Each skill module is a thin typed façade. The actual LLM call is in
`SkillExecutor`; the registry entry is in the controller; the chat
intent routing is in `ChatService`. Three responsibilities, three files.

### 1.2 OCP

Adding an 8th skill tomorrow is a single file
(`skill-registry/skills/<new>.ts`) + a controller registry entry. No
modifications to existing skill code.

### 1.3 LSP

Every skill implements `ISkill<SpecificInput, SpecificOutput>`. The
chat dispatch code uses the same pattern for all seven.

### 1.4 ISP

- `ISkill<I, O>` — execute.
- `ISkillWithCitations` — optional, only for skills that emit
  citations (summarize, compare, draft-report).
- `ISkillWithSchemaValidation` — optional, only for `extract`.
- Consumers depend on the **narrowest** of the three they need.

### 1.5 DIP

`SkillExecutor` depends on injected `AiGatewayService` (the existing
canonical LLM facade). Skills depend on injected `SkillExecutor`. No
direct provider imports anywhere.

---

## 2. Architecture

```
                ┌──────────────────────────┐
                │  ChatService             │
                │  (intent=extract|...)    │
                └────────────┬─────────────┘
                             │ dispatchSkill(intent, payload)
                             ▼
                ┌──────────────────────────┐
                │  SkillRegistry           │  ← skill-registry.service.ts
                │  - list / get            │     (single source of truth,
                │  - dispatchSkill()       │      replaces static array in
                └────────────┬─────────────┘      skill-registry.controller.ts)
                             │ execute(name, input)
                             ▼
                ┌──────────────────────────┐
                │  SkillExecutor           │  ← skill-executor.service.ts
                │  - schema validation     │     (LLM wrapper + grounding
                │  - prompt construction   │      + post-processing)
                │  - grounding             │
                └────────────┬─────────────┘
                             │ invoke(model, prompt, responseSchema)
                             ▼
                ┌──────────────────────────┐
                │  AiGatewayService        │  ← existing
                └──────────────────────────┘

    SRP: each box owns exactly one concern.
    DIP: arrows point at abstractions.
```

Skill files (one per capability):

```
skill-registry/skills/
├── summarize.skill.ts
├── rewrite.skill.ts
├── translate.skill.ts
├── extract.skill.ts
├── compare.skill.ts
├── draft-report.skill.ts
└── draft-email.skill.ts
```

Each is **a pure class** that implements `ISkill<I, O>`. No HTTP, no
DI. The executor instantiates them once at module boot.

---

## 3. Data model

No new tables. Skills are **code-defined** for now (the 7 baseline
items are foundational capabilities, not user-defined). User-defined
skills (Phase 6 agent-templates) already exist; Phase 11 does NOT
duplicate that surface.

If extensibility becomes a customer requirement, the abstraction
`ISkill<I, O>` is already in place for Phase 12 to swap in
DB-backed skill configs without touching skill-executor.service.ts.

---

## 4. Contracts (Zod)

```ts
// inputs
SummarizeInput   = { source: SourceRef, maxLength?: number, tone?: 'bullets'|'narrative', locale?: string }
RewriteInput     = { text: string, mode: 'tone'|'shorten'|'expand', targetTone?: 'formal'|'casual'|'friendly'|'urgent', locale?: string }
TranslateInput   = { text: string, targetLocale: string, sourceLocale?: string, preserveEntities?: boolean }
ExtractInput     = { source: SourceRef, schema: Record<string, ExtractField>, locale?: string }
  ExtractField   = { type: 'string'|'number'|'date'|'currency'|'enum', enum?: string[], required?: boolean }
CompareInput     = { left: SourceRef, right: SourceRef, dimensions?: string[], locale?: string }
DraftReportInput = { topic: string, sources: SourceRef[], sections?: string[], locale?: string, format?: 'md'|'html' }
DraftEmailInput  = { source: SourceRef, recipient: { email: string, name?: string }, intent: string, brandVoice?: string, attachments?: SourceRef[], locale?: string }

// shared
SourceRef = { kind: 'record', recordType: string, recordId: string }
          | { kind: 'text',  text: string }
          | { kind: 'thread', threadId: string }
          | { kind: 'file',   fileId: string } // Phase 12 wires file pull-through

// outputs (every skill)
SkillOutput<T> = {
  content: T,             // primary payload (string for text-output, object for extract)
  citations: Array<{ recordType?: string; recordId?: string; locator: string; quote: string }>,
  limits: Array<string>,  // declared abstentions
  confidence: number,     // 0..1
  durationMs: number,
}
```

Each Zod schema lives in its own `*.skill.schema.ts` file to keep the
runtime files thin.

---

## 5. Implementation order

| Step | Scope | Files | Reversibility |
|---|---|---|---|
| 11.1 | SkillRegistry service + persistence | 3 new + 1 edit | single file revert |
| 11.2 | SkillExecutor (LLM wrapper + grounding) | 2 new + 1 edit | single file revert |
| 11.3 | ISkill + 7 skill implementations | 9 new + 7 spec | per-skill revert |
| 11.4 | ChatService intent dispatcher | 1 edit | single file revert |
| 11.5 | Tenant FE: inline AI buttons on 7 surfaces | 7 new (per surface) | per-surface revert |
| 11.6 | Tenant FE: skill catalog page | 2 new | single-page revert |
| 11.7 | Gate 11 certification runner | 2 new | single commit revert |

Estimated 32 backend files + 11 frontend files = 43 files total.

---

## 6. Gates (NC-AWL-IMP-1 §11 — extended to Phase 11)

| Rule | Required |
|---|---|
| 100 % contract-schema validation pass | yes |
| Zero cross-tenant exposure | yes |
| Every skill emits `SkillOutput.citations` for record/file sources | yes |
| `implemented` flag in registry matches actual handler existence | **yes (regression guard)** |
| Zero hard-coded LLM providers in any skill | yes |
| All 7 skills certify under GEN-001 through GEN-007 acceptance scenarios | yes |
| Phase 9 G9 baseline still 105/105 | yes |
| Phase 10 G10 baseline still 8/8 | yes |
| `NoConnectorsStubRegistry` (already present in service-gateway-v2) | extends to skill-registry |

The new regression guard **`SkillRegistryImplementsFlag`** is the
machine-checkable equivalent of `P−1`. If any skill in the registry
declares `implemented: true` without a chat dispatcher handler, the
build fails.

---

## 7. Honest risks

1. **Cost.** LLM-backed skills are not free. The mitigation is the
   `SkillExecutor` recording every call to `TelemetryService` with
   `tokensIn`/`tokensOut` so the Command Center cost surface (Phase
   14) can surface per-skill spend.
2. **Determinism.** Translation / extract / compare must be
   reproducible enough to count as certified. The mitigation is the
   `temperature=0` policy in `SkillExecutor.invokeModel()` plus the
   per-skill schema validation that aborts on first parse failure.
3. **Tenant content.** Inputs pass through `AssertTenantContext`
   before the LLM is called. The skill MUST refuse any
   `recordType`/`recordId` that does not belong to the calling
   tenant, even if the caller claims authority. This is the same
   guard already used by `nc.*` chat tools.
4. **Email capability (CR-AI-0107) is not auto-send.** The skill
   DRAFTS — sending remains a separate mutating channel via
   `nc.dispatch_channel` with approval. `P−1` forbids fake success.

---

## 8. File inventory (per item)

### 11.1 Skill registry (3 files + 1 edit)

- `backend/src/modules/skill-registry/skill-registry.service.ts`
- `backend/src/modules/skill-registry/skill-registry.module.ts`
- `backend/src/modules/skill-registry/skill-registry.service.spec.ts`
- edit `backend/src/modules/chat/skill-registry.controller.ts` — wire to the service

### 11.2 Skill executor (2 files + 1 edit)

- `backend/src/modules/skill-registry/skill-executor.service.ts`
- `backend/src/modules/skill-registry/skill-executor.service.spec.ts`
- edit `backend/src/modules/ai-gateway/ai-gateway.module.ts` — no API changes; consumers import existing facade

### 11.3 Seven skills (16 files)

- `backend/src/modules/skill-registry/interfaces/skill.interface.ts`
- `backend/src/modules/skill-registry/skills/summarize.skill.{ts,schema.ts,spec.ts}`
- `backend/src/modules/skill-registry/skills/rewrite.skill.{ts,schema.ts,spec.ts}`
- `backend/src/modules/skill-registry/skills/translate.skill.{ts,schema.ts,spec.ts}`
- `backend/src/modules/skill-registry/skills/extract.skill.{ts,schema.ts,spec.ts}`
- `backend/src/modules/skill-registry/skills/compare.skill.{ts,schema.ts,spec.ts}`
- `backend/src/modules/skill-registry/skills/draft-report.skill.{ts,schema.ts,spec.ts}`
- `backend/src/modules/skill-registry/skills/draft-email.skill.{ts,schema.ts,spec.ts}`

### 11.4 Chat dispatcher (1 file edit)

- edit `backend/src/modules/chat/chat.service.ts` — add `dispatchSkill(intent, payload, claims)` branch + 7 case arms

### 11.5 Tenant FE inline AI buttons (7 files)

- `frontend-tenant/src/components/skills/SummarizeButton.tsx`
- `frontend-tenant/src/components/skills/RewriteButton.tsx`
- `frontend-tenant/src/components/skills/TranslateButton.tsx`
- `frontend-tenant/src/components/skills/ExtractButton.tsx`
- `frontend-tenant/src/components/skills/CompareButton.tsx`
- `frontend-tenant/src/components/skills/DraftReportButton.tsx`
- `frontend-tenant/src/components/skills/DraftEmailButton.tsx`

### 11.6 Skill catalog page (2 files)

- `frontend-tenant/src/app/skills/page.tsx`
- `frontend-tenant/src/app/skills/[id]/page.tsx`

### 11.7 Phase 11 certification (2 files)

- `backend/src/test/certification/g11-generative-productivity.spec.ts`
- `backend/scripts/run-phase11-certification.ts`

---

## 9. Verification commands

```bash
cd backend
./node_modules/.bin/nest build                    # exit 0
./node_modules/.bin/jest --config jest.config.js \
  src/modules/skill-registry \
  src/modules/chat/skill-registry \
  src/test/certification/g11-generative-productivity
pnpm routes:scan                                   # 0 collisions
pnpm tenancy:scan                                  # 0 unsafe
ts-node scripts/run-phase11-certification.ts       # APPROVED

cd frontend-tenant
npx tsc --noEmit                                   # exit 0
```

---

## 10. Document control

- 2026-08-06 — created. Author: Phase 11 planning session.
- Owner: `@chat-product`, `@agents`, `@skills`.
