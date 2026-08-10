# Phase 0 Baseline Report — SOL-02 Thin AI Employee Core

Date: 2026-08-10  
Verified branch: `0011-sol-automation`  
Verified baseline HEAD: `c0bd9939`

## Verdict

**Phase 0 is implemented correctly for the scoped SOL-02 work and may proceed
to Phase 1.** The core-related validation baseline is now clean, the frontend
type check is clean, and the legacy-executor architecture guard is active.

The repository is **not globally TypeScript-clean**: 97 pre-existing backend
test/harness type errors remain in 22 files outside the Phase 0 core scope.
This report does not represent those errors as a pass. They are recorded as
technical debt and the global `tsc --noEmit` gate remains red.

## 1. Audit corrections

The initial report could not be accepted unchanged because it:

- recorded branch `0010-harness-base` and hash `ef491db9`, while the verified
  workspace is branch `0011-sol-automation` at `c0bd9939`;
- declared a general Phase 0 pass despite backend and frontend type-check
  failures;
- classified Skill Registry and chat test errors as unrelated even though both
  participate in the planned AI Employee core;
- allowed every future file under `ai-employee-core/adapters/` to bypass the
  legacy-executor architecture gate.

Those gaps have been corrected.

## 2. Phase 0 changes made

### Core-relevant type and fixture corrections

- Corrected the Skill Registry test's `TenantContext` import path.
- Updated Skill output assertions to preserve their actual readonly contracts.
- Updated ChatService test fixtures for the current `skillRegistry` dependency.
- Updated Command Registry fixtures to the current `CommandMetadata` contract:
  `idempotencyKey`, string `occurredAt`, and `schemaVersion`.
- Updated the Agent pool fixture for its current two-dependency constructor.

### Frontend corrections

- Replaced invalid Playwright `Page.getByLabelText()` calls with the supported
  `Page.getByLabel()` locator in both Phase 10 E2E specifications.
- The tenant frontend TypeScript check now passes.

### Architecture guard correction

Added:

`backend/src/test/architecture/legacy-executor-gate.spec.ts`

The guard prevents new production imports/calls of
`AgentExecutorService.executeTask()` outside the exact grandfathered files.
It does not blanket-allow a future adapter directory. A compatibility adapter
may be added only by its exact path when it exists.

## 3. Verified workspace state

The files changed during Phase 0 remediation are limited to test fixtures, two
frontend E2E specifications, the architecture guard, and this report. No
production Agent Runtime, Work Runtime, Agent, Skill Registry, Approval Port,
or Prisma implementation was changed.

`git diff --check` passes with no whitespace errors.

## 4. Validation results

### 4.1 Prisma schema

Command:

```bash
cd neurecore/backend
pnpm prisma validate
```

Result: **PASS**

- schema loads successfully;
- no unidentified schema validation failure;
- no schema modification was made in Phase 0.

### 4.2 Backend build

Command:

```bash
pnpm build
```

Result: **PASS**

The production Nest build completes successfully.

### 4.3 Focused SOL-02 backend tests

Command:

```bash
pnpm jest --config jest.config.js --runInBand \
  src/modules/agent-runtime \
  src/modules/work-runtime \
  src/modules/approval-port \
  src/modules/skill-registry \
  src/test/architecture/legacy-executor-gate.spec.ts
```

Result: **PASS**

| Metric | Result |
|---|---:|
| Passing suites | 15 |
| Skipped suites | 1 |
| Passing tests | 137 |
| Skipped tests | 8 |
| Failed tests | 0 |

The skipped tests are environment-dependent suites and are not silently
counted as passing coverage.

### 4.4 Remediated backend fixture tests

The focused remediation run included:

- legacy executor architecture guard;
- Command Registry;
- Agent pool;
- Chat LLM/routing fixtures;
- Skill Registry and skills.

Result: **10 suites and 77 tests passed; 0 failures.**

### 4.5 Backend TypeScript

Command:

```bash
pnpm exec tsc --noEmit --pretty false
```

Result: **FAIL — known global baseline debt**

After remediation, the result is:

| Metric | Result |
|---|---:|
| Error lines | 97 |
| Files | 22 |
| Errors in Agent Runtime | 0 |
| Errors in Work Runtime | 0 |
| Errors in Approval Port | 0 |
| Errors in Skill Registry | 0 |
| Errors in Chat fixtures | 0 |
| Errors in Agent pool fixture | 0 |
| Errors in Command Registry fixture | 0 |

Remaining error locations:

- `src/harness/**` conformance tests;
- `src/modules/ai-twin/**` tests;
- analytics prediction tests;
- coding-agent SDK test;
- governance composition test;
- Hermes scoped gateway test;
- marketing/service skill tests;
- retention and sales-outreach tests.

These errors are outside the Phase 0 implementation surface. They must not be
treated as newly introduced SOL-02 regressions. They should be repaired in a
separate baseline-debt change set before claiming the entire backend passes
`tsc --noEmit`.

### 4.6 Tenant frontend TypeScript

Command:

```bash
cd neurecore/frontend-tenant
pnpm type-check
```

Result: **PASS**

The four Playwright locator type errors recorded in the initial report were
fixed.

### 4.7 Tenant frontend unit tests

Command:

```bash
pnpm test
```

Result: **PASS**

| Metric | Result |
|---|---:|
| Test files | 33 |
| Tests | 226 |
| Failures | 0 |

## 5. Error classification

### Phase 0 plan-blocking errors

**None remain in the SOL-02 scope.**

The previously overlooked Skill Registry, chat, Command Registry, Agent pool,
and frontend type errors have been resolved and their focused tests pass.

### Global repository debt

The remaining 97 backend TypeScript errors are real and openly recorded. They
do not touch the core modules being changed in Phase 1, and the production
backend build passes. Phase 1 must enforce a no-regression comparison:

- none of the 22 baseline files may gain additional errors;
- no new error file may appear;
- `ai-employee-core`, `agents`, `agent-runtime`, `work-runtime`,
  `skill-registry`, `approval-port`, and changed shared contracts must remain
  type-clean;
- production build and focused tests must remain green.

## 6. Phase 0 exit gate

| Criterion | Status |
|---|---|
| Workspace state captured accurately | PASS |
| Prisma validation | PASS |
| Backend production build | PASS |
| Focused core tests | PASS |
| Frontend type check | PASS |
| Frontend unit tests | PASS |
| Core-relevant type errors resolved | PASS |
| Legacy executor architecture guard | PASS |
| Unidentified schema drift | NONE FOUND |
| Global backend `tsc --noEmit` | FAIL — recorded baseline debt |

## 7. Final Phase 0 decision

**SCOPED PASS: proceed to Phase 1.**

This decision means the SOL-02 baseline is reproducible and its relevant
surfaces are green. It does not mean the whole repository is error-free.

Phase 1 must stop if it introduces any new type-error file, changes the global
error baseline without explanation, breaks the production build, breaks the
focused 137-test core run, or weakens the architecture guard.

