# NeureCore Frontend-Tenant: Comprehensive UI/UX Audit & Refactor Guide

**Status:** Phase 6 (Home page redesign complete) → Phase 7+ (Systematic refactor needed)  
**Date:** 2026-07-05  
**Scope:** All 40+ pages in frontend-tenant + component system + design system  
**Audience:** Product design, engineering leads, frontend developers  

---

## Executive Summary

The frontend-tenant application has a solid foundation with **consistent Creatio-inspired design language** and **well-structured components**. However, several architectural inconsistencies and UX gaps prevent optimal **user experience**, **developer velocity**, and **scalability**.

### Current State

| Aspect | Rating | Notes |
|--------|--------|-------|
| **Design Consistency** | ⭐⭐⭐⭐ | Creatio language applied well; dark theme coherent |
| **Component Reusability** | ⭐⭐⭐⭐ | StatusBadge, KpiCard, AgentCard patterns strong |
| **Layout Uniformity** | ⭐⭐⭐☆ | Some pages (service-desk) use tabs; others don't |
| **Mobile Responsiveness** | ⭐⭐☆☆ | Limited `sm:` breakpoints; poor on <768px |
| **Form Handling** | ⭐⭐⭐☆ | Working but repetitive; no centralized validation |
| **Data Display** | ⭐⭐⭐⭐ | Tables, cards, charts consistent; lazy loading missing |
| **Navigation** | ⭐⭐⭐☆ | Breadcrumbs present on detail pages; search primitive |
| **Performance** | ⭐⭐⭐☆ | Builds pass; bundle tracking absent; no virtualization |

### Key Issues to Address

1. **Dual button systems** (UI button vs ActionButton) cause decision paralysis
2. **Two table components** (DataTable vs EntityTable) with overlapping concerns
3. **Missing mobile-first responsive design** across all pages
4. **Repetitive form validation logic** in every form component
5. **Frontend-only search** won't scale beyond current dataset
6. **No loading skeletons** for better perceived performance
7. **Inconsistent empty/error states** across data display components
8. **No dashboard/list view unification** - each page reinvents the wheel

---

## Design Reference Analysis

### Reference: Creatio Home Page (`Home_screenx.png.webp`)

**Pattern Observed:**
```
┌─ Left Rail (Vertical Menu) ─┬─ Center Hero ────────────────────┬─ Right Panel (AI) ─┐
│ Home page                    │ Full-bleed background image      │ Forecast insights  │
│ Feed                         │ Greeting (date + name)           │ AI chat composer   │
│ Leads                        │ Command input ("Message to AI")  │                    │
│ Accounts                     │                                  │                    │
│ Contacts                     │ [Floating action suggestions]    │                    │
│ Activities                   │                                  │                    │
│ Opportunities                │                                  │                    │
│ Chat                         │                                  │                    │
│ Orders                       │                                  │                    │
│ Invoices                     │                                  │                    │
│ Contracts                    │                                  │                    │
└────────────────────────────┴──────────────────────────────────┴────────────────────┘
```

**Key Insights:**
- Left rail: **Icon + label** only (no colored backgrounds)
- Center: **Full-bleed image** background with **centered greeting**
- Right panel: **Contextual AI insights** (not generic widgets)
- No intermediate buttons/CTAs in hero (direct AI input)

### Reference: Sales Detail Page (`05-sales-screen-01_1x.png.webp`)

**Pattern Observed:**
```
┌─ Breadcrumb + Actions ────────────────────────────────────────────┐
│ ← Alexander Wilson, Alpha Business        [Save] [Lock] [More]    │
├─ Tab Navigation (OVERVIEW | PROCESSING | SALES | PRODUCTS | ...) ─┤
├─ Layout ──────────────────────────────────────────────────────────┤
│ ┌─ Left (25%) ─┬─ Center (50%) ──────────┬─ Right (25%) ─────┐   │
│ │ Profile pic  │ KPI cards (blue/orange) │ Customer context  │   │
│ │ Contact info │ Engagement chart        │ AI assistant      │   │
│ │ Best offers  │ Forms data              │                   │   │
│ │ Enrichment   │                         │                   │   │
│ └──────────────┴─────────────────────────┴───────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
```

**Key Insights:**
- **3-column layout** with defined proportions (25-50-25)
- **Tabs** for different views of same entity
- **KPI cards** in grid (color-coded by priority)
- **Left sidebar** for metadata/context
- **Right sidebar** for AI-driven actions

### Reference: Lead Processing Page (`05-sales-screen-02_1x.png.webp`)

**Pattern Observed:**
```
┌─ Status timeline ──────────────────────────────────────────────┐
│ Marketing qualified → Converted → Closed won ✓                 │
├─ Scores + Tabs ────────────────────────────────────────────────┤
│ Readiness [78%] │ Predictive [74%]     [OVERVIEW|TIMELINE|...]│
├─ Expandable sections ──────────────────────────────────────────┤
│ ▼ Lead details (Tasks [1] | Calls [0] | Created [1/15/2025])  │
│ ▼ Customer details (Profile cards side-by-side)               │
│ ▼ Purchase likelihood                                          │
├─ Right Sidebar ────────────────────────────────────────────────┤
│ AI Evaluation                                                  │
│ "This lead is interested in solar panels..."                   │
│ [Start nurturing campaign] [Assign to sales]                  │
└────────────────────────────────────────────────────────────────┘
```

**Key Insights:**
- **Timeline/progress indicator** at top
- **Expandable sections** for content hierarchy
- **Metric cards** with visual indicators (%, scores)
- **Right panel AI** provides evaluation + suggested actions
- **Side-by-side detail cards** for related records

---

## Current Frontend-Tenant Architecture

### Shell Pattern (TenantShell)

All authenticated pages wrapped in **TenantShell** providing:
```
┌─ Top Bar ──────────────────────────────────────────────────────┐
│ [Creatio Logo] [Search] [Notifications] [Avatar]  [Settings]   │
├─ Main Content ─────────────────────────────────────────────────┤
│ ┌─ Left Rail ──┬─ Center Content ──────────────────────┬─ AI ──┐
│ │ Icon buttons │ Page-specific layout                 │ Panel │
│ │ (collapsed)  │ (varies per route)                   │       │
│ └──────────────┴───────────────────────────────────────┴───────┘
└────────────────────────────────────────────────────────────────┘
```

**Issue:** Right "AI Panel" is placeholder; not utilized on most pages

### Home Page (FIX-021 layout)

```
┌─ IconRail (56/240px) ─┬─ Center ────────────────────────────┬─ Right Panel ─┐
│ NeureCore brand        │ Hero (greeting, AI prompt)          │ Live Feed     │
│ Sectioned nav:         │ KPI Strip (4 metrics)              │ Performance   │
│  Home                  │ Network Status                     │ Quick Actions │
│  Workspace (Depts…)    │                                    │ Tasks         │
│  Marketplace           │                                    │ Approvals     │
│  Service Desk          │                                    │               │
│  Finance               │                                    │               │
│  Intelligence          │                                    │               │
│ Customize / Collapse   │                                    │               │
└────────────────────────┴────────────────────────────────────┴───────────────┘
```

The `/home` page no longer renders its own `LeftPanel` — the **IconRail** (hosted by `TenantShell`) is the canonical left navigation for the entire portal. See [left-rail-icon.md](left-rail-icon.md).

**Current State:** ✅ Matches Creatio pattern (hero centered, right-rail widgets).  
**Remaining Issues:** Right panel widgets still mock data; collapse button visual feedback needed.

### Key Pages Analyzed

| Page | URL | Type | Current State | Issues |
|------|-----|------|---------------|--------|
| Home | `/home` | Dashboard | Phase 6 refactored | Widgets need real data |
| Command Center | `/command-center` | Hub | Using tabs + cards | Inconsistent spacing |
| Service Desk | `/service-desk` | Hub | Tabs (4 views) | No search integration |
| Agents | `/agents` | List | Grid + table mixed | Mobile broken |
| Agent Detail | `/agents/[id]` | Detail | Tab-based | Layout inconsistent w/ Creatio |
| Tasks | `/tasks` | List | Simple list | No filters/search UX |
| Approvals | `/approvals` | List | Card list | Bulk actions missing |
| Workflows | `/workflows` | List | Grid view | No creation wizard |
| Marketplace | `/marketplace` | Hub | Category tabs | Inconsistent with sales screens |
| Settings/Wizard | `/settings/wizard/[slug]` | Form | Modal dialogs | Validation unclear |
| Onboarding | `/onboarding/setup` | Wizard | Step-based | Good pattern; not reused |

---

## Component Inventory & Patterns

### Reusable Components (Well-Designed)

| Component | Location | Usage | Issues |
|-----------|----------|-------|--------|
| `StatusBadge` | `components/common/` | Status indicators | ✅ Consistent across app |
| `KpiCard` | `components/home/` | Metric display | ⚠️ Only used on home; could generalize |
| `AgentCard` | `components/agents/` | Agent preview | ✅ Used in marketplace + list |
| `ActionButton` | `components/common/` | Primary actions | ⚠️ Button system duplicated |
| `GlassPanel` | `components/home/` | Container | ✅ New; glassmorphic styling |
| `PreferencesModal` | `components/home/` | Settings | ✅ Good isolation |
| `RightPanel` | `components/home/` | Widget container | ✅ Collapsible pattern |

### Problem Components

| Component | Location | Issues | Recommendation |
|-----------|----------|--------|-----------------|
| `UI Button` | `src/` | Overlaps with ActionButton | ❌ Remove; merge into ActionButton |
| `DataTable` | `components/` | Pagination only | ⚠️ Merge with EntityTable |
| `EntityTable` | `components/` | Bulk actions only | ⚠️ Merge with DataTable |
| Search inputs | Various | Frontend-only filtering | ❌ Must add server-side backing |
| Form validation | Various | Reimplemented per form | ❌ Extract to `useFormValidation` hook |

### Missing Components

| Component | Why Needed | Pattern Example |
|-----------|-----------|-----------------|
| Loading skeleton | Better perceived performance | Shimmer animation on KpiCard, table rows |
| Empty state | Clarity when no data | Illustration + call-to-action |
| Error state | Handle failures gracefully | Error icon + retry button |
| Toast notification | Feedback for actions | Slide-in from bottom-right |
| Breadcrumb nav | Context in deep pages | Clickable path with separators |
| Bulk action bar | Multi-select patterns | Sticky bar with action buttons |
| Data filter panel | Complex filtering | Collapsible sidebar with checkboxes/chips |

---

## UX/Design Issues & Gaps

### 1. Mobile Responsiveness (Critical)

**Current State:** Mostly unresponsive below 768px  
**Impact:** Poor on tablets (iPad), all mobile devices  
**Evidence:**
- Left rail: Not hidden/collapsed on mobile
- KPI cards: Don't stack
- Tables: Horizontal scroll (broken UX)
- Forms: Input fields too wide

**Affected Pages:**
- All pages with 3-column layout
- Tables (agents, tasks, approvals)
- Command center

**Recommendation:**
```tsx
// Add mobile-first breakpoint system:
// Layout pattern for responsive:
<div className="grid gap-4 lg:grid-cols-3 md:grid-cols-2 sm:grid-cols-1">
  <aside className="hidden lg:block w-72">Left panel</aside>
  <main className="lg:col-span-2">Content</main>
  <aside className="hidden md:block md:col-span-2 lg:col-span-1">Right panel</aside>
</div>
```

### 2. Data Display States (Major)

**Issue:** No loading, empty, or error skeletons on any page  
**Impact:** Confusing UX when data loads; user doesn't know if page is working  
**Examples:**
- Agent list: Shows loading... text (no visual indicator)
- Tasks: Empty list looks broken
- Charts: No loading animation

**Recommendation:**
```tsx
// Reusable skeleton components:
<SkeletonCard /> // KPI card placeholder
<SkeletonTable rows={5} /> // Table loading state
<EmptyState icon={AlertIcon} title="No data" action="Create new" />
<ErrorState error={message} action="Retry" />
```

### 3. Search & Filtering (Scalability)

**Current:** All search is frontend-only (`.filter()` on arrays)  
**Problem:** Works for 100 items; breaks at 1000+  
**Pages Affected:** Agents, workflows, approvals, tasks  

**Recommendation:**
```tsx
// Server-side backed search:
const { search, setSearch } = useState('');
const { data, loading } = useSearch('/agents', { query: search });

// Debounce + immediate loading state
```

### 4. Form Validation (Dev Friction)

**Current:** Each form implements validation separately  
**Example:** `Settings wizard`, `Agent creation`, `Task creation`  
**Impact:** 50% code duplication; inconsistent error messages  

**Recommendation:**
```tsx
// Reusable hook:
const { values, errors, touched, handleChange, handleSubmit } = useFormValidation(
  { name: '', email: '' },
  validationSchema
);
```

### 5. Navigation Hierarchy (Clarity)

**Issue:** Breadcrumbs missing on detail pages; no back button pattern  
**Pages:**
- `/agents/[id]` - No breadcrumb
- `/workflows/[id]` - No breadcrumb
- Nested settings routes - Unclear parent/child

**Recommendation:**
```tsx
// Add breadcrumb to all detail pages:
<Breadcrumb>
  <BreadcrumbItem href="/agents">Agents</BreadcrumbItem>
  <BreadcrumbItem>Alex AI Agent</BreadcrumbItem>
</Breadcrumb>
```

### 6. Right Panel Context Misalignment

**Current:** Home page has 5 static widgets (Live Feed, Stats, Tasks, Approvals, Quick Actions)  
**Issue:** Other pages have empty right panels; no context-specific widgets  
**Expected (per Creatio):** Right panel should show relevant AI insights / context

**Examples:**
- `/agents/[id]` should show: agent performance, recent interactions, suggested actions
- `/tasks/[id]` should show: assignee context, due date warnings, related records
- `/service-desk` should show: ticket resolution guidance, knowledge base suggestions

**Recommendation:**
```tsx
// Context provider pattern:
<AssistantContextProvider entityType="agent" entityId={agentId}>
  {/* Right panel automatically shows relevant insights */}
</AssistantContextProvider>
```

---

## Detailed Page-by-Page Audit

### ✅ Good Examples

#### `/home` (FIX-021)
- ✅ Centered hero with greeting
- ✅ IconRail with collapsible sections + per-user customisation (see [left-rail-icon.md](left-rail-icon.md))
- ✅ Right panel with widgets
- ⚠️ Widget data is mock (needs real API)

#### `/settings/wizard/[slug]` (Onboarding flow)
- ✅ Step-based progression with visual indicator
- ✅ Form validation clear
- ✅ Previous/Next navigation
- ✅ Progress bar
- 💡 Pattern should be reused for multi-step flows (agent creation, workflow builder)

#### `/marketplace` (category browsing)
- ✅ Tab-based categorization
- ✅ Card grid layout
- ✅ Search + filter sidebar
- ⚠️ Mobile: cards don't stack; tab nav breaks

### ⚠️ Needs Improvement

#### `/command-center` (Hub page)
**Current Issues:**
- Tabs feel disconnected from content
- Cards have inconsistent spacing
- No visual hierarchy (all cards same height)
- Search placeholder not functional

**Recommended Changes:**
- Add visual indicator showing which tab is active
- Add summary stats at top (total tasks, pending approvals)
- Group related cards (tasks + approvals together)
- Implement server-side search across all cards
- Add quick filters (by status, priority, date)

#### `/agents` (List page)
**Current Issues:**
- Grid view + table view mixed
- No filters (search only)
- Sorting not obvious
- Add agent button takes too long to find
- Mobile: grid breaks

**Recommended Changes:**
- Single table view (not dual grid/table)
- Add filter sidebar (active, inactive, role)
- Sort by columns (click header)
- Prominent "Add agent" button in header
- Mobile: collapsible filter sidebar
- Add bulk actions (enable/disable multiple)

#### `/agents/[id]` (Detail page)
**Current Issues:**
- Layout doesn't match Creatio 3-column pattern
- No tabs for different views (prompts, permissions, performance)
- Right panel empty
- Missing breadcrumb

**Recommended Changes:**
- 3-column layout: left (identity/config), center (details), right (AI insights)
- Add tabs: Identity → Prompting → Permissions → Config → Performance → Audit
- Show agent execution stats in right panel
- Add breadcrumb navigation
- Add suggested improvements via AI

#### `/service-desk` (Hub page)
**Current Issues:**
- Tab navigation feels isolated
- Cards within each tab inconsistent
- No global search
- Approval workflow not clear

**Recommended Changes:**
- Add dashboard header with key metrics
- Unify card styling across tabs
- Implement search that spans all tabs
- Show approval workflows with visual timeline
- Add SLA indicators (time remaining)

### ❌ Major Refactors Needed

#### `/tasks` (List page)
**Issues:** Minimal UI; no filtering, sorting, or bulk actions  
**Refactor Plan:**
1. Add Kanban view (in addition to list)
2. Add filtering (by status, priority, assignee, date)
3. Add sorting (due date, priority, created)
4. Add bulk actions (complete multiple, reassign)
5. Mobile: Stack columns vertically
6. Add inline editing (quick edit due date, priority)

#### `/workflows` (List page)
**Issues:** Grid layout doesn't scale; no creation wizard  
**Refactor Plan:**
1. Table view with columns: Name, Status, Triggered, Last run, Actions
2. Add creation wizard (trigger type → steps → variables → test)
3. Add filter sidebar
4. Add Kanban by status view
5. Add quick enable/disable toggle
6. Mobile: Reduce columns; show key info only

#### `/approvals` (List page)
**Issues:** Card list only; no filtering, sorting, or bulk actions  
**Refactor Plan:**
1. Add table + card view toggle
2. Add filters (status: pending/approved/rejected, type, date)
3. Add sorting (date created, due date, priority)
4. Add bulk actions (approve/reject multiple)
5. Add inline approval (approve/reject from list)
6. Timeline view showing approval progress

#### `/onboarding/setup` (Current good pattern)
**Status:** ✅ Good; pattern should be replicated  
**Replication Target:** Workflow creation, Agent creation, Integration setup  

---

## Proposed Refactor Roadmap (Phase 7+)

### Phase 7: Foundation (Week 1-2)
**Goal:** Build reusable component system + mobile responsiveness

- [ ] Consolidate button system (remove UI button; use ActionButton everywhere)
- [ ] Create loading skeleton components (SkeletonCard, SkeletonTable, SkeletonChart)
- [ ] Create empty/error state components
- [ ] Add mobile-first responsive breakpoints to TenantShell
- [ ] Create breadcrumb component + use on all detail pages

**Files to create/modify:**
- `src/components/common/Skeleton.tsx`
- `src/components/common/EmptyState.tsx`
- `src/components/common/ErrorState.tsx`
- `src/components/common/Breadcrumb.tsx`
- `src/components/TenantShell.tsx` (add sm: breakpoints)
- `src/hooks/useFormValidation.ts` (reusable validation)

### Phase 8: Data Display Unification (Week 3-4)
**Goal:** Merge DataTable + EntityTable; add search/filter everywhere

- [ ] Merge DataTable + EntityTable → UnifiedDataTable with feature flags
- [ ] Add server-side search hook (useSearch)
- [ ] Add filter sidebar component (FilterPanel)
- [ ] Add bulk actions bar (BulkActionBar)
- [ ] Implement on: agents, tasks, approvals, workflows

**Files to modify:**
- `src/components/table/DataTable.tsx` + `EntityTable.tsx` → merge
- `src/hooks/useSearch.ts` (new)
- `src/components/filter/FilterPanel.tsx` (new)
- `src/components/table/BulkActionBar.tsx` (new)

### Phase 9: Page Standardization (Week 5-6)
**Goal:** Apply consistent 3-column layout + context-aware right panel to all detail pages

- [ ] Standardize `/[entity]/[id]` pages to 3-column layout
- [ ] Add tabs component (OVERVIEW | DETAILS | RELATED | ACTIVITY | SETTINGS)
- [ ] Implement AssistantContextProvider for right panel
- [ ] Add breadcrumb to all detail pages
- [ ] Mobile: Collapse right panel into modal/drawer

**Pages to update:**
- `/agents/[id]`
- `/workflows/[id]`
- `/tasks/[id]`
- `/projects/[id]`
- `/users/[id]`

### Phase 10: Hub Page Unification (Week 7-8)
**Goal:** Standardize hub pages (command-center, service-desk, marketplace)

- [ ] Add dashboard header with KPI metrics
- [ ] Consolidate tab navigation style
- [ ] Unify card styling across pages
- [ ] Add global search + filters
- [ ] Mobile: Collapsible tab navigation

**Pages to update:**
- `/command-center`
- `/service-desk`
- `/marketplace`
- `/analytics`

### Phase 11: Mobile & Polish (Week 9-10)
**Goal:** Mobile-first refinements + visual polish

- [ ] Test all pages on mobile (<768px)
- [ ] Add mobile navigation drawer for left rail
- [ ] Stack 3-column layouts to 1-column on mobile
- [ ] Optimize tables for mobile (horizontal scroll vs stacking)
- [ ] Test touch interactions on all buttons/inputs
- [ ] Performance optimization (lazy loading, image optimization)

### Phase 12: Advanced Features (Week 11-12)
**Goal:** Add sophisticated UX patterns

- [ ] Kanban view for status-based data (tasks, workflows, approvals)
- [ ] Inline editing (click field to edit)
- [ ] Keyboard shortcuts (cmd+k for search, etc.)
- [ ] Drag-to-reorder (reorder dashboard widgets, tasks, etc.)
- [ ] Export to CSV/PDF
- [ ] Real-time collaboration indicators

---

## Specific Refactor Recommendations

### 1. Button System Consolidation

**Problem:** Two button implementations cause confusion
```tsx
// Current:
<UI.Button variant="primary" />      // Older pattern
<ActionButton action={action} />     // Newer pattern

// Unified:
<Button variant="primary" size="md" />
<Button variant="secondary" />
<Button variant="ghost" />
<Button variant="loading" />
```

**Implementation:**
- Keep ActionButton logic; rename to Button
- Remove UI button system
- Create single `src/components/common/Button.tsx`
- Update all imports across 40+ pages

### 2. Table Consolidation

**Problem:** DataTable (pagination) vs EntityTable (bulk actions) duplicate logic
```tsx
// Current:
<DataTable rows={items} columns={columns} />        // Pagination only
<EntityTable entities={items} onSelect={...} />     // Bulk actions only

// Unified:
<DataTable 
  rows={items} 
  columns={columns}
  onSelectionChange={selectedRows => ...}
  selectable={true}
  actions={[{ label: 'Delete', onClick: ... }]}
/>
```

**Implementation:**
- Merge concerns in single UnifiedDataTable
- Feature flags: selectable, sortable, filterable, paginated
- Extract to `src/components/table/DataTable.tsx`
- Update agents, tasks, approvals, workflows pages

### 3. Form Validation Hook

**Problem:** Every form re-implements validation logic
```tsx
// Current (repeated everywhere):
const [formData, setFormData] = useState({});
const [errors, setErrors] = useState({});
const handleChange = (e) => { /* validation logic */ };

// Unified:
const form = useForm({
  initialValues: { name: '', email: '' },
  validate: async (values) => { /* schema validation */ },
  onSubmit: async (values) => { /* API call */ }
});
```

**Implementation:**
- Create `src/hooks/useForm.ts` + `useFormValidation.ts`
- Support Zod/Yup for schema validation
- Integrate with all forms: agent creation, settings, onboarding
- Error UI consistent across app

### 4. Loading/Empty States

**Current:** Missing everywhere  
**Standard Pattern:**
```tsx
// Loading
<div className="space-y-4">
  {[...Array(3)].map(i => <SkeletonCard key={i} />)}
</div>

// Empty
<EmptyState 
  icon={AlertCircle} 
  title="No agents found" 
  action={{ label: 'Create agent', href: '/agents/new' }}
/>

// Error
<ErrorState 
  error="Failed to load agents"
  action={{ label: 'Retry', onClick: refetch }}
/>
```

**Implementation:**
- Create `src/components/common/Skeleton.tsx`
- Create `src/components/common/EmptyState.tsx`
- Create `src/components/common/ErrorState.tsx`
- Apply to all list pages: agents, tasks, approvals, workflows, marketplace

### 5. Mobile Responsive Breakpoints

**Current:** Limited to `md:` breakpoints only  
**Add:** `sm:` (640px) and `xs:` (full stack) support

```tsx
// Current (breaks on mobile):
<div className="flex gap-6">
  <aside className="w-72">Left</aside>
  <main className="flex-1">Center</main>
  <aside className="w-80">Right</aside>
</div>

// Mobile-responsive:
<div className="flex flex-col md:flex-row gap-6">
  <aside className="hidden md:block w-72">Left</aside>
  <main className="flex-1">Center</main>
  <aside className="hidden lg:block w-80">Right</aside>
</div>
```

**Implementation:**
- Update TenantShell for mobile
- Add hamburger menu for left rail on <768px
- Stack columns on mobile
- Collapse right panel on <1024px
- Test all pages on 375px (iPhone SE), 768px (iPad), 1024px (tablet)

### 6. Search & Filtering Architecture

**Current:** Frontend-only `.filter()` - doesn't scale  
**Target:** Server-side search + client-side filter cache

```tsx
// Reusable search hook:
const { search, setSearch, data, loading, error } = useSearch('/agents', {
  debounce: 300,
  onSearch: async (query) => {
    const res = await fetch(`/api/agents?q=${query}`);
    return res.json();
  }
});

// Usage in component:
<SearchInput value={search} onChange={setSearch} placeholder="Search agents..." />
{loading && <SkeletonTable />}
{data && <DataTable rows={data} />}
{error && <ErrorState error={error} action="Retry" />}
```

**Implementation:**
- Create `src/hooks/useSearch.ts`
- Backend: Add search endpoints for agents, workflows, tasks, approvals
- Frontend: Use on all list pages
- Add debouncing + loading indicator

---

## Design System Enhancements

### Color Palette Consistency

**Current:** Creatio palette applied; good cohesion  
**Recommendation:** Extend for additional states

```scss
// Existing (good)
$primary: #7c3aed (Violet)
$success: #10b981 (Emerald)
$warning: #f59e0b (Amber)
$error: #ef4444 (Red)

// Add
$info: #3b82f6 (Blue)
$neutral-50: #f9fafb
$neutral-900: #111827
$overlay: rgba(0, 0, 0, 0.5)
```

### Typography Consistency

**Current:** Tailwind defaults (sans-serif, dark theme)  
**Enhancement:** Define semantic classes

```tsx
// Semantic typography:
<h1 className="text-4xl font-bold">Page title</h1>     // 36px, 700
<h2 className="text-2xl font-semibold">Section</h2>    // 24px, 600
<p className="text-base font-normal">Body</p>          // 16px, 400
<small className="text-sm font-medium">Label</small>   // 14px, 500
```

### Spacing Scale

**Current:** Tailwind default (4px grid)  
**Recommendation:** Document standard patterns

```tsx
// Card padding
<div className="p-6">  // 24px (3 units)

// Gap between cards
<div className="gap-6"> // 24px

// Section margin
<div className="mt-8">  // 32px (2 units)

// Tight spacing (adjacent elements)
<div className="gap-2"> // 8px
```

---

## Accessibility Improvements

### 1. Keyboard Navigation
- [ ] Tab order logical on all pages
- [ ] Skip-to-main-content link
- [ ] Keyboard shortcuts (Cmd+K for search, Cmd+N for new)
- [ ] Arrow keys for navigation (tables, menus)

### 2. Screen Reader Support
- [ ] All icons have aria-label
- [ ] Form labels associated with inputs
- [ ] Tables have proper headers + scope
- [ ] Status indicators have text alternatives

### 3. Color Contrast
- [ ] Test with WCAG contrast checker
- [ ] Ensure 4.5:1 ratio for body text
- [ ] Don't rely on color alone (add icons/text)

### 4. Focus Management
- [ ] Focus trap in modals
- [ ] Focus restoration on close
- [ ] Visible focus indicator on all interactive elements

---

## Performance Optimization

### 1. Bundle Analysis
**Current:** No bundle tracking  
**Recommendation:** Add bundle analysis to CI/CD

```bash
npm run build -- --analyze
# Track: chunk sizes, imports, dependencies
```

### 2. Code Splitting
- [ ] Route-based code splitting (automatic via Next.js)
- [ ] Component lazy loading (heavy modals, charts)
- [ ] Dependency optimization (remove unused packages)

### 3. Image Optimization
- [ ] Use Next.js Image component
- [ ] Responsive srcset
- [ ] WebP format with fallback

### 4. Data Fetching
- [ ] Implement React Query for caching
- [ ] Pagination for large datasets
- [ ] Lazy loading for tables (virtual scroll)
- [ ] Request deduplication

---

## Testing Strategy

### Unit Tests
- [ ] Component rendering (snapshot + functional)
- [ ] Hook logic (useSearch, useForm, useValidation)
- [ ] Utility functions

### Integration Tests
- [ ] Page workflows (list → create → edit → delete)
- [ ] Form submission + validation
- [ ] Search + filtering

### E2E Tests (Playwright)
- [ ] Full user journeys (agent creation, task completion)
- [ ] Cross-browser (Chrome, Firefox, Safari)
- [ ] Mobile viewports (375px, 768px, 1024px)

### Accessibility Testing
- [ ] Lighthouse audit (run in CI)
- [ ] Manual screen reader testing
- [ ] Keyboard navigation verification

---

## Implementation Priorities

### 🔴 Critical (Start immediately)
1. Mobile responsiveness (blocking tablet/phone users)
2. Button/table consolidation (unblocks other refactors)
3. Form validation hook (reduces code duplication 50%)
4. Loading/empty states (improves UX across all pages)

### 🟡 High (Next sprint)
5. Search/filter architecture (scalability)
6. Breadcrumb navigation (clarity on detail pages)
7. Right panel context (AI insights)
8. 3-column layout standardization

### 🟢 Medium (Following sprint)
9. Kanban views (tasks, workflows)
10. Bulk actions (multi-select patterns)
11. Inline editing
12. Mobile drawer navigation

### 🔵 Low (Future enhancements)
13. Keyboard shortcuts
14. Real-time collaboration
15. Export to CSV/PDF
16. Advanced filtering UI

---

## Success Metrics

### User Experience
- [ ] Mobile device usage increases by 30%
- [ ] Time to complete task decreases by 25%
- [ ] Form submission success rate increases by 15%

### Developer Experience
- [ ] Time to add new page decreases 50% (reusable patterns)
- [ ] Code duplication drops 40%
- [ ] TypeScript errors fixed (stronger types)

### Performance
- [ ] Bundle size < 500KB (gzipped)
- [ ] First Contentful Paint < 2s
- [ ] Lighthouse score > 90 across pages

### Quality
- [ ] Test coverage > 80% (components)
- [ ] Zero a11y violations (Lighthouse)
- [ ] Mobile-friendly on all pages

---

## Appendix: File Structure Reference

### Components to Create/Modify

```
src/components/
├── common/
│   ├── Button.tsx                 [CONSOLIDATE: merge UI + ActionButton]
│   ├── Skeleton.tsx               [NEW: loading states]
│   ├── EmptyState.tsx             [NEW: empty data]
│   ├── ErrorState.tsx             [NEW: error handling]
│   ├── Breadcrumb.tsx             [NEW: navigation]
│   ├── Badge.tsx                  [STANDARDIZE: status indicators]
│   └── Card.tsx                   [STANDARDIZE: container]
├── table/
│   ├── DataTable.tsx              [MERGE: DataTable + EntityTable]
│   ├── BulkActionBar.tsx          [NEW: multi-select actions]
│   └── ColumnHeader.tsx           [NEW: sortable headers]
├── form/
│   ├── FormField.tsx              [NEW: reusable field wrapper]
│   ├── FormError.tsx              [NEW: error display]
│   └── FormLayout.tsx             [NEW: consistent form structure]
├── filter/
│   ├── FilterPanel.tsx            [NEW: sidebar filters]
│   ├── FilterChip.tsx             [NEW: filter tags]
│   └── FilterButton.tsx           [NEW: filter toggle]
├── home/
│   ├── ~~LeftPanel.tsx~~          [DELETED in FIX-021 — navigation moved to IconRail]
│   ├── RightPanel.tsx             [UPDATE: add context awareness]
│   ├── SkeletonWidget.tsx         [NEW: loading state for widgets]
│   └── WidgetContext.tsx          [NEW: context-specific widgets]
└── TenantShell.tsx                [UPDATE: add sm: breakpoints]

src/hooks/
├── useSearch.ts                   [NEW: server-side search]
├── useForm.ts                     [NEW: form management]
├── useFormValidation.ts           [NEW: reusable validation]
├── useDataTable.ts                [NEW: table state management]
├── useBulkActions.ts              [NEW: multi-select logic]
└── useFilterPanel.ts              [NEW: filter state]

src/lib/
├── formValidation.ts              [NEW: schema definitions]
├── tableHelpers.ts                [NEW: sort, filter utilities]
└── componentHelpers.ts            [NEW: reusable UI logic]
```

### Pages to Update

```
/home                              [✅ Phase 6 done; needs real data]
/command-center                    [⚠️ Standardize layout + search]
/service-desk                      [⚠️ Unify cards + search]
/agents                            [⚠️ Single table + filters]
/agents/[id]                       [⚠️ 3-column + tabs + breadcrumb]
/workflows                         [⚠️ Table + filters + wizard]
/workflows/[id]                    [⚠️ 3-column + tabs]
/tasks                             [⚠️ Kanban + filters]
/tasks/[id]                        [⚠️ 3-column + details]
/approvals                         [⚠️ Table + timeline view]
/marketplace                       [⚠️ Responsive grid + search]
/settings/wizard/[slug]            [✅ Good; pattern to replicate]
```

---

## Conclusion

The frontend-tenant application has a **solid design foundation** with Creatio-inspired aesthetics and consistent component patterns. However, achieving **optimal user experience**, **developer velocity**, and **scalability** requires systematic refactoring across four areas:

1. **Component Consolidation** - Eliminate dual systems (buttons, tables, search)
2. **Mobile Responsiveness** - Add breakpoints; support all device sizes
3. **Data Display Standards** - Loading, empty, error states + search/filter
4. **Layout Standardization** - 3-column pattern for detail pages; hub pattern for listings

By following this roadmap over 12 phases, the application will become a **reference implementation** for modern, accessible, scalable SaaS design.

---

## Appendix A — Defensive patterns (added 2026-07-07 from FIX-019)

The 12-phase refactor roadmap above addresses design and UX. Separately, FIX-019 surfaced **three runtime defensive patterns** that every component must follow:

### A.1 Unguarded array access on persisted Zustand stores

A page that reads `useTaskStore((s) => s.tasks)` and calls `tasks.filter(...)` will crash with `TypeError: can't access property "length", n is undefined` if the persisted `tasks` value is corrupted. The crash appears as a generic error UI and erodes user trust.

**Mandatory pattern:**
```tsx
const tasksRaw = useTaskStore((s) => s.tasks);
const tasks = Array.isArray(tasksRaw) ? tasksRaw : [];
// Then use `tasks` — never the raw value.
```

**Defence-in-depth:** every persisted store must also have a `merge` function that sanitizes the persisted state on hydration. See [fixes.md §Defensive patterns cheat sheet](fixes.md#defensive-patterns-cheat-sheet-from-fix-018--fix-019).

**Coverage target:** every component that reads from a persisted store (current count: 9 fixed in FIX-019, full list in [frontend-tenant.md §19](frontend-tenant.md#19-defensive-patterns-zustand-merge--ui-guards-fix-019)). Add a lint rule (D15 in [pending-tasks.md](pending-tasks.md)) to enforce this in CI.

### A.2 WebSocket URL fallback

`services/socket.ts` must not fall back to `localhost:3000` when `NEXT_PUBLIC_SOCKET_URL` is missing. The browser running the production build cannot reach `localhost:3000` and silently fails with cryptic console errors.

**Mandatory pattern:** derive from `window.location` (same-origin wss in production, ws in dev). See [operations.md §6.5](operations.md#65-never-hardcode-localhost3000-in-production-code).

### A.3 `<Link>` must have a page

TopBar.tsx had `<Link href="/help">` but no `/help` page existed. Next.js prefetches on viewport/hover, producing 404 noise in the network tab. FIX-019 added a real `/help` page. The rule for new `<Link>` elements: create the page in the same commit, or change the link to a `<button>` with a real handler.

### A.4 Loading skeleton during auth hydration (not `return null`)

Pages that gate on `useTenantAuth()` must not return `null` while the Zustand `persist` middleware rehydrates from localStorage — the user sees a blank screen for 50-500ms. Show a spinner instead. See [fixes.md FIX-018 §Fix #4](fixes.md#fix-018--home-page-slow-load-duplicate-api-calls-redundant-fetches-blank-auth-hydration).

### A.5 Loading states, not "no data yet", when data is in flight

`StatsWidget` previously showed "No data yet" with no loading indicator when `command-center/summary` hadn't returned yet. Users couldn't tell if the data was loading or actually empty. Mandatory pattern: when reading from a store that hasn't been hydrated, show a contextual loading message ("Waiting for workspace data...", "Watching for activity...") instead of an "empty" message.

These patterns complement the 12-phase roadmap. They should be added to the onboarding checklist for new frontend contributors and enforced via lint rules where possible.

---

**Document Version:** 1.1
**Last Updated:** 2026-07-07
**Maintained By:** Design & Engineering leads
**Next Review:** After Phase 7 implementation (2 weeks)
