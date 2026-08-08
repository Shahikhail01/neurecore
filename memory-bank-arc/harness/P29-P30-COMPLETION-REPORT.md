# P29 + P30 — Completion Report (honest)

**Document:** NC-P29-P30-COMPLETION
**Date:** 2026-08-08
**Plan:** `IMPLEMENTATION-PLAN-PARITY-COMPLETION.md` §10 (P29) and §11 (P30)
**Capabilities:** CR-AI-1304 (Accessibility WCAG 2.2 AA + localization),
CR-AI-1305 (Resilience + rate/cost controls)

> Honesty principle (plan §0): nothing below is a relabelled seam. Each
> claim maps to a file that exists, a gate that runs, and a command whose
> output is reproducible. Where a gap remains, it is stated as a gap with
> its measured size — not omitted.

---

## 1. Verdicts

| Gate | Runner | Result |
|---|---|---|
| G29 | `src/test/certification/phase29-certification.runner.ts` | **APPROVED** — 13/13 |
| G30 | `src/test/certification/phase30-certification.runner.ts` | **APPROVED** — 15/15 |
| SOLID guard | `src/test/certification/parity-completion/solid-integrity-guard-p29-p30.spec.ts` | **PASS** — 249/249 (both guards) |

Reproduce:

```bash
cd neurecore/backend
pnpm certify:phase29        # G29
pnpm certify:phase30        # G30 (re-runs G29 + G14 for regression)
pnpm certify:solid          # P22/P24 + P29/P30 SOLID guards
pnpm a11y:scan              # full WCAG 2.2 audit over both frontends
./node_modules/.bin/nest build
cd ../frontend-tenant && npx tsc --noEmit && npx vitest run src/shared/a11y
cd ../frontend-admin  && npx vitest run src/shared/a11y
```

---

## 2. P29 — WCAG 2.2 AA + localization (CR-AI-1304)

### 2.1 What shipped

**Static audit engine** — `backend/src/modules/accessibility/`

| Concern | File |
|---|---|
| Vocabulary + rule contract | `interfaces/IA11yRule.ts` |
| Source loading contract | `interfaces/IA11ySourceLoader.ts` |
| Report sink contract | `interfaces/IA11yReportSink.ts` |
| JSX scanner (comment- and expression-aware) | `parser/jsx-source.parser.ts` |
| Shared element predicates | `parser/element-query.ts` |
| 8 WCAG rules | `rules/*.rule.ts` |
| Criterion-keyed registry | `a11y-rule.registry.ts` |
| Pipeline orchestrator | `a11y-audit.runner.ts` |
| Certified-screen scope + ratchet | `key-screens.ts` |
| Filesystem / in-memory loaders | `loaders/*` |
| JSON / in-memory sinks | `sinks/*` |
| CLI scanner | `backend/scripts/run-a11y-audit.ts` (`pnpm a11y:scan[:strict]`) |

Rules and the criteria they enforce:

| Rule | WCAG | Level | Severity |
|---|---|---|---|
| `a11y/image-alt` | 1.1.1 Non-text Content | A | critical |
| `a11y/form-label` | 3.3.2 Labels or Instructions | A | serious |
| `a11y/interactive-keyboard` | 2.1.1 Keyboard | A | serious |
| `a11y/focus-order` | 2.4.3 Focus Order | A | serious |
| `a11y/document-language` | 3.1.1 Language of Page | A | serious |
| `a11y/name-role-value` | 4.1.2 Name, Role, Value | A | serious |
| `a11y/heading-order` | 1.3.1 Info and Relationships | A | moderate |
| `a11y/target-size` | 2.5.8 Target Size (Minimum) — **new in WCAG 2.2** | AA | moderate |

**Runtime audit engine (axe-core)** — `frontend-{tenant,admin}/src/shared/a11y/audit/`
`IA11yRuntimeEngine` + `AxeRuntimeEngine` run the `wcag2a`, `wcag2aa`,
`wcag21a`, `wcag21aa` and `wcag22aa` tag sets against the rendered tree.
Vitest suites (`a11y-runtime.spec.tsx`) assert zero critical/serious
violations in both applications. `axe-core@4.13.0` was added as a
devDependency to both apps.

**Accessibility primitives** — `SkipLink` (2.4.1 Bypass Blocks),
`AnnouncerProvider` / `useAnnouncer` (4.1.3 Status Messages — replaces the
Phase 18 `LiveAnnouncer`, whose imperative API was unreachable),
`VisuallyHidden`, and shared `landmarks.ts` ids. Both shells now render a
skip link, a labelled navigation landmark and a focusable `<main>`.

**Localization** — `backend/src/modules/localization/format/`
`ILocaleFormatter` (5 kinds) + `LocaleFormatterRegistry` +
`LocaleFormatPolicyService` + `TenantLocaleResolver` +
RFC 7231 `Accept-Language` negotiation. Resolution ladder:
override → `Accept-Language` → user → tenant → `en-US`; time zone
user → tenant → `UTC`; currency tenant → locale default.

Frontend mirror — `frontend-tenant/src/shared/i18n/` with `LocaleProvider`,
`useLocaleFormat`, `useLocalePreferences` and an explicit single-writer
ambient context. `utils/formatters.ts` and `lib/utils.ts` no longer contain
a hard-coded `en-US` or a hard-coded `$`. `LocaleProvider` also sets
`document.documentElement.lang` and `dir`, which is what makes the two RTL
locales in the OOB catalog (`ar-SA`, `he-IL`) actually render RTL.

### 2.2 Violations found and fixed

The first full audit found **370 findings across 451 documents**. Two of
those rule hits were parser false positives (markup quoted inside JSDoc
prose); the scanner now blanks comments before scanning, which removed
them. Real fixes applied:

| File | Fix |
|---|---|
| `customers/page.tsx` | `role="presentation"` on the stop-propagation action wrapper; `aria-label` on the search input and three filter selects |
| `projects/page.tsx` | `aria-label` on the search input |
| `meetings/page.tsx` | card heading `h3` → `h2` (heading level was skipped) |
| `chat/ContextChips.tsx` | remove button `w-3 h-3` (12 px) → `min-w-6 min-h-6` (24 px, WCAG 2.5.8) |
| `TenantShell.tsx` / `AdminShell.tsx` | skip link, `<main id>` + `tabIndex={-1}`, labelled `<nav>`, announcer, locale provider |

### 2.3 The remaining gap — stated plainly

G29 certifies the six screens the plan names (chat, customers, projects,
command-center, skills, meetings) at **zero findings of any severity**.

Outside that scope the audit still reports **342 blocking findings across
118 files** — overwhelmingly missing form labels (276) and non-keyboard-
operable click handlers (72) on admin and secondary tenant screens. That
backlog:

* is **published**, not hidden — `src/test/certification/reports/g29-a11y-audit.json`;
* is **ratcheted** — `A11Y_BLOCKING_BASELINE = 342` in `key-screens.ts`;
  gate `G29-A-007` fails if the number rises, so it can only decrease;
* is **actionable** — `pnpm a11y:scan` prints file, line, rule and
  remediation for every one of them.

Closing it is mechanical but not automatable safely: a correct `aria-label`
depends on the visible label text, and a correct keyboard affordance
depends on whether the element is a button, a row or decoration. It is
tracked as follow-on work, and certifying a new screen is one entry in
`KEY_SCREENS`.

---

## 3. P30 — Resilience + per-tenant cost ceiling (CR-AI-1305)

### 3.1 What shipped

`backend/src/modules/cost-ceiling/`

| Concern | File |
|---|---|
| Vocabulary + rule contract | `interfaces/ICeilingRule.ts` |
| Usage / alert / spend / enforcer contracts | `interfaces/I{UsageReporter,AlertSink,SpendRecorder,CostCeilingEnforcer}.ts` |
| Typed errors | `cost-ceiling.errors.ts` |
| Comparison primitive | `rules/ceiling-evaluation.ts` |
| 4 dimension rules | `rules/*.rule.ts` |
| Dimension-keyed registry | `ceiling-rule.registry.ts` |
| Ceiling configuration | `config/tenant-cost-ceiling.repository.ts` |
| Usage aggregation + rate window + spend write | `usage/*` |
| Audit alert sink | `alerts/audit-cost-alert.sink.ts` |
| Enforcement service | `cost-ceiling.service.ts` |
| Tenant-scope guardrail | `cost-ceiling.tenant-scope.service.ts` |
| Operator read model | `cost-dashboard.service.ts` |
| HTTP surface | `controllers/cost-ceiling.controller.ts` |

Dimensions: `MONTHLY_SPEND_CENTS`, `DAILY_SPEND_CENTS`, `MONTHLY_TOKENS`,
`REQUESTS_PER_MINUTE`. Adding a fifth is one Prisma enum member, one rule
class and one entry in `CEILING_RULE_CLASSES` — the service, the
controller and the dashboard do not change, and the SOLID guard asserts the
service contains no per-dimension branch.

**Persistence** — `TenantCostCeiling` model + `CostCeilingDimension` enum,
migration `20260808_phase30_cost_ceiling` (additive; no existing table
altered; `limitValue` is an `integer` with a non-negative CHECK).

**Enforcement** — `LlmModelRunner` now:
1. calls `ICostCeilingEnforcer.authorize(...)` with a projection derived
   from `maxTokens` **before** the upstream request, so a breach costs
   nothing;
2. reports realised spend afterwards, so the next authorisation is
   accurate;
3. returns `costCents` on `LlmRunResult`.

The enforcer is injected `@Optional()` under the `COST_CEILING_ENFORCER`
token, so every existing construction site — including the Phase 21 gate —
keeps working unchanged, and the analytics module has no compile-time
dependency on the cost-ceiling internals.

**Ceiling vs budget.** `BudgetPolicy` keeps its soft `ALERT | THROTTLE |
BLOCK` semantics for reporting. `TenantCostCeiling` is the hard stop. They
are deliberately separate tables so an operator can run a reporting budget
and a containment ceiling with different numbers.

**Dashboard** — `GET /command-center/cost-ceilings{,/status,/dashboard}`
and `POST /command-center/cost-ceilings`, composing `CostCentsService`
(integer cents), `CostCeilingService` (per-dimension utilisation) and
`SloCounters` (latency p95, denial rate, duplicate effects, recoveries).
Admin FE: `components/command-center/CostCeilingCard.tsx`, wired into
`/command-center` with real table semantics and `progressbar` roles.

### 3.2 A real defect the gate caught

`costCentsPer1kTokens()` initially read
`Number(process.env['LLM_COST_CENTS_PER_1K_TOKENS'] ?? '')`. An unset
variable produced `Number('') === 0`, which is finite and non-negative, so
every call reported **zero spend** and the spend ceiling could never trip.
Gate `G30-C-011` failed on it. The parser now treats unset/blank explicitly
and falls back to `DEFAULT_COST_CENTS_PER_1K_TOKENS`.

### 3.3 Deployment note (not a code gap)

Ceilings are opt-in: a tenant with no `tenant_cost_ceilings` row is
governed only by the existing budget policy. That is deliberate — a
silently-defaulted ceiling would deny production traffic nobody asked for.
Operators set ceilings through `POST /command-center/cost-ceilings` or the
admin card.

---

## 4. SOLID enforcement

`parity-completion/solid-integrity-guard-p29-p30.spec.ts` reads source at
test time and fails CI on any violation across all 53 new files:

| Principle | Enforced check |
|---|---|
| SRP | every new file ≤ 400 LOC; at most one exported class per file (6 documented exceptions: DTO bundles, the error taxonomy, the temporal formatter family, and registries colocated with the single error they throw) |
| OCP | every registry is a typed `Map` keyed by an enum/union; no `switch` in a registry; `CostCeilingService` contains no dimension literal; `A11yAuditRunner` contains no criterion literal; both modules expose a single `*_CLASSES` extension list |
| LSP | 25 concrete classes each assert `class X implements IY` |
| ISP | no `I…` interface declares more than 5 methods; the 9 single-method contracts are asserted to declare exactly one |
| DIP | only 4 designated adapter files may import `PrismaService`; the two orchestrators must inject every collaborator by token and may not construct one; rules must contain no IO |
| Errors | 6 typed error classes asserted; no P30 service or repository throws a bare `Error` |

---

## 5. Verification results

| Check | Result |
|---|---|
| `jest src/test/certification/` | 40/41 suites pass, 462/463 tests |
| G11–G30 gate runners | all APPROVED |
| `nest build` | exit 0 |
| `frontend-tenant` `tsc --noEmit` | exit 0 |
| `frontend-admin` `tsc --noEmit` | 7 errors — **all pre-existing**, verified against a clean tree |
| `frontend-tenant` vitest | 213 pass, 2 fail — **both pre-existing** |
| `frontend-admin` vitest | 79 pass, 3 fail — **all pre-existing** |
| `pnpm tenancy:scan` | exit 0; 17 pre-existing unsafe findings, **none in the new modules** |
| `pnpm routes:scan` | 2 handler collisions, both pre-existing (`GET /agents`, `GET /agents/:id` from P23), **none from the new controller** |

The single failing certification test
(`scenarios/command-center.spec.ts › counts corrections as REJECTED +
REVISION reviews`) was verified to fail identically on a stashed clean tree
and is unrelated to P29/P30.

---

## 6. What is explicitly NOT claimed

1. The 342-finding accessibility backlog outside the six certified screens
   is open. It is measured, published and ratcheted, not closed.
2. `routes:scan` still reports the two pre-existing P23 `/agents`
   collisions; P29/P30 neither caused nor fixed them.
3. `frontend-admin` still has 7 pre-existing type errors; P29/P30 added
   none and fixed none.
4. Human-owner sign-off (plan §12) is a people process. Engineering
   completion of CR-AI-1304 and CR-AI-1305 does not substitute for
   `@frontend` and `@platform` signing the register.

---

## 7. Document control

- 2026-08-08 — created on completion of P29 and P30.
- Owners: `@frontend` (CR-AI-1304), `@platform` (CR-AI-1305).
