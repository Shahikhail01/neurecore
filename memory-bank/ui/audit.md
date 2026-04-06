# NeureCore UI/UX Architecture Audit

**Branch:** `2.1-new-ui` (based on `2-similar-features`)  
**Date:** 2026-04-06  
**Status:** Planning Phase — No code changes until `plan.md` is approved.

---

## 1. Executive Summary

The current frontend is a **functional but architecturally fragmented** Next.js 15 application. It was built in fast iterations, accumulating two parallel shell layers, a disconnected design-token system, and monolithic page files. The UI does not match the target brand identity (Creatio-inspired, premium dark SaaS with intelligent AI panels). Before the Phase 2 rebuild begins, this audit documents every file that must be replaced, preserved, or deleted.

**Key findings:**

- **Two shell components** exist simultaneously — only `AppShell.tsx` is active; `TenantShell.tsx` is dead code
- **CSS variables and Tailwind tokens are not bridged** — the theme switching works in CSS but Tailwind utility classes use hardcoded hex values, making theming fragile
- **Dashboard page is a 665-line monolith** — it mixes layout, data fetching, chart rendering, and business logic
- **No unified design system** — typography, spacing, elevation, and motion values are scattered inline or missing entirely
- **AI chat components exist in two separate feature paths** — `ConversationPanel.tsx` (full) and `AIChatPanel.tsx` (slide-in) with no shared primitives
- **All business logic layers are sound** — services, stores, hooks, and core infrastructure should be fully preserved

---

## 2. Active Architecture Snapshot

### 2.1 Shell Layer

| File                                       | Status       | Lines | Used In                                 |
| ------------------------------------------ | ------------ | ----- | --------------------------------------- |
| `src/components/shell/AppShell.tsx`        | ✅ ACTIVE    | 278   | `app/(app)/layout.tsx`                  |
| `src/components/TenantShell.tsx`           | ❌ DEAD CODE | 263   | Not imported anywhere in current layout |
| `src/components/layout/TopBar.tsx`         | ⚠️ LEGACY    | ~100  | Imported by `TenantShell` only          |
| `src/components/layout/InspectorPanel.tsx` | ⚠️ LEGACY    | ~80   | Imported by `TenantShell` only          |

**Finding:** The `(app)/layout.tsx` file uses `<AppShell>` directly. `TenantShell`, `TopBar`, and `InspectorPanel` are orphaned files that are never reached in the current routing tree. They represent the old architecture and carry zero runtime risk but 100% maintenance confusion.

### 2.2 Navigation Structure (AppShell — currently active)

```
Workspace
  ├── AI Office       → /dashboard
  ├── Inbox           → /inbox
  └── Activity        → /activity

Work
  ├── Tasks           → /tasks
  ├── Workflows       → /workflows
  ├── Projects        → /projects
  ├── Routines        → /routines
  └── Approvals       → /approvals

Org
  ├── Team            → /agents
  ├── Departments     → /departments
  └── Org Chart       → /org-chart

Intelligence
  ├── Analytics       → /analytics
  ├── Goals           → /goals
  ├── Strategy        → /strategy
  └── Costs           → /costs

Platform
  ├── Connectors      → /connectors
  ├── Billing         → /billing
  └── Settings        → /settings
```

**Finding:** Navigation groupings are logical and should be preserved in the new shell. The icons and labels map well to the Creatio home sidebar pattern. The group ordering may change to elevate AI-first features.

---

## 3. CSS Architecture Audit

### 3.1 Token System (Critical Disconnect)

**CSS Variables** (`globals.css` — active, theme-aware):

```css
:root, .theme-dark { --surface: #09090b; --surface-raised: #111113; ... }
.theme-light       { --surface: #ffffff; --surface-raised: #f4f4f5; ... }
.theme-high-contrast { --surface: #000000; ... }
```

Variables defined: `--surface`, `--surface-raised`, `--surface-overlay`, `--surface-border`, `--surface-muted`, `--status-{profit,risk,ops,strategy,warn,neutral}`, `--text-primary`, `--text-secondary`

**Tailwind Config** (`tailwind.config.js` — active, static):

```js
surface: {
  DEFAULT: '#09090b',  // ← hardcoded hex, not var(--surface)
  raised: '#111113',
  ...
}
```

**The Critical Gap:** When theme class changes (`.theme-light` applied to `<html>`), globally used `bg-surface` / `text-zinc-200` classes **do not respond** — they stay dark because they resolve to static hex at build time, not at runtime via CSS variables. Only elements using `bg-[var(--surface)]` inline syntax actually theme-switch.

**Token Gaps (missing entirely):**

- `--text-primary` / `--text-secondary` — defined in CSS but no Tailwind token
- `--surface-brand` — no accent/brand color token
- No `shadow` tokens
- No `radius` tokens
- No `spacing` scale beyond Tailwind defaults
- No `font-size` semantic scale (e.g., `text-body`, `text-caption`)

### 3.2 Typography

| Property       | Current State                       | Gap                    |
| -------------- | ----------------------------------- | ---------------------- |
| Primary font   | Inter (Google Fonts via layout.tsx) | ✅ Good                |
| Mono font      | JetBrains Mono (tailwind config)    | ✅ Good                |
| Scale          | Default Tailwind sizes only         | ❌ No semantic aliases |
| Line height    | Default only, no document-level     | ❌                     |
| Letter-spacing | Only `.font-dyslexia-friendly`      | ❌                     |

### 3.3 Component Style Fragmentation

The following inline class patterns appear across pages — none are abstracted into reusable tokens:

- `bg-zinc-800/60 border border-zinc-700/40 rounded-xl` (card pattern)
- `text-zinc-400 text-xs` (secondary label pattern)
- `bg-indigo-600 hover:bg-indigo-500` (CTA button — uses `indigo`, not a semantic token)
- `text-violet-400` (accent label)
- `border-l-4 border-violet-500` (AI response card accent)

**Finding:** 20+ pages repeat the same 5-7 inline class patterns with no shared component or utility class. Any brand-color change requires a mass find-replace.

---

## 4. Page Inventory & Classification

### 4.1 Page Status Matrix

| Route          | File                   | Lines | Classification                                    | Priority |
| -------------- | ---------------------- | ----- | ------------------------------------------------- | -------- |
| `/dashboard`   | `dashboard/page.tsx`   | 665   | 🔴 REBUILD — monolith, wrong layout               | 1        |
| `/agents`      | `agents/page.tsx`      | ~200  | 🟡 REFACTOR — functional but no rich cards        | 2        |
| `/agents/[id]` | `agents/[id]/page.tsx` | ~300  | 🟡 REFACTOR — no tab layout                       | 3        |
| `/tasks`       | `tasks/page.tsx`       | ~250  | 🟡 REFACTOR — table needs polish                  | 4        |
| `/workflows`   | `workflows/page.tsx`   | ~200  | 🟡 REFACTOR — list only                           | 5        |
| `/analytics`   | `analytics/page.tsx`   | ~300  | 🟡 REFACTOR — charts exist, layout stale          | 6        |
| `/inbox`       | `inbox/page.tsx`       | ~150  | 🟢 POLISH — functional                            | 7        |
| `/costs`       | `costs/page.tsx`       | ~300  | 🟡 REFACTOR — API path fixed in `3-new-ui` needed | 4        |
| `/departments` | `departments/page.tsx` | ~200  | 🟢 POLISH                                         | 8        |
| `/goals`       | `goals/page.tsx`       | ~200  | 🟢 POLISH                                         | 9        |
| `/strategy`    | `strategy/page.tsx`    | ~200  | 🟢 POLISH                                         | 10       |
| `/approvals`   | `approvals/page.tsx`   | ~150  | 🟢 POLISH                                         | 11       |
| `/connectors`  | `connectors/page.tsx`  | ~200  | 🟢 POLISH                                         | 12       |
| `/billing`     | `billing/page.tsx`     | ~200  | 🟡 REFACTOR — API path issue (from 3-new-ui)      | 5        |
| `/settings`    | `settings/page.tsx`    | ~300  | 🟡 REFACTOR — tabbed layout needed                | 6        |
| `/activity`    | `activity/page.tsx`    | ~150  | 🟢 POLISH                                         | 13       |
| `/org-chart`   | `org-chart/page.tsx`   | ~100  | 🟢 POLISH                                         | 14       |
| `/projects`    | `projects/page.tsx`    | ~150  | 🟢 POLISH                                         | 15       |
| `/routines`    | `routines/page.tsx`    | ~150  | 🟢 POLISH                                         | 16       |

**Classifications:**

- 🔴 REBUILD: Architectural pattern must change
- 🟡 REFACTOR: Content ok, UI pattern upgrade needed
- 🟢 POLISH: Minor styling and component consistency pass needed

### 4.2 Dashboard Monolith Analysis (`dashboard/page.tsx` — 665 lines)

**Responsibilities currently embedded in a single file:**

1. Data fetching (5+ `useEffect` hooks with direct API calls)
2. State management (12+ local `useState` declarations)
3. Chart rendering (AreaChart, BarChart inline JSX)
4. Metric card layout (hardcoded inline JSX)
5. Agent call-to-action (inline link buttons)
6. AI office greeting section
7. Socket event listeners for real-time updates
8. Error/loading state management

**Violations:** Single Responsibility, Open/Closed  
**Target:** Split into at minimum 6 focused components + 2 custom hooks

---

## 5. Component Inventory

### 5.1 Chat/AI Components

| Component               | Path                           | Status      | Notes                                                                                        |
| ----------------------- | ------------------------------ | ----------- | -------------------------------------------------------------------------------------------- |
| `AIChatPanel.tsx`       | `features/ai-chat/components/` | 🟡 REFACTOR | Slide-in panel, good architecture, needs visual rework to match reference screenshots        |
| `AIChatMessage.tsx`     | `features/ai-chat/components/` | 🟡 REFACTOR | Basic bubble, lacks rich agent response card format                                          |
| `ConversationPanel.tsx` | `components/chat/`             | ⚠️ LEGACY   | Full-page chat, used in TenantShell only (dead code path). Rich but architecturally orphaned |
| `ArtifactViewer.tsx`    | `components/artifacts/`        | ✅ KEEP     | Solid MIME-type render logic, reusable                                                       |

**Finding:** `ConversationPanel.tsx` has richer rendering (markdown, metrics charts, action buttons) that is currently unreachable. The Reference Design's "AI Response Card" pattern (violet left-border, KPI tiles, action buttons) is NOT yet implemented in any component — it needs to be built from scratch as `AIResponseCard.tsx`.

### 5.2 UI Primitives (Radix/shadcn wrappers)

Located in `/components/ui/` — full inventory:

| Component           | Assessment                               |
| ------------------- | ---------------------------------------- |
| `button.tsx`        | ✅ KEEP — extend with new variant tokens |
| `badge.tsx`         | ✅ KEEP                                  |
| `card.tsx`          | ✅ KEEP — augment with elevation system  |
| `dialog.tsx`        | ✅ KEEP                                  |
| `dropdown-menu.tsx` | ✅ KEEP                                  |
| `input.tsx`         | ✅ KEEP                                  |
| `label.tsx`         | ✅ KEEP                                  |
| `select.tsx`        | ✅ KEEP                                  |
| `separator.tsx`     | ✅ KEEP                                  |
| `skeleton.tsx`      | ✅ KEEP                                  |
| `tabs.tsx`          | ✅ KEEP                                  |
| `textarea.tsx`      | ✅ KEEP                                  |
| `tooltip.tsx`       | ✅ KEEP                                  |
| `progress.tsx`      | ✅ KEEP                                  |
| `switch.tsx`        | ✅ KEEP                                  |
| `avatar.tsx`        | ✅ KEEP                                  |
| `popover.tsx`       | ✅ KEEP                                  |
| `command.tsx`       | ✅ KEEP                                  |
| `scroll-area.tsx`   | ✅ KEEP                                  |
| `sheet.tsx`         | ✅ KEEP                                  |
| `table.tsx`         | ✅ KEEP                                  |

**Finding:** Radix/shadcn primitives are well-structured. The rebuild should NOT replace these — instead, extend with new variant tokens for the brand design system.

### 5.3 Chart Components

| Component        | Path                 | Status  |
| ---------------- | -------------------- | ------- |
| `AreaChart.tsx`  | `components/charts/` | ✅ KEEP |
| `BarChart.tsx`   | `components/charts/` | ✅ KEEP |
| `DonutChart.tsx` | `components/charts/` | ✅ KEEP |
| `LineChart.tsx`  | `components/charts/` | ✅ KEEP |
| `Sparkline.tsx`  | `components/charts/` | ✅ KEEP |

All chart components wrap recharts and are reusable. Keep and compose.

### 5.4 Feature Components

| Component            | Path                            | Status      | Notes                           |
| -------------------- | ------------------------------- | ----------- | ------------------------------- |
| `CommandPalette`     | `components/command-palette/`   | ✅ KEEP     | Global ⌘K — hook into new shell |
| `AgentAvatar`        | `components/agents/`            | ✅ KEEP     |                                 |
| `TaskCard`           | `components/tasks/`             | 🟡 REFACTOR | Needs new card design           |
| `WorkflowCard`       | `components/workflows/`         | 🟡 REFACTOR |                                 |
| `OnboardingWizard`   | `features/onboarding/`          | ✅ KEEP     |                                 |
| `AppInitializer`     | `components/AppInitializer.tsx` | ✅ KEEP     | Auth state hydration            |
| `NotificationCenter` | `components/notifications/`     | ✅ KEEP     |                                 |
| `VoiceInput`         | `features/voice/`               | ✅ KEEP     |                                 |

---

## 6. Business Logic Preservation Map

**These layers are FULLY PRESERVED. No modifications in refactoring phases.**

### 6.1 Zustand Stores

| Store                | File                           | Preserve |
| -------------------- | ------------------------------ | -------- |
| `authStore`          | `stores/authStore.ts`          | ✅       |
| `agentStore`         | `stores/agentStore.ts`         | ✅       |
| `taskStore`          | `stores/taskStore.ts`          | ✅       |
| `workflowStore`      | `stores/workflowStore.ts`      | ✅       |
| `chatStore`          | `stores/chatStore.ts`          | ✅       |
| `departmentStore`    | `stores/departmentStore.ts`    | ✅       |
| `commandStore`       | `stores/commandStore.ts`       | ✅       |
| `inspectorStore`     | `stores/inspectorStore.ts`     | ✅       |
| `onboardingStore`    | `stores/onboardingStore.ts`    | ✅       |
| `notificationStore`  | `stores/notificationStore.ts`  | ✅       |
| `uiPreferencesStore` | `stores/uiPreferencesStore.ts` | ✅       |
| `voiceProfileStore`  | `stores/voiceProfileStore.ts`  | ✅       |

### 6.2 Services

| Service                             | File        | Preserve |
| ----------------------------------- | ----------- | -------- |
| `auth.service.ts`                   | `services/` | ✅       |
| `chat.service.ts`                   | `services/` | ✅       |
| `analytics.service.ts`              | `services/` | ✅       |
| `finance.service.ts`                | `services/` | ✅       |
| `connectors.service.ts`             | `services/` | ✅       |
| `delegation.service.ts`             | `services/` | ✅       |
| `workspace-provisioning.service.ts` | `services/` | ✅       |
| `agent-streaming.service.ts`        | `services/` | ✅       |
| `onboarding.service.ts`             | `services/` | ✅       |

### 6.3 Core Infrastructure

| Layer              | Path                          | Preserve |
| ------------------ | ----------------------------- | -------- |
| `TokenManager`     | `core/infrastructure/auth/`   | ✅       |
| `EventBus`         | `core/infrastructure/socket/` | ✅       |
| `SocketManager`    | `core/infrastructure/socket/` | ✅       |
| `storeEventBridge` | `core/infrastructure/socket/` | ✅       |
| `RestClient`       | `core/services/api/clients/`  | ✅       |

### 6.4 Hooks

All custom hooks in `/hooks/` are preserved:

- `useActivityStream`, `useAgentTasks`, `useAuth`, `useChatStream`, `useDashboard`, `useDelegation`, `useKeyboardShortcuts`, `useNotifications`, `useRealtimeAgents`, `useSocketEvents`, `useVoiceInput`, `useWorkflows`

---

## 7. Legacy Deletion Map

**Exact files to be deleted after migration is complete. Not before.**

### 7.1 Shell & Layout (delete after AppShell v2 ships)

```
src/components/TenantShell.tsx          — superseded by AppShell
src/components/layout/TopBar.tsx        — functionality absorbed into AppShell header
src/components/layout/InspectorPanel.tsx — replaced by RightAIPanel in new shell
```

### 7.2 Chat (delete after AIResponseCard + new ConversationPanel ship)

```
src/components/chat/ConversationPanel.tsx  — orphaned, replaced by new AI panel pattern
```

### 7.3 Dashboard (delete after new dashboard page ships)

```
src/app/(app)/dashboard/page.tsx         — monolith, replaced by modular feature components
```

_Note: replacement is new `page.tsx` + extracted components in `features/dashboard/`_

### 7.4 Temporary / Utility Files (safe to delete any time)

These appear to be incomplete or debugging files based on naming:

```
src/app/(app)/dashboard/dashboard-v2/   — check if exists; if so, delete
```

---

## 8. Tech Debt Register

| ID    | Category      | Severity | Description                                                                        | Fix Strategy                                                             |
| ----- | ------------- | -------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| TD-01 | CSS           | Critical | Tailwind uses hardcoded hex not CSS vars — theme switch broken for utility classes | Bridge CSS vars into tailwind `theme.extend.colors` using `var(--token)` |
| TD-02 | CSS           | High     | No semantic text color tokens in Tailwind                                          | Add `text-primary`, `text-secondary` tokens                              |
| TD-03 | CSS           | High     | No brand/accent color token (`violet`)                                             | Add `brand` and `brand-subtle` tokens                                    |
| TD-04 | Architecture  | High     | `TenantShell` dead code creates confusion                                          | Delete after AppShell v2 ships                                           |
| TD-05 | Architecture  | High     | `dashboard/page.tsx` is 665-line monolith                                          | Extract to feature components + custom hooks                             |
| TD-06 | UI            | High     | AI response card pattern (reference screenshots) not implemented                   | Build `AIResponseCard.tsx`                                               |
| TD-07 | UI            | Medium   | No consistent card elevation system                                                | Define `shadow-surface`, `shadow-raised`, `shadow-float` tokens          |
| TD-08 | UI            | Medium   | Button variants use `indigo` not a brand token                                     | Remap to `brand` token                                                   |
| TD-09 | CSS           | Medium   | No radius tokens — `rounded-xl`, `rounded-lg` scattered inline                     | Add `radius` tokens to design system                                     |
| TD-10 | Architecture  | Medium   | `AIChatPanel` and `ConversationPanel` have no shared message primitives            | Extract `ChatMessage.tsx` shared primitive                               |
| TD-11 | Accessibility | Medium   | `theme-high-contrast` defined in CSS but no UI control to enable it                | Add theme switcher including high-contrast                               |
| TD-12 | Typography    | Low      | No semantic type aliases (body, caption, heading)                                  | Add semantic typography utilities                                        |
| TD-13 | DX            | Low      | No `cn()` usage standardized — mix of string concatenation and classnames          | Standardize on `cn()` from `lib/utils`                                   |

---

## 9. Reference Design Gap Analysis

Comparing current implementation against the Creatio-pattern reference screenshots:

| Feature                   | Reference Design                                   | Current State                                  | Gap                                |
| ------------------------- | -------------------------------------------------- | ---------------------------------------------- | ---------------------------------- |
| Home screen hero          | Full-canvas background image with greeting         | KPI dashboard tiles                            | Full rebuild needed                |
| AI response cards         | Violet left-border card, KPI tiles, action buttons | Basic message bubble                           | `AIResponseCard` component missing |
| Navigation                | Icon+label collapsible sidebar, top search bar     | Icon+label sidebar, no search                  | Add global search bar              |
| Agent record view         | Tabbed layout: Overview/History/Activity           | Single scrolling page                          | Tab layout needed                  |
| Right AI panel            | Persistent pinned panel with structured responses  | Slide-in only                                  | Persistent dock mode needed        |
| Autonomy level            | (N/A in Creatio reference)                         | Assist/Copilot/Autopilot in TopBar (dead code) | Integrate into AppShell header     |
| KPI mini-tiles            | 2-column row, colored value, label                 | Full-width tiles only                          | KPI pair component needed          |
| Background image/gradient | Hero image behind greeting                         | Solid surface color                            | Hero background support needed     |

---

## 10. Summary: What Gets Built vs Deleted vs Kept

### Build (New)

- `AppShell v2` — full redesign with hero header, persistent AI dock slot
- `AIResponseCard` — the flagship AI interaction component
- `HomeScreen` (dashboard) — greeting, hero bg, centered AI input, agent summary
- `AgentDetailPage` — tabbed record view (Overview / Tasks / History / Analytics)
- `KPIPairTile` — 2-column mini KPI component
- `RightAIPanel` — persistent dockable right panel
- Unified design token system (CSS vars bridged to Tailwind)

### Delete (After Migration)

- `TenantShell.tsx`
- `TopBar.tsx`
- `InspectorPanel.tsx`
- `ConversationPanel.tsx`
- Old `dashboard/page.tsx` monolith

### Keep (Untouched)

- All Zustand stores
- All services
- All core infrastructure
- All Radix/shadcn UI primitives
- All chart components
- All custom hooks
- All feature components not listed for deletion
