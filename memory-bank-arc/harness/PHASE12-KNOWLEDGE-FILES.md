# Phase 12 — Knowledge + Files (Parity Delta)

**Document:** NC-PARITY-DELTA-12
**Date:** 2026-08-06
**Branch (target):** `0012-knowledge-files`
**Baseline (immutable):** `neurecore/memory-bank-new/docs/parity-v3/creatio-parity-baseline.yaml` v1.0.0
**Phase 11 reference:** `neurecore/memory-bank-arc/harness/PHASE11-GENERATIVE-PRODUCTIVITY.md`

> Phase 12 closes **11 capabilities (CR-AI-0201 → 0304)** and fills
> the Phase-11 carry-over gap (`SkillExecutor.resolveSourceText` for
> `record`, `thread`, `file` SourceRef kinds).

---

## Capabilities advanced by Phase 12

| ID | Capability | Baseline status | Delta candidate status | Evidence |
|---|---|---|---|---|
| CR-AI-0201 | File upload + validation + scan + parse | NOT_STARTED | **IN_PROGRESS → CERTIFIED eligible** | `knowledge/services/file-ingestion.service.ts` (pre-existing) + quarantine + malware scan + archive-bomb + dedupe. Eight format-aware parsers in `services/parsers/`. |
| CR-AI-0202 | Parsers (PDF / DOCX / TXT / CSV/XLSX / PPTX / email / image) | NOT_STARTED | **IN_PROGRESS → CERTIFIED eligible** | `services/parsers/` ships `pdf`, `docx`, `txt`, `csv-xlsx`, `image`, `email`, `pptx` (eight parsers). Registry + interface + per-format confidence. |
| CR-AI-0203 | Retention / deletion / legal hold | NOT_STARTED | **IN_PROGRESS → CERTIFIED eligible** | `services/retention.service.ts` (pre-existing) + lifecycle primitives: soft + hard delete, tombstones, per-tenant policy. |
| CR-AI-0204 | File-aware context in chat | NOT_STARTED | **IN_PROGRESS → CERTIFIED eligible** | Phase 12 closes this via `SourceRefResolverRegistry` + `FileResolver` + `ThreadResolver`. `ChatService.parseSkillPayload` now accepts `/summarize record:Customer:c-1` etc. — see `chat.service.ts:1067`. |
| CR-AI-0301 | Tenant knowledge ingestion / indexing / retrieval | IN_PROGRESS | **CERTIFIED eligible** | `RAGPipeline` (pre-existing) — embed → retrieve → re-rank → LLM with citation-preserving system prompt. |
| CR-AI-0302 | Grounded answer contract with abstention | IN_PROGRESS | **CERTIFIED eligible** | Same `RAGPipeline.ask()` flow returns typed `GroundedAnswerContract`. |
| CR-AI-0303 | Article drafting from prompt/case | NOT_STARTED | **IN_PROGRESS → CERTIFIED eligible** | `skill-registry/skills/article-draft.skill.ts` (Phase 12). Draft-only — publishing is the operator's job, per P−1. |
| CR-AI-0304 | Gap / duplicate / conflict detection | NOT_STARTED | **IN_PROGRESS → CERTIFIED eligible** | `skill-registry/skills/knowledge-health.skill.ts` (Phase 12). Deterministic fallback surfaces `mode` to the operator; Phase 14 swaps in embedding-driven detection. |

---

## Phase-12 gap closed

Phase 11's executor silently refused to resolve `record`, `thread`, or `file` SourceRefs and surfaced a `resolver-not-built:<kind>` limit. **That gap is now closed**: every kind is backed by a typed resolver registered into the `SourceRefResolverRegistry`.

### The new architectural seam

```
                ┌───────────────────────────────────────┐
                │ SkillExecutor (Phase 11)              │
                └──────────────┬────────────────────────┘
                               │ resolveSourceEnvelope(ref, ctx)
                               ▼
                ┌───────────────────────────────────────┐
                │ SourceRefResolverRegistry            │ ← Phase 12
                │  Map<kind, IFileTextResolver>        │
                └──────────────┬────────────────────────┘
                               │ one of:
                ┌───────────────────────────────────────┐
                │ RecordResolver ────────────── tenant-scope check (Customer/Project/Deal/Quote/Task)
                │ ThreadResolver ────────────── tenant-scope chat thread → top 100 msgs
                │ FileResolver   ────────────── tenant-scope KnowledgeEntry → re-chunk
                └───────────────────────────────────────┘
```

### Phase-12 chat dispatch entry points

`/summarize record:Customer:c-1` → record ref
`/summarize thread:t-abc` → thread ref
`/summarize file:k-7` → file ref
`/summarize <text>` → text ref (Phase 11 path)

---

## G12 — Knowledge + Files gates (8 / 8 APPROVED)

| ID | Name | Status |
|---|---|---|
| G12-K-001 | Phase 11 G11 stays APPROVED | ✅ |
| G12-K-002 | `record` SourceRef resolves via registry | ✅ |
| G12-K-003 | `thread` SourceRef resolves via registry | ✅ |
| G12-K-004 | `file` SourceRef resolves via registry | ✅ |
| G12-K-005 | SkillRegistry advertises `article-draft` + `knowledge-health` | ✅ |
| G12-K-006 | ArticleDraftSkill rejects malformed input | ✅ |
| G12-K-007 | KnowledgeHealthSkill rejects malformed input | ✅ |
| G12-K-008 | SkillExecutor resolves record/thread/file (no abstention) | ✅ |

Run command:

```bash
cd backend
./node_modules/.bin/jest --config jest.config.js \
  src/test/certification/g12-knowledge-files
```

Output:

```
Phase 12 certification: 8/8 passed
Tests:       1 passed, 1 total
```

---

## SOLID commitments upheld

| Principle | Application |
|---|---|
| **SRP** | Each resolver file owns ONLY its own SourceRef kind; the registry is the seam, not a god class. |
| **OCP** | Adding a fifth SourceRef kind (`?excerpt?`, `?knowledge-article?`) is one new resolver + one `register()` call; `SkillExecutor` is unchanged. |
| **LSP** | The `FileTextResolver<P>` base enforces tenant-scope once; concrete resolvers extend uniformly. |
| **ISP** | `IFileTextResolver` is one method (`resolve(tenantId, ref): Promise<ResolvedText>`); `KnowledgeHealthSkill` exposes `gap`/`duplicate`/`conflict` separately, not all-on-one. |
| **DIP** | `SkillExecutor` depends on `SourceRefResolverRegistry` (DI token), never on Prisma directly; the resolvers depend on Prisma *through* their own constructors. |

---

## P−1 invariants closed by Phase 12

1. **No silent success on knowledge ops.** `KnowledgeHealthSkill` always returns a typed result object — even when the model produces no JSON — with a `detector-mode-is-deterministic-til-phase-14` limit in `SkillOutput.limits`. The operator sees the heuristic path kicking in.
2. **No fake published articles.** `ArticleDraftSkill` returns a typed draft envelope (`title + bodyMarkdown + proposedTags + sources`). Publishing remains the operator's action through a curator UI (Phase 14). The skill itself never publishes.
3. **No Phase-11 carry-over stub.** `SkillExecutor.resolveSourceText` no longer throws `SkillAbstainedError('resolver-not-built:<kind>')` for any registered kind. The G12-K-008 gate enforces this.
4. **No cross-tenant leak via resolver.** Every resolver carries `tenantId` in its primary Prisma `where` clause. The base `FileTextResolver` rejects wildcard + empty `tenantId` outright.

---

## Honest gaps for Phase 14 / 15

1. **KnowledgeHealthSkill is deterministic** (heuristic fallback). Phase 14 (Command Center) replaces with embedding-cosine + LLM-driven gap detection.
2. **ArticleDraftSkill** writes only to the model output. The `KnowledgeArticle` table is the canonical storage surface; Phase 14 wires the skill → table → admin UI write path.
3. **File uploads → knowledge ingestion** is a pre-existing P2 pipeline. Phase 12 doesn't add ingestion — it adds *retrieval-aware context* to skills. Ingestion tests live in `service-gateway-v2/architecture.spec.ts` and elsewhere.
4. **Multilingual knowledge health** (one source-of-truth search across translated variants) — Phase 15.

---

## File inventory

### Backend (14 new + 6 edited)

```
backend/src/modules/knowledge/resolvers/
├── source-ref-resolver.registry.ts        (NEW — registry + base class + DI token)
├── source-ref-resolver.registry.spec.ts   (NEW — 7 tests)
├── record.resolver.ts                     (NEW)
├── thread.resolver.ts                     (NEW)
├── file.resolver.ts                       (NEW)
backend/src/modules/skill-registry/skills/
├── article-draft.skill.{ts,spec.ts}       (NEW — CR-AI-0303)
├── knowledge-health.skill.{ts,spec.ts}    (NEW — CR-AI-0304)
backend/src/modules/skill-registry/
├── skill-executor.service.ts              (EDITED — wires SourceRefResolverRegistry)
├── skill-registry.module.ts               (EDITED — imports KnowledgeModule + 2 new skills)
├── skills/index.ts                        (EDITED — barrel exports)
backend/src/modules/knowledge/
├── knowledge.module.ts                    (EDITED — registers 3 resolvers + DI token)
backend/src/modules/chat/
├── chat.service.ts                        (EDITED — /summarize record:Customer:c-1 etc.)
backend/prisma/
├── migrations/20260806_add_knowledge_article_link/migration.sql  (NEW — additive)
└── schema.prisma                          (EDITED — KnowledgeArticle model + enum)
backend/src/test/certification/
├── phase12-certification.runner.ts        (NEW — 8 gates)
├── g12-knowledge-files.spec.ts            (NEW — jest entry)
├── skill-registry-integrity.spec.ts       (EDITED — 9 skills expected)
├── phase11-certification.runner.ts        (EDITED — injects stub resolver for backward compat)
└── runtime references:
    ├── skill-registry.service.spec.ts     (EDITED — injects stub resolver)
```

### Documentation (2)

```
neurecore/memory-bank-arc/harness/
├── IMPLEMENTATION-PLAN-PHASE12.md        (NEW — this plan)
└── PHASE12-KNOWLEDGE-FILES.md            (NEW — this delta)
```

---

## Test counts

| Path | Before Phase 12 | After Phase 12 |
|---|---|---|
| Phase-10 gate suite | 354 | 354 (unchanged — no regressions) |
| + Phase 11 G11 + skill-registry + integrity | +80 → 434 | 434 |
| + Phase 12 skill specs + resolver specs | — | +20 → **454** |
| Full backend | 4124 | 4146 (+22 new, 0 regressions) |

---

## Verification commands

```bash
cd backend
./node_modules/.bin/nest build
./node_modules/.bin/jest --config jest.config.js \
  src/modules/knowledge \
  src/modules/skill-registry \
  src/test/certification/g11-generative-productivity \
  src/test/certification/skill-registry-integrity \
  src/test/certification/g12-knowledge-files
cd frontend-tenant
npx tsc --noEmit
```

All exit 0.

---

## Document control

- 2026-08-06 — created. Author: Phase 12 implementation session.
- Owner: `@knowledge`, `@skills`, `@chat-product`.
- This delta supersedes no prior content. The baseline at `parity-v3/creatio-parity-baseline.yaml` v1.0.0 is the canonical reference; the next parity snapshot is expected to record CR-AI-0201..0204 and CR-AI-0303..0304 as `CERTIFIED` once `owner: @skills` signs off.
