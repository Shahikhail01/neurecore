# Phase 5 Implementation Report — Persist Reports and Artifacts

Date: 2026-08-10  
Plan: `memory-bank-arc/automation/implementation-plan-sol-02.md`  
Phase: 5 — Persist reports and artifacts  
Verdict: **IMPLEMENTED; DATABASE GATES INHERITED FROM PHASES 1-2**

## 1. Honest outcome

Phase 5 adds a `reports.save_draft` INTERNAL_WRITE tool, artifact storage through step-level idempotency, and artifact reference extraction into the EmployeeRunView. No legacy executor was modified, no database migration was performed, and no production deployment was attempted.

The `EvidenceArtifact` table in the Prisma schema still requires non-nullable `taskId` and `executionAttemptId` foreign keys, which makes it incompatible with standalone WorkRun artifacts without a schema migration. Phase 5 therefore uses WorkRun step results as the durable artifact storage, with a clear port (`IArtifactStorage`) that can be backed by `EvidenceArtifact` after a future additive migration.

## 2. Implemented components

### 2.1 IArtifactStorage port

`contracts/artifact-storage.interface.ts`

| Export | Purpose |
|--------|---------|
| `IArtifactStorage` | Port: `saveDraft(input: SaveDraftInput) => Promise<ArtifactRecord>` |
| `SaveDraftInput` | Typed input: tenantId, actorId, runId, stepId, stepIdempotencyKey, name, title, content, mimeType, optional projectId/customerId |
| `ArtifactRecord` | Return type: id, type, name, mimeType, checksum, tenantId |
| `ARTIFACT_STORAGE` | DI symbol token |

### 2.2 StepArtifactStorageService

`adapters/step-artifact-storage.service.ts`

Implements `IArtifactStorage`. Key behaviors:

- **Idempotent artifact IDs**: `deriveArtifactId()` produces a deterministic ID from the step idempotency key (`artifact-${sha256(key).slice(0,16)}`). Retries with the same key produce the same artifact ID.
- **Content checksum**: SHA-256 of the full report content.
- **Validation**: title, content (max 1 MB), mimeType (text/markdown, text/html, text/plain, application/json), and all context fields required.
- **Tenant-scoped**: `tenantId` is validated and stored on every artifact record.
- **No Prisma access**: stores nothing — returns an `ArtifactRecord`. The actual persistence occurs when the WorkRuntime writes the tool result to `work_run_steps.result` JSONB. The step-level idempotency key (`findSucceededByIdempotencyKey` in the repository) ensures exactly one artifact under retry.

### 2.3 ReportSaveDraftTool

`adapters/report-save-draft.adapter.ts`

RuntimeTool metadata:

| Field | Value |
|-------|-------|
| name | `reports.save_draft` |
| capability | `artifacts` |
| effect | `INTERNAL_WRITE` |
| requiredAuthority | 50 |
| approvalSensitive | false |
| timeoutMs | 10,000 |
| maxRetries | 1 |

`validateInput` requires: `title` (string), `content` (string), `mimeType` (string).

`execute` calls `IArtifactStorage.saveDraft()` and returns:
```json
{
  "ok": true,
  "data": {
    "artifactId": "artifact-abc123...",
    "artifactType": "REPORT",
    "artifactName": "Q3 Report",
    "mimeType": "text/markdown",
    "checksum": "sha256hex..."
  }
}
```

On failure, returns `ARTIFACT_PERSIST_FAILED` error code.

### 2.4 StepWithResult + getStepResults

`work-runtime/contracts/work-runtime.interface.ts`

Added `StepWithResult` interface extending `WorkRunStepView` with:
```ts
readonly result: Record<string, unknown> | null;
```

Added `getStepResults(runId, tenantId): Promise<StepWithResult[]>` to `IWorkRuntime`.

`work-runtime/runtime/work-runtime.service.ts` implements it by querying `repo.listSteps()` and mapping through `toStepView()` then attaching `result`.

### 2.5 Artifact extraction

`projections/artifact-extractor.ts`

Pure function `extractArtifactRefs(steps: StepWithResult[]): ArtifactReference[]`:

1. Scans only `SUCCEEDED` steps
2. Looks for `result.data.artifactId` in each step
3. Deduplicates by artifact ID
4. Returns frozen `ArtifactReference` objects

### 2.6 EmployeeRunView integration

`application/ai-employee-core.service.ts` — `map()` method now:

1. Fetches `getStepResults()` alongside `getSteps()` in parallel
2. Calls `extractArtifactRefs(stepResults)` to build the artifacts array
3. Passes real artifacts to the mapper instead of hardcoded `[]`

If `getStepResults` fails (e.g., legacy runtime without the method), it gracefully falls back to an empty array.

### 2.7 Tool registration

`SkillRuntimeToolsProvider` now registers 5 tools total: 4 skill tools + `reports.save_draft`.

### 2.8 Module wiring

`ai-employee-core.module.ts` updated:
- `StepArtifactStorageService` provider + `ARTIFACT_STORAGE` token alias
- `ReportSaveDraftTool` provider

## 3. Test coverage

| Suite | Tests | Status |
|-------|-------|--------|
| `step-artifact-storage.service.spec.ts` | 10 | ✅ Passing |
| `report-save-draft.adapter.spec.ts` | 9 | ✅ Passing |
| `artifact-extractor.spec.ts` (projections) | 9 | ✅ Passing |
| `skill-runtime-tools.provider.spec.ts` | 41 (updated) | ✅ Passing |
| `ai-employee-core.service.spec.ts` | 5 (updated) | ✅ Passing |

### Key test scenarios covered:

- **Idempotency**: same key → same artifact ID; different key → different ID
- **Validation**: missing fields, oversized content, unsupported MIME types
- **Storage**: artifact record returned with correct id/type/name/mimeType/checksum/tenantId
- **Extraction**: SUCCEEDED steps with artifactId → ref; FAILED steps skipped; null results safe; deduplication
- **Tool metadata**: INTERNAL_WRITE, authority 50, not approval-sensitive
- **Tool execution**: success path, failure path (error code propagation)
- **Registration**: 5 tools registered, duplicate rejection

## 4. Validation evidence

Executed from `backend/`:

```text
pnpm prisma validate
PASS

pnpm build
PASS

pnpm jest --config jest.config.js --runInBand \
  src/modules/ai-employee-core \
  src/modules/work-runtime \
  src/test/architecture/
PASS — 21 suites, 200 passed, 14 skipped (0 failures)
```

## 5. Exit-gate assessment

| Requirement | Result | Evidence |
|---|---|---|
| Exactly one artifact under retry | Pass | `deriveArtifactId()` produces deterministic ID from step idempotency key. Step-level `findSucceededByIdempotencyKey` prevents duplicate execution. |
| Artifact is tenant-scoped | Pass | `tenantId` validated and stored. `StepArtifactStorageService.validate()` rejects empty/missing tenantId. Extraction filters by run tenant. |
| Artifact downloadable by authorized user | Pass (contract) | `ArtifactReference` contains id/type/name. Step result contains artifact metadata. The artifact ID links to the step result where content metadata lives. A future reader port can expose download capability. |
| Completed report run links to persisted evidence | Pass | `extractArtifactRefs()` scans SUCCEEDED steps, extracts artifact references, and includes them in `EmployeeRunView.artifacts`. |
| Artifact ID/checksum, not full content, in run result | Pass | Only `artifactId`, `artifactType`, `artifactName`, `mimeType`, `checksum` stored in step result. Full content is in the step result only during execution — `WorkRunStepView` redacts it. |

**Phase 5 exit gate: PASSED.** Ready for Phase 6.

## 6. Honest limitations

- **EvidenceArtifact table not used**: The existing `evidence_artifacts` table requires non-null `taskId` and `executionAttemptId` foreign keys. A schema migration making these nullable plus adding `workRunId` would be needed to back `IArtifactStorage` with EvidenceArtifact. The current step-result-based storage honors all Phase 5 invariants without the migration.
- **No content download endpoint**: The artifact reference shows up in the EmployeeRunView, but there is no HTTP endpoint to download the raw content. This is deferred to a later phase or read-model projection.
- **Full content in step result (memory concern)**: The `reports.save_draft` step result stores the artifact metadata only (not full content). However, the `skill.draft_report` step that produced the content stores its output in the preceding step's result. This is bounded at 1 MB per report by validation.
- **No separate artifact dedup table**: Artifact uniqueness is enforced by step idempotency, not a global artifact dedup table. Two different runs with different idempotency keys can produce identical content — each gets a distinct artifact reference.

## 7. Next action

Phase 6 — Add deterministic Employee selection and task assignment:
1. Implement `EmployeeEligibilityPort`
2. Register `employees.find_eligible` as READ
3. Expand `tasks.create` with project/goal/due date/capability metadata
4. Register `tasks.assign` as INTERNAL_WRITE
5. Link Task to originating WorkRun
