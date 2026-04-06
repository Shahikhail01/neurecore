# AI Agent Prompt: UI Restyle Implementation Plan

## Context

You are tasked with creating a detailed implementation plan for restyling the `frontend-tenant` application to match the visual designs in `/memory-bank/ui/Images/`.

## Project Structure

```
/mnt/data/Web Dev/NeureCore/
├── frontend-tenant/          # Main application (Next.js)
│   ├── src/
│   │   ├── app/              # Next.js App Router pages
│   │   ├── components/       # Shared UI components
│   │   │   ├── ai/           # AI components (AIResponseCard, KPIMiniTile, ChatInput)
│   │   │   ├── layout/       # Layout components (PageHeader, PageContent, SectionCard, TabNav, TwoColumnLayout)
│   │   │   ├── shell/        # Shell components (AppShell)
│   │   │   └── ui/           # Radix/shadcn primitives
│   │   ├── features/         # Feature-specific components
│   │   │   ├── dashboard/
│   │   │   ├── agents/
│   │   │   ├── ai-chat/
│   │   │   └── org-chart/
│   │   ├── stores/           # Zustand stores (unchanged)
│   │   ├── core/             # Services and business logic (unchanged)
│   │   ├── shared/           # Shared hooks and services
│   │   └── lib/              # Utilities
│   └── tailwind.config.js   # Tailwind configuration
├── memory-bank/
│   └── ui/
│       ├── plan.md           # Existing UI plan (reference)
│       └── Images/           # Reference screenshots
```

## Reference Documents

1. **Existing UI Plan:** [`memory-bank/ui/plan.md`](memory-bank/ui/plan.md) — Contains detailed design system specs, component architecture, and phased approach
2. **Reference Images:** [`memory-bank/ui/Images/`](memory-bank/ui/Images/) — Contains visual mockups for:
   - Dashboard screens
   - Agent management screens
   - Task management screens
   - Industry-specific screens (manufacturing, marketing, sales, service)

## Current State

The following components have already been created as part of the initial restyle:

### Shell Components

- [`frontend-tenant/src/components/shell/AppShell.tsx`](frontend-tenant/src/components/shell/AppShell.tsx) — Main layout shell
- [`frontend-tenant/src/components/layout/TwoColumnLayout.tsx`](frontend-tenant/src/components/layout/TwoColumnLayout.tsx) — Two-column layout

### AI Components

- [`frontend-tenant/src/components/ai/AIResponseCard.tsx`](frontend-tenant/src/components/ai/AIResponseCard.tsx) — AI response card with violet accent
- [`frontend-tenant/src/components/ai/KPIMiniTile.tsx`](frontend-tenant/src/components/ai/KPIMiniTile.tsx) — Mini KPI tile
- [`frontend-tenant/src/components/ai/ChatInput.tsx`](frontend-tenant/src/components/ai/ChatInput.tsx) — Chat input component

### Layout Components

- [`frontend-tenant/src/components/layout/PageHeader.tsx`](frontend-tenant/src/components/layout/PageHeader.tsx) — Page header
- [`frontend-tenant/src/components/layout/PageContent.tsx`](frontend-tenant/src/components/layout/PageContent.tsx) — Page content wrapper
- [`frontend-tenant/src/components/layout/SectionCard.tsx`](frontend-tenant/src/components/layout/SectionCard.tsx) — Section card
- [`frontend-tenant/src/components/layout/TabNav.tsx`](frontend-tenant/src/components/layout/TabNav.tsx) — Tab navigation

### Dashboard Feature Components

- [`frontend-tenant/src/features/dashboard/components/DashboardHero.tsx`](frontend-tenant/src/features/dashboard/components/DashboardHero.tsx) — Dashboard hero
- [`frontend-tenant/src/features/dashboard/components/DashboardKPIRow.tsx`](frontend-tenant/src/features/dashboard/components/DashboardKPIRow.tsx) — KPI row
- [`frontend-tenant/src/features/dashboard/components/ActiveAgentsGrid.tsx`](frontend-tenant/src/features/dashboard/components/ActiveAgentsGrid.tsx) — Active agents grid
- [`frontend-tenant/src/features/dashboard/components/UpcomingTasksList.tsx`](frontend-tenant/src/features/dashboard/components/UpcomingTasksList.tsx) — Upcoming tasks
- [`frontend-tenant/src/features/dashboard/components/RecentActivityFeed.tsx`](frontend-tenant/src/features/dashboard/components/RecentActivityFeed.tsx) — Recent activity

### Org Chart Components

- [`frontend-tenant/src/features/org-chart/components/OrgChartNode.tsx`](frontend-tenant/src/features/org-chart/components/OrgChartNode.tsx) — Org chart node

### Task Page

- [`frontend-tenant/src/app/(app)/tasks/[id]/page.tsx`](<frontend-tenant/src/app/(app)/tasks/[id]/page.tsx>) — Task detail page

## Your Task

Create a comprehensive **Implementation Plan** (as a Markdown file) that addresses:

### 1. Design Token Migration (Phase A)

- Document how to bridge CSS variables to Tailwind tokens
- Specify color tokens (surface, brand, text, status)
- Document typography scale
- Document spacing and radius tokens
- Document shadow/elevation tokens
- Document motion tokens

### 2. Component Mapping

- Map existing components to their new design tokens
- Identify inline hex values that need replacement
- Specify which components need full restyle vs. token swap

### 3. Page-by-Page Migration Plan

For each page in the application:

- Current state analysis
- Target visual state (based on reference images)
- Required changes
- Dependencies (what must be done first)
- Estimated effort

### 4. Shell Component Requirements

- Document what new shell components are needed
- Specify props interfaces
- Document state management approach
- Define breakpoints and responsive behavior

### 5. Integration Points

- Document how existing hooks connect to new components
- Document service integration
- Document store connections

### 6. Testing Requirements

- Visual regression testing approach
- Accessibility testing requirements
- Performance benchmarks

### 7. Rollout Strategy

- Phased rollout plan
- Feature flags needed
- Rollback strategy

## Output Format

Create a Markdown file at `/mnt/data/Web Dev/NeureCore/plans/ui-restyle-implementation-plan.md` with:

1. **Executive Summary** — Brief overview of the restyle effort
2. **Current State Assessment** — What's done, what's remaining
3. **Design System Specification** — Detailed token definitions
4. **Component Migration Matrix** — Page-by-page breakdown
5. **Implementation Timeline** — Phased approach with dependencies
6. **Risk Assessment** — Potential issues and mitigations
7. **Success Metrics** — How to measure success

## Constraints

- Preserve all business logic (stores, services, hooks remain unchanged)
- Maintain backward compatibility with existing routes
- Ensure accessibility compliance (WCAG 2.1 AA)
- Support theme switching (dark/light/high-contrast)
- Do not break authentication flow

## Reference the Following Existing Files

- Tailwind config: [`frontend-tenant/tailwind.config.js`](frontend-tenant/tailwind.config.js)
- Existing UI plan: [`memory-bank/ui/plan.md`](memory-bank/ui/plan.md)
- Agent store: [`frontend-tenant/src/stores/agentStore.ts`](frontend-tenant/src/stores/agentStore.ts)
- Task store: [`frontend-tenant/src/stores/taskStore.ts`](frontend-tenant/src/stores/taskStore.ts)
- UI preferences store: [`frontend-tenant/src/shared/stores/uiPreferencesStore.ts`](frontend-tenant/src/shared/stores/uiPreferencesStore.ts)
