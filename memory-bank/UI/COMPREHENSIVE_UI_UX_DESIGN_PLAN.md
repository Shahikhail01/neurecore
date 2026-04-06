# NeureCore: Comprehensive UI/UX Design Plan

## Creatio-Inspired Operating System for AI Agents

**Status:** Design & Planning Phase (No Implementation)  
**Date:** April 6, 2026  
**Version:** 2.0

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Design Vision & Principles](#design-vision--principles)
3. [UI/UX Research & Inspiration](#uiux-research--inspiration)
4. [Design System Architecture](#design-system-architecture)
5. [Component Library & Reuse Strategy](#component-library--reuse-strategy)
6. [Feature-to-UI Mapping](#feature-to-ui-mapping)
7. [Home Screen Design](#home-screen-design)
8. [Multi-Agent Chat System](#multi-agent-chat-system)
9. [Telegram Integration for Offline Notifications](#telegram-integration-for-offline-notifications)
10. [Light/Dark Mode Implementation](#lightdark-mode-implementation)
11. [Accessibility & Internationalization](#accessibility--internationalization)
12. [Implementation Roadmap](#implementation-roadmap)
13. [Code Reuse Analysis](#code-reuse-analysis)
14. [Migration & Rollout Strategy](#migration--rollout-strategy)

---

## Executive Summary

### What We're Building

A **modern, Creatio-inspired UI/UX for NeureCore's frontend-tenant** that transforms the platform from a developer-friendly dashboard into a **conversational, intuitive operating system for managing AI agents as digital employees**.

### Key Design Goals

1. **Conversational-First Interface**: Make chat and command inputs the primary interaction paradigm
2. **Clear Information Hierarchy**: Each screen surfaces the most actionable items front-and-center
3. **Persistent Connectivity**: Keep team members (AI agents) and notification channels always accessible
4. **Role-Based Experiences**: Different UI surfaces for operators, supervisors, and agents
5. **Themeable & Accessible**: Light/dark modes with WCAG AA compliance throughout
6. **Intelligent Offline Handling**: Use Telegram to bridge gaps when users are offline

### What We're Borrowing from Creatio

- **Visual Language**: Clean vertical navigation, scenic heroes, frosted glass panels, high-contrast CTAs
- **Interaction Patterns**: Channel-based messaging, grouped nav sections, card-based dense dashboards
- **Information Architecture**: Department/role-based navigation, quick access to critical actions, status indicators
- **Messaging UX**: Rich message rendering (tables, metrics, suggested actions), streaming responses, presence

### Core Differentiators for NeureCore

Unlike CRM software, NeureCore surfaces **AI agent teams as the primary actors**. Navigation reflects:

- **Departments** (organizational structure) as first-class nav items
- **Agent Channels** (All Agents, by department, by skill, direct messages) in the chat interface
- **Agent Authority & Approval Workflows** (Assist, Copilot, Autopilot modes) in the top bar
- **Cost & Performance Insights** for each agent visible in the chat and dashboard

---

## Design Vision & Principles

### Principle 1: Clarity & Actionability

Every screen should make the next action obvious. Navigation breadcrumbs, quick-links, and CTA buttons guide users from discovery → engagement → delegation.

### Principle 2: Conversational-First

Chat and command inputs are not secondary—they're primary interaction surfaces. Users should feel like they're talking to their team (humans + agents), not filling out forms.

### Principle 3: Responsive & Progressive

- **Desktop (primary)**: Full chrome with sidebar, chat panel, dashboard
- **Tablet**: Collapsible sidebar, bottom sheet chat
- **Mobile**: Bottom navigation, modal chat
- **Feature progression**: Basic chat on mobile → rich channels + threads on desktop

### Principle 4: Agents as Social Entities

Agents appear as contacts with avatars, status/presence indicators, and role labels. Messages from agents show their personality, authority level, and contextual metadata (execution time, cost, outcome).

### Principle 5: Themeable & Accessible

- CSS variable-based tokens for runtime light/dark switching
- WCAG AA minimum for all color pairs
- Full keyboard navigation for all interactive elements
- Semantic HTML + ARIA labels

### Principle 6: Trust Through Transparency

- Every agent action is logged, traced, and auditable
- Decision trees and execution paths are visualizable
- Costs, token usage, and execution times are always visible
- Approval workflows are clear and unambiguous

---

## UI/UX Research & Inspiration

### Creatio Design Patterns Observed

#### 1. **Home Screen (Hero Pattern)**

- Full-bleed scenic background (gradient or image)
- Centered greeting: "Hello, <name>! Friday, 09:00 PM"
- Large command/text input with placeholder: "Message to Creatio.ai"
- Subtle metadata: current date, time, brief status
- **Adaptation for NeureCore**: Show next scheduled agent tasks, recent approvals, or team status

#### 2. **Vertical Navigation (Sidebar)**

- Compact icons with text labels side-by-side
- Grouped sections: Home, Team, Work, Insights, Configure
- Collapsible sub-trees within each group
- Active state indicator (colored bar or background)
- Bottom section: user avatar, settings dropdown
- **Adaptation for NeureCore**: Departments as collapsible trees, direct messages as a group, agent status indicators

#### 3. **Top Bar (Header)**

- Logo + app breadcrumb on the left
- Search/command input in the center (secondary search, global only)
- Right side: notifications, help, settings, theme toggle, user menu
- Sticky and always accessible
- **Adaptation for NeureCore**: Add autonomy level selector (Assist/Copilot/Autopilot), quick agent status summary

#### 4. **Chat/Forecast Panel (Slide-Out)**

- Persistent, docked to the right side (or modal on mobile)
- Translucent frosted glass background (glassmorphism)
- Compact message list with avatars, timestamps, action buttons
- Forecast/summary cards with metrics
- Message input at the bottom
- Context badge (Agent X, Department Y, Direct)
- **Adaptation for NeureCore**: Show multi-channel chat, agent activity feed, approval queue in the same panel

#### 5. **Data Tables & Dashboards**

- Compact typography, tight spacing, high information density
- Hierarchical row layouts (expandable parent/child categories)
- Color-coded status badges (green=success, orange=pending, red=error)
- Inline edit capability and quick actions
- Sortable and filterable columns
- **Adaptation for NeureCore**: Show agent execution logs, task queues, department metrics in table form

#### 6. **Detail Views & Workflows**

- Sidebar for context metadata (contact info, linked records)
- Main panel with tabbed sections (General Info, Attachments, Feed, History)
- Horizontal workflow stage indicator at the top (New → In Progress → Under Review → Approved → Completed)
- Suggested next actions and related records
- **Adaptation for NeureCore**: Agent execution detail view with decision tree, approval workflow stage, linked tasks/approvals

### Creatio Visual Language

| Element               | Light Theme         | Dark Theme             | Use Case                               |
| --------------------- | ------------------- | ---------------------- | -------------------------------------- |
| **Surface (Base)**    | #ffffff             | #09090b                | Main content areas                     |
| **Surface (Raised)**  | #f8f9fb             | #111113                | Cards, panels, overlays                |
| **Surface (Overlay)** | rgba(15,23,42,0.04) | rgba(255,255,255,0.02) | Hover states, subtle backgrounds       |
| **Border**            | #e6e7eb             | #27272a                | Section dividers, input borders        |
| **Text (Primary)**    | #0f1720             | #e6e6e9                | Main content, headers                  |
| **Text (Secondary)**  | #6b7280             | #9ca3af                | Metadata, hints, disabled states       |
| **Accent (Primary)**  | #6d28d9             | #7c3aed                | CTAs, active states, highlights        |
| **Accent (Hover)**    | #5b21b6             | #6d28d9                | Interactive element hover              |
| **Success**           | #16a34a             | #22c55e                | Approved, completed, success           |
| **Warning**           | #f59e0b             | #fbbf24                | Pending, warning, retry needed         |
| **Danger**            | #ef4444             | #ff6b6b                | Error, blocked, urgent approval needed |

Typography:

- **Headings** (H1–H3): 24px, 20px, 18px; font-weight 600–700
- **Body text**: 14px–16px; font-weight 400
- **Small/metadata**: 12px–13px; font-weight 400; color: secondary
- **Font family**: Inter, -apple-system, BlinkMacSystemFont, sans-serif

Spacing & Layout:

- **Base unit**: 4px
- **Padding**: 8px (xs), 12px (sm), 16px (md), 24px (lg), 32px (xl)
- **Border radius**: 6px (small), 8px (medium), 12px (large)
- **Shadow**: subtle (0 1px 2px rgba(0,0,0,0.08)), medium (0 4px 8px rgba(0,0,0,0.12))

---

## Design System Architecture

### Goals

- Single source of truth for colors, typography, spacing
- Runtime theme switching without page reload
- Consistency across frontend-admin and frontend-tenant
- Easy dark/light mode toggle
- Accessible color pairings (WCAG AA compliance)

### Implementation Strategy: CSS Variables + Tailwind

#### File Structure

```
frontend-tenant/
├── src/
│   ├── styles/
│   │   ├── design-tokens.css          (CSS variables for light + dark themes)
│   │   ├── globals.css                (imports design-tokens.css)
│   │   └── README_TOKENS.md           (token documentation)
│   ├── hooks/
│   │   └── useTheme.ts                (theme toggle logic)
│   ├── components/
│   │   ├── layout/
│   │   │   ├── ThemeToggle.tsx        (UI control for light/dark switch)
│   │   │   └── ...existing components
│   │   └── ...
│   └── app/
│       ├── globals.css
│       ├── layout.tsx                 (inject theme script)
│       └── ...pages
├── tailwind.config.js                 (map colors to CSS variables)
└── package.json
```

#### CSS Variables Specification (design-tokens.css)

**Light Theme** (`:root` or `.theme-light`):

```css
:root {
  /* Surface colors */
  --surface-base: #ffffff;
  --surface-raised: #ffffff;
  --surface-overlay: rgba(15, 23, 42, 0.04);
  --surface-border: #e6e7eb;

  /* Text colors */
  --text-primary: #0f1720;
  --text-secondary: #6b7280;
  --text-muted: #7b8087;

  /* Accent colors */
  --accent-primary: #6d28d9;
  --accent-600: #5b21b6;
  --accent-50: #ede9fe;

  /* Status colors */
  --success: #16a34a;
  --success-light: #dcfce7;
  --warning: #f59e0b;
  --warning-light: #fef3c7;
  --danger: #ef4444;
  --danger-light: #fee2e2;

  /* Additional utility colors */
  --neutral-100: #f3f4f6;
  --neutral-200: #e5e7eb;
  --neutral-300: #d1d5db;
  --neutral-400: #9ca3af;
  --neutral-500: #6b7280;
  --neutral-600: #4b5563;
  --neutral-700: #374151;

  /* Shadows */
  --shadow-xs: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.08);
  --shadow-md: 0 4px 8px 0 rgba(0, 0, 0, 0.12);
  --shadow-lg: 0 10px 20px 0 rgba(0, 0, 0, 0.15);
}
```

**Dark Theme** (`.theme-dark`):

```css
.theme-dark {
  /* Surface colors */
  --surface-base: #09090b;
  --surface-raised: #111113;
  --surface-overlay: rgba(255, 255, 255, 0.02);
  --surface-border: #27272a;

  /* Text colors */
  --text-primary: #e6e6e9;
  --text-secondary: #9ca3af;
  --text-muted: #71717a;

  /* Accent colors */
  --accent-primary: #7c3aed;
  --accent-600: #6d28d9;
  --accent-50: #4c1d95;

  /* Status colors */
  --success: #22c55e;
  --success-light: #065f46;
  --warning: #fbbf24;
  --warning-light: #78350f;
  --danger: #ff6b6b;
  --danger-light: #7f1d1d;

  /* ... and so on ... */
}
```

#### Tailwind Configuration (tailwind.config.js excerpt)

```js
module.exports = {
  theme: {
    colors: {
      transparent: "transparent",
      white: "#ffffff",
      black: "#000000",
      surface: {
        base: "var(--surface-base)",
        raised: "var(--surface-raised)",
        overlay: "var(--surface-overlay)",
        border: "var(--surface-border)",
      },
      text: {
        primary: "var(--text-primary)",
        secondary: "var(--text-secondary)",
        muted: "var(--text-muted)",
      },
      accent: {
        primary: "var(--accent-primary)",
        600: "var(--accent-600)",
        50: "var(--accent-50)",
      },
      status: {
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
      },
      // ... etc
    },
    extend: {
      spacing: {
        xs: "0.5rem", // 8px
        sm: "0.75rem", // 12px
        md: "1rem", // 16px
        lg: "1.5rem", // 24px
        xl: "2rem", // 32px
      },
      borderRadius: {
        sm: "0.375rem", // 6px
        md: "0.5rem", // 8px
        lg: "0.75rem", // 12px
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },
    },
  },
};
```

### Theme Toggle Implementation

**Hook** (`src/hooks/useTheme.ts`):

```ts
import { useEffect, useState } from "react";

export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [mounted, setMounted] = useState(false);

  // Initialize from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const isDark =
      stored === "dark" ||
      (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches);
    setTheme(isDark ? "dark" : "light");
    setMounted(true);
  }, []);

  // Apply theme to document
  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    root.classList.remove("theme-light", "theme-dark");
    root.classList.add(theme === "dark" ? "theme-dark" : "theme-light");
    localStorage.setItem("theme", theme);
  }, [theme, mounted]);

  return { theme, setTheme, mounted };
}
```

**Component** (`src/components/layout/ThemeToggle.tsx`):

```tsx
import { useTheme } from "@/hooks/useTheme";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme, mounted } = useTheme();

  if (!mounted) return null;

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-surface-overlay transition-colors"
    >
      {theme === "dark" ? (
        <Sun className="w-4 h-4 text-accent-primary" />
      ) : (
        <Moon className="w-4 h-4 text-accent-primary" />
      )}
    </button>
  );
}
```

---

## Component Library & Reuse Strategy

### Current Codebase Inventory

**Existing components** in `frontend-tenant/src/components/`:

- `TenantShell.tsx` — main layout orchestrator
- `layout/TopBar.tsx` — header with title, autonomy selector, theme toggle
- `layout/InspectorPanel.tsx` — right-side context/details panel
- `command-palette/CommandPalette.tsx` — global command interface
- `chat/ConversationPanel.tsx` — multi-turn chat with streaming
- `dashboard/` — KPI cards, charts, metric displays
- `agent-card/` — individual agent card UI
- `data-table/` — generic table renderer
- `kpi/` — metric displays and status badges
- `ui/` — basic Radix UI wrapper components

### Reuse vs. Implementation Decision Matrix

| Component                    | Current State           | Decision              | Rationale                                                        |
| ---------------------------- | ----------------------- | --------------------- | ---------------------------------------------------------------- |
| **Sidebar / Navigation**     | Embedded in TenantShell | Extract + Refactor    | Current hard-coded; extract to composable, collapsible component |
| **TopBar / Header**          | Basic, functional       | Extend + Enhance      | Add theme toggle, agent status summary, quick links              |
| **Command Palette**          | Exists, working         | Reuse + Extend        | Add multi-channel command context (all agents, dept, direct)     |
| **Chat Panel**               | Exists, single-channel  | Consolidate + Enhance | Merge admin & tenant versions, add channels, presence, threads   |
| **KPI / Card Components**    | Exists, styled          | Refactor to Tokens    | Update colors to use CSS variables, ensure accessibility         |
| **Agent Card**               | Basic                   | Reuse + Iterate       | Keep structure, improve hover states and status indicators       |
| **Data Tables**              | Functional              | Refactor to Tokens    | Ensure borders, text colors use design tokens                    |
| **HomeScreen / Hero**        | Doesn't exist           | Implement New         | Build scenic hero with greeting, quick links, command input      |
| **Department Org Chart**     | Doesn't exist           | Implement New         | Render hierarchical dept tree with drag-to-reorder option        |
| **Workflow Stage Indicator** | Doesn't exist           | Implement New         | Horizontal progress bar showing approval stages                  |
| **Agent Presence / Status**  | Basic avatar            | Enhance UI            | Add status indicators (online, busy, offline), last activity     |
| **Approval Card / Widget**   | Partial                 | Refactor              | Clear CTA, brief context, approve/reject/preview actions         |

### Component Architecture Plan

#### Layout Components (`src/components/layout/`)

**Sidebar** (New extraction)

- Props: `groups: NavigationGroup[]`, `activeItem: string`, `isCollapsed: boolean`
- Features: Icon + label, collapsible groups, active state indicator, user profile section
- Styling: CSS variables for colors, smooth collapse animation
- Responsive: Collapses to icon-only bar on < 768px

**TopBar**

- Props: `title: string`, `autonomyLevel: 'assist'|'copilot'|'autopilot'`, `onAutonomyChange: (level) => void`
- Features: Title display, autonomy level selector, theme toggle, user menu, notifications indicator
- Styling: Use CSS variables, sticky positioning
- Responsive: Hide autonomy selector on mobile, condense user info

**InspectorPanel**

- Props: `entity: Agent | Task | Approval`, `onClose: () => void`
- Features: Context metadata, related items, action buttons
- Styling: Slide-out panel from right edge, glassmorphic background
- Responsive: Full-width modal on mobile

#### Chat Components (`src/components/chat/`)

**ChatPanel** (Consolidated)

- Props: `channels: Channel[]`, `activeChannel: Channel`, `messages: Message[]`, `isLoading: boolean`, `onSendMessage: (text) => void`, `onChannelChange: (channel) => void`
- Features: Channel selector (tabs or dropdown), message list (with streaming), message input, presence indicators, suggested actions
- Styling: Persistent right panel on desktop, bottom sheet on tablet, full-screen modal on mobile
- Accessibility: Keyboard nav (arrow keys for channels, Tab to input, Enter to send)

**MessageRenderer**

- Props: `message: Message`, `showAvatar: boolean`
- Renders: Agent identity, timestamp, message content (text, suggestions, inline tables, metrics)
- Features: Copy-to-clipboard, react with emoji, share/forward actions

**SuggestedActions**

- Props: `actions: SuggestedAction[]`, `onAction: (actionId) => void`
- Renders: Pill buttons with icon + label or inline confirmation dialogs

#### Dashboard Components (`src/components/dashboard/`)

**HomeScreen** (New)

- Props: `user: User`, `recentTasks: Task[]`, `agentStatus: AgentStatus[]`, `upcomingApprovals: Approval[]`
- Structure:
  - Hero section (greeting + scenic background + command input)
  - Quick links grid (4–6 major actions)
  - Recent activity section (tasks, approvals, agent messages)
  - Agent status panel (online agents, upcoming tasks)
- Styling: Full-bleed hero, card-based sections below with generous whitespace

**AgentCard**

- Props: `agent: Agent`, `showStatus: boolean`, `onClick: () => void`
- Features: Avatar, name, role, status indicator (online/busy/offline), recent activity count
- Styling: Hover effects, transitions

**ApprovalCard**

- Props: `approval: Approval`, `onApprove: () => void`, `onReject: () => void`
- Features: Compact context, approval count/importance indicator, brief description, CTA buttons
- Styling: Color-coded by priority (green=low, orange=medium, red=high)

**MetricCard**

- Props: `label: string`, `value: number | string`, `format: string`, `trend?: 'up'|'down'|'neutral'`, `icon: ReactNode`
- Renders: Large metric display with optional trend arrow
- Styling: Use accent colors for emphasis

#### Shared UI Components (`src/components/ui/`)

**Button, Input, Badge, Dialog, Modal, etc.**

- Radix UI based primitives wrapped with token colors
- Props: `variant` (primary/secondary/danger), `size` (xs/sm/md/lg)
- Styling: CSS variable colors, smooth transitions

### Storybook-Style Showcase (Future)

Once components are stable, create a Storybook or similar component showcase for QA and team collaboration. Document expected behaviors, edge cases, and theme variations.

---

## Feature-to-UI Mapping

### Department Management

**UI Location**: Left sidebar, beneath "Home" section

**Components**:

- **DepartmentTree** (new component)
  - Nested list of departments with expand/collapse toggle
  - Drag-to-reorder within hierarchy (future phase)
  - Shows department head agent as a small avatar badge
  - Shows unread task count per department
  - Clicking a dept highlights it and filters chat channels + tasks

- **DepartmentDetail** (overlay or inspector)
  - Dept name, head agent, budget allocation
  - List of agents in dept
  - Recent activities / KPIs for dept

**Interactions**:

- Hover a dept → show tooltip with head agent info
- Right-click dept → context menu (edit, delete, view agents, view budget)
- Drag dept → reorder in hierarchy (after initial phase)

### Agent Management & Status

**UI Location**: Right panel (via chat) + sidebar sections

**Components**:

- **AgentStatusPanel** (new)
  - Grid or list of agents with status indicators
  - Color-coded: green (online), amber (busy), gray (offline), red (error/failed)
  - Shows last activity timestamp, current task (if any)
  - Clicking agent → opens direct message channel in chat

- **AgentBriefCard**
  - Compact card (avatar, name, status, role, action button)
  - Used in lists, quick-link grids, and in chat channel headers

**Interactions**:

- Click agent → open direct message channel
- Right-click agent → view full profile, see execution log, view permissions
- Agent status auto-updates via WebSocket (or polling)

### Tasks & Workflow

**UI Location**: Left sidebar → "Work" → "Tasks"

**Components**:

- **TaskList** (table-based)
  - Columns: Task ID, assigned agent(s), status (new/in-progress/completed), due date, assigned by
  - Filterable by: agent, status, priority, assigned to me
  - Sortable by: due date, priority, created date
  - Rows are clickable → task detail view

- **TaskDetailView** (new modal or page)
  - Task metadata (ID, created by, created date, priority, budget allocated)
  - Description and related documents/attachments
  - Workflow stage indicator (New → Assigned → In Progress → Under Review → Completed)
  - Agent execution log (what did the agent do? decisions made, tool calls, outcome)
  - Approval workflow (if applicable): shows who needs to approve, current approvers' status
  - Comments / activity feed

**Interactions**:

- Create task: Quick link in home → modal or dedicated page
- Assign to agent: Dropdown selector with agent avatars
- Approve/reject: Large CTA buttons in detail view
- Inline edit fields (description, priority, deadline) with auto-save

### Approvals & Governance

**UI Location**: Left sidebar → "Home" → "Approvals" (with badge count)

**Components**:

- **ApprovalQueue** (table or card grid)
  - Each approval card shows:
    - Initiator info (agent or human who initiated)
    - Context snippet (what is being approved? e.g., "Send 500 emails to leads")
    - Priority indicator (color-coded)
    - Approval chain: Shows who has approved, who's pending, who rejected
    - Action buttons: Approve/Reject/Preview
  - Filterable by: initiator, status, priority, created date
  - Sortable: default by priority desc, then by age

- **ApprovalDetailView**
  - Full context of what's being approved
  - Request reasoning from the agent
  - Related records (task, agent, execution log)
  - Approval workflow stage: multi-step approval if needed
  - Comments from other approvers
  - Approve/Reject/Request Changes buttons

**Interactions**:

- Quick approve: Click "Approve" on card (or long-form approve in detail view)
- Bulk approve: Checkboxes to select multiple, batch action button
- View execution log: Show agent's reasoning and decisions
- Deny with comment: Free-text explanation for rejection

### Analytics & Insights

**UI Location**: Left sidebar → "Insights" → "Analytics"

**Components**:

- **AnalyticsDashboard** (page)
  - KPI cards at the top (total agents, active tasks, pending approvals, avg. execution cost)
  - Charts below: Agent utilization over time, cost by agent/dept, approval turnaround times, task completion rates
  - Filterable by: date range, department, agent, approval status
  - Zoomable/expandable charts

- **CostAnalytics** (detailed page)
  - Per-agent cost breakdown (tokens, API calls, execution time)
  - Per-task cost summary
  - Cost trend graph
  - Budget alerts (if dept/agent approaching limit)

**Interactions**:

- Click KPI card → drill down to detail view
- Hover chart → show tooltip with exact values
- Click legend item → toggle data series visibility

### Chat & Communication

**See detailed section below: "Multi-Agent Chat System"**

---

## Home Screen Design

### Visual Structure

#### Full-Bleed Hero Section

- **Background**: Scenic gradient or image (similar to `Home_screenx.png`)
  - Light theme: Blue-to-purple gradient with nature scene
  - Dark theme: Deep purple-to-navy with subtle texture
  - Overlay: Optional semi-transparent dark/light overlay for text contrast
- **Centered Content**:
  - Greeting: "Hello, <first name>!" (24px, font-weight 600)
  - Timestamp: "Friday, 09:00 PM" (14px, secondary text color)
  - Central Command Input: Prominent search/message box
    - Placeholder: "Message NeureCore or ask a question..."
    - Icon: Message/chat bubble on left, search icon on right
    - On focus: Expand slightly, show recent suggestions (agents, quick commands)
    - Full width (300–600px depending on viewport)

#### Quick Links Section

Below hero, 2–4 rows of 4–6 quick-access cards:

**Suggested Quick Links**:

1. **New Task** — Create and assign a new task to an agent
2. **View Approvals** — Jump to pending approvals (shows count badge)
3. **Agent Status** — See all agents and their current activity
4. **View Departments** — Navigate to department overview
5. **Analytics Dashboard** — Quick link to KPIs and insights
6. **Settings** — Access account, integrations, preferences

Each card:

- Icon (from lucide-react or custom)
- Label (e.g., "New Task")
- Optional badge (count, status)
- Hover effect: subtle shadow, slight lift, color shift
- Click → navigates to feature or opens modal

#### Recent Activity Section

- **Agent Activity Feed**: Last 5–10 agent messages (from direct chats or all-agents channel)
  - Shows agent avatar, name, brief message snippet, timestamp
  - Click → jump to that chat channel
- **Pending Approvals**: Quick count + preview of top 2–3 pending
  - Shows priority color
  - Click → go to approvals page

- **Upcoming Tasks**: If any tasks are due soon, show a mini-list
  - Shows assigned agent, task name, due date
  - Click → view task detail

#### Agent Status Panel (Right Side or Below)

- Grid or horizontal scroll of agent cards
- Each card: Avatar, name, role tag, online/offline status
- Show agent's current task (if any) in a tooltip on hover
- Scrollable if many agents

### Responsive Behavior

| Viewport            | Layout                                             | Changes                      |
| ------------------- | -------------------------------------------------- | ---------------------------- |
| Desktop (>1024px)   | Hero + quick links (2 rows) + activity sidebar     | Full 2-column layout         |
| Tablet (768–1023px) | Hero + quick links (1 row) + activity (scrollable) | Stacked, smaller quick links |
| Mobile (<768px)     | Hero (shortened) + vertical stack of quick links   | Full-width mobile optimized  |

### Implementation Notes

- **Background image/gradient**: Use CSS background or Next.js Image component with `priority` flag for LCP
- **Command input**: Wire to existing `CommandPalette` logic or create dedicated `HomeInput` component
- **Recent activity**: Fetch from chat, task, and approval stores; show "No activity" state if empty
- **Skeleton states**: Show placeholder cards while loading agent/task data
- **Analytics**: Use Recharts for any embedded charts (if included in home screen)

---

## Multi-Agent Chat System

### Architecture Overview

**Chat Model**:

- **Channels**: Logical groupings for conversations
  - "All Agents" — broadcast channel, any message reaches all agents
  - "Department X" — scoped to agents in that dept
  - "Agent Y (Direct)" — 1-on-1 conversation with specific agent
  - "Approval Queue" — special channel showing pending approvals (read-only from user perspective)
  - "Team" or "General" — human team members + selected lead agents

- **Messages**:
  - `id, channelId, senderId, senderType ('agent'|'human'|'system'), content, timestamp, metadata (tokens used, cost, execution time)`
  - Rich content: text, suggested actions, inline tables, metrics, linked records

- **Presence**:
  - Agent online/offline status
  - Last activity timestamp
  - Current task (if any)
  - Deployment status (active, paused, error)

### Chat Panel Layout

#### Desktop (Full Width)

```
┌─────────────────────────────────────────────────────────────────┐
│ NeureCore                    Search...        ☀️ Settings Profile │  ← TopBar
├──────────────┬──────────────────────────────────────────────────┤
│              │                                                    │
│ Home         │                                                    │
│ Inbox        │  [All Agents ▼]  [Department  Finance ▼]  [All ] │  ← Channel selector
│ Approvals    │─────────────────────────────────────────────────  │
│              │                                                    │
│ TEAM         │ Agent: Meeting Manager                            │
│ ├─ Agents    │ "Your meeting is scheduled for 3 PM tomorrow"     │  ← Message with sender
│ ├─Dept1      │ [View Details] [Reschedule]                       │     identity, timestamp,
│ ├─Dept2      │                                                    │     actions
│          (3) │ You: Thanks, confirmed!                           │
│              │ ┌──────────────────────────────────────────────┐ │
│ DIRECT       │ │ Agent: Analytics Bot                         │ │
│ ├─Agent X    │ │ "Weekly report ready"                        │ │
│ ├─Agent Y    │ │ [View] [Download PDF] [Share]               │ │
│              │ │ Cost: 0.3¢ | Time: 2.4s | Tokens: 245       │ │
│              │ └──────────────────────────────────────────────┘ │
│              │                                                    │
│              │ ┌────────────────────────────────────────────────┐│
│              │ │ [💡 Suggested follow-ups]                     ││
│              │ │ □ Request executive summary                   ││
│              │ │ □ Share with leadership                       ││
│              │ └────────────────────────────────────────────────┘│
│              │                                                    │
│              │ Message to All Agents...                        ▶ │  ← Input
└──────────────┴──────────────────────────────────────────────────┘
```

#### Mobile (Bottom Sheet)

```
┌────────────────────────────────────┐
│ [All Agents ▼]  [Close]            │  ← Channel & close button
├────────────────────────────────────┤
│ Message list (scrollable)           │
│                                      │
│ Agent: "Meeting scheduled..."       │
│ [View Details]                      │
│                                      │
│ You: "Thanks!"                      │
├────────────────────────────────────┤
│ Message input...                   │  ← Keyboard will push up
└────────────────────────────────────┘
```

### Channel Selector

**Desktop**: Horizontal tabs or dropdown selector at the top of chat panel

- Tabs show: "All Agents", "Finance", "Direct with Agent X", "Approvals"
- Active tab highlighted
- Clicking tab switches message history

**Mobile**: Dropdown selector with scrollable list

### Message Rendering

#### Agent Message Components

**Header**:

- Agent avatar (32–40px)
- Agent name (bold)
- Role tag (e.g., "Meeting Manager")
- Timestamp (relative: "2 min ago" or absolute: "3:45 PM")
- Status indicator (if executing: animated spinner; if error: red icon)

**Body**:

- Message text (wrapping, links are clickable)
- Optional suggested actions (pill buttons)
- Optional inline content (tables, metrics, code blocks)

**Footer** (conditional):

- Execution metadata: "Cost: 0.3¢ | Tokens: 245 | Time: 2.4s"
- Approval indicator (if message triggered an approval flow)
- Reaction buttons (emoji quick-react? optional)

#### Human Message Components

**Simple layout**:

- Aligned right
- Bubble/card style
- Avatar (smaller, optional)
- Message text
- Timestamp

#### System Messages

- Centered, muted color
- Examples: "Meeting Manager started executing", "Task #123 approved"

### Presence & Online Status

**Agent Status Indicators** (in chat header or in sidebar):

- **Green dot**: Online and active
- **Yellow/amber dot**: Online but busy (executing task)
- **Gray dot**: Offline
- **Red dot**: Error state / needs attention
- **Tooltip on hover**: Last activity time, current task (if any)

### Streaming Messages

When an agent is sending a long-form response:

- Show partial message as it streams
- Animated cursor/pulse at the end of streamed content
- Once complete, show execution metadata (cost, tokens, time)

### Suggested Actions

**Pill Buttons** displayed below messages:

- "View Details", "Approve", "Schedule", "Share", etc.
- Icon + label
- On click: either opens modal, navigates, or sends action message back

### Threads / Conversation History

**Per-channel message persistence**:

- All messages in a channel are stored locally (service worker) and on backend
- Scrolling up loads older messages (pagination)
- Jumping to a specific message: expand context around that message

**Future phase**: Thread support

- Within a channel, click a message to open threaded reply view
- Replies appear indented with visual distinction

### Input & Sending

**Message Input Component**:

- Text input with placeholder: "Message [channel name]..."
- Multiline support (Shift+Enter for new line, Enter to send)
- Emoji picker icon
- Attachment icon (for uploading documents, images, etc.)
- Send button (or keyboard shortcut Ctrl/Cmd+Enter)
- Character count (optional, for long messages)

**Submission Behavior**:

- Optimistic update: show message immediately, disable send button
- Broadcast to WebSocket or send via HTTP
- If error: show retry/cancel buttons
- On success: message locked, show timestamp

### Channel-Specific Features

#### All Agents Channel

- Any message here is targeted to all active agents
- Agents can pick it up and respond (depending on their filters)
- Shown as a broadcast message with "All Agents" badge
- Approval workflows may consolidate agent responses

#### Department Channel

- Only agents in that dept see messages
- Shows dept name in header
- Useful for dept-specific coordination

#### Direct Message with Agent

- Only you and the agent
- Can include detailed follow-ups, approvals, task assignments
- Shows full agent profile in header

#### Approval Channel

- Special, read-only for human users (unless they're supervisors)
- Shows pending approval items as pseudo-messages
- Clicking an approval → full approval detail view

### Data Flow & Storage

**Frontend State** (`chatStore`):

- `channels: Channel[]`
- `activeChannelId: string`
- `messages: { [channelId]: Message[] }`
- `unreadCounts: { [channelId]: number }`
- `presenceStatus: { [agentId]: AgentPresence }`
- `loading: boolean`
- `error: string | null`

**Actions**:

- `fetchChannels()`
- `selectChannel(channelId)`
- `sendMessage(channelId, text)`
- `fetchMessages(channelId, limit, offset)`
- `markChannelAsRead(channelId)`
- `updatePresence(agentId, status)`

**Backend Endpoints**:

- `GET /api/v1/channels` — list channels for user
- `GET /api/v1/channels/:id/messages` — paginated message history
- `POST /api/v1/channels/:id/messages` — send message (WebSocket preferred, HTTP fallback)
- `GET /api/v1/agents/status` — fetch all agent statuses
- `WS /api/v1/ws` — WebSocket for real-time presence, messages, notifications

### Accessibility

- Full keyboard navigation: Tab between channels, Arrow keys to select message, Enter to expand detail
- Screen reader labels: Aria-labels for channel names, agent identities, message count badges
- Focus management: When channel switches, focus moves to message list
- Color not sole indicator: Use icons + text for status (not just color)

### Performance Optimizations

- Virtual scrolling for long message lists (use `react-window`)
- Pagination: Load 50 messages at a time, lazy-load older
- Memoization: MessageRenderer, ChannelSelector memoized to prevent re-renders
- Debounce: Typing indicators debounced to 500ms
- Image optimization: Agent avatars served as thumbnails

---

## Telegram Integration for Offline Notifications

### Use Case

When a user is offline:

1. An agent completes a task or needs approval
2. NeureCore checks if user is online
3. If offline and Telegram is linked + enabled, send a concise notification to user's Telegram
4. User can see notification on their phone without opening NeureCore web app
5. (Future) User can reply from Telegram to ack/approve

### Architecture

#### Backend Components

**Data Model** (`telegram_integrations` table):

```sql
CREATE TABLE telegram_integrations (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID NOT NULL REFERENCES users(id),
  telegram_chat_id BIGINT NOT NULL,
  telegram_bot_token VARCHAR(255) NOT NULL ENCRYPTED, -- stored encrypted
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  last_verified_at TIMESTAMP,
  last_sent_at TIMESTAMP,
  UNIQUE(user_id, telegram_chat_id)
);
```

**Service** (`backend/src/services/telegram.service.ts`):

```ts
export class TelegramService {
  constructor(private configService: ConfigService) {}

  async sendMessage(
    chatId: string,
    message: string,
    buttons?: TelegramButton[],
  ): Promise<void> {
    const botToken = this.configService.get("TELEGRAM_BOT_TOKEN");
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const payload = {
      chat_id: chatId,
      text: message,
      parse_mode: "HTML",
      reply_markup: buttons ? { inline_keyboard: buttons } : undefined,
    };
    await axios.post(url, payload);
  }

  async linkChat(
    userId: string,
    tenantId: string,
    telegramChatId: string,
  ): Promise<TelegramIntegration> {
    // Store encrypted token + chat ID
    // Send verification message to chat
  }

  async verifyLink(userId: string, pin: string): Promise<boolean> {
    // User enters PIN from Telegram message into UI
    // Match PIN, mark as verified
  }
}
```

**Notification Dispatcher** (integrated into existing inbox/notifier system):

```ts
export class TelegramNotifier implements INotifier {
  async notify(inboxItem: InboxItem): Promise<void> {
    if (!inboxItem.user.telegramLinked || !inboxItem.user.telegramEnabled) {
      return; // Skip
    }

    const message = this.formatMessage(inboxItem);
    await this.telegramService.sendMessage(
      inboxItem.user.telegramChatId,
      message,
    );
  }

  private formatMessage(item: InboxItem): string {
    // Concise HTML-formatted message
    // Example: "<b>Meeting Manager:</b>\nMeeting scheduled for 3 PM tomorrow\n[View in NeureCore](link)"
  }
}
```

**Controller** (`backend/src/modules/integrations/telegram.controller.ts`):

```ts
@Controller("integrations/telegram")
export class TelegramController {
  @Post("link")
  async linkAccount(@Body() dto: LinkTelegramDto): Promise<void> {
    // 1. Validate telegram user
    // 2. Generate PIN, send to Telegram chat
    // 3. Return PIN verification request
  }

  @Post("verify")
  async verifyLink(
    @Body() dto: VerifyTelegramDto,
  ): Promise<TelegramIntegration> {
    // 1. Check PIN from user input
    // 2. If correct, mark integration as verified
    // 3. Return success
  }

  @Delete()
  async unlinkAccount(): Promise<void> {
    // Remove telegram integration
  }

  @Get("status")
  async getStatus(): Promise<TelegramIntegration> {
    // Return current integration status for user
  }
}
```

#### Frontend Components

**Settings Page** (`frontend-tenant/src/app/settings/integrations/telegram/page.tsx`):

```tsx
export default function TelegramSettingsPage() {
  const [step, setStep] = useState<"initial" | "link" | "verify" | "linked">(
    "initial",
  );
  const [chatId, setChatId] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLink = async () => {
    setLoading(true);
    try {
      // Send request to backend
      const response = await api.post("/integrations/telegram/link", {
        chatId,
      });
      setStep("verify");
      // Show PIN verification flow
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setLoading(true);
    try {
      await api.post("/integrations/telegram/verify", { pin });
      setStep("linked");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Telegram Integration</h1>

      {step === "initial" && (
        <div>
          <p className="text-text-secondary mb-4">
            Link your Telegram account to receive agent notifications when
            you're offline.
          </p>
          <button
            onClick={() => setStep("link")}
            className="px-4 py-2 bg-accent-primary text-white rounded-md"
          >
            Link Telegram
          </button>
        </div>
      )}

      {step === "link" && (
        <div>
          <label className="block mb-2">Telegram Chat ID</label>
          <input
            type="text"
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            placeholder="Enter your Telegram chat ID or username"
            className="w-full px-3 py-2 border border-surface-border rounded"
          />
          <p className="text-sm text-text-secondary mt-2">
            Send <code>/start</code> to @NeureCore_Bot to get your chat ID
          </p>
          <button
            onClick={handleLink}
            disabled={loading}
            className="mt-4 px-4 py-2 bg-accent-primary text-white rounded-md"
          >
            {loading ? "Linking..." : "Send Verification PIN"}
          </button>
        </div>
      )}

      {step === "verify" && (
        <div>
          <p className="text-text-secondary mb-4">
            Check your Telegram for a message with a PIN code.
          </p>
          <input
            type="text"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Enter PIN"
            className="w-full px-3 py-2 border border-surface-border rounded"
          />
          <button
            onClick={handleVerify}
            disabled={loading}
            className="mt-4 px-4 py-2 bg-accent-primary text-white rounded-md"
          >
            {loading ? "Verifying..." : "Verify"}
          </button>
        </div>
      )}

      {step === "linked" && (
        <div className="bg-surface-raised p-4 rounded border border-success">
          <p className="text-success font-semibold">
            ✓ Telegram linked successfully!
          </p>
          <p className="text-text-secondary mt-2">
            You'll receive agent notifications on Telegram when offline.
          </p>
          {/* Per-agent notification settings */}
          <div className="mt-6">
            <h3 className="font-semibold mb-4">Notification Preferences</h3>
            {/* List of agents with toggle switches for Telegram notifications */}
          </div>
        </div>
      )}
    </div>
  );
}
```

**Per-Agent Toggle** (in agent detail or settings):

- Switch: "Notify me on Telegram when offline"
- Shows last notification sent (if any)
- Can disable per-agent

### Message Format Examples

#### Task Completion Notification

```
🎯 Task Completed

Meeting Manager completed your task:
"Schedule Leadership Meeting"

✓ Scheduled for Wed 10 AM
⏱️ Execution time: 2.4s
💰 Cost: $0.03

[View Task] [Dismiss]
```

#### Approval Needed

```
⚠️ Approval Required

Sales Agent needs your approval:
"Send promotional email to 500 leads"

📊 Recipients: 500
💬 Message: "Spring Sale Alert"
⏱️ Waiting: 5 min

[Approve] [Reject] [View Details]
```

#### Agent Status Alert

```
🔴 Alert

Analytics Bot encountered an error:
"Data sync failed - API rate limit"

Needs manual restart.

[View Log] [Restart Agent]
```

### Privacy & Security Considerations

1. **Data in Transit**: HTTPS for API calls to Telegram
2. **Data at Rest**: Telegram chat IDs and bot tokens encrypted in database (using application secrets or KMS)
3. **Message Content**: Avoid sending PII; use minimal context, link back to web app for details
4. **Opt-Out**: User can disable globally or per-agent
5. **Audit Trail**: Log all messages sent via Telegram (to/from, timestamp, content hash)
6. **Compliance**: For GDPR/regulated data, require explicit opt-in and data residency setup

### Phased Rollout

**Phase 1** (MVP):

- Unidirectional notifications (Telegram → NeureCore)
- Approval notifications + task completion
- Settings UI to link/unlink

**Phase 2**:

- Per-agent notification toggle
- Scheduled digest (e.g., daily summary at 9 AM)
- Do Not Disturb window (e.g., 10 PM – 8 AM)

**Phase 3**:

- Bidirectional: Reply from Telegram to approve/acknowledge
- Telegram command shortcuts (e.g., `/approve <approval_id>`)
- Custom notification templates per tenant

---

## Light/Dark Mode Implementation

### Strategy

Use CSS variables + Tailwind mapping for runtime theme switching without page reload.

### Design Tokens (Already Detailed Above)

See [Design System Architecture](#design-system-architecture) section.

### Implementation Checklist

- [ ] Create `frontend-tenant/src/styles/design-tokens.css` with light + dark theme variables
- [ ] Update `tailwind.config.js` to map colors to CSS variables
- [ ] Create `useTheme` hook with localStorage persistence
- [ ] Add `ThemeToggle` button to TopBar
- [ ] Inject theme class into `<html>` on app load (avoid theme flash)
- [ ] Update all existing components to use token colors instead of hard-coded values
- [ ] Test color contrast in both themes (WCAG AA)
- [ ] Test theme switching performance (no lag, smooth transition)
- [ ] Mirror setup in `frontend-admin` for consistency

### Testing Light/Dark Mode

- Manual: Toggle theme button, verify all pages render correctly
- Automated: Snapshot tests for both themes (Playwright + Percy)
- Accessibility: Test color contrast with tools like WebAIM, Stark, or axe
- Browser DevTools: Use device emulation to verify `prefers-color-scheme` preference detection

---

## Accessibility & Internationalization

### Accessibility (WCAG 2.1 AA Compliance)

#### Color Contrast

- All text must have >= 4.5:1 contrast (normal text)
- Large text (18px+) requires >= 3:1 contrast
- Test both light and dark themes with WebAIM contrast checker

#### Keyboard Navigation

- All interactive elements accessible via Tab key
- Focus visible (outline or background change)
- Escape key closes modals/panels
- Arrow keys navigate select lists, radio groups, and menus
- Enter/Space to activate buttons

#### Screen Reader Support

- Semantic HTML (`<button>`, `<nav>`, `<main>`, `<form>`)
- ARIA labels for icons: `<button aria-label="Open menu">☰</button>`
- Live regions for dynamic content: `<div aria-live="polite" aria-atomic="true">`
- Form labels associated with inputs: `<label htmlFor="input-id">Label</label>`
- Skip links: "Skip to main content" link at top of page

#### Focus Management

- Modals trap focus within dialog
- When modal closes, focus returns to trigger button
- Page navigation: focus moves to main content heading

#### Testing Tools

- axe DevTools (browser extension)
- Lighthouse (built into Chrome DevTools)
- NVDA or JAWS screen readers (for manual testing)
- Keyboard-only navigation (disable mouse, test all features)

### Internationalization (i18n)

#### Strategy

Use `react-intl` or `next-intl` for message translation.

#### Key Areas to Translate

- UI labels (buttons, menu items, headers)
- Tooltips and help text
- Error messages and validation feedback
- Placeholder text in inputs
- Date/time formatting (locale-specific)
- Currency and number formatting

#### Implementation

- Translation JSON files: `en.json`, `es.json`, `fr.json`, etc.
- Keys: Hierarchical (e.g., `chat.message_input.placeholder`)
- Language selector in settings
- Language preference persisted in user profile
- RTL support for Arabic, Hebrew (future phase)

---

## Implementation Roadmap

### Phase 0: Discovery & Infrastructure (1 week)

**Deliverables**:

- [ ] Finalize design token palette (colors, spacing, typography)
- [ ] Create `design-tokens.css` with light + dark variables
- [ ] Update `tailwind.config.js` to use CSS variables
- [ ] Implement `useTheme` hook and `ThemeToggle` component
- [ ] Test theme switching in dev environment

**Owner**: Designer + 1 Frontend Dev

### Phase 1: Home Screen & Navigation (2 weeks)

**Deliverables**:

- [ ] Extract `Sidebar` component from TenantShell
- [ ] Build `HomeScreen` (hero + quick links + activity feed)
- [ ] Enhance `TopBar` with agent status summary
- [ ] Implement responsive layout for tablet/mobile
- [ ] Add skeleton/loading states
- [ ] Test VoiceOver/NVDA accessibility

**Owner**: 2 Frontend Devs

### Phase 2: Chat Consolidation & Channels (3 weeks)

**Deliverables**:

- [ ] Consolidate admin & tenant `ConversationPanel` → unified `ChatPanel`
- [ ] Implement channel selector (All Agents, Department, Direct, Approvals)
- [ ] Add presence indicators (online/offline/busy)
- [ ] Implement streaming message rendering
- [ ] Add suggested actions and inline content (tables, metrics)
- [ ] Implement message persistence & pagination
- [ ] Test WebSocket connection and retry logic

**Owner**: 2 Frontend Devs + 1 Backend Dev (WebSocket support)

### Phase 3: Department Management UI (2 weeks)

**Deliverables**:

- [ ] Build `DepartmentTree` component
- [ ] Implement department-scoped chat channels
- [ ] Add department detail view (agents, KPIs, budget)
- [ ] Test drag-to-reorder (future phase can be skipped if time-constrained)

**Owner**: 1 Frontend Dev

### Phase 4: Approvals & Workflow (2 weeks)

**Deliverables**:

- [ ] Build `ApprovalQueue` (card grid + filters)
- [ ] Implement `ApprovalDetailView` with workflow stage indicator
- [ ] Add bulk approval actions
- [ ] Wire up backend endpoints for approve/reject
- [ ] Implement approval notifications + badge counts

**Owner**: 1 Frontend Dev + 1 Backend Dev

### Phase 5: Telegram Integration (2-3 weeks)

**Deliverables**:

- [ ] Implement backend `TelegramService` + endpoints
- [ ] Build Telegram linking UI (PIN verification flow)
- [ ] Create notification dispatcher integration
- [ ] Implement per-agent Telegram notification toggle
- [ ] Test sending notifications to Telegram Bot API
- [ ] Implement audit logging for Telegram messages

**Owner**: 1 Backend Dev + 0.5 Frontend Dev

### Phase 6: Analytics & Dashboards (2 weeks)

**Deliverables**:

- [ ] Build analytics dashboard with KPI cards
- [ ] Implement cost analytics (per-agent breakdown)
- [ ] Create charts with Recharts
- [ ] Add filtering and date range controls
- [ ] Test performance with large datasets

**Owner**: 1 Frontend Dev

### Phase 7: Polish, Testing & Rollout (2 weeks)

**Deliverables**:

- [ ] Visual polish: animations, transitions, micro-interactions
- [ ] QA: cross-browser testing (Chrome, Firefox, Safari, Edge)
- [ ] Accessibility audit: formal WCAG 2.1 AA compliance
- [ ] Performance: Lighthouse score > 90
- [ ] Feature flags: set up tenant-level toggles for rollout
- [ ] Documentation: component library, admin guide, user help articles
- [ ] Rollback plan: maintain old UI as fallback option

**Owner**: 2 Frontend Devs + 1 QA + 1 Tech Writer

### Total Effort

- **Estimated Dev Days**: 80–120 (10–15 weeks calendar time with team of 3–4)
- **Design Time**: 20–30 days (in parallel with dev)
- **QA & Polish**: 15–20 days

---

## Code Reuse Analysis

### Components to Extract & Consolidate

| Component              | Current Location(s)                                                    | Action                                          | Effort | Rationale                                              |
| ---------------------- | ---------------------------------------------------------------------- | ----------------------------------------------- | ------ | ------------------------------------------------------ |
| **Sidebar**            | TenantShell (inline)                                                   | Extract to `layout/Sidebar.tsx`                 | 1 day  | Reusable, collapsible, improves testability            |
| **ChatPanel**          | `components/chat/ConversationPanel.tsx` (duplicated in admin & tenant) | Consolidate into shared `ui/chat/ChatPanel.tsx` | 3 days | Eliminates duplication, single source for improvements |
| **TopBar / Header**    | `components/layout/TopBar.tsx`                                         | Extend with theme toggle, agent status          | 1 day  | Minimal changes, high impact                           |
| **KPI / Metric Cards** | `components/dashboard/*`, `components/kpi/*`                           | Refactor to use CSS token colors                | 2 days | Ensures consistency, simplifies dark mode              |
| **Data Table**         | `components/data-table/`                                               | Map to design tokens, add accessibility         | 2 days | Ensure WCAG AA compliance, consistent styling          |
| **Command Palette**    | `components/command-palette/CommandPalette.tsx`                        | Extend to support channel context               | 1 day  | Minor enhancement, reuse logic                         |

### Components to Build New

| Component                        | Complexity | Effort | Dependencies                  |
| -------------------------------- | ---------- | ------ | ----------------------------- |
| **HomeScreen / Hero**            | Medium     | 3 days | Sidebar, TopBar, ThemeToggle  |
| **DepartmentTree**               | Medium     | 3 days | Zustand store, collapsible UI |
| **ChatPanel (Enhanced)**         | High       | 5 days | WebSocket / real-time APIs    |
| **ApprovalCard / ApprovalQueue** | Medium     | 3 days | Backend approval APIs         |
| **ThemeToggle + useTheme**       | Low        | 1 day  | CSS variables                 |
| **Workflow Stage Indicator**     | Low        | 1 day  | SVG/Tailwind                  |
| **Agent Presence Panel**         | Medium     | 2 days | Real-time presence API        |
| **TelegramSettingsPage**         | Medium     | 3 days | Backend Telegram endpoints    |

### File Organization Post-Refactor

```
frontend-tenant/
├── src/
│   ├── styles/
│   │   ├── design-tokens.css            ✨ NEW
│   │   ├── globals.css
│   │   └── README_TOKENS.md             ✨ NEW
│   ├── hooks/
│   │   ├── useTheme.ts                  ✨ ENHANCED
│   │   ├── useChat.ts
│   │   └── ...existing
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx              ✨ EXTRACTED
│   │   │   ├── TopBar.tsx               ✨ ENHANCED
│   │   │   ├── ThemeToggle.tsx          ✨ NEW
│   │   │   ├── InspectorPanel.tsx
│   │   │   └── ...
│   │   ├── chat/
│   │   │   ├── ChatPanel.tsx            ✨ CONSOLIDATED
│   │   │   ├── MessageRenderer.tsx      ✨ NEW extraction
│   │   │   ├── ChannelSelector.tsx      ✨ NEW
│   │   │   └── ...
│   │   ├── home/
│   │   │   ├── HomeScreen.tsx           ✨ NEW
│   │   │   ├── HeroSection.tsx          ✨ NEW
│   │   │   ├── QuickLinksGrid.tsx       ✨ NEW
│   │   │   └── ActivityFeed.tsx         ✨ NEW
│   │   ├── dashboard/
│   │   │   ├── AgentStatusPanel.tsx     ✨ NEW
│   │   │   ├── ApprovalCard.tsx         ✨ NEW
│   │   │   └── ...
│   │   ├── department/
│   │   │   ├── DepartmentTree.tsx       ✨ NEW
│   │   │   ├── DepartmentDetail.tsx     ✨ NEW
│   │   │   └── ...
│   │   ├── integrations/
│   │   │   ├── TelegramLinkFlow.tsx     ✨ NEW
│   │   │   └── ...
│   │   ├── ui/
│   │   │   ├── Button.tsx               (refactored to use tokens)
│   │   │   ├── Card.tsx                 (refactored)
│   │   │   └── ...existing
│   │   └── ...
│   ├── stores/
│   │   ├── chatStore.ts                 ✨ ENHANCED (channels)
│   │   ├── departmentStore.ts           (existing)
│   │   └── ...
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── page.tsx                     (home/dashboard)
│   │   ├── (auth)/
│   │   ├── settings/
│   │   │   ├── integrations/
│   │   │   │   └── telegram/
│   │   │   │       └── page.tsx         ✨ NEW
│   │   │   └── ...
│   │   └── ...
│   └── ...
├── tailwind.config.js                   ✨ UPDATED (CSS vars)
└── package.json
```

---

## Migration & Rollout Strategy

### Pre-Rollout Phase

1. **Internal Dogfooding** (1 week)
   - NeureCore team uses new UI exclusively
   - Identify UX issues, performance bottlenecks
   - Gather feedback on chat, approvals, Telegram

2. **Pilot Customer Group** (1–2 weeks)
   - Select 3–5 customers (mix of sizes)
   - Enable feature flag for new UI
   - Monitor usage, collect feedback via in-app surveys
   - Fix critical bugs

### Rollout Plan

**Week 1: Early Adopters (10–20% of tenants)**

- Enable feature flag for tenants who opt-in
- Monitor error rates, performance metrics
- Support team on standby for issues

**Week 2: Expanded Rollout (50% of tenants)**

- Expand feature flag to additional customer cohorts
- Continue monitoring, fix issues discovered
- Gather telemetry on feature usage

**Week 3: Full Rollout (100% of tenants)**

- Enable new UI for all remaining tenants
- Keep old UI available as fallback (via settings toggle)
- Monitor for 1 week post-launch for stability

### Fallback & Rollback Plan

**If Critical Issues Found**:

1. Kill feature flag immediately (all tenants revert to old UI)
2. Hot-fix the issue in staging
3. Test thoroughly before re-enabling
4. Communicate status to affected customers

**Long-term Fallback**:

- Keep old UI codebase available for 3+ months
- Gradually sunset as new UI stabilizes
- Provide customer support during transition period

### Feature Flags

Use a feature flag service (e.g., LaunchDarkly, Unleash, Tinybird) to control:

- `ui.creatio-inspired.enabled` — toggle entire new UI
- `ui.creatio-inspired.chat-v2` — new chat panel
- `ui.creatio-inspired.home-v2` — new home screen
- `ui.creatio-inspired.telegram` — Telegram integration
- `ui.creatio-inspired.theme-modes` — light/dark mode toggle

### Success Metrics

Track these KPIs post-launch:

- **Adoption**: % of daily active users using new UI
- **Engagement**: Time spent in chat, number of messages sent, approvals processed
- **Performance**: Page load time, First Contentful Paint (FCP), Largest Contentful Paint (LCP)
- **Stability**: Error rates, crash reports, 500 errors
- **Satisfaction**: NPS score, support ticket volume, user survey sentiment

---

## Appendix A: Design Token Reference

### Light Theme Exhaustive Variable Map

```css
/* Colors - Semantic */
--surface-base: #ffffff;
--surface-raised: #ffffff;
--surface-overlay: rgba(15, 23, 42, 0.04);
--surface-border: #e6e7eb;

--text-primary: #0f1720;
--text-secondary: #6b7280;
--text-muted: #7b8087;

--accent-primary: #6d28d9;
--accent-600: #5b21b6;
--accent-50: #ede9fe;

--success: #16a34a;
--success-light: #dcfce7;
--success-dark: #15803d;

--warning: #f59e0b;
--warning-light: #fef3c7;
--warning-dark: #d97706;

--danger: #ef4444;
--danger-light: #fee2e2;
--danger-dark: #dc2626;

/* Neutral Grays */
--neutral-50: #f9fafb;
--neutral-100: #f3f4f6;
--neutral-200: #e5e7eb;
--neutral-300: #d1d5db;
--neutral-400: #9ca3af;
--neutral-500: #6b7280;
--neutral-600: #4b5563;
--neutral-700: #374151;
--neutral-800: #1f2937;
--neutral-900: #111827;

/* Shadows */
--shadow-xs: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.08);
--shadow-md: 0 4px 8px 0 rgba(0, 0, 0, 0.12);
--shadow-lg: 0 10px 20px 0 rgba(0, 0, 0, 0.15);

/* Focus Shadow (for keyboard nav) */
--focus-ring:
  0 0 0 3px rgba(109, 40, 217, 0.1), 0 0 0 1px rgba(109, 40, 217, 0.8);
```

### Tailwind Color Mapping

```js
colors: {
  surface: {
    base: 'var(--surface-base)',
    raised: 'var(--surface-raised)',
    overlay: 'var(--surface-overlay)',
    border: 'var(--surface-border)',
  },
  text: {
    primary: 'var(--text-primary)',
    secondary: 'var(--text-secondary)',
    muted: 'var(--text-muted)',
  },
  accent: {
    primary: 'var(--accent-primary)',
    600: 'var(--accent-600)',
    50: 'var(--accent-50)',
  },
  success: 'var(--success)',
  'success-light': 'var(--success-light)',
  warning: 'var(--warning)',
  'warning-light': 'var(--warning-light)',
  danger: 'var(--danger)',
  'danger-light': 'var(--danger-light)',
}
```

---

## Appendix B: Figma / Wireframe Notes

(This would be linked to Figma boards containing full component specs, responsive layouts, dark mode previews, interaction flows, etc. Since we're in design/planning phase, include placeholder stubs for future design assets.)

**Design Deliverables to Create**:

- [ ] Component library (buttons, cards, inputs, modals, badges)
- [ ] Page templates (home, chat, approvals, dashboard)
- [ ] Dark theme mockups (all pages)
- [ ] Mobile responsive layouts (375px, 600px viewports)
- [ ] Interaction prototypes (chat channel switching, theme toggle, approval workflow)
- [ ] Accessibility specs (focus states, keyboard shortcuts, screen reader labels)

---

## Appendix C: Example Component Code Snippets

### Example 1: HomeScreen Component

```tsx
"use client";

import { useEffect, useState } from "react";
import { Sparkles, Inbox, CheckCircle2, Bot, Building2 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useTaskStore } from "@/stores/taskStore";
import { HeroSection } from "./HeroSection";
import { QuickLinksGrid } from "./QuickLinksGrid";
import { ActivityFeed } from "./ActivityFeed";
import { AgentStatusPanel } from "@/components/dashboard/AgentStatusPanel";

export function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const tasks = useTaskStore((s) => s.tasks);
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    // Fetch recent activity, approvals, task updates
  }, []);

  return (
    <div className="min-h-screen bg-surface-base">
      <HeroSection user={user} />

      <div className="max-w-7xl mx-auto px-4 py-8">
        <QuickLinksGrid />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          <ActivityFeed activities={recentActivity} className="lg:col-span-2" />
          <AgentStatusPanel />
        </div>
      </div>
    </div>
  );
}
```

### Example 2: ChatPanel (Multi-Channel)

```tsx
"use client";

import { useState } from "react";
import { useChatStore } from "@/stores/chatStore";
import { ChannelSelector } from "./ChannelSelector";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";

export function ChatPanel() {
  const channels = useChatStore((s) => s.channels);
  const activeChannelId = useChatStore((s) => s.activeChannelId);
  const messages = useChatStore((s) => s.messages[activeChannelId] || []);
  const { selectChannel, sendMessage } = useChatStore();

  return (
    <div className="flex flex-col h-full bg-surface-raised rounded-lg shadow-md">
      <ChannelSelector
        channels={channels}
        activeChannelId={activeChannelId}
        onSelectChannel={selectChannel}
      />

      <MessageList messages={messages} />

      <MessageInput
        placeholder={`Message ${channels.find((c) => c.id === activeChannelId)?.name || "Channel"}...`}
        onSend={(text) => sendMessage(activeChannelId, text)}
      />
    </div>
  );
}
```

### Example 3: ThemeToggle + useTheme Hook

**(Already provided above in Design System Architecture)**

---

## Appendix D: Migration Checklist

- [ ] **Design tokens created** (colors, typography, spacing)
- [ ] **Tailwind config updated** (CSS variable mappings)
- [ ] **useTheme hook implemented** (localStorage, document class injection)
- [ ] **ThemeToggle component built** (UI control)
- [ ] **HomeScreen component built** (hero + quick links + activity)
- [ ] **Sidebar extracted & enhanced** (collapsible, responsive)
- [ ] **ChatPanel consolidated** (merged admin + tenant versions)
- [ ] **Channel support added** (UI selector, message scoping)
- [ ] **Presence indicators implemented** (online/offline/busy status)
- [ ] **Approval UI components built** (cards, detail view, workflow stage)
- [ ] **Department UI components built** (org tree, detail view)
- [ ] **Analytics dashboard implemented** (KPI cards, charts)
- [ ] **Telegram service integrated** (backend + frontend UI)
- [ ] **Accessibility audit passed** (WCAG 2.1 AA)
- [ ] **Responsive design tested** (desktop, tablet, mobile)
- [ ] **Feature flags configured** (tenant-level toggles)
- [ ] **Documentation written** (component library, admin guide, user help)
- [ ] **Rollout plan executed** (pilots, early adopters, full launch)
- [ ] **Post-launch monitoring active** (metrics, support, feedback)

---

## Conclusion

This comprehensive plan transforms NeureCore's tenant interface into a **modern, conversational, and intuitive operating system for managing AI agents**. By borrowing Creatio's visual language and interaction patterns while maintaining NeureCore's unique agent-centric positioning, we create a product that feels both familiar to CRM users and distinctly forward-thinking.

Key success factors:

1. **Phased rollout** with feature flags and fallback options
2. **Continuous user research** and feedback loops during implementation
3. **High-quality design system** (tokens) that enables rapid iteration
4. **Strong focus on accessibility** and performance from day one
5. **Team coordination** between design, frontend, backend, and QA

**Next immediate steps**:

1. Approve design token palette and Tailwind approach
2. Create Figma components and wireframes for sign-off
3. Stand up development environment with design-tokens.css
4. Begin Phase 0 (infrastructure) in parallel with Phase 1 (home screen + sidebar)

---

**Document Version**: 2.0  
**Last Updated**: April 6, 2026  
**Status**: Ready for Design Review & Implementation Planning  
**Approvers Needed**: Design Lead, Engineering Lead, Product Manager
