# Phase 12 — Knowledge + Files Implementation Plan

**Document:** NC-PLAN-PHASE12
**Date:** 2026-08-06
**Branch (target):** `0012-knowledge-files`
**Baseline:** `neurecore/memory-bank-new/docs/parity-v3/creatio-parity-baseline.yaml` v1.0.0
**Source plan:** `Phase11-completion-notes.md` PHASE 12 recommendation.

> Phase 12 closes **11 capabilities (CR-AI-0201 → 0304)** split across
> two domains — `files` (4 caps) and `knowledge` (4 caps) plus the
> `article-draft` + `knowledge-health` skills (CR-AI-0303 / 0304).

---

## 0. Executive summary

| ID | Capability | Going IN | Going OUT |
|---|---|---|---|
| CR-AI-0201 | File upload + validation + scan + parse | NOT_STARTED | **IN_PROGRESS → CERTIFIED eligible** |
| CR-AI-0202 | Parsers (PDF / DOCX / TXT / CSV/XLSX / PPTX / email / image) | NOT_STARTED | **IN_PROGRESS → CERTIFIED eligible** |
| CR-AI-0203 | Retention / deletion / legal hold | NOT_STARTED | **IN_PROGRESS → CERTIFIED eligible** |
| CR-AI-0204 | File-aware context in chat | NOT_STARTED | **IN_PROGRESS → CERTIFIED eligible** |
| CR-AI-0301 | Tenant knowledge ingestion / indexing / retrieval | IN_PROGRESS | **CERTIFIED eligible** |
| CR-AI-0302 | Grounded answer contract with abstention | IN_PROGRESS | **CERTIFIED eligible** |
| CR-AI-0303 | Article drafting from prompt/case | NOT_STARTED | **IN_PROGRESS → CERTIFIED eligible** |
| CR-AI-0304 | Gap / duplicate / conflict detection | NOT_STARTED | **IN_PROGRESS → CERTIFIED eligible** |

Two skills that the baseline points to by path:

```
skill-registry/skills/article-draft.ts    (CR-AI-0303)
skill-registry/skills/knowledge-health.ts (CR-AI-0304)
```

Both need to exist as concrete implementations, integrated into the
existing `SkillRegistryModule`.

---

## 1. Existing scaffolding — re-evaluated

The `knowledge/` module already ships:

- `file-ingestion.service.ts` — quarantine, MIME sniff, malware scan, archive-bomb, encryption, dedupe-by-hash, status surface.
- `services/parsers/` — `pdf`, `docx`, `txt`, `csv-xlsx`, `image`, `email`, `pptx` (8 format-aware parsers).
- `chunking.service.ts` — recursive character splitter (paragraph → line → sentence → hard cut).
- `embeddings.service.ts`, `hybrid-search.service.ts`, `rag-pipeline.service.ts` — full RAG loop (embed → retrieve → re-rank → LLM with citation-preserving system prompt).
- `retention.service.ts`, `malware-scanner.ts`, `archive-bomb.ts`, `file-cipher.ts`, `security-event.service.ts` — security / lifecycle primitives.

That is real plumbing, not stubs. Phase 12's job is to:
1. Verify and certify each surface with tests + a guard.
2. Fill the two missing skills (`article-draft`, `knowledge-health`).
3. Wire the Phase-12 SourceRef resolvers into `SkillExecutor` so chat can summarize a record, thread, or file (the original Phase-11 gap).
4. Wire the chat path so uploaded files become chat context with citations (CR-AI-0204).

---

## 2. SOLID commitments

| Principle | Application |
|---|---|
| **SRP** | Each new file owns ONE concern: `IFileTextResolver` interface, `ArticleDraftSkill`, `KnowledgeHealthSkill`, the chat dispatcher method, the `SkillExecutor` extension. |
| **OCP** | Adding a 9th skill is one file. Adding a 9th parser is one file. Adding a 5th SourceRef kind (`?excerpt?`) is one new resolver + one registry entry. |
| **LSP** | Every new skill extends `ISkill<I,O>`; every new resolver satisfies `IFileTextResolver`. The chat dispatcher treats both uniformly. |
| **ISP** | `IFileTextResolver` is one method (`resolve(tenantId, ref): Promise<{text, citations}>`); `KnowledgeHealthSkill` exposes `gap` + `duplicate` + `conflict` separately. |
| **DIP** | `SkillExecutor` depends on `Map<SourceRefKind, IFileTextResolver>` resolved via DI, not on concrete Prisma/customer/project/etc. The registry is wired in the module. |

---

## 3. Architecture

```
                  ┌────────────────────────────────────┐
                  │ SkillExecutor                      │
                  │ (Phase 11)                         │
                  └─────────────┬──────────────────────┘
                                │ .resolveSourceText(ref, ctx)
                                ▼
                  ┌────────────────────────────────────┐
                  │ SourceRefResolverRegistry         │ ← new
                  │  Map<kind, IFileTextResolver>      │
                  └─────────────┬──────────────────────┘
                                │ TextResolverFactory returns one of:
                                ▼
        ┌────────────────────────────────────────────────────┐
        │ RecordResolver (NEW)                                │
        │   - Customer / Project / Deal / Quote / User / Task │
        │   - Whitelisted tenant-scoped fields per recordType  │
        ├────────────────────────────────────────────────────┤
        │ ThreadResolver (NEW)                                │
        │   - HermesMessage list with chronology + citations  │
        ├────────────────────────────────────────────────────┤
        │ FileResolver (NEW)                                  │
        │   - KnowledgeEntry (decrypt → chunk top-1)          │
        │   - Falls back to FullTextExtractor (PDF/DOCX) if   │
        │     the cached chunk is missing                    │
        └────────────────────────────────────────────────────┘
                                │
                                ▼
                  Typed text + citations → SkillExecutor → SkillOutput

  chat path:
    POST /api/v1/chat/messages → ChatService.tryDispatchSkillIntent →
    SkillRegistry.dispatch → SkillExecutor.invokeSkill →
    SourceRefResolverRegistry → typed text → AiGatewayService.invoke
```

Two new skills (`article-draft`, `knowledge-health`) follow the same
shape as the existing seven:

```
skill-registry/skills/article-draft.skill.ts
skill-registry/skills/knowledge-health.skill.ts
```

Each: thin typed class extending `BaseSkill<I,O>`, registered into
the runtime `SkillRegistry` at boot.

---

## 4. Data model — additive only

### 4.1 Prisma migration: `20260806_add_knowledge_article_link`

Two additive columns (no destructive change):

```prisma
model KnowledgeArticle {
  id              String   @id @default(uuid())
  tenantId        String
  title           String
  sourceChunkIds  String[] @default([])      // Phase 12: back-link to chunks
  publishedAt     DateTime?                  // Phase 12: governed publication state
  duplicateOfId   String?                    // Phase 12: gap/duplicate detection
  @@unique([tenantId, title])
  @@map("knowledge_articles")
}
```

Migration is non-destructive: adds nullable columns + creates the
table. Reversible.

### 4.2 New knowledge invariants

- `KnowledgeArticle.tenantId` is enforced at insert.
- `KnowledgeArticle.duplicateOfId` is nullable; non-null means this
  article is a duplicate or near-duplicate of another. Used by
  `KnowledgeHealthSkill.conflict` to surface curated de-duplication.
- `KnowledgeArticle.sourceChunkIds` is a `String[]` so the gap
  detector can join against the existing `KnowledgeChunk` table.

---

## 5. Contracts

```ts
// IFileTextResolver — Phase 12's new seam
interface IFileTextResolver {
  readonly kind: 'record' | 'thread' | 'file';
  /** Resolve a source-ref to (text, citations) for LLM context. */
  resolve(tenantId: string, ref: SourceRef): Promise<ResolvedText>;
}

interface ResolvedText {
  readonly text: string;
  readonly citations: ReadonlyArray<{
    readonly locator: string;
    readonly quote: string;
  }>;
}

// ArticleDraftSkill — CR-AI-0303
interface ArticleDraftInput {
  readonly topic: string;
  readonly sources: ReadonlyArray<SourceRef>;
  readonly intent?: 'how-to' | 'concept' | 'faq' | 'reference';
  readonly governedBy?: string; // user-id for audit
}
interface ArticleDraftOutput extends SkillOutput<{
  title: string;
  bodyMarkdown: string;
  proposedTags: string[];
  sources: ReadonlyArray<string>;
}> {}

// KnowledgeHealthSkill — CR-AI-0304
interface KnowledgeHealthInput {
  readonly sources: ReadonlyArray<SourceRef>;
  readonly mode: 'gap' | 'duplicate' | 'conflict';
}
interface KnowledgeHealthOutput extends SkillOutput<{
  findings: ReadonlyArray<{
    severity: 'low' | 'medium' | 'high';
    finding: string;
    locator: string;
  }>;
  recommendedAction: 'merge' | 'create-new' | 'flag-for-review' | 'no-op';
}> {}
```

---

## 6. Verification matrix

| Gate | Required |
|---|---|
| `nest build` exit 0 | yes |
| Frontend `tsc --noEmit` exit 0 | yes |
| Phase 11 G11 stays APPROVED | yes |
| Phase 10 stays 452/452 phase gate | yes |
| Phase 12 G12 gate runner APPROVED | yes |
| `SkillRegistryImplementsFlag` integrity guard ≥ 9 skills | yes |
| Knowledge `RAGPipeline` returns typed `GroundedAnswer` | yes |
| `record/thread/file` SourceRefs no longer throw `SkillAbstainedError` | yes |
| KnowledgeArticle Prisma migration applies + rolls back | yes |

---

## 7. Honest risks

1. **Migration risk.** The new `KnowledgeArticle` table is additive; the two columns are nullable. Rollback is drop-table. The migration is benign in either direction.
2. **Resolver cost.** Record/thread/file resolvers each hit the DB. Phase 12 caps via the existing `ChunkingService` (top-1 chunk for `kind=file`) so the worst case is single-row reads.
3. **KnowledgeHealthSkill robustness.** "Duplicate" is fuzzy. We use trigram Jaccard on titles + first chunk; full-fledged semantics Phase 14 (Command Center) refine.

---

## 8. File inventory (≤ 25)

### Backend (18)

```
backend/src/modules/knowledge/
├── resolvers/
│   ├── source-ref-resolver.registry.ts   (NEW — phase 12 core)
│   ├── record.resolver.ts                (NEW)
│   ├── thread.resolver.ts                (NEW)
│   └── file.resolver.ts                  (NEW)
backend/src/modules/skill-registry/skills/
├── article-draft.skill.{ts,spec.ts}      (NEW — CR-AI-0303)
└── knowledge-health.skill.{ts,spec.ts}   (NEW — CR-AI-0304)
backend/src/modules/skill-registry/
├── skill-executor.service.ts             (EDITED — wire resolvers)
└── skill-registry.module.ts              (EDITED — register 2 skills)
backend/prisma/
└── migrations/20260806_add_knowledge_article_link/
    └── migration.sql                     (NEW)
backend/src/modules/knowledge/
└── knowledge.module.ts                   (EDITED — providers for resolvers)
backend/src/test/certification/
├── phase12-certification.runner.ts       (NEW — G12 runner)
└── g12-knowledge-files.spec.ts           (NEW — jest entry)
```

### Documentation (2)

```
neurecore/memory-bank-arc/harness/
├── IMPLEMENTATION-PLAN-PHASE12.md        (NEW — this file)
└── PHASE12-KNOWLEDGE-FILES.md            (NEW — parity delta)
```

---

## 9. Run commands

```bash
cd backend
./node_modules/.bin/nest build
./node_modules/.bin/jest --config jest.config.js \
  src/modules/knowledge \
  src/modules/skill-registry \
  src/test/certification/g12-knowledge-files
cd frontend-tenant
npx tsc --noEmit
```

---

## 10. Document control

- 2026-08-06 — created. Owner: `@knowledge`, `@skills`, `@chat-product`.
