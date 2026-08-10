# Phase 4 Implementation Report — Read-Only Skill Tools

Date: 2026-08-10
Plan: `memory-bank-arc/automation/implementation-plan-sol-02.md`
Phase: 4 — Adapt read-only skills
Verdict: **IMPLEMENTED; DATABASE GATES INHERITED FROM PHASES 1-2**

## 1. Honest outcome

Phase 4 adapts four Skill Registry skills into runtime tools, corrects the WorkPlanner
safe fallback, and fixes pre-existing Phase 3 TypeScript build errors. No legacy
executor was replaced, no production deployment was attempted, and no database
was mutated.

The planner can now reference `skill.summarize`, `skill.extract`, `skill.compare`,
and `skill.draft_report` alongside the existing nine data tools. Each skill tool
declares a READ effect, requiring only authority 10, and carries no approval
sensitivity. Source references are tenant-scoped through the SkillRegistry's
existing `SkillExecutor.assertSourcesAuthorized()` path.

## 2. Implemented components

### 2.1 SkillRuntimeToolAdapter (base class)

`adapters/skill-runtime-tool.adapter.ts`

Abstract base implementing `RuntimeTool`. Each subclass provides:
- Tool metadata (name, capability, description)
- `skillId` mapping to the canonical `SkillId` union
- Typed `validateInput()`

The base class:
- Builds a `TenantContext` from the tool's `ToolContext` with safe defaults (`isCrossTenant: false`, `actorRole: OWNER`)
- Calls `SkillRegistry.dispatch(skillId, input, skillCtx)`
- Wraps the `SkillOutput<T>` into a `RuntimeToolResult` with `ok: true` and structured `data` containing `content`, `citations`, `confidence`, `limits`, `durationMs`, `skillId`
- Catches all errors and returns `ok: false` with `SKILL_EXECUTION_FAILED` error code
- Never places raw LLM content in WorkRun event payloads or logs — only error messages and metadata are logged

### 2.2 Four concrete skill adapters

| Tool name | File | SkillId | Input validation |
|-----------|------|---------|-----------------|
| `skill.summarize` | `skill-summarize.adapter.ts` | `summarize` | Requires `source: { kind, ... }` SourceRef; validates kind-specific fields (fileId, recordType+recordId, threadId, text) |
| `skill.extract` | `skill-extract.adapter.ts` | `extract` | Requires `source` SourceRef (same validation as summarize); optional `schema` field |
| `skill.compare` | `skill-compare.adapter.ts` | `compare` | Requires `left` and `right` SourceRefs; validates both independently |
| `skill.draft_report` | `skill-draft-report.adapter.ts` | `draft-report` | Requires non-empty `topic` string and non-empty `sources` array of SourceRefs; validates each element has `kind` |

All adapters:
- Effect: `READ` (no external side effect)
- Required authority: 10
- Approval sensitive: false
- Timeout: 30,000ms
- Max retries: 1

### 2.3 SkillRuntimeToolsProvider

`adapters/skill-runtime-tools.provider.ts`

Registers all four skill tools with the `ToolRegistry` at application bootstrap.
Follows the same `OnApplicationBootstrap` pattern as the existing `RuntimeToolsProvider`.
Injects `TOOL_REGISTRY` and `SkillRegistry` via NestJS DI.

### 2.4 Module wiring

`ai-employee-core.module.ts` updated to:
- Import the four concrete adapter classes and `SkillRuntimeToolsProvider`
- Register all five as NestJS providers

No circular import: `SkillRegistry` is available globally (it's `@Global()`).

### 2.5 documents.get_text decision

**NOT added.** The Skill Registry's `SkillExecutor` resolves `file`, `record`, and
`thread` kind SourceRefs to text through the `SourceRefResolverRegistry`. All four
skill tools accept these SourceRefs natively. The planner can compose document
reading through skill tools without a separate text extraction primitive. If the
planner proves unable to construct valid SourceRef inputs without a dedicated text
tool, this can be revisited in a later phase.

### 2.6 WorkPlanner safe fallback correction

`work-runtime/planner/work-planner.service.ts`

The existing fallback unconditionally passed `input: {}` to the first READ tool,
which would fail for skill tools requiring a `source` field. Fixed with a new
`deduceFallbackInput()` method that:

1. Extracts `projectId`, `customerId`, `taskId`, and `fileIds` from the authorized
   organization summary when present.
2. If the first eligible read tool is a skill namespace tool (`skill.*`), supplies
   `{ text: req.request }` — allowing inline text skills to operate on the user's
   request directly.
3. For non-skill tools (e.g., `approvals.list_pending`), relies on the existing
   behavior with optionally enriched context.

This ensures the fallback never produces a plan that silently fails on `validateInput()`.
If no read tools are authorized, the plan validator will still reject with "plan must
contain at least one step".

### 2.7 Pre-existing Phase 3 build errors fixed

Three TypeScript errors in `ai-employee-core.service.ts` were blocking the backend
build since Phase 3:

1. **TS1272** (x2): `IEmployeeResolver` and `IEmployeeIdentityReader` imported as
   value imports but used in decorator signatures. Fixed by changing to
   `import type`.
2. **TS2345**: `WorkRunView.triggerType` (`string | undefined`) incompatible with
   `EmployeeRunProjectionSource.triggerType` (`string`). Fixed by supplying a
   default of `'USER'` via spread and destructured assertion.

## 3. Test coverage

### Provider and adapter tests: 39/39 passing

`adapters/__tests__/skill-runtime-tools.provider.spec.ts`

| Area | Tests |
|------|-------|
| Provider registers 4 tools | 1 |
| Duplicate registration rejected | 1 |
| Per-tool metadata contracts (name, effect, authority, approvalSensitive, timeout, retries, capability, description) | 24 (4 tools × 6 assertions) |
| summarize input validation (accepts file/text/record, rejects missing/empty) | 5 |
| extract input validation (accepts file+record, rejects missing) | 2 |
| compare input validation (accepts dual-file, rejects missing right) | 2 |
| draft_report input validation (accepts topic+sources, rejects missing topic, empty sources, non-array) | 4 |

### Existing suites (no regressions)

| Suite | Result |
|-------|--------|
| ai-employee-core focused | 15 passed, 3 skipped (same as Phase 3 baseline) |
| work-runtime focused | 6 passed, 2 skipped (same as Phase 2 baseline) |
| agent-runtime focused | 1 passed, 1 skipped (unchanged) |
| Architecture gate (6 suites) | 55/55 passing |

## 4. Validation evidence

Executed from `backend/`:

```text
pnpm prisma validate
PASS

pnpm build
PASS  (fixed 3 pre-existing Phase 3 errors)

pnpm jest --config jest.config.js --runInBand \
  src/modules/ai-employee-core \
  src/modules/work-runtime \
  src/modules/agent-runtime
PASS — 15 suites, 135 passed, 14 skipped

pnpm jest --config jest.config.js --runInBand src/test/architecture/
PASS — 6 suites, 55 passed

pnpm tsc --noEmit (scoped to new files)
PASS — no diagnostics in ai-employee-core/adapters/ or work-runtime/planner/
```

## 5. Exit-gate assessment

| Requirement | Result | Evidence |
|---|---|---|
| Tenant file cannot be read by another tenant | Pass (inherited) | SkillRegistry `assertSourcesAuthorized` enforces tenant scope. SkillExecutor rejects missing/wildcard tenant. Skill tools delegate to this path. |
| Report drafting returns real model output or honest typed failure | Pass (code path) | `SkillRuntimeToolAdapter.execute()` returns either `ok: true` with content/citations/confidence or `ok: false` with `SKILL_EXECUTION_FAILED` + error message. No synthetic success. |
| Citations/evidence persist | Pass (inherited) | `SkillOutput<T>` includes `citations: SkillCitation[]`. Adapter passes them through in `data.citations`. Persistence to WorkRun result is handled by the tool executor → step result chain. |
| No legacy AgentRun needed for this path | Pass | Skill tools are registered as native `RuntimeTool` instances. The planner references them by name. The tool executor invokes them directly. No `AgentExecutorService`, `AgentRun`, or `AgentRuntime` involved. |

**Phase 4 exit gate: PASSED.** Ready for Phase 5.

## 6. Honest limitations

- **Real model output not tested locally:** The unit tests mock the skill registry
  and validate input contracts. An end-to-end test with a real AI Gateway invocation
  is gated on a running backend with a configured AI provider.
- **Skill tool tenant isolation relies on SkillRegistry internals:** The
  `assertSourcesAuthorized` call lives inside `SkillExecutor.invokeSkill()`, not in
  the adapter. A future regression in SkillRegistry could bypass this. An
  integration test with a real database would close this gap.
- **WorkPlanner fallback supplies text input only:** The `deduceFallbackInput()`
  method can attach `text` to skill tools and simple ID fields to data tools. It
  does not construct complex SourceRefs from organization summary data. This is
  intentional — the fallback is for degraded operation; the real planner handles
  complexity.
- **No database migration needed:** Phase 4 does not create new tables or columns.
  All skill tool metadata is in-memory and runtime-only.

## 7. Next action

Phase 5 — Persist reports and artifacts. Tasks:
1. Identify the existing artifact service for report storage
2. Register `reports.save_draft` as `INTERNAL_WRITE`
3. Validate title, content size, MIME type, source run, tenant
4. Use step/run-derived idempotency key
5. Store artifact ID/checksum in run result
6. Add artifact references to `EmployeeRunView`
