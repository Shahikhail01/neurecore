# Future Plans & Feature Roadmap

**Last updated:** 2026-07-25 11:20 PKT (Industry Verification Run-3 closed every accounting-audit-services defect filed in Run-1 + Run-2; production-ready for accounting. Prior rev: Enterprise Communication Platform Phases 1-9 IMPLEMENTED + AUDIT-PASSED — see [enterprise-comms-chat.md](enterprise-comms-chat.md) rev 3 for the implementation reference. Rev 2 closed 10 spec gaps; rev 3 deep-audit closed 17 runtime/DI/WS gaps (ActivityModule shadow provider, HermesModule missing EventsModule import, 6 services with broken `import type` interface DI converted to symbol-based `@Inject(...)` + `useExisting` aliases, `thread:participant_added` room-name typo, missing `thread:join`/`thread:leave` WS handlers, `useActivityFeed` backfill fixed with new `since` param, 3 orphan test specs deleted). All 10 `COMM_*` feature flags + `AGENT_MESSAGING_ENABLED` default `false` — zero prod behavior change until flags flipped.)
**Audience:** Product + engineering — what's coming next.
**Sibling docs:** [fixes.md](fixes.md) · [backend.md](backend.md) · [frontend-tenant.md](frontend-tenant.md) · [frontend-admin.md](frontend-admin.md) · [contabo-ops.md](contabo-ops.md) · [enterprise-comms-chat.md](enterprise-comms-chat.md)

---

## Status legend

- 🔴 **Not started**
- 🟡 **In progress**
- 🟢 **Done**

---

## 1. Tenant UI — Phase 6 onwards

The original Phase 1-5 refactor plan is delivered (see [frontend-tenant.md §13](frontend-tenant.md#13-phase-history-delivered-features)). What's next:

### 1.0 Phase 6: 3-Column Glassmorphic Home Page 🟢 (COMPLETED 2026-07-05)

**Reference:** `memory-bank-ARCHIVED/ui/Images/Home_screenx.png.webp`

**What was built:**

A Creatio-inspired post-login landing page with glassmorphic design, 3-column layout, and real-time ready widgets:

**Layout:**
- **Left navigation** — single IconRail (FIX-021) replaces the legacy wide sidebar, the `/home` LeftPanel, and the TopBar secondary nav. See [left-rail-icon.md](left-rail-icon.md) for the canonical reference.
- **Center column** (flex):
  - Hero section with live date/time, user greeting, AI prompt input, suggestion chips
  - KPI strip (4 tiles)
  - Network status banner
  - Departments + Quick Actions (2-col grid)
  - Tasks panel
- **Right panel** (320px, fixed, scrollable): 5 collapsible widgets:
  - Live Feed (activity timeline with actor/timestamps)
  - Performance Stats (7-day Recharts line chart)
  - Quick Actions (2×2 gradient button grid)
  - Tasks (active list with priority badges)
  - Approvals (pending list with inline approve/reject)

**UI State Management:**
- `src/stores/uiPreferencesStore.ts` — background style + widget visibility/order. `visibleIcons` field was removed in FIX-021 (legacy LeftPanel deleted). See [left-rail-icon.md §7.1](left-rail-icon.md#71-uipreferencesstore-migration).
- `src/stores/railPreferencesStore.ts` — IconRail visibility (sections + items + section collapse). Persists to localStorage.

**Preferences Modal:**
- Per-icon show/hide now lives inside the IconRail's own **Customize** modal (see [left-rail-icon.md §4](left-rail-icon.md#4-railcustomizemodal)).
- The old `PreferencesModal` component (background style + widget toggles) was deleted in FIX-021.

**Styling:**
- Glassmorphic CSS classes (`.glass-panel`, `.glass-icon`) added to `globals.css`
- Backdrop-blur + semi-transparent white backgrounds
- Framer Motion animations (entrance/exit, stagger, hover)

**Files (current):**
- `src/stores/uiPreferencesStore.ts`
- `src/stores/railPreferencesStore.ts`
- `src/components/layout/IconRail.tsx`
- `src/components/layout/RailCustomizeModal.tsx`
- `src/components/home/{RightPanel,GlassPanel,LiveFeedWidget,StatsWidget,QuickActionsWidget,TasksWidget,ApprovalsWidget}.tsx`
- Updated: `src/app/home/page.tsx` (no longer renders its own LeftPanel), `src/components/TenantShell.tsx` (single shell + IconRail), `src/components/layout/TopBar.tsx` (trimmed secondary nav).

**Real-time ready:** Widget structure supports easy integration with WebSocket/API streams. Replace mock data with actual `/intelligence/analytics`, `/intelligence/observability`, etc.

**Next phases (1.1+):**
- Department control rooms
- Routine builder UI
- Marketplace v1
- Voice commands
- Mobile-first responsive overhaul

---

### 1.1 Phase 7: Department control rooms 🔴

**Goal:** Per-department dedicated view with their agents, goals, projects, tasks, blockers.

**Scope:**
- `/departments/[id]/control-room` page
- Department-scoped KPI tiles, agent list, in-flight tasks, blockers feed
- Auto-refresh every 30s + WebSocket push
- Permission: `DEPT_ADMIN` for own dept, `TENANT_ADMIN` for all

**Touch points:** `frontend-tenant/src/app/departments/`, new `src/components/departments/control-room/`, backend `/departments/:id/control-room` aggregator endpoint.

### 1.2 Phase 7: Routine builder UI 🔴

**Goal:** Visual builder for routines (triggers + steps), no code required.

**Scope:**
- `/routines/new` wizard (trigger type → steps → variables → test → save)
- Drag-drop step reordering (dnd-kit)
- Live test runner with preview
- Template gallery (predefined routines users can clone)

**Touch points:** `frontend-tenant/src/app/routines/builder/`, backend `RoutinesService.createWithTemplate()`.

### 1.3 Phase 8: Marketplace v1 🟡 (in progress, partial)

**Goal:** Browse + install agent/connector templates from a curated marketplace.

**Scope:**
- `/marketplace` listing with categories (agents, connectors, workflows)
- Filter, search, sort, ratings
- "Install to my tenant" flow with consent dialog
- Backend `/marketplace/templates` + `/marketplace/install/:id`

**Touch points:** `frontend-tenant/src/app/marketplace/`, backend new `marketplace` module.

### 1.4 Phase 9: Voice commands 🟡 (scaffolded, not active)

**Goal:** Voice-driven navigation and command execution.

**Status:** `NEXT_PUBLIC_ENABLE_VOICE_COMMANDS=false` in env. UI not built.

**Scope:**
- Web Speech API integration
- Voice → intent → command palette mapping
- Wake word ("Hey Neure")

### 1.5 Phase 10: Mobile-first responsive overhaul 🟡 (partial)

**Goal:** All tenant pages work flawlessly on mobile (375px–430px).

**Status:** Most pages responsive; some admin/inspector panels still overflow.

**Touch points:** audit every `src/app/**/page.tsx` for mobile breakpoints; fix overflow issues.

---

## 2. Admin UI — roadmap

### 2.1 Platform-wide analytics dashboard 🟡 (partial)

**Scope:**
- Revenue MRR/ARR chart
- Active tenants over time
- LLM token usage by model
- Churn indicator
- Cost per tenant

**Status:** Some tiles in `/admin/overview`; full dashboard not built.

### 2.2 Tenant impersonation (for support) 🔴

**Goal:** Support team can impersonate a tenant admin to debug.

**Scope:**
- "Impersonate" button in `/admin/tenants/[id]` (gated to `PLATFORM_ADMIN` + audit logged)
- JWT carrying original admin ID + impersonated tenant ID
- Banner in tenant UI showing "You are impersonating"

### 2.3 White-label tenant theming 🟢 (config only)

Per-tenant logo, primary color, custom domain. Config-driven via `tenants.settings` JSON. UI to edit settings exists; per-tenant render needs CSS variable swap.

### 2.4 Audit log explorer 🟡

**Scope:** Filterable, exportable audit log viewer at `/admin/audit`. Pagination + export to CSV.

**Status:** Backend `/audit-logs` exists; UI is read-only list, no filters/export yet.

---

## 3. Platform engineering

### 3.1 Sentry / error monitoring 🟡 (env set, not active)

**Goal:** Capture frontend + backend errors in Sentry.

**Status:** `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_DSN` env vars exist but empty.

**Scope:**
- Backend: `@sentry/node` init in `main.ts`, capture unhandled exceptions
- Frontend: `@sentry/nextjs` SDK, browser tracing
- Alerts: 5xx rate, 4xx spike, latency spike

### 3.2 CI/CD pipeline 🔴

**Goal:** GitHub Actions runs tests, builds, deploys on push to `main`.

**Scope:**
- Backend: lint + unit + e2e + build → on success, rsync + `rebuild.sh backend` on Contabo via SSH action
- Frontend: lint + type-check + unit + e2e + build → rsync + `rebuild.sh tenant` and/or `rebuild.sh admin`
- Manual approval gate for prod deploys
- Slack notification on success/failure

**CRITICAL — must include `next build` / `nest build`, not just `lint`:**

`next lint` (and `eslint` in general) does NOT catch missing destructures, wrong generics, or undefined names. A pre-existing build error in `command-center/page.tsx` (FIX-019) survived multiple lint passes and was only caught by `next build` during the FIX-019 redeploy. See [deployment.md §10](deployment.md#10-pre-deploy-checklist) and [fixes.md FIX-019 "Build error" section](fixes.md#fix-019--comprehensive-home-page-audit-5-issues-fixed).

**CI steps (per frontend):**
```yaml
- name: Lint
  run: npm run lint
- name: Type-check + build (catches what lint misses)
  run: npm run build
- name: Unit tests
  run: npm test
- name: Bundle-size check
  run: du -sh .next | awk '{print $1}' | xargs -I{} test {} -lt 10M
- name: Deploy to Contabo
  if: github.ref == 'refs/heads/main' && success()
  uses: appleboy/ssh-action@master
  with:
    host: ${{ secrets.CONTABO_HOST }}
    username: root
    key: ${{ secrets.CONTABO_SSH_KEY }}
    script: |
      cd /opt/neurecore/frontend-tenant
      git pull origin main
      npm ci
      ./node_modules/.bin/next build
      pm2 startOrReload /opt/neurecore/ecosystem.config.js --only neurecore-tenant
```

**Lint rule (deferred to D15 in [pending-tasks.md](pending-tasks.md)):** add `eslint-plugin-zustand` or a custom rule that flags any `.length`/`.filter`/`.map`/`.slice`/`.find`/`.includes` on a Zustand selector that returns a value from a persisted store without a preceding `Array.isArray` check.

### 3.3 Architecture — Contabo only 🟢

**Decision:** All three NeureCore apps (Backend, Frontend-Admin, Frontend-Tenant) run on Contabo only. No Vercel, no other cloud.

**Scope:**
- All frontends served from Contabo via PM2 + OpenLiteSpeed
- Backend on Contabo port 3003
- TLS via Let's Encrypt
- Re-evaluation only if a future business need arises

### 3.4 Test coverage 🟡 (gap)

**Current state:**
- Backend: **0** unit specs (only e2e)
- Frontend-tenant: ~5 test files (mostly stores)
- Frontend-admin: **0** tests

**Scope:**
- Backend: add unit tests for services (`*.service.spec.ts`); target 60% coverage on services
- Frontend-tenant: component tests with React Testing Library for `ui/` primitives; Playwright e2e for critical user flows (login, create agent, run routine)
- Frontend-admin: smoke tests for each `/admin/*` route (just verify 200 + no console errors)

**Target:** 60% line coverage on backend services, 100% route smoke on frontends within Q3 2026.

### 3.5 Background job system 🔴

**Goal:** Move from in-process `setInterval` to a real queue (BullMQ + Redis).

**Why:** `SyncSchedulerService` logs "0 succeeded, 0 failed" — silent failures. Real queue gives retries, dead-letter, observability.

**Scope:**
- Add BullMQ + Redis-backed job processor
- Replace `setInterval` calls with `Queue.add(...)`
- Admin UI to view job queue health
- Move routine triggers here too

### 3.6 Internationalization 🔴

**Goal:** UI translatable to es, fr, de, zh (env declares these, source has only English).

**Scope:**
- Add `next-intl` (or `react-i18next`)
- Extract every hard-coded English string
- Translation files in `locales/`
- Language switcher in user menu

### 3.7 Feature flag system 🟢 (implemented with Hermes)

**Current:** `FeatureFlagService` is live with 5 runtime flags: `DISABLE_AI_ACTIONS`, `HERMES_ENABLED`, `HERMES_AUTO_LINK`, `HERMES_APPROVAL_REQUIRED`, `HERMES_SESSION_LOGGING`. Flags are cached from env and refreshed on SIGHUP or every 30s background check.

**Scope (future):**
- Read from `tenants.settings.featureFlags` + global defaults (per-tenant granularity)
- Frontend: `useFeatureFlag()` hook (scaffold exists, not wired to backend)
- Admin UI to toggle flags per tenant
- Rollout % support (e.g. enable for 10% of tenants)

### 3.9 Hermes Layer — domain subgraphs 🔴

**Goal:** Per-domain LangGraph subgraphs (HR, Finance, Sales, etc.) with specialized approval workflows.

**Status:** Foundation shipped — `HermesModule` with runtime, registry, tool-gateway, session, memory, event-bus, and LangGraph integration nodes all implemented. Gated behind `HERMES_ENABLED` flag. Full plan at [plans/hermes-unification-plan.md](plans/hermes-unification-plan.md).

**Future phases:**
- Domain-specific Hermes subgraphs (HR onboarding, Finance invoicing, etc.)
- Full `ApprovalWorkflowEngine` (schema exists, engine not built)
- Hermes admin UI in frontend-admin
- Per-Hermes-type LLM model routing
- Vector embedding population for `HermesMemoryEntry`

### 3.10 AgentStateMachine retirement 🔴

**Goal:** Remove legacy `AgentStateMachine` (custom LangGraph implementation), use only `OfficialAgentGraph`.

**Status:** `OfficialAgentGraph` is the primary execution engine. `AgentStateMachine` still registered in `AgentsModule` as a provider. Hermes module uses `OfficialAgentGraph` only. Retirement planned after Hermes is live in production.

### 3.11 Observability upgrade 🔴

**Goal:** Distributed tracing + structured logs searchable.

**Scope:**
- OpenTelemetry SDK in backend (already partially scaffolded — `OTEL_EXPORTER_OTLP_ENDPOINT` env exists)
- Tempo or Jaeger for trace storage
- Loki for log aggregation
- Grafana dashboards linking traces ↔ logs ↔ metrics

---

## 4. Security & compliance

### 4.1 SOC 2 Type II readiness 🔴

**Goal:** Document controls, evidence collection, audit log retention.

**Scope:**
- Formal access control matrix
- Audit log retention 1+ year (currently indefinite via DB)
- Encryption at rest verification (Contabo does this; document)
- Incident response playbook
- Vendor risk assessment (Contabo, OpenAI, Anthropic)

### 4.2 GDPR data export / deletion 🔴

**Scope:**
- `GET /users/me/export` returns JSON of all my data
- `DELETE /users/me` cascades to related records (or soft-delete with 30-day grace)
- Audit log of every export/delete request

### 4.3 Secret rotation automation 🔴

**Scope:**
- Auto-rotate `JWT_SECRET` quarterly (with overlap window)
- Auto-rotate LLM API keys quarterly
- Document rotation procedure in [contabo-ops.md](contabo-ops.md)

### 4.4 Rate limiting per-tenant 🟡

**Current:** Global rate limit via `ThrottlerGuard`.

**Scope:** Per-tenant quotas enforced in `QuotaGuard` (scaffold exists in `reliability` module).

---

## 5. Database & data

### 5.1 Read replicas 🔴

**Why:** Mission Feed (command center) and dashboards do heavy read queries.

**Scope:**
- Provision Contabo read replica
- Backend reads via replica URL, writes via primary
- Track in [backend.md §6](backend.md#6-database)

### 5.2 Vector store for agent memory 🔴

**Current:** `MemoryEntry` model is structured; semantic search missing.

**Scope:**
- Add `pgvector` extension to Neon
- Migrate `MemoryEntry` to use `vector(1536)` for OpenAI embeddings
- `/memory/search` endpoint using `<=>` operator
- Auto-embed on memory create

### 5.3 DB migration policy 🔴

**Why:** 22 migration dirs on disk but only 14 applied — drift risk.

**Scope:**
- Squash the 8 orphan dirs into the next migration
- Add CI check: `prisma migrate status` must be clean

---

## 6. Disaster recovery hardening

### 6.1 Off-host DR snapshots 🔴

**Why:** Snapshots are on the same box as the apps. If box dies, snapshots die.

**Scope:**
- Cron job: weekly rsync `/opt/neurecore/_archives/` to off-host (Backblaze B2, S3, or another VPS)
- Document in [disaster-recovery.md §1](disaster-recovery.md)

### 6.2 DR restore drill quarterly 🔴

**Scope:** Spin up a clone of Contabo, restore from snapshot, verify all 4 services + DB connection. Document time-to-recover.

### 6.3 Database backup policy 🔴

**Scope:** Scheduled `pg_dump` to `/opt/neurecore/_archives/db-*.sql` (daily), off-host (weekly).

---

## 7. Performance

### 7.1 Frontend bundle size audit 🔴

**Current:** Frontend-tenant first-load JS is large (need to measure with `next build` output).

**Scope:**
- Code-split per route
- Lazy-load charts, command palette, chat
- Replace heavy dependencies (d3 → d3-* subpackages; visx → only what's used)

### 7.2 Backend p95 latency tracking 🟡 (partial)

**Scope:**
- Add `histogram_quantile` panels in Grafana for `/api/v1/*` p50/p95/p99
- Alert if p95 > 500ms

### 7.3 Database query review 🔴

**Scope:** Audit top-20 slow queries (`pg_stat_statements`); add indexes or rewrite as needed.

---

## 8. Product features (to be scoped)

### 8.1 Full-featured onboarding wizard 🔴

**Strategy (locked 2026-07-04):** Two-tier progressive system.
- **Tier 1**: `/onboarding/setup` reduced to 6 blocking steps (Company + Logo + Localization + Plan + Template + Done). Completion redirects to `/home`.
- **Tier 2**: 11 focused sub-wizards under `/settings/wizard/[slug]` (company, localization, billing, profile, preferences, security, ai-ops, org, integrations, compliance, team), surfaced via a persistent "Things to do" panel on `/home` and linked from Settings.
- Full design + PR breakdown in `plans/onboarding-progressive-wizard.md`.

**PR-1 (Foundation) ✅ shipped 2026-07-04:**
- `OnboardingChecklistEntry` model + `OnboardingChecklistState` / `TenantSizeBucket` / `BillingPaymentMethod` enums.
- Tenant + User additive nullable fields (locale, timezone, currency, dateFormat, timeFormat, fiscalYearStart, sizeBucket, foundedYear, businessType, addressJson, billingProfileJson, defaultsJson, checklistDismissedAt, phone, supportEmail, etc.).
- `MissionFeedCategory.ONBOARDING_TASK` enum value added.
- `OnboardingChecklistModule` (controller/service/DTOs/config) under `backend/src/modules/onboarding/checklist/`.
- `OnboardingService.complete()` now seeds the 11 checklist entries + matching MissionFeedItems (idempotent).
- Frontend: `useOnboardingChecklistStore` (Zustand), `useOnboardingChecklist` hook, `ThingsToDoPanel`, `WizardShell` placeholder, `/settings/wizard` index + `[slug]` route, mounted in `TenantShell`.
- Migration `20260704_ws21_onboarding_checklist/migration.sql` ready (purely additive).
- One-off script `scripts/seed-checklist-for-existing-tenants.ts` to seed checklist for tenants who already completed onboarding pre-PR-1.

**PR-2 (Tier-1 wizard reduction) ✅ shipped 2026-07-04:**
- **Backend — uploads module:** `backend/src/modules/uploads/` with `IUploadStorage` abstract-class DI token (DIP), `LocalDiskStorage` impl persisting to `apps/cdn/uploads/logos/{tenantId}/{uuid}.{ext}`. Static serving at `GET /cdn/*` via `useStaticAssets` in `main.ts`. POST `/uploads/logo` (multipart, OWNER/ADMIN) + DELETE `/uploads/logo/:key`. Content sniffing defends against spoofed MIME types. 5 MB cap, allowed: PNG/JPEG/WEBP/SVG.
- **Backend — PATCH `/tenants/me`:** owner-scoped endpoint with `UpdateMyTenantDto` covering identity, localization, structured address, billing-profile JSON, defaults JSON, and branding. Writes audit log with changed field names. Status / slug / tier explicitly excluded — those require platform admin.
- **Backend — onboarding persistence bug fix:** DTO accepted `timezone` / `currency` / `logoUrl` but controller and service were silently dropping them. Fixed in `onboarding.controller.ts`, `onboarding.service.ts`, `OnboardingStatePayload` interface. `getState()` now exposes timezone + currency for resume.
- **Frontend — uploads:** `services/uploads.service.ts` (raw axios for multipart), `components/uploads/LogoUploader.tsx` (preview/replace/remove with client-side validation).
- **Frontend — Tier-1 wizard refactor:** `app/onboarding/setup/page.tsx` reduced from 680 → ~200 lines as a thin orchestrator. Six step components in `app/onboarding/setup/steps/` (Company, Logo, Localization, Plan, Template, Complete). Resume support via `tenantsService.getCurrent()` + `onboardingService.getState()`.
- **Frontend — services:** `services/tenants.service.ts` (new) with `getCurrent()` + `updateMine()`. `onboarding.service.ts` extended with `saveCompanyAndLocale()` helper.
- Post-onboarding-complete redirect target moved from `/command-center` → `/home` (in both `CompleteStep` and the legacy flow).

**Current state:** A 6-step wizard exists at `frontend-tenant/src/app/onboarding/setup/page.tsx`: **Company → Plan → Template → Review → Team → Done**. Gated by `login/page.tsx:126-127` (`tenant.onboardingCompletedAt` null → redirect here). Backend endpoints in `services/onboarding.service.ts` wrap `/onboarding/{state,select-tier,select-template,invite,complete,accept-invite/:token}`. Re-entrant from `/command-center` link.

**Goal:** Extend to capture **everything the portal needs to render correctly on day one** — logo, timezone, currency, user profile, security, integrations — so the new Home (Phase 5.5) doesn't render with placeholder/missing data.

**New steps to add (after Company, before Plan):**

1. **Company v2** — current fields + **logo upload** (file → `company.logoUrl`) + live brand preview tile showing how it'll render in the Home hero.
2. **Locale & defaults** — timezone (IANA), date format, default currency, locale.
3. **User profile** — display name, avatar, notification preferences, tz confirmation.
4. **Security** — 2FA opt-in (TOTP), SSO choice (Google / Microsoft / none) if tenant plan supports it.
5. **Integrations** *(optional, skippable)* — Google Workspace, Slack, Microsoft 365 connectors (the Settings → Integrations flow exists; offer here for first-run convenience).
6. *(Existing)* Plan → Template → Review → Team → Done.

**Replacing current Review step:**
- Old: counts only ("3 departments, 5 agents").
- New: **live preview** — show the chosen company logo + name + greeting + AI assistant name (`<companyName> AI`) exactly as the Home hero will render, so typos are caught before commit.

**Touch points:**
- Frontend: `frontend-tenant/src/app/onboarding/setup/page.tsx` (extend STEPS), `src/services/onboarding.service.ts` (new endpoints for logo upload, profile, security), `src/app/onboarding/setup/[step]/page.tsx` if we split into subroutes.
- Backend: new `POST /onboarding/upload-logo` (multipart → S3/local), `PUT /onboarding/profile`, `PUT /onboarding/security/2fa`, `PUT /onboarding/integrations`. Update `OnboardingState` schema.
- Also update the post-onboarding redirect target from `/command-center` → `/home` (see §1.0).

**Open questions for product:**
- Is SSO/2FA mandatory or opt-in on first run?
- Are integrations blocking or pure convenience (skippable)?
- Should logo be required, or fall back to initials avatar?

**Dependencies:** should ship **before or alongside** Phase 5.5 Home — otherwise Home renders with placeholder logo and wrong timezone on first login.

---

These are user-facing features that need product review before engineering:

| Feature | Status | Notes |
|---|---|---|
| Real-time collaboration (multi-user editing of agent config) | 🔴 | Needs CRDT/locking design |
| Mobile app (iOS/Android via React Native or Expo) | 🔴 | Big investment; defer until web solid |
| Public API for third-party integrations | 🔴 | Need API key model + rate limiting + docs site |
| Webhook subscriptions for tenant events | 🔴 | Backend has webhooks; no UI for users to subscribe |
| Slack / Teams integration for approvals | 🟡 | Backend connector exists; UI not built |
| Stripe billing integration | 🟡 | `STRIPE_SECRET_KEY` env exists; no checkout flow |
| Custom domains per tenant | 🟡 | Backend `tenants.domain` field exists; no provisioning UI |
| Email digest (daily/weekly summary) | 🔴 | Mailgun configured; no template engine |
| White-label mobile apps | 🔴 | Deferred |

---

## 9. Deprecation plan

Things we plan to remove:

| Item | When | Why |
|---|---|---|
| `frontend-tenant-simplified/` | already removed | FTS rewrite cancelled |
| Legacy deployment docs | corrected | Single-surface decision |
| EAOS frontend | already removed | App retired |
| Legacy `next.config.js` standalone output | TBD | Re-evaluate when adding more Node.js services |
| `app/api/v1/*` duplicate routes in frontend-admin | TBD | Either use them properly or delete |
| In-process cron jobs | when §3.5 ships | Move to BullMQ |

---

## 10. Decision log (recent)

| Date | Decision | Rationale |
|---|---|---|
| 2026-07-04 | All frontends on Contabo | Single-host ops simplicity; cost |
| 2026-07-04 | Retire FTS rewrite | Insufficient ROI vs. maintenance cost |
| 2026-07-04 | Deployment docs corrected | Architecture clarified |
| 2026-07-04 | Single PM2 ecosystem.config.js for all 4 processes | Reproducibility |
| 2026-07-04 | `start.sh` wrappers instead of `npx next start` | npx path resolution in PM2 was broken |
| 2026-07-04 | CORS in sidecar, not NestJS | Production handled by OLS vhost; dev by proxy |
| 2026-07-04 | Memory-bank restructured | 6 legacy docs archived; 12 canonical docs |
| 2026-07-04 | Admin refactor — six-pool business-composition model | Replace ad-hoc `*Templates` taxonomy with explicit six orthogonal pools; product vocabulary aligns with what customers buy (Packages); full plan in [plans/admin-business-composition.md](plans/admin-business-composition.md) |
| 2026-07-04 | `Phase 10` shipped six new pool endpoints | `industries`, `tier-templates`, `features`, `packages`, `agents-pool`, `departments-pool` — all under `/api/v1` |
| 2026-07-04 | `DepartmentTemplate` & `AgentTemplate` extended, not replaced | Backward-compatible; new pool endpoints coexist with legacy `/department-templates` and `/agent-templates/platform` |
| 2026-07-04 | `TierTemplate` split from billing `Tier` | Distinct lifecycles — billing (Finance-owned) vs. commercial offering (Product-owned) |
| 2026-07-04 | Dropped leftover experimental tables (`pool_agents`, `pool_departments`, `industry_packages`, `industry_package_entries`, `agents.poolSourceId`, custom `Industry` enum) | Were from an abandoned prior attempt; superseded by the new six-pool schema |

---

## 11. Admin Business Composition (Phase 10) — SHIPPED 🟢

Replaces the previous ad-hoc `*Templates` grouping with **six orthogonal pools** that compose a **Package** (the unit customers buy). Admin now matches the marketing/product vocabulary.

### 11.1 The six pools

| # | Pool | Prisma model | Admin route | Backend route | Purpose |
|---|---|---|---|---|---|
| 1 | AI Employees | `AgentTemplate` (+`enabled`) | `/agents-pool` | `/api/v1/agents-pool` | Master library of Hermes agent templates |
| 2 | Departments | `DepartmentTemplate` | `/departments-pool` | `/api/v1/departments-pool` | Org-structure building blocks |
| 3 | Industries | `Industry` (NEW) | `/industries` | `/api/v1/industries` | Top-level business categorisation |
| 4 | Tiers | `TierTemplate` (NEW, split from `Tier`) | `/tiers` | `/api/v1/tier-templates` | Commercial offering levels |
| 5 | Features | `Feature` (NEW) | `/features` | `/api/v1/features` | Atomic platform capabilities |
| 6 | Packages | `Package` (NEW, composite root) | `/packages` | `/api/v1/packages` | Final commercial SKUs (Industry × Tier × Depts × Agents × Features) |

### 11.2 What shipped

- **Backend** (`/home/najeeb/Linux-Dev/neurecore-2026/neurecore/backend/`):
  - `prisma/schema.prisma` — 4 new models + 4 enums + `enabled` flag on `AgentTemplate` (additive only)
  - `prisma/migrations/20260704_business_composition_six_pools/` — applied
  - `prisma/seed-business-composition.cjs` — 8 industries, 4 tier templates, 19 features (idempotent)
  - `prisma/seed-agency-agents.cjs` — **706 AI Employees** (AgentTemplate, isPublic=true) and **57 Department Templates** (DepartmentTemplate, isPublic=true) seeded from `agency-agents-main/` pool (idempotent; run again to update)
  - `src/common/pool/` — shared `pool.types.ts`, abstract `PoolService`, abstract `PoolController` (DIP primitives)
  - 6 new modules: `agents-pool`, `departments-pool`, `industry`, `tier-templates`, `features`, `packages`
  - `PackagesService.updateComposition()` — atomic 3-way M2M replace
  - `PackagesService.preview()` — dry-run validation without writing
  - 6 unit-test files, **36/36 tests passing**

- **Frontend** (`/home/najeeb/Linux-Dev/neurecore-2026/neurecore/frontend-admin/`):
  - `src/lib/pool/IPoolAdminService.ts` — TS interface (no shared code with backend)
  - 6 pool services implementing `IPoolAdminService` (DIP boundary)
  - `src/hooks/usePoolList.ts` — generic CRUD hook (DRY)
  - `src/components/pool/` — `PoolToolbar`, `PoolStatusBadge`, `PoolEmptyState`, `PoolConfirmDeleteDialog`, `PoolPagination` (shared UI — 20 items/page server-side pagination)
  - `src/components/sidebar/navigation.config.ts` — single source of truth for the left-nav AND the command palette (replaces hard-coded `NAV` array in `AdminShell`)
  - 6 pool pages (`/industries`, `/tiers`, `/features`, `/agents-pool`, `/departments-pool`, `/packages`)
  - 3 back-compat redirects (`/agent-templates`, `/dept-templates`, `/tier-templates`)
  - Package 4-step composer (`/packages/new`): Identity → Categorize → Compose → Review with live `PackagePreview` side-rail
  - Package detail (`/packages/[id]`) + edit (`/packages/[id]/edit`)
  - `npm run type-check` clean · `npm run build` clean · no new lint errors

> **Bug fix (post-deploy 23:35 PKT):** Pool pages had a `useEffect` calling `service.list({ limit: 100 })` directly then `refresh()` which overwrote with `limit: 20` — only ever showing 20 items. Fixed: `useEffect` now calls `setOpts({ search, status, page: 1, limit: 20 })`. All 5 pool pages now have true server-side pagination via `PoolPagination` component.

### 11.3 Back-compat surface (preserved)

- `/api/v1/agent-templates/platform/*` — legacy endpoints still serve
- `/api/v1/department-templates/*` — legacy endpoints still serve
- `/agent-templates`, `/dept-templates`, `/tier-templates` admin pages now 302-redirect to the new routes
- `tier-templates` rows in `department_templates` are marked `category='legacy-tier'` (not deleted) by the seed script

### 11.4 Data relationships

```
Industry (1) ── (N) Package (N) ── (1) TierTemplate
                            │
                            ├── (N) DepartmentTemplate   (Pool #2)
                            ├── (N) AgentTemplate        (Pool #1)
                            └── (N) Feature              (Pool #5)
```

`TierTemplate.defaultBillingTierId` is an optional suggestion to the billing `Tier` (separate lifecycle).

### 11.5 Open questions (deferred per plan §10)

- **Tiers** — keep both billing `Tier` and commercial `TierTemplate` (current decision).
- **Departments** — pool currently reuses `DepartmentTemplate.structure` JSON; plan §11.1 flagged a future PR-4 spike to normalise into rows.
- **Package instantiation** — v1 stays as SKUs only; `POST /packages/:id/instantiate` deferred.
- **Stable feature keys** vs UUIDs — shipped with stable keys (per `Feature.key`).
- **`/agents` admin route** — kept as a Fleet group item for now; not hidden.

### 11.6 Pool inventory (as of 2026-07-05)

| Pool | Model | Seeder script | Count |
|---|---|---|---|
| AI Employees | `AgentTemplate` (isPublic=true) | `seed-agency-agents.cjs` | **706** |
| Departments | `DepartmentTemplate` (isPublic=true) | `seed-agency-agents.cjs` | **57** |
| **Industries** | `Industry` | `seed-industries-majors.cjs` (canonical, 2026-07-05) + `add-industry-accounting.cjs` (Major #16, 2026-07-05) | **16 majors** (sub-industries in `description`) |
| Tier Templates | `TierTemplate` | `seed-business-composition.cjs` | **4** |
| Features | `Feature` | `seed-business-composition.cjs` | **19** |
| Packages | `Package` | `seed-package-catalogue.cjs` (empty pool, 2026-07-05) + `seed-accounting-packages.cjs` (15 with composition, 2026-07-05) | **68** (15 with composition: 4 Starter / 8 Professional / 3 Enterprise, all anchored to Accounting) |

**Industry taxonomy history** (see [`pools-taxonomy.md` §3](pools-taxonomy.md) for full table):
- `seed-business-composition.cjs` (2026-07-04): Phase 10 — **8** industries.
- `seed-industries-compact.cjs` (2026-07-04, superseded same evening): **30** narrow rows.
- `seed-industries-majors.cjs` (2026-07-05, canonical): **15** Major Industries aligned to the broader market; sub-industries packed into `Industry.description`.
- `add-industry-accounting.cjs` (2026-07-05 01:29, additive): inserted Major #16 `accounting-audit-services` at sortOrder 35. Idempotent, no `deleteMany`.
- `seed-accounting-packages.cjs` (2026-07-05 01:50, additive composition): inserted 15 packages anchored to Accounting with full Departments + AI Agents + Features. First vertical-with-composition.

**To re-seed:** `cd /opt/neurecore/backend && node prisma/seed-agency-agents.cjs` (idempotent — safe to re-run; updates existing records by slug). For Industry reload: `node prisma/seed-industries-majors.cjs --check` (diff) then re-run without `--check` to apply.

### 11.7 Reference

- Full plan: [plans/admin-business-composition.md](plans/admin-business-composition.md)
- Backend module reference: [backend.md §3, §4.7](backend.md)
- Frontend nav: [frontend-admin.md §4, §5](frontend-admin.md)

---

## 12. ~~Auth system refactor (FIX-020) — SHIPPED 2026-07-07~~ 🟢

> **Historical record.** The original plan is preserved in [plans/auth-hardening-refactor.md](plans/auth-hardening-refactor.md). For the current implementation, see [int-features/auth-architecture.md](int-features/auth-architecture.md) — the **authoritative reference** for any future auth change.

**Audit (2026-07-07 16:27 PKT)** identified 7 root causes for the "auth gets corrupted when I implement work on other pages" bug class. **Implementation (2026-07-07)** shipped all 10 phases:

| Phase | Status | Notes |
|---|---|---|
| 1. Build new core (L2/L3/L4) + tests | ✅ | 7 interfaces, 7 implementations, DI container; 27 new unit tests |
| 2. Migrate TenantShell + TopBar (one consumer) | ✅ | `useAuth().logout()` everywhere |
| 3. Migrate API interceptors | ✅ | Single `authHttpClient`, single response interceptor, NO hard-redirects |
| 4. Migrate all pages | ✅ | Back-compat `useTenantAuth`/`useAdminAuth` shims over `useAuth()` |
| 5. Fix ProfileDetail (RC-4) | ✅ | Read user fresh from store at save time |
| 6. Delete dead `lib/security.ts` + `lib/errors.ts` token code | ✅ | Both files truncated to sanitization helpers; auth bits deleted |
| 7. Fix `AppInitializer` (RC-6) | ✅ | Subscribes to `authService.subscribe()` instead of clearing on transient failure |
| 8. Admin refactor (parallel) | ✅ | Mirrored in `frontend-admin/src/auth/` |
| 9. Lint rules | ✅ | Implemented as `bash scripts/auth-lint.sh` (4 greps). ESLint plugin deferred. |
| 10. Documentation | ✅ | [int-features/auth-architecture.md](int-features/auth-architecture.md) + updates to auth.md, fixes.md, runbook.md, system-state.md, pending-tasks.md |

**Verification (post-deploy):**
- `vitest run` → 43/43 pass
- Backend `auth-hardening.spec.ts` → 8/8 pass on Contabo
- `npx playwright test auth-smoke prod-auth-smoke prod-login-flow prod-walkthrough` → 9/9 pass against live `https://hq.neurecore.com` and `https://cc.neurecore.com`
- `bash scripts/auth-lint.sh` → OK, no banned patterns

**The 7 root causes** (now structurally impossible):
- **RC-1** ✅ `lib/security.ts` deleted in both frontends; `scripts/auth-lint.sh` blocks any reintroduction
- **RC-2** ✅ `lib/errors.ts:useErrorHandler` no longer clears localStorage or hard-redirects; 401 handling moved to `authResponseInterceptor`
- **RC-3** ✅ `killSession()` is atomic; only one place can clear the session
- **RC-4** ✅ `ProfileDetail.handleSaveProfile` now reads `useAuthStore.getState().user` at save time
- **RC-5** ✅ `useAuth()` returns discriminated `AuthState`; pages can no longer render `null` mid-hydration
- **RC-6** ✅ `AuthService.initialize()` keeps user on transient `/me` failure; only clears on explicit 401
- **RC-7** ✅ Single `authHttpClient` instance; shared response interceptor

**⚠️ DO NOT CORRUPT.** A new contributor who:
- imports `localStorage`/`sessionStorage` for auth keys → `scripts/auth-lint.sh` fails
- writes `document.cookie = ...` outside `src/auth/impl/CookieTokenRepository.ts` → lint fails
- calls `window.location.href = '/login'` outside `src/auth/` → lint fails
- mutates `useAuthStore` directly outside `src/auth/impl/ZustandUserRepository.ts` → lint fails
- imports the dead `SecureStorageKey`/`setSecureToken` helpers → lint fails

…will fail CI before merge. That is the design.

---

**End of future-plans.md.** Add new entries under the appropriate section; don't delete old ones — strike them with `~~` and link to the replacement.