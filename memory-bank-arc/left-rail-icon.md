# Left Icon Rail — Canonical Single-Source-of-Truth Navigation

> **Status:** ✅ Shipped (FIX-021, 2026-07-07). All legacy left-side navigation removed.
> **Owner:** Frontend platform team.
> **Affects:** `frontend-tenant`, `frontend-admin` (admin to follow in FIX-022).

---

## 1. Purpose

This document is the canonical reference for the left navigation in the
NeureCore tenant portal. It captures **why** the rail exists, **what** it
contains, **how** it is rendered, **how** users customise it, and the
**operational runbooks** for debugging it.

The rail replaces every prior form of left navigation in the portal:

| Old | Replaced by |
|---|---|
| LegacyShell wide sidebar (280px, 18-item NAV + OrgTree + sign-out footer) | **IconRail** (56/240px, sectioned) |
| `/home` decorative `LeftPanel` (280px gradient icons + Preferences modal) | IconRail (same nav, no separate panel) |
| TopBar secondary icon row (Inbox / Marketplace / Service Desk / Intelligence / Finance) | IconRail sections |
| `useFeatureFlag('commandCenter')` toggle | Removed (always-on) |
| `visibleIcons` per-user toggles in `uiPreferencesStore` | `railPreferencesStore` with sections + items |
| `/command-center` page (route + page.tsx + dead redirect) | Removed; rewrite handles legacy URLs |
| `/dashboard`, `/agents`, `/tasks`, `/workflows`, … dead redirect `page.tsx` files | Removed; `next.config.js` rewrites still serve URLs |

After FIX-021 the portal has **exactly one** left navigation surface (the
IconRail) and **one** TopBar. No code path renders a second left-nav under
either the legacy flag or any environment variable.

---

## 2. Architecture

### 2.1 Component tree

```
<ErrorBoundary>
  <div className="flex h-screen overflow-hidden">
    ┌──────────────────────┐  ┌──────────────────────────────────────┐
    │ <div className=      │  │ <div className="flex-1 flex flex-col">│
    │   "hidden md:block   │  │   <TopBar .../>                      │
    │   shrink-0 h-full">  │  │   <main className="flex-1 ...">      │
    │   <IconRail />       │  │     {children}                       │
    │ </div>               │  │   </main>                            │
    │                      │  │   <ActivityStream />                 │
    │ <MobileNav>          │  │ </div>                               │
    │   <IconRail />       │  │                                      │
    │ </MobileNav>         │  │ <ThingsToDoPanel/>  (lg: fixed)      │
    │                      │  │ <InspectorPanel/>                    │
    │                      │  │ <CommandPalette/>                    │
    │                      │  │ <ConversationPanel/>                 │
    │                      │  │ <UnifiedChatPanel .../>              │
    └──────────────────────┘  └──────────────────────────────────────┘
  </div>
</ErrorBoundary>
```

Two `IconRail` instances exist (desktop + MobileNav drawer), but the
drawer's `<nav>` is `md:hidden`. Only the desktop one is visible at any
given viewport. Both subscribe to the same `railPreferencesStore`, so a
toggle in the modal updates both instantly.

### 2.2 Files (canonical, single source of truth)

| Path | Role |
|---|---|
| `frontend-tenant/src/components/layout/IconRail.tsx` | The rail itself. Exports `RAIL_SECTIONS` (the canonical nav definition). |
| `frontend-tenant/src/components/layout/RailCustomizeModal.tsx` | Per-user toggle modal (sections + items + reset). |
| `frontend-tenant/src/stores/railPreferencesStore.ts` | Zustand store + persist for visibility preferences. |
| `frontend-tenant/src/components/TenantShell.tsx` | Portal shell that hosts the rail + TopBar. **No more `LegacyShell`.** |
| `frontend-tenant/src/components/layout/TopBar.tsx` | Slim TopBar (brand + breadcrumb + ⌘K + theme + notifications + help + user menu). |
| `frontend-tenant/src/components/layout/MobileNav.tsx` | Slide-out drawer that re-hosts the same IconRail on mobile. |
| `frontend-tenant/next.config.js` | URL rewrites that serve all 19 legacy URLs from canonical pages. |

### 2.3 Files DELETED

These were the legacy surfaces. Do not re-create them.

| Deleted | Why |
|---|---|
| `frontend-tenant/src/components/sidebar/Sidebar.tsx` | LegacyShell main nav list — replaced by `IconRail`. |
| `frontend-tenant/src/components/TenantShell.tsx::LegacyShell()` function | Hard-coded 18-item nav + OrgTree + sign-out footer. |
| `frontend-tenant/src/components/home/LeftPanel.tsx` | Decorative 280px gradient icon panel rendered on `/home` only. |
| `frontend-tenant/src/components/home/PreferencesModal.tsx` | Old per-icon show/hide modal. |
| `frontend-tenant/src/app/dashboard/page.tsx` | Dead `redirect("/home")`. |
| `frontend-tenant/src/app/command-center/page.tsx` | Old Creatio-style shell. The new `/home` page subsumes it. |
| `frontend-tenant/src/app/agents/page.tsx` | Dead redirect. |
| `frontend-tenant/src/app/tasks/page.tsx` | Dead redirect. |
| `frontend-tenant/src/app/tasks/delegate/page.tsx` | Dead redirect. |
| `frontend-tenant/src/app/workflows/page.tsx` | Dead redirect. |
| `frontend-tenant/src/app/routines/page.tsx` | Dead redirect. |
| `frontend-tenant/src/app/goals/page.tsx` | Dead redirect. |
| `frontend-tenant/src/app/projects/page.tsx` | Dead redirect. |
| `frontend-tenant/src/app/costs/page.tsx` | Dead redirect. |
| `frontend-tenant/src/app/inbox/page.tsx` | Dead redirect. |
| `frontend-tenant/src/app/activity/page.tsx` | Dead redirect. |
| `frontend-tenant/src/app/approvals/page.tsx` | Dead redirect. |
| `frontend-tenant/src/app/analytics/page.tsx` | Dead redirect. |
| `frontend-tenant/src/app/connectors/page.tsx` | Dead redirect. |
| `frontend-tenant/src/app/billing/page.tsx` | Dead redirect. |
| `frontend-tenant/src/app/org-chart/page.tsx` | Dead redirect. |

### 2.4 Data model

```ts
// frontend-tenant/src/stores/railPreferencesStore.ts
type SectionId = 'home' | 'workspace' | 'marketplace' | 'service-desk' | 'finance' | 'intelligence';
type ItemId =
  | 'home' | 'departments' | 'org-chart' | 'tasks' | 'workflows'
  | 'routines' | 'goals' | 'projects'
  | 'marketplace' | 'agents' | 'connectors' | 'ai-skills'
  | 'service-desk' | 'inbox' | 'approvals' | 'activity'
  | 'finance' | 'intelligence' | 'settings';

interface RailPreferencesState {
  hiddenSections: SectionId[];      // sections toggled OFF
  hiddenItems:    ItemId[];         // individual items toggled OFF
  collapsedSections: SectionId[];   // per-section collapse (expanded rail only)

  toggleSection: (id) => void;
  toggleItem: (id) => void;
  toggleSectionCollapsed: (id) => void;
  reset: () => void;                // restore all defaults
}
```

**Defaults:** all three arrays empty → all 19 links visible, no section collapsed.

**Persistence:** `zustand/middleware/persist` → `localStorage['neurecore-rail-preferences']` v1. The merge function sanitises persisted values to the typed union (drops unknown ids silently).

**Visibility rule:** an item is rendered if (a) its parent section is visible AND (b) the item itself is visible. Both filters are computed at render time inside `IconRail` from the raw `hiddenSections` / `hiddenItems` arrays.

---

## 3. IconRail implementation details

### 3.1 Layout & dimensions

```
┌──────────────────────┐
│ Brand (h-14, 56px)   │   ← shrink-0
├──────────────────────┤
│                      │
│  <nav flex-1         │   ← scrollable (overflow-y-auto + min-h-0)
│       min-h-0>       │     [+scrollbar-width:thin]
│   … sections …       │
│   … items    …       │
│  </nav>              │
├──────────────────────┤
│ OrgTree drawer       │   ← collapsible bottom section
├──────────────────────┤
│ [⚙ Customize] [⇤]   │   ← footer row (gap-1)
└──────────────────────┘
```

| Property | Value |
|---|---|
| Collapsed width | 56px (Tailwind `w-14`) — icons only |
| Expanded width | 240px (Tailwind `w-60`) — icons + labels |
| Expansion trigger | Mouse-enter OR pin toggle (click `⇤` footer button) |
| Active-state color | `bg-accent-500/15 text-accent-500` |
| Hover-state color | `bg-surface-overlay text-zinc-100` |
| Section label style | `text-[10px] font-semibold uppercase tracking-widest text-zinc-500` |

### 3.2 The canonical nav (`RAIL_SECTIONS`)

```ts
export const RAIL_SECTIONS: RailSection[] = [
  { id: 'home',          items: [{ id: 'home',          label: 'Home',          href: '/home',                   icon: Home }] },
  { id: 'workspace',     label: 'Workspace',
    items: [
      { id: 'departments', label: 'Departments', href: '/departments',                     icon: Building2 },
      { id: 'org-chart',    label: 'Org Chart',   href: '/departments?tab=org-chart',      icon: Network   },
      { id: 'tasks',        label: 'Tasks',       href: '/departments?tab=tasks',          icon: ListTodo  },
      { id: 'workflows',    label: 'Workflows',   href: '/departments?tab=workflows',      icon: GitBranch },
      { id: 'routines',     label: 'Routines',    href: '/departments?tab=routines',       icon: Repeat    },
      { id: 'goals',        label: 'Goals',       href: '/departments?tab=goals',          icon: Target    },
      { id: 'projects',     label: 'Projects',    href: '/departments?tab=projects',       icon: Briefcase },
    ] },
  { id: 'marketplace',   label: 'Marketplace',
    items: [
      { id: 'marketplace', label: 'Marketplace', href: '/marketplace',                     icon: Store    },
      { id: 'agents',      label: 'Agents',      href: '/marketplace?tab=agents',         icon: Users    },
      { id: 'connectors',  label: 'Connectors',  href: '/marketplace?tab=connectors',     icon: Plug     },
      { id: 'ai-skills',   label: 'AI Skills',   href: '/marketplace?tab=templates',      icon: Lightbulb},
    ] },
  { id: 'service-desk',  label: 'Service Desk',
    items: [
      { id: 'service-desk', label: 'Service Desk', href: '/service-desk?tab=inbox',        icon: Headphones  },
      { id: 'inbox',        label: 'Inbox',        href: '/service-desk?tab=inbox',        icon: Inbox       },
      { id: 'approvals',    label: 'Approvals',    href: '/service-desk?tab=approvals',    icon: CheckSquare },
      { id: 'activity',     label: 'Activity',     href: '/service-desk?tab=activity',     icon: Activity    },
    ] },
  { id: 'finance',       items: [{ id: 'finance', label: 'Finance', href: '/finance', icon: DollarSign }] },
  { id: 'intelligence',  label: 'Intelligence',
    items: [
      { id: 'intelligence', label: 'Intelligence', href: '/intelligence',                   icon: BarChart3 },
      { id: 'settings',     label: 'Settings',     href: '/intelligence?tab=settings',     icon: Cog       },
    ] },
];
```

Total: **6 sections, 19 items, 19 unique canonical destinations**.

### 3.3 URL rewrites (legacy → canonical)

`next.config.js` rewrites the legacy URLs the old sidebar linked to. None
of these have a `page.tsx` file anymore — the rewrite serves the canonical
page:

| Legacy URL | Destination | Tab id matches? |
|---|---|---|
| `/dashboard` | `/home` | n/a |
| `/agents` | `/marketplace?tab=agents` | ✅ |
| `/tasks` | `/departments?tab=tasks` | ✅ |
| `/tasks/delegate` | `/departments?tab=tasks` | ✅ (no separate delegate page; UI lives inside Departments → Tasks) |
| `/workflows` | `/departments?tab=workflows` | ✅ |
| `/routines` | `/departments?tab=routines` | ✅ |
| `/goals` | `/departments?tab=goals` | ✅ |
| `/projects` | `/departments?tab=projects` | ✅ |
| `/costs` | `/finance?tab=overview` | ✅ |
| `/inbox` | `/service-desk?tab=inbox` | ✅ |
| `/activity` | `/service-desk?tab=activity` | ✅ |
| `/approvals` | `/service-desk?tab=approvals` | ✅ |
| `/analytics` | `/intelligence?tab=analytics` | ✅ |
| `/connectors` | `/marketplace?tab=connectors` | ✅ |
| `/billing` | `/finance?tab=billing` | ✅ |
| `/org-chart` | `/departments?tab=org-chart` | ✅ (FIX-021 — was incorrectly `?tab=org` in FIX-019) |
| `/command-center` | `/home` | n/a |

### 3.4 Footer controls

| Control | When expanded | When collapsed |
|---|---|---|
| Customize | `SlidersHorizontal` icon + "Customize" text | Icon-only (icon button) |
| Collapse/Expand | `ChevronsLeft` icon, icon-only (sibling button) | `ChevronsRight` icon, icon-only |

Clicking **Customize** opens `RailCustomizeModal`.

### 3.5 OrgTree drawer (bottom of rail)

When expanded, a "Workspace tree" toggle reveals the live department → agent
hierarchy inside the rail. Implementation: `<OrgTree />` from
`components/sidebar/OrgTree.tsx` (unchanged from legacy; it fetches
`/departments?limit=100` and `/agents?limit=100` and renders a collapsible
tree). Max height 288px (`max-h-72`) so the rail stays scrollable.

> **FIX-021 bug fix:** The legacy code used `?limit=200` on the agents
> fetch, which the backend rejects with `400 INVALID_REQUEST` (the canonical
> `PaginationDto` enforces `MAX_LIMIT = 100`). The IconRail now uses
> `?limit=100` consistent with the rest of the codebase.

### 3.6 Section header collapse

In expanded mode, each section label (e.g. `WORKSPACE`) is a button:

- `aria-expanded` reflects whether the items are visible.
- A `ChevronDown` icon rotates `-90deg` when collapsed.
- Section with a single item (Home, Finance) shows no chevron.
- The collapse state persists in `collapsedSections`.

This is independent of the visibility state — you can hide items via
visibility, then collapse the remaining section to save space.

### 3.7 The Zustand subscription gotcha (and fix)

The first implementation of `railPreferencesStore` exposed helper
selectors (`isSectionVisible(id)`, `isItemVisible(id)`, etc.). Components
read them like:

```tsx
const isItemVisible = useRailPreferencesStore((s) => s.isItemVisible);
```

That returned the **function reference**, which is stable across renders
(because the store defines it once and never replaces it). Zustand only
re-renders when the selector's return value changes — but a function
reference never changes → components never re-rendered on toggles.

The second `IconRail` instance (in the MobileNav drawer, hidden on
desktop) revealed the bug: it never re-rendered even when the desktop
rail did (which only worked because mouse-enter / hover triggered
unrelated re-renders).

**Fix:** subscribe to the raw arrays, derive visibility inline:

```tsx
const hiddenItems = useRailPreferencesStore((s) => s.hiddenItems);
const itemIsVisible = (id: ItemId) => !hiddenItems.includes(id);
```

Same pattern in `RailCustomizeModal`. Both rails now update instantly on
every toggle.

---

## 4. RailCustomizeModal

### 4.1 Visual

```
┌─────────────────────────────────────┐
│ Customize navigation             [×]│
│ Choose what appears in your left    │
│ rail. 14/19 links visible.          │
├─────────────────────────────────────┤
│ ┌─[✓] Home                  1/1 On─┐│
│ │    Home                          ││
│ └──────────────────────────────────┘│
│ ┌─[✓] Workspace          7/7 On ───┐│
│ │   [✓] Departments      [✓] Goals ││
│ │   [✓] Org Chart        [✓] Projects│
│ │   [✓] Tasks                     ││
│ │   [✓] Workflows                 ││
│ │   [✓] Routines                  ││
│ └──────────────────────────────────┘│
│ … more sections …                   │
├─────────────────────────────────────┤
│ [↻ Reset to defaults]      [ Done ] │
└─────────────────────────────────────┘
```

- Width: `max-w-md` (~28rem).
- Backdrop click or `Esc` closes.
- A section card's body (per-item toggles) is only rendered when the
  section is visible (otherwise it would be empty).
- "All items hidden — section is effectively invisible" warning appears
  when a visible section has zero remaining items.

### 4.2 Footer actions

- **Reset to defaults** → `reset()` — clears `hiddenSections`,
  `hiddenItems`, `collapsedSections`.
- **Done** → closes modal (`onClose`).

### 4.3 Accessibility

- `role="dialog"` + `aria-modal="true"` + `aria-label="Customize navigation rail"`.
- Section header buttons: `aria-pressed={visible}`.
- Item buttons: `aria-pressed={visible}`.
- Section collapse triggers (in the rail): `aria-expanded` + `aria-controls`.
- All actionable elements are keyboard-reachable (native `<button>` elements).

---

## 5. TopBar

The TopBar was trimmed in FIX-021: the 5 secondary icon links (Inbox /
Marketplace / Service Desk / Intelligence / Finance) were removed because
those routes are now reached from the IconRail. Current TopBar layout:

```
[Brand:NeureCore] / Breadcrumb  … [⌘K] [Theme] [Bell] [Help] [Avatar ▾]
```

The user menu (avatar dropdown) drives:

- User identity (name, email, role chip).
- "Settings" link → `/intelligence?tab=settings`.
- "Help" link → `/help`.
- "Sign out" button → calls `useAuth().logout()` then `router.push('/login')`.

### 5.1 Removed secondary nav

Before FIX-021, `TopBar.tsx` rendered these as `<SecondaryIcon>` links:
- Inbox → `/service-desk?tab=inbox`
- Marketplace → `/marketplace`
- Service Desk → `/service-desk?tab=approvals`
- Intelligence → `/intelligence`
- Finance → `/finance`

All five live inside the IconRail now (see §3.2). The removed TopBar
helpers (`SecondaryIcon`, `SecondaryIconProps`, badge counter fetches for
pending approvals / unread inbox) were deleted. The TopBar's pending-badge
functionality is preserved inside the IconRail items themselves if/when
needed (the `badge` field on `RailItem` is wired in the data model).

---

## 6. URL → page mapping (authoritative)

| Href | Page.tsx | Tabs supported | Notes |
|---|---|---|---|
| `/home` | `app/home/page.tsx` | n/a | Hero + KPIs + right rail (widgets from `RightPanel`). |
| `/departments` | `app/departments/page.tsx` | `org-chart`, `tasks`, `workflows`, `routines`, `goals`, `projects` | OrgChart tab reads `tab=org-chart` (FIX-021 bug fix). |
| `/marketplace` | `app/marketplace/page.tsx` | `agents`, `connectors`, `templates` | Marketplace hub. |
| `/service-desk` | `app/service-desk/page.tsx` | `inbox`, `approvals`, `activity` | Service Desk hub. |
| `/finance` | `app/finance/page.tsx` | `overview`, `billing`, `costs` | Finance hub. |
| `/intelligence` | `app/intelligence/page.tsx` | `analytics`, `observability`, `health`, `reliability`, `security`, `settings` | Intelligence hub. |
| `/settings` | `app/settings/page.tsx` | dynamic (smart redirect) | Falls through to `/intelligence?tab=settings`. |
| `/help` | `app/help/page.tsx` | n/a | Unchanged. |
| `/login` | `app/login/page.tsx` | n/a | Unchanged. |
| `/register` | `app/register/page.tsx` | n/a | Unchanged. |
| `/onboarding/setup` | `app/onboarding/setup/page.tsx` | n/a | Pre-auth landing for new tenants. |
| `/settings/integrations/*` | `app/settings/integrations/...` | n/a | OAuth callback pages. |

The full URL list served by rewrites is in §3.3.

---

## 7. State persistence & migration

### 7.1 uiPreferencesStore migration

The previous `uiPreferencesStore` exposed a `visibleIcons: VisibleIcon[]`
field that the old `LeftPanel` used. `LeftPanel` was deleted in FIX-021.
The store was updated:

- Bumped `version` from 1 → 2.
- Added a `migrate(persistedState, fromVersion)` function that, for
  `fromVersion < 2`, strips `visibleIcons` from the persisted payload.
- Removed `VisibleIcon`, `toggleIconVisibility`, `setVisibleIcons` from
  the TypeScript surface.

Existing users with `visibleIcons` in localStorage have it ignored on
next load — no breakage.

### 7.2 railPreferencesStore

```jsonc
// localStorage["neurecore-rail-preferences"]
{
  "state": {
    "hiddenSections":     ["marketplace"],
    "hiddenItems":        ["workflows", "routines", "goals"],
    "collapsedSections":  []
  },
  "version": 1
}
```

The store's `merge` function sanitises both arrays against the typed
`SectionId` / `ItemId` unions, dropping any unknown ids silently. This
keeps the store forward-compatible if we add or remove items later.

---

## 8. Behavioural requirements

### 8.1 Functional

- ✅ Hovering the rail expands it from 56 → 240px.
- ✅ The expand state is "sticky" — clicking `⇤`/`⇥` pins it.
- ✅ Mouse-leave collapses (unless pinned).
- ✅ Active link has `bg-accent-500/15 text-accent-500` + `aria-current="page"`.
- ✅ Tab-aware: `/departments?tab=tasks` lights up the **Tasks** item
  only when the user is actually on that tab.
- ✅ Clicking a section header (in expanded mode) collapses its items.
- ✅ Clicking **⚙ Customize** opens the modal.
- ✅ The modal's toggles update the rail in real time (no save button).
- ✅ The modal closes via X button, `Esc`, backdrop click, or **Done**.
- ✅ All preferences persist across reloads and across user logout/login
  cycles (same browser, same localStorage).

### 8.2 Non-functional

- ✅ Zero console errors on every route.
- ✅ Build succeeds clean (`next build` exit 0).
- ✅ Both desktop and mobile rail instances stay in sync.
- ✅ `<aside>` is keyboard-tabbable and screen-reader announces the
  navigation role (`aria-label="Primary navigation"`).
- ✅ No login bounce: navigation no longer triggers a 401/loop because
  the auth flow is now mounted exactly once (single `TenantShell`).

---

## 9. Test plan (manual + automated)

### 9.1 Manual smoke (must pass before each release)

Logged in as `mali@live.com` on `https://hq.neurecore.com`:

1. **Default state:** all 19 links visible in both desktop and mobile rails.
2. **Hover:** rail expands to show labels.
3. **Click ⇥ (or any link):** rail stays expanded (pinned).
4. **Click ⇤:** rail collapses back.
5. **Click each of the 19 rail links:** lands on the expected URL, zero
   console errors per route.
6. **Click ⚙ Customize:** modal opens with all 6 sections visible.
7. **Hide 3 items:** rail updates live (both desktop and mobile).
8. **Hide a whole section:** the section disappears from the rail.
9. **Show all items again via Reset:** rail restores to default.
10. **Reload the page:** preferences persist.
11. **Sign out and back in:** preferences persist (same browser).
12. **Click section header (e.g. WORKSPACE):** items collapse with chevron
    rotation; click again to expand.
13. **Resize window < 768px:** IconRail hides, hamburger appears, mobile
    drawer opens with the same rail contents.

### 9.2 Automated tests (recommended)

Unit tests for `IconRail` + `RailCustomizeModal`:

- Default render shows all 19 links.
- Toggling `hiddenItems` removes the matching items from the rail.
- Toggling `hiddenSections` removes the whole section.
- `toggleSectionCollapsed` toggles `aria-expanded` and the items' height.
- `reset()` clears all three arrays.

Integration test:

- Click each rail link → assert URL is the expected one and the
  corresponding rail link has `aria-current="page"`.

Regression guard:

- Snapshot the `RAIL_SECTIONS` export. Any change to the nav must update
  this snapshot AND the corresponding entry in this document.

---

## 10. Operational runbook

### 10.1 "The rail is empty / links disappeared"

1. Open the modal (`⚙ Customize`).
2. Check if the user has hidden everything. The header shows
   `0/19 links visible`.
3. Click **Reset to defaults** — restores the canonical rail.
4. If that doesn't work, open DevTools → Application → Local Storage →
   `neurecore-rail-preferences` → clear the entry. Reload.

### 10.2 "The active link isn't highlighted"

- The icon + label colour comes from the `isActive(href)` function in
  `IconRail.tsx:157`. It uses `usePathname()` + tab query matching.
- Confirm the target page actually exists (check `app/<page>/page.tsx`
  and the tabs it supports).
- Confirm the `href` in `RAIL_SECTIONS` matches the page's tab id
  exactly (e.g. `?tab=org-chart`, not `?tab=org`).

### 10.3 "Console errors on every page after the rail change"

- Confirm `next.config.js` rewrites still resolve (curl the legacy URLs).
- Confirm `/socket.io/?EIO=4&transport=polling` returns 200 from the
  frontend's hostname (was the OLS `/socket.io` proxy missing before
  FIX-019 / FIX-020 — see [runbook.md §3.2](runbook.md#32-websocket-proxied-through-openlitespeed)).
- Confirm the backend `/agents?limit=N` N ≤ 100.

### 10.4 "User preferences didn't survive a deploy"

The persist key is `neurecore-rail-preferences` (per-browser localStorage).
A deploy does not touch the user's browser. If a user reports their prefs
were wiped:

- They likely cleared site data, switched browsers, or opened an
  incognito window.
- Or our store's `merge` function rejected their old payload. Inspect
  `localStorage.getItem('neurecore-rail-preferences')` and check that
  every `id` in `hiddenSections` / `hiddenItems` matches the current
  `SectionId` / `ItemId` unions.

### 10.5 "Adding or removing a rail item"

When the nav structure changes:

1. Update `RAIL_SECTIONS` in `IconRail.tsx`.
2. If the change introduces new ids:
   - Add them to `SectionId` / `ItemId` unions in `railPreferencesStore.ts`.
   - Add them to the sanitisation lists in the `merge` function.
   - Bump the persist `version` (e.g. `1 → 2`) and add a `migrate` that
     drops unknown ids from the old payload.
3. Update §3.2 and §6 of this document.
4. Run the manual smoke test (§9.1).
5. If the change removes a legacy URL, update `next.config.js` rewrites
   and check no other docs reference the dead URL.

---

## 11. Known limitations & future work

- **Per-user sync across devices:** preferences live in localStorage,
  not in the backend. A future enhancement is to mirror them to
  `User.preferences` so they follow the user across browsers.
- **Reorderable sections:** not currently supported. The rail preserves
  the order of `RAIL_SECTIONS`. Adding drag-and-drop would require
  persistence of an `order` array per user.
- **Custom link injection:** no support for user-added external links.
  Future enhancement: a "Quick links" section driven by
  `User.quickLinks` in the backend.
- **Mobile drawer UX:** the drawer currently uses the same
  `railPreferencesStore` (instant sync), but it has no quick-toggle to
  mark a link as a "mobile favourite". Future enhancement: surface the
  most-clicked items in a quick-action bottom-sheet on mobile.
- **Admin frontend:** `frontend-admin` still uses the LegacyShell.
  Plan to port the IconRail to admin in FIX-022.

---

## 12. Change log

| Date | Change | Author | Notes |
|---|---|---|---|
| 2026-07-07 | Initial implementation (FIX-021) | Kilo | Replaced LegacyShell + LeftPanel + TopBar secondary nav with IconRail. Deleted dead page.tsx redirects. Added RailCustomizeModal. Fixed `?tab=org-chart` bug. Fixed `?limit=200` agents bug. Switched socket.io to polling. |
| 2026-07-07 | WebSocket fix (FIX-020) | Kilo | Switched `services/socket.ts` from `transports: ['websocket','polling']` to `transports: ['polling']` with `upgrade: false` because the OpenLiteSpeed proxy could not consistently proxy the WebSocket upgrade. |
| 2026-07-07 | Contabo proxy fix (FIX-019) | Kilo | Added `/socket.io/` context + rewrite rule to `hq.neurecore.com` and `cc.neurecore.com` OLS vhosts. Synced public/ folder. Restarted pm2 services. |

---

## 13. Related documents

- [runbook.md](runbook.md) — daily operations, deploy checklist.
- [contabo-ops.md](contabo-ops.md) — Contabo-specific deploys and recovery.
- [system-state.md](system-state.md) — top-level system state.
- [fixes.md](fixes.md) — historical fix records (FIX-019/020/021 entries).
- [pending-tasks.md](pending-tasks.md) — open work.
- [future-plans.md](future-plans.md) — roadmap.

If you find this document out of date with the code, treat the code as
the source of truth and update this file. If the code and this document
disagree on intent, raise it with the frontend platform team.