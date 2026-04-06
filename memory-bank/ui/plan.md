# NeureCore UI/UX Implementation Plan

**Branch:** `2.1-new-ui`  
**Based on audit:** `memory-bank/ui/audit.md`  
**Status:** ⏳ AWAITING APPROVAL — No code changes until this plan is signed off.

---

## 0. Guiding Principles

### SOLID Application to UI Architecture

| Principle                     | Applied As                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------- |
| **S** — Single Responsibility | Each component renders one thing. Pages compose features. Pages don't fetch data.                       |
| **O** — Open/Closed           | New AI response types extend `AIResponseCard` via `variant` prop, not by modifying the component.       |
| **L** — Liskov Substitution   | Any card that receives `{ title, value, trend }` satisfies `KPICardProps` — swap KPI components freely. |
| **I** — Interface Segregation | `AIResponseCardProps` does not require KPI tiles or action buttons — they're optional.                  |
| **D** — Dependency Inversion  | Pages depend on hook interfaces (`useDashboard`, `useAgents`) not on API call details.                  |

### Design Philosophy

- **AI-first, not tool-first** — every page has a natural path to invoke AI assistance
- **Information density over emptiness** — no empty states, no placeholder cards; show relevant data
- **Motion with intent** — animate only to communicate state change, not to decorate
- **Theme-safe from the ground up** — every color token routes through CSS variables, never hardcoded

---

## 1. Design System Specification

### 1.1 Color Token Architecture

**Strategy:** Tailwind tokens map to CSS `var()` references. Theme classes on `<html>` drive all color changes. No hardcoded hex anywhere except in the CSS variable definitions themselves.

#### Surface Palette

```js
// tailwind.config.js (target)
colors: {
  surface: {
    DEFAULT:  'var(--surface)',         // page background
    raised:   'var(--surface-raised)',  // card background
    overlay:  'var(--surface-overlay)', // modal / drawer
    border:   'var(--surface-border)',  // dividers, outlines
    muted:    'var(--surface-muted)',   // disabled, ghost
  }
}
```

```css
/* globals.css (target) — dark theme (default) */
:root,
.theme-dark {
  --surface: #09090b;
  --surface-raised: #111113;
  --surface-overlay: #18181b;
  --surface-border: #27272a;
  --surface-muted: #3f3f46;
}
/* light theme */
.theme-light {
  --surface: #f8f9fa;
  --surface-raised: #ffffff;
  --surface-overlay: #f0f1f3;
  --surface-border: #e2e4e9;
  --surface-muted: #9ba3af;
}
```

#### Brand Palette (violet/indigo accent — NeureCore identity)

```js
brand: {
  DEFAULT:  'var(--brand)',          // primary action, focus ring
  subtle:   'var(--brand-subtle)',   // hover bg, selected state
  dim:      'var(--brand-dim)',      // left-border accent, badges
  foreground: 'var(--brand-fg)',     // text on brand bg
}
```

```css
:root,
.theme-dark {
  --brand: #7c3aed; /* violet-700 */
  --brand-subtle: #4c1d95; /* violet-900 */
  --brand-dim: #5b21b6; /* violet-800 */
  --brand-fg: #f5f3ff; /* violet-50 */
}
.theme-light {
  --brand: #6d28d9; /* violet-700 */
  --brand-subtle: #ede9fe; /* violet-100 */
  --brand-dim: #8b5cf6; /* violet-500 */
  --brand-fg: #ffffff;
}
```

#### Text Palette

```js
text: {
  primary:   'var(--text-primary)',   // headings, body
  secondary: 'var(--text-secondary)', // labels, metadata
  muted:     'var(--text-muted)',     // placeholders, disabled
  inverse:   'var(--text-inverse)',   // text on dark/brand bg
}
```

```css
:root,
.theme-dark {
  --text-primary: #f4f4f5;
  --text-secondary: #a1a1aa;
  --text-muted: #52525b;
  --text-inverse: #09090b;
}
```

#### Status Palette (unchanged — already working)

```js
status: {
  profit:   'var(--status-profit)',
  risk:     'var(--status-risk)',
  ops:      'var(--status-ops)',
  strategy: 'var(--status-strategy)',
  warn:     'var(--status-warn)',
  neutral:  'var(--status-neutral)',
}
```

### 1.2 Typography Scale

**Font:** Inter (primary), JetBrains Mono (code/numbers)

```js
// tailwind.config.js additions
fontSize: {
  'display': ['2rem',   { lineHeight: '2.5rem', letterSpacing: '-0.02em', fontWeight: '700' }],
  'heading':  ['1.25rem', { lineHeight: '1.75rem', letterSpacing: '-0.01em', fontWeight: '600' }],
  'subheading': ['1rem', { lineHeight: '1.5rem', fontWeight: '500' }],
  'body':     ['0.875rem', { lineHeight: '1.5rem' }],   // 14px
  'caption':  ['0.75rem',  { lineHeight: '1.25rem' }],  // 12px
  'micro':    ['0.6875rem', { lineHeight: '1rem' }],    // 11px
}
```

### 1.3 Spacing & Radius

```js
// Consistent spatial rhythm
spacing: {
  'page':   '1.5rem',    // page horizontal padding
  'panel':  '1rem',      // panel internal padding
  'card':   '1.25rem',   // card internal padding
  'tight':  '0.75rem',   // compact padding
}

borderRadius: {
  'card':   '0.75rem',   // 12px — cards, panels
  'input':  '0.5rem',    // 8px  — inputs, badges
  'pill':   '99px',      // pills, chips
  'dot':    '50%',       // avatars, status dots
}
```

### 1.4 Elevation / Shadow

```js
boxShadow: {
  'surface': '0 0 0 1px var(--surface-border)',                           // card outline
  'raised':  '0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px var(--surface-border)',
  'float':   '0 8px 24px rgba(0,0,0,0.6), 0 0 0 1px var(--surface-border)',
  'brand':   '0 0 0 2px var(--brand-subtle)',                            // focus ring
}
```

### 1.5 Motion Tokens

```js
transitionDuration: {
  'instant': '80ms',
  'fast':    '150ms',
  'normal':  '250ms',
  'slow':    '400ms',
}
transitionTimingFunction: {
  'spring': 'cubic-bezier(0.175, 0.885, 0.32, 1.1)',
  'ease-out-expo': 'cubic-bezier(0.19, 1, 0.22, 1)',
}
```

---

## 2. New Component Architecture

### 2.1 Shell: AppShell v2

**File:** `src/components/shell/AppShell.tsx` (full replacement)

**Layout Structure:**

```
┌─ <html> (theme class) ─────────────────────────────────────────┐
│  ┌─ Sidebar (64px collapsed / 220px expanded) ───────────────┐ │
│  │  Logo / brand mark                                         │ │
│  │  [NavGroup] × 5                                            │ │
│  │    [NavItem] (icon + label)                                │ │
│  │  ─── bottom ───────────────────────────                    │ │
│  │  User avatar + name + sign out                             │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌─ Main column ─────────────────────────────────────────────┐ │
│  │  ┌─ TopStrip (48px) ─────────────────────────────────────┐│ │
│  │  │  PageTitle | GlobalSearch | AutonomyPill | Bell | User ││ │
│  │  └───────────────────────────────────────────────────────┘│ │
│  │  ┌─ Content area (flex-1, scrollable) ───────────────────┐│ │
│  │  │  {children}                                            ││ │
│  │  └───────────────────────────────────────────────────────┘│ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌─ RightAIPanel (0px hidden / 320px docked) ────────────────┐ │
│  │  Agent name + avatar                                       │ │
│  │  [AIResponseCard] list                                     │ │
│  │  ─── bottom ────────────────                               │ │
│  │  [ChatInput]                                               │ │
│  └────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

**Props interface:**

```ts
interface AppShellProps {
  children: React.ReactNode;
}
```

**State owned by shell (via Zustand):**

- `uiPreferencesStore.sidebarCollapsed` — sidebar expanded/collapsed
- `uiPreferencesStore.aiPanelOpen` — right AI panel visible
- `uiPreferencesStore.aiPanelDocked` — docked (persistent) vs slide-in mode
- `uiPreferencesStore.theme` — active theme class

**Key behaviors:**

- Sidebar persists collapse state across page navigation (Zustand persist)
- Keyboard shortcut `⌘/` toggles AI panel
- Keyboard shortcut `⌘K` opens CommandPalette
- `AutonomyPill` in top strip: Assist / Copilot / Autopilot (moved from legacy TopBar)
- ThemeToggle: cycles dark → light → high-contrast

---

### 2.2 `AIResponseCard` — The Flagship Component

**File:** `src/components/ai/AIResponseCard.tsx`

**Purpose:** Renders a structured AI agent response in the reference screenshot pattern — agent label, response body with violet left accent, optional KPI tiles, optional action buttons.

**Visual anatomy:**

```
 ┌─────────────────────────────────────────────────────────┐
 │  ✦ Territory Management Agent          [10:42 AM]       │  ← agent header (muted)
 ├─────────────────────────────────────────────────────────┤
 │▌                                                        │  ← violet left border (4px)
 │  Based on Q1 data, here are the key findings:           │  ← response body
 │  • **Revenue** increased 18% vs prior quarter           │
 │  • **Win rate** improved to 34% in EMEA                 │
 │  • **Pipeline** at risk: 3 deals stalled > 14 days      │
 │                                                         │
 │  ┌───────────────┐  ┌───────────────┐                   │  ← KPI pair (optional)
 │  │  $2.4M        │  │  34%          │                   │
 │  │  Q1 Revenue   │  │  Win Rate     │                   │
 │  └───────────────┘  └───────────────┘                   │
 │                                                         │
 │  [View Pipeline]  [Generate Report]                     │  ← action buttons (optional)
 └─────────────────────────────────────────────────────────┘
```

**Props:**

```ts
interface AIResponseCardProps {
  agentName: string;
  agentRole?: string;
  content: string; // markdown string
  timestamp?: Date;
  kpis?: Array<{
    value: string | number;
    label: string;
    trend?: "up" | "down" | "neutral";
    color?: "profit" | "risk" | "ops" | "strategy";
  }>;
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: "outline" | "ghost";
  }>;
  isStreaming?: boolean;
}
```

**Implementation notes:**

- Content is rendered via `react-markdown` (already in deps)
- Streaming state shows animated cursor at end of content
- KPIs render as a 2-column grid of `KPIMiniTile` components
- Action buttons use the `Button` shadcn primitive with `outline` variant
- Background: `bg-surface-raised`, left border: `border-l-4 border-brand-dim`
- No framer-motion on the card itself — only fade-in on mount for the container

---

### 2.3 `KPIMiniTile` — KPI Pair Sub-Component

**File:** `src/components/ai/KPIMiniTile.tsx`

**Purpose:** The 2-column KPI display used inside `AIResponseCard` and on the new dashboard.

```ts
interface KPIMiniTileProps {
  value: string | number;
  label: string;
  trend?: "up" | "down" | "neutral";
  color?: "profit" | "risk" | "ops" | "strategy" | "neutral";
  hint?: string; // tooltip text
}
```

---

### 2.4 `RightAIPanel` — Persistent AI Dock

**File:** `src/components/shell/RightAIPanel.tsx`

**Purpose:** Hosts the full AI conversation for the current page context. Can be toggled between:

- **Hidden:** 0px width, invisible
- **Slide-in overlay:** animates from right edge (current `AIChatPanel` behavior)
- **Docked:** persistent 320px column in layout grid (new)

**State:** `uiPreferencesStore.aiPanelOpen` + `aiPanelDocked`

**Contents:**

- Header: agent/assistant name, collapse button, dock toggle button
- Scroll area: list of `AIResponseCard` components
- Footer: `ChatInput` component (single-line with send button)

**Migration from:** `AIChatPanel.tsx` — same functionality, new visual skin + dock mode

---

### 2.5 `GlobalSearchBar` — Top Strip Search

**File:** `src/components/shell/GlobalSearchBar.tsx`

**Purpose:** Inline search in the top strip that queries agents, tasks, workflows, and pages. Overlays a results dropdown. Shortcut: `⌘F`.

**Backend:** Queries existing search endpoints (or delegates to CommandPalette).

---

### 2.6 `AutonomyPill` — Autonomy Level Selector

**File:** `src/components/shell/AutonomyPill.tsx`

**Migrated from:** `TopBar.tsx` (currently dead code)

**Variants:** Assist | Copilot | Autopilot  
**State:** `uiPreferencesStore.autonomyLevel`

---

### 2.7 Page-Level Layout Primitives

These are used to compose pages consistently:

```
src/components/layout/
  PageHeader.tsx        — title, subtitle, breadcrumb, action slot
  PageContent.tsx       — max-width wrapper, horizontal padding
  SectionCard.tsx       — titled card section (title + optional action + body)
  TabNav.tsx            — horizontal tab bar (wraps Radix Tabs)
  TwoColumnLayout.tsx   — left (data/list) + right (AI/details) split
```

---

## 3. Page Rebuild Schedule

### Phase A — Foundation (CSS + Shell) ← **FIRST**

**Goal:** Make the design system work before anything visual is rebuilt.

| Item | Work                                           | Files Changed                       |
| ---- | ---------------------------------------------- | ----------------------------------- |
| A1   | Bridge CSS vars into Tailwind (`var(--token)`) | `tailwind.config.js`                |
| A2   | Add brand, text, shadow tokens to Tailwind     | `tailwind.config.js`                |
| A3   | Add semantic typography utilities              | `tailwind.config.js`, `globals.css` |
| A4   | AppShell v2 — new layout grid + top strip      | `AppShell.tsx`                      |
| A5   | `RightAIPanel` — dockable AI panel             | NEW `RightAIPanel.tsx`              |
| A6   | `AutonomyPill`                                 | NEW component, remove from TopBar   |
| A7   | `GlobalSearchBar`                              | NEW component                       |

---

### Phase B — AI Components ← **SECOND**

**Goal:** Build the AIResponseCard ecosystem — the visual signature of the product.

| Item | Work                                                           | Files Changed      |
| ---- | -------------------------------------------------------------- | ------------------ |
| B1   | `AIResponseCard` component                                     | NEW                |
| B2   | `KPIMiniTile` component                                        | NEW                |
| B3   | Integrate `AIResponseCard` into `RightAIPanel`                 | `RightAIPanel.tsx` |
| B4   | Update `AIChatPanel` and `AIChatMessage` to use new primitives | Refactor           |

---

### Phase C — Dashboard (AI Office Home) ← **THIRD**

**Goal:** Replace the 665-line monolith with a composable, visually impressive home screen.

**Target design:**

```
┌──────────────────────────────────────────────────────────────────┐
│  Hero background (gradient mesh or subtle abstract image)        │
│                                                                  │
│       Good morning, [FirstName] 🌤                              │
│       [Your 3 AI agents are active. 7 tasks in progress.]       │
│                                                                  │
│   ┌────────────────────────────────────────────────────────┐    │
│   │  Ask your agents anything...                    [Send] │    │
│   └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  │ 47         │ │ 12         │ │ $18,400    │ │ 94%        │   │
│  │ Tasks      │ │ In Review  │ │ MRR        │ │ Agent Uptime│  │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘   │
│                                                                  │
│  ┌──────────── Recent Activity ───────────────────────────────┐ │
│  │  [ActivityFeed] — filtered to today                        │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌──── Active Agents ─────────┐  ┌── Upcoming Tasks ──────────┐ │
│  │  [AgentCard] × 3           │  │  [TaskCard] × 5            │ │
│  └────────────────────────────┘  └────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

**Extracted components:**

```
src/features/dashboard/
  components/
    DashboardHero.tsx       — greeting + central AI input
    DashboardKPIRow.tsx     — 4-tile KPI strip
    ActiveAgentsGrid.tsx    — 2-3 col agent cards
    UpcomingTasksList.tsx   — compact task list
    RecentActivityFeed.tsx  — today's activity
  hooks/
    useDashboardData.ts     — all data fetching, memoized
  page.tsx                  — composes above, ~80 lines
```

---

### Phase D — Agent Pages

**Agent List (`/agents`):**

- Switch from basic table to card grid (3 cols desk, 1 col mobile)
- Each `AgentCard`: avatar, name, role, status badge, last active, button to view/chat

**Agent Detail (`/agents/[id]`):**

- Tab layout: Overview | Tasks | Conversations | Settings
- Overview: agent info card + live status + KPI row
- Tasks: `TaskCard` list for this agent's tasks
- Conversations: `AIResponseCard` history
- Settings: edit agent name/role/config

---

### Phase E — Record/Table Pages (Tasks, Workflows, Goals, Projects)

**Pattern:**

- `PageHeader` with title + "New [Entity]" button
- Filter bar (status, priority, assignee, date)
- Table or card list (responsive: table on desktop, card on mobile)
- On row click: right AI panel context-loads related agent for that task

**Task Detail (`/tasks/[id]`):**

- New dedicated detail view (currently missing)
- Similar to Agent Detail tab layout

---

### Phase F — Analytics & Intelligence Pages

**Analytics (`/analytics`):**

- KPI strip (4 tiles)
- `AreaChart` — revenue/volume over time
- `BarChart` — agent performance comparison
- `DonutChart` — task distribution
- All charts already exist — just composing with new layout primitives

**Costs (`/costs`):**

- Fix API path (needs `3-new-ui` fix: `/finance/invoices`)
- Budget vs actual chart
- Cost breakdown by department table

**Strategy (`/strategy`):**

- Kanban-style strategy board (new pattern)
- Or structured list — TBD based on data model

---

### Phase G — Settings & Platform Pages

**Settings (`/settings`):**

- Tabbed single-page: Profile | Workspace | Preferences | Notifications | Security
- Preferences tab includes: theme toggle (dark/light/high-contrast), font size, autonomy default

**Billing, Connectors:** Polish pass — new layout primitives only.

---

## 4. CSS Migration Strategy (TD-01 Fix)

### Before (broken)

```js
// tailwind.config.js
surface: { DEFAULT: '#09090b', raised: '#111113' }
// bg-surface resolves to #09090b always — ignores theme
```

### After (correct)

```js
// tailwind.config.js
surface: { DEFAULT: 'var(--surface)', raised: 'var(--surface-raised)' }
// bg-surface now reads the CSS variable at runtime — responds to theme changes
```

**Migration steps:**

1. Update `tailwind.config.js` — change all hex values to `var(--token)`
2. Add `brand`, `text`, `shadow` token groups
3. Add semantic `fontSize` aliases
4. Audit existing pages: replace inline `bg-[var(--surface)]` with `bg-surface` (cleanup)
5. Replace `bg-indigo-600` (CTA buttons) with `bg-brand`
6. Replace `text-zinc-200` etc. with `text-text-primary` / `text-text-secondary`

**Risk:** Tailwind CSS-var approach requires postcss to NOT resolve the var at build time. This is the default Tailwind behavior — no plugin changes needed.

---

## 5. Legacy Cleanup Schedule

**Rule:** Delete only after the replacement goes live and is tested.

```
Phase A complete → Delete: TopBar.tsx, InspectorPanel.tsx
Phase B complete → Delete: ConversationPanel.tsx, old AIChatPanel (replaced)
Phase C complete → Delete: dashboard/page.tsx monolith
Phase D complete → Delete: old agents/page.tsx, agents/[id]/page.tsx
Phase G complete → Delete: TenantShell.tsx (final dead code removal)
```

---

## 6. File Structure (Target State)

```
src/
  app/
    (app)/
      layout.tsx                      — AppShell v2 (unchanged entry point)
      dashboard/page.tsx              — ~80 lines, composes feature components
      agents/page.tsx                 — AgentCard grid
      agents/[id]/page.tsx            — tabbed detail view
      tasks/page.tsx                  — sorted table
      tasks/[id]/page.tsx             — NEW task detail page
      ... (other pages — layout pass)
  components/
    shell/
      AppShell.tsx                    — v2: full layout grid
      RightAIPanel.tsx                — NEW: dockable AI panel
      GlobalSearchBar.tsx             — NEW
      AutonomyPill.tsx                — NEW (migrated from TopBar)
    ai/
      AIResponseCard.tsx              — NEW: flagship component
      KPIMiniTile.tsx                 — NEW: sub-component
      ChatInput.tsx                   — NEW: shared input (used in panel + dashboard)
    layout/
      PageHeader.tsx                  — NEW: consistent page headers
      PageContent.tsx                 — NEW: width/padding wrapper
      SectionCard.tsx                 — NEW: titled section card
      TabNav.tsx                      — NEW: tab bar wrapper
      TwoColumnLayout.tsx             — NEW: split layout
    ui/                               — Radix/shadcn (UNCHANGED)
    artifacts/                        — UNCHANGED
    charts/                           — UNCHANGED
  features/
    dashboard/
      components/
        DashboardHero.tsx
        DashboardKPIRow.tsx
        ActiveAgentsGrid.tsx
        UpcomingTasksList.tsx
        RecentActivityFeed.tsx
      hooks/
        useDashboardData.ts
    ai-chat/
      components/
        AIChatPanel.tsx               — refactored to use AIResponseCard
        AIChatMessage.tsx             — updated styles
  stores/                             — ALL UNCHANGED
  services/                           — ALL UNCHANGED
  core/                               — ALL UNCHANGED
  hooks/                              — ALL UNCHANGED
```

---

## 7. Accessibility Requirements

Every rebuilt component must satisfy:

| Requirement           | Implementation                                                                 |
| --------------------- | ------------------------------------------------------------------------------ |
| WCAG 2.1 AA contrast  | Use `text-text-primary` on `bg-surface` (>7:1 in dark theme)                   |
| Keyboard navigation   | All interactive elements focusable, `focus:ring-2 focus:ring-brand`            |
| Screen reader support | `aria-label` on icon-only buttons, live regions for streaming content          |
| Reduced motion        | `@media (prefers-reduced-motion: reduce)` disables framer-motion               |
| High contrast theme   | Activate via settings preferences → applies `.theme-high-contrast` to `<html>` |

---

## 8. Branching & Delivery Strategy

All work happens on `2.1-new-ui`. No merges to `main` until plan is fully executed and tested.

**Commit pattern:**

```
feat(design-system): bridge CSS vars to Tailwind tokens [Phase A]
feat(shell): AppShell v2 with top strip and AI panel slot [Phase A]
feat(ai): AIResponseCard and KPIMiniTile components [Phase B]
feat(dashboard): modular dashboard with hero and KPI strip [Phase C]
feat(agents): agent card grid and tabbed detail view [Phase D]
refactor(cleanup): delete legacy TenantShell and TopBar [Phase G]
```

---

## 9. Open Questions (Require Decision Before Starting)

1. **Hero background:** Dashboard hero — use a CSS mesh gradient or allow tenant-uploaded background image? → Recommend mesh gradient initially (simpler), image support as enhancement.

2. **RightAIPanel default state:** Should the AI panel be open by default on the dashboard, or closed until user triggers it? → Recommend: closed by default, AI input in dashboard hero triggers it.

3. **Agent Detail page route:** `/agents/[id]` exists but has no tab layout. New route same path or new path? → Same path, backward compatible.

4. **`/tasks/[id]` route:** No detail page exists currently. Create new? → Yes, required for Phase E.

5. **Brand accent — violet vs indigo:** Currently `AIChatMessage` uses `bg-indigo-600` for user bubbles; reference screenshots show violet. Confirm: violet (`#7c3aed`) as primary brand color? → Pending confirmation.

---

## 10. Non-Negotiables

- **Never break auth flow** — `AppShell` must still guard behind `isAuthenticated`
- **Never remove Zustand stores** — even if pages are rebuilt, stores are unchanged
- **Never hardcode tenant-specific data** in components — all data via hooks/services
- **Never skip `cn()` imports** — all conditional class merging uses `cn()` from `lib/utils`
- **Never use `!important`** — if a style override needs `!important`, the token system is wrong; fix the token

---

## 11. Already-Implemented Features & Tools — Integration Map

This section catalogues every implemented asset that can be **directly incorporated** into the new interface. Nothing here needs to be rebuilt — only reskinned, recomposed, or re-routed within the new design system.

Legend:

- 🟢 **Drop-in** — plug into new layout with zero or trivial changes
- 🟡 **Restyle** — functional logic preserved; replace inline hex with design tokens + new layout wrapper
- 🔵 **Compose** — already good, elevate by composing with a new parent component

---

### 11.1 UI Display Components

| Component                     | Path                                                   | Status     | New Interface Role                                                                                                                                                                                                                                      |
| ----------------------------- | ------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `KpiTile`                     | `components/kpi/KpiTile.tsx`                           | 🟡 Restyle | **Dashboard KPI strip** — already has delta, trend arrows, loading skeleton, and all 6 status colors. Migrate `bg-[var(--surface-overlay)]` inline usage to `bg-surface-overlay` token; keep all logic. Used in `KpiSection` and new `DashboardKPIRow`. |
| `AgentCard`                   | `components/agent-card/AgentCard.tsx`                  | 🟡 Restyle | **Agent list page card grid** — has compact/full variants, status colors, workload progress bar, pause/resume/inspect actions. Wire `selected` highlight from `border-violet-500/50` → `border-brand` token.                                            |
| `AgentGrid`                   | `features/agents/components/AgentGrid.tsx`             | 🟢 Drop-in | **Agent list page** — responsive 1–4 col grid already built with AnimatePresence, loading skeleton, empty state. Slot directly into new `AgentPage` under `PageContent`.                                                                                |
| `AgentFilter`                 | `features/agents/components/AgentFilter.tsx`           | 🟡 Restyle | **Agent list page filter bar** — search + status + department dropdowns with accessible ARIA labels. Swap static zinc classes for design token equivalents.                                                                                             |
| `DataTable`                   | `components/data-table/DataTable.tsx`                  | 🟡 Restyle | **Tasks, Workflows, Goals, Approvals tables** — fully generic (`ColumnDef<T>`), animated rows, pagination built-in, skeleton loading, empty renderer. Already token-adjacent (`border-surface-border`). Minor restyle of header row.                    |
| `WorkspaceProvisioningBanner` | `components/dashboard/WorkspaceProvisioningBanner.tsx` | 🟢 Drop-in | **Dashboard hero section** — dismissable, session-persistent banner for pending Google/M365 workspace setup. Slot above KPI strip.                                                                                                                      |
| `ErrorBoundary`               | `components/ErrorBoundary.tsx`                         | 🟢 Drop-in | **Wrap every page** — already implemented with `getUserFriendlyMessage()`. Add to `AppLayout` and feature root wrappers.                                                                                                                                |

---

### 11.2 Dashboard Feature Components (already feature-extracted — not in monolith)

| Component          | Path                                                 | Status     | New Interface Role                                                                                                                                                                                                                                                 |
| ------------------ | ---------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `KpiSection`       | `features/dashboard/components/KpiSection.tsx`       | 🟢 Drop-in | **Dashboard KPI row** — composes `KpiTile` × 4 with time-range filtered data. Hook directly into new `DashboardKPIRow` slot.                                                                                                                                       |
| `ActivityTimeline` | `features/dashboard/components/ActivityTimeline.tsx` | 🟡 Restyle | **Dashboard activity feed + Activity page** — timestamped activity stream with actor/action/target. Restyle wrapper card with new `SectionCard`.                                                                                                                   |
| `ChartSection`     | `features/dashboard/components/ChartSection.tsx`     | 🟡 Restyle | **Dashboard analytics strip** — native SVG `SparkArea` (task completion trend, no recharts) + animated `AgentBars` (success rates). Already theme-compatible; replace `bg-surface-raised` / `border-surface-border` inline with tokens.                            |
| `DailyBriefing`    | `features/dashboard/components/DailyBriefing.tsx`    | 🔵 Compose | **Dashboard hero / RightAIPanel** — AI-generated briefing with narration toggle. Surface inside the new `RightAIPanel` as the default "opening" AI response, or as a card in the dashboard hero below the greeting. Backed by `DailyBriefingService` with caching. |

---

### 11.3 AI Chat & Interaction Components

| Component           | Path                                            | Status     | New Interface Role                                                                                                                                                                                                                                 |
| ------------------- | ----------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AIChatPanel`       | `features/ai-chat/components/AIChatPanel.tsx`   | 🔵 Compose | **RightAIPanel backing layer** — slide-in behavior, starter prompts, send form. Logic extracted into `useAIChat` hook (preservable); visual skin replaced by new `RightAIPanel` wrapper. Keep `AIChatPanel` as the internal content pane.          |
| `AIChatMessage`     | `features/ai-chat/components/AIChatMessage.tsx` | 🔵 Compose | **Inside AIResponseCard** — mini inline bar chart (`MiniChart`) and suggestion pills (`Suggestions`) can be extracted as sub-primitives composable in the new `AIResponseCard`. User bubble styling migrates to new design (indigo → brand token). |
| `ArtifactViewer`    | `components/artifacts/ArtifactViewer.tsx`       | 🟢 Drop-in | **Task detail / AI response attachments** — detects and renders markdown/CSV/JSON/PDF/image by MIME type. Slot into `AgentDetailPage` conversation tab and task detail views.                                                                      |
| `ConversationPanel` | `components/chat/ConversationPanel.tsx`         | 🔵 Compose | **Orphaned but rich** — has markdown rendering, inline metrics, streaming, action buttons. Mine its `MetricCard`, `ActionBar`, and streaming logic for the new `AIResponseCard`. Then delete shell.                                                |

---

### 11.4 Org Chart Feature

| Component                                | Path                                                | Status     | New Interface Role                                                                                                                                                                                                                |
| ---------------------------------------- | --------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OrgChartSidebar`                        | `features/org-chart/components/OrgChartSidebar.tsx` | 🔵 Compose | **Org Chart page** — animated spring sidebar (260px), drag-and-drop agent reassignment with confirm dialog, search. Slots into `TwoColumnLayout` as the left panel. Replace `motion.aside` width animation with new layout token. |
| `OrgChartNode` (`AgentNode`, `DeptNode`) | `features/org-chart/components/OrgChartNode.tsx`    | 🟡 Restyle | **Org chart node cards** — themed with status/mood colors, drag handle. Restyle border/bg to design tokens.                                                                                                                       |
| `useOrgChart`                            | `features/org-chart/hooks/useOrgChart.ts`           | 🟢 Drop-in | **Org Chart page hook** — builds `OrgNode` tree from stores, search filter, drag state, expand/collapse, `moveAgent()`. Zero changes required.                                                                                    |

---

### 11.5 Strategy & Scenario Feature

| Component           | Path                                                 | Status     | New Interface Role                                                                                                                                                 |
| ------------------- | ---------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ScenarioSimulator` | `features/strategy/components/ScenarioSimulator.tsx` | 🟡 Restyle | **Strategy page** — what-if simulation input form + results display. Wrap in new `SectionCard`, restyle form inputs to design tokens. Backed by `ScenarioService`. |

---

### 11.6 Settings Features

| Component              | Path                                                    | Status     | New Interface Role                                                                                                             |
| ---------------------- | ------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `VoiceProfileSettings` | `features/settings/components/VoiceProfileSettings.tsx` | 🟢 Drop-in | **Settings → Voice tab** — voice profile CRUD, waveform preview, language/speed selectors. Slot into new tabbed Settings page. |

---

### 11.7 Onboarding Wizard

| Component           | Path                     | Status     | New Interface Role                                                                                                                                                                                                                                                                           |
| ------------------- | ------------------------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full 11-step wizard | `components/onboarding/` | 🟢 Drop-in | All steps (`WelcomeStep`, `OrganizationStep`, `AdminStep`, `PlanStep`, `AgentsStep`, `DepartmentsStep`, `TeamStep`, `WorkflowsStep`, `IntegrationsStep`, `SecurityStep`, `ReviewStep`) + `ProgressBar` are complete. Only the container card background needs restyle to new surface tokens. |

---

### 11.8 Charts Library

| Component       | Path                                  | Status     | New Interface Role                     |
| --------------- | ------------------------------------- | ---------- | -------------------------------------- |
| `AreaChart`     | `components/charts/AreaChart.tsx`     | 🟢 Drop-in | **Analytics page**, dashboard charts   |
| `BarChart`      | `components/charts/BarChart.tsx`      | 🟢 Drop-in | **Analytics**, agent performance       |
| `DonutChart`    | `components/charts/DonutChart.tsx`    | 🟢 Drop-in | **Costs page**, task distribution      |
| `LineChart`     | `components/charts/LineChart.tsx`     | 🟢 Drop-in | **Goals**, trend views                 |
| `Sparkline`     | `components/charts/Sparkline.tsx`     | 🟢 Drop-in | **KPI tiles**, inline trend indicators |
| `ChartSkeleton` | `components/charts/ChartSkeleton.tsx` | 🟢 Drop-in | All chart loading states               |

---

### 11.9 Shell Infrastructure (Reuse, Don't Rebuild)

| Item                     | Path                                            | Status     | New Interface Role                                                                                                                                                                             |
| ------------------------ | ----------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ThemeProvider`          | `shared/components/ThemeProvider.tsx`           | 🟢 Drop-in | **Applied to `<body>` in root layout** — already handles dark/light/high-contrast, font (default/dyslexia/mono), text size (sm/md/lg/xl), colorblind mode, reduce-motion. Zero changes needed. |
| `AppInitializer`         | `shared/components/AppInitializer.tsx`          | 🟢 Drop-in | Auth state hydration guard — keep in root layout.                                                                                                                                              |
| `ServiceWorkerRegistrar` | `shared/components/ServiceWorkerRegistrar.tsx`  | 🟢 Drop-in | PWA SW registration + "update available" toast. Keep in root layout.                                                                                                                           |
| `CommandPalette`         | `components/command-palette/CommandPalette.tsx` | 🟢 Drop-in | **⌘K global palette** — already ⌘K wired, observer pattern registry. Mount in `AppShell v2` (was in `TenantShell`).                                                                            |
| `commandRegistry`        | `services/command-registry.ts`                  | 🟢 Drop-in | Singleton Observer bus. All modules call `commandRegistry.register()`.                                                                                                                         |
| `registerTenantCommands` | `services/register-commands.ts`                 | 🟡 Restyle | **Navigation commands** — all nav shortcuts (G D/A/T/W etc.) already registered. Add new routes (tasks/[id], Phase A new pages) here.                                                          |

---

### 11.10 Feature Flag System

| Item                            | Path                      | Status     | New Interface Role                                                                                                                                                                                                                                                                         |
| ------------------------------- | ------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `FEATURE_FLAGS` / `isEnabled()` | `config/feature-flags.ts` | 🟢 Drop-in | **Guards experimental new UI features** during the phased rollout. Enable `WHAT_IF_SIMULATOR`, `VOICE_COMMANDS`, `CUSTOM_DASHBOARD` progressively as phases ship. Already has `HIGH_CONTRAST_MODE`, `KEYBOARD_SHORTCUTS`, `SCREEN_READER_SUPPORT` flags that map to new a11y requirements. |

---

### 11.11 Theme & UI Preferences System

| Item                 | Path                                  | Status     | New Interface Role                                                                                                                                                          |
| -------------------- | ------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `theme.config.ts`    | `config/theme.config.ts`              | 🟢 Drop-in | `ThemeName`, `FontPreference`, `TextSize`, `ColorScheme`, `UIPreferences` types. `THEMES` array drives the settings UI toggle. `DEFAULT_UI_PREFERENCES` sets initial state. |
| `useTheme`           | `hooks/useTheme.ts`                   | 🟢 Drop-in | **Settings page theme toggle** + top strip theme switcher.                                                                                                                  |
| `uiPreferencesStore` | `shared/stores/uiPreferencesStore.ts` | 🟢 Drop-in | Persisted sidebar collapse, AI panel open/docked, theme, font, text size, colorblind, reduce-motion. Already the correct store for `AppShell v2` state.                     |

---

### 11.12 Hooks — Ready to Wire

| Hook                  | Path                                              | Status     | New Interface Role                                                                                                                                                    |
| --------------------- | ------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useAIChat`           | `shared/hooks/useAIChat.ts`                       | 🟢 Drop-in | **RightAIPanel, Dashboard hero input** — full ConversationalAIService bridge: `send()`, `applySuggestion()`, `clear()`, `isTyping`, `error`, `bottomRef` auto-scroll. |
| `useDailyBriefing`    | `shared/hooks/useDailyBriefing.ts`                | 🟢 Drop-in | **Dashboard hero / RightAIPanel default content** — `open()`, `refresh()`, `toggleNarration()`, `isNarrating`.                                                        |
| `useDashboardData`    | `shared/hooks/useDashboardData.ts`                | 🟢 Drop-in | **Dashboard page** — comprehensive KPI + activity + agent data fetching.                                                                                              |
| `useDashboardFilters` | `features/dashboard/hooks/useDashboardFilters.ts` | 🟢 Drop-in | **Dashboard + Analytics filter bar** — `timeRange` + `departmentId`, typed setters, `resetFilters()`.                                                                 |
| `useAgentData`        | `shared/hooks/useAgentData.ts`                    | 🟢 Drop-in | **Agent list page** — pagination, filter state, `refresh()`.                                                                                                          |
| `useOrgChart`         | `features/org-chart/hooks/useOrgChart.ts`         | 🟢 Drop-in | **Org Chart page** — see §11.4.                                                                                                                                       |
| `useActivityStream`   | `hooks/useActivityStream.ts`                      | 🟢 Drop-in | **Dashboard activity feed, Activity page** — real-time socket events.                                                                                                 |
| `useAgentMetrics`     | `hooks/useAgentMetrics.ts`                        | 🟢 Drop-in | **Agent detail page** — performance metrics per agent.                                                                                                                |
| `useChartData`        | `hooks/useChartData.ts`                           | 🟢 Drop-in | **Analytics page** — chart data with time range.                                                                                                                      |
| `useDashboardKpis`    | `hooks/useDashboardKpis.ts`                       | 🟢 Drop-in | **Dashboard KPI row** — KPI values for 4 tiles.                                                                                                                       |
| `useDelegation`       | `hooks/useDelegation.ts`                          | 🟢 Drop-in | **Task delegation flow** — department/agent selection, cost estimation.                                                                                               |
| `useTimeRange`        | `hooks/useTimeRange.ts`                           | 🟢 Drop-in | **Analytics, Costs pages** — shared time range picker state.                                                                                                          |
| `useHealthMonitor`    | `shared/hooks/useHealthMonitor.ts`                | 🟢 Drop-in | **Settings → System Status tab** — polls health/readiness/liveness/metrics endpoints in parallel.                                                                     |

---

### 11.13 Services — Fully Wired, Zero Rebuild Needed

| Service                     | Path                                                  | New Interface Role                                                                        |
| --------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `ConversationalAIService`   | `core/services/ConversationalAIService.ts`            | AI chat in RightAIPanel — history, context, chart JSON parsing, optimistic message append |
| `DailyBriefingService`      | `core/services/DailyBriefingService.ts`               | Daily briefing card + TTS narration in dashboard hero                                     |
| `DashboardService`          | `core/services/DashboardService.ts`                   | Dashboard data aggregation                                                                |
| `NotificationService`       | `core/services/notification/NotificationService.ts`   | Toast + in-app notifications, priority queue, deduplication                               |
| `ReportBuilder` + exporters | `core/services/reporting/`                            | **Costs / Analytics pages** — `CsvExporter`, `JsonExporter` for report download buttons   |
| `ScenarioService`           | `core/services/ScenarioService.ts`                    | Strategy page what-if simulation                                                          |
| `VoiceCommandService`       | `core/services/voice/VoiceCommandService.ts`          | Voice input in dashboard hero AI bar (when `VOICE_COMMANDS` flag enabled)                 |
| `VoiceProfileService`       | `core/services/voice/VoiceProfileService.ts`          | Settings → Voice tab                                                                      |
| `VoiceAnalyticsLogger`      | `core/services/voice/VoiceAnalyticsLogger.ts`         | Voice command analytics in settings                                                       |
| `AgentService`              | `core/services/AgentService.ts`                       | Agent list, detail, pause/resume/inspect actions                                          |
| `AnalyticsService`          | `core/services/AnalyticsService.ts`                   | Analytics page chart data                                                                 |
| `AccessibilityService`      | `core/services/accessibility/AccessibilityService.ts` | Screen reader announcements for live regions in AI panel                                  |
| `CacheManager`              | `core/infrastructure/cache/CacheManager.ts`           | All repository-level caching (TTL + GC already running)                                   |

---

### 11.14 Utilities & Libraries

| Utility            | Path                                | New Interface Role                                                                                                                                                                                                                                  |
| ------------------ | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `agent-colors.ts`  | `lib/agent-colors.ts`               | `getAvatarColors(dept, index)` — consistent colored avatars for agents in `AgentCard`, `AgentGrid`, `OrgChartNode`, `ActivityTimeline`. `getInitials(name)` — avatar fallback text. `relativeTime(iso)` — "2m ago" timestamps in activity and chat. |
| `security.ts`      | `lib/security.ts`                   | `sanitizeUserInput()` on every AI chat input field before sending. `containsXss()` guard on all free-text form fields.                                                                                                                              |
| `cn()`             | `lib/utils.ts`                      | Required for all conditional class merging across the new design system.                                                                                                                                                                            |
| `errors.ts`        | `lib/errors.ts`                     | `getUserFriendlyMessage()` used by `ErrorBoundary` and service error handlers.                                                                                                                                                                      |
| `api-endpoints.ts` | `shared/constants/api-endpoints.ts` | Single source of truth for all API paths — fixes the literal-string duplication in pages.                                                                                                                                                           |
| `routes.ts`        | `shared/constants/routes.ts`        | All `href` values in navigation and redirects pulled from this.                                                                                                                                                                                     |
| `ui-config.ts`     | `shared/constants/ui-config.ts`     | UI dimension constants (sidebar widths, panel sizes, animation config).                                                                                                                                                                             |

---

### 11.15 Radix / shadcn Primitives (All Drop-In)

All 21 components in `components/ui/` are untouched and immediately usable:

`alert`, `avatar`, `badge`, `breadcrumb`, `button`, `card`, `checkbox`, `collapsible`, `command`, `dialog`, `dropdown-menu`, `input`, `label`, `popover`, `progress`, `scroll-area`, `select`, `separator`, `sheet`, `skeleton`, `switch`, `table`, `tabs`, `textarea`, `tooltip`

These form the base layer. New design tokens extend them via `className` overrides — never by modifying the primitive files.

---

### 11.16 Summary Count

| Category                     | Total Items | Drop-in 🟢 | Restyle 🟡 | Compose 🔵 |
| ---------------------------- | ----------- | ---------- | ---------- | ---------- |
| UI Display Components        | 7           | 3          | 3          | 1          |
| Dashboard Feature Components | 4           | 2          | 1          | 1          |
| AI Chat Components           | 4           | 0          | 0          | 4          |
| Org Chart Feature            | 3           | 1          | 1          | 1          |
| Strategy Feature             | 1           | 0          | 1          | 0          |
| Settings Feature             | 1           | 1          | 0          | 0          |
| Onboarding Wizard (11 steps) | 11          | 11         | 0          | 0          |
| Charts Library               | 6           | 6          | 0          | 0          |
| Shell Infrastructure         | 6           | 5          | 1          | 0          |
| Feature Flags                | 1           | 1          | 0          | 0          |
| Theme & Preferences System   | 3           | 3          | 0          | 0          |
| Hooks                        | 13          | 13         | 0          | 0          |
| Services                     | 13          | 13         | 0          | 0          |
| Utilities & Libraries        | 6           | 6          | 0          | 0          |
| Radix/shadcn Primitives      | 24          | 24         | 0          | 0          |
| **TOTAL**                    | **103**     | **89**     | **7**      | **7**      |

**89 of 103 identified assets (86%) are drop-in** — plug directly into the new interface with no logic changes, only token/class updates. The rebuild effort is primarily the 7 new components (§2), the CSS token bridge (Phase A), and the 10 page layout restructures (Phases C–G).

---

_Awaiting approval to begin Phase A implementation._
