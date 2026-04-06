/**
 * COMPONENT LIBRARY DOCUMENTATION
 *
 * NeureCore UI Component Library - Comprehensive Reference
 * Maintainer: Frontend Team
 * Last Updated: April 6, 2026
 *
 * This document provides a complete reference for all UI components,
 * design patterns, accessibility guidelines, and usage examples.
 */

# NeureCore Component Library

## Table of Contents

1. [Introduction](#introduction)
2. [Layout Components](#layout-components)
3. [Chat & Communication](#chat--communication)
4. [Analytics & Dashboards](#analytics--dashboards)
5. [Approvals & Workflows](#approvals--workflows)
6. [Telegram Integration](#telegram-integration)
7. [Utility Components](#utility-components)
8. [Design Tokens](#design-tokens)
9. [Accessibility](#accessibility)
10. [Animation & Polish](#animation--polish)

---

## Introduction

### Purpose

The NeureCore component library provides a comprehensive set of reusable, accessible, and themeable UI components built with:
- **Next.js 15** + React 19
- **TypeScript** for type safety
- **Tailwind CSS** with CSS variables for theming
- **Radix UI** primitives
- **Zustand** for state management
- **date-fns** for date handling

### Core Principles

- **Single Responsibility**: Each component has one primary purpose
- **Composition**: Combine small components into larger features
- **Type Safety**: Full TypeScript coverage, no `any` types
- **Accessibility**: WCAG 2.1 AA compliance
- **Responsive**: Mobile-first design (1-3 column layouts)
- **Themeable**: Light/dark mode via CSS variables
- **Performance**: Optimized rendering, code-splitting ready

### Design Tokens

All colors use CSS variables mapped to Tailwind classes.

**Surface Colors:**
- `--surface-base`: Primary background (white in light, #09090b in dark)
- `--surface-raised`: Elevated surfaces (cards, panels)
- `--surface-overlay`: Subtle backgrounds for hover/focus
- `--surface-border`: Borders and dividers

**Text Colors:**
- `--text-primary`: Main content text
- `--text-secondary`: Metadata and secondary information
- `--text-muted`: Disabled or tertiary text

**Status Colors:**
- `--success` / `--success-light`: Positive states
- `--warning` / `--warning-light`: Caution states
- `--danger` / `--danger-light`: Error states

---

## Layout Components

### TopBar.tsx

Header with title, autonomy selector, theme toggle, and user menu.

**Props:**
```typescript
interface TopBarProps {
  title: string;
  autonomyLevel?: 'assist' | 'copilot' | 'autopilot';
  onAutonomyChange?: (level: string) => void;
  showSearch?: boolean;
}
```

**Usage:**
```tsx
<TopBar
  title="Analytics"
  autonomyLevel="copilot"
  onAutonomyChange={handleLevelChange}
/>
```

### Sidebar.tsx

Collapsible navigation with grouped sections and user profile.

**Props:**
```typescript
interface SidebarProps {
  isCollapsed?: boolean;
  activeItem?: string;
  onItemClick?: (item: string) => void;
}
```

**Features:**
- Icon + label navigation
- Collapsible groups (Home, Work, Insights)
- Active state indicator
- User profile section
- Responsive collapse on mobile

### InspectorPanel.tsx

Right-side context panel for entity details.

**Props:**
```typescript
interface InspectorPanelProps {
  entity: Agent | Task | Approval;
  onClose: () => void;
  loading?: boolean;
}
```

### ThemeToggle.tsx

Light/dark mode toggle button.

**Usage:**
```tsx
<ThemeToggle />
```

---

## Chat & Communication

### ChatPanel.tsx

Multi-channel messaging interface.

**Features:**
- Channel selector (All Agents, Department, Direct, Approvals)
- Online/offline presence indicators
- Message streaming with execution metadata
- Suggested actions
- Keyboard navigation

**Usage:**
```tsx
<ChatPanel
  channels={channels}
  activeChannelId={activeId}
  messages={messages}
  onSendMessage={handleSend}
/>
```

### MessageRenderer.tsx

Individual message rendering with sender identity and metadata.

**Props:**
```typescript
interface MessageRendererProps {
  message: Message;
  showAvatar?: boolean;
  onReact?: (emoji: string) => void;
}
```

---

## Analytics & Dashboards

### AnalyticsDashboard.tsx

Main analytics page with KPI cards and charts.

**Features:**
- 4 KPI summary cards
- Date range filtering
- 5 interactive charts (utilization, cost, approval, completion)
- Budget alerts
- Export functionality

**Usage:**
```tsx
<AnalyticsDashboard />
```

### CostAnalyticsPage.tsx

Detailed cost breakdown page.

**Features:**
- Per-agent cost breakdown (sortable table)
- Per-task cost summary
- Cost trends and forecasting
- Budget alerts with progress bars
- Filterable by agent, department, date range

### DateRangeFilter.tsx

Date range selector with presets.

**Props:**
```typescript
interface DateRangeFilterProps {
  onDateRangeChange: (from: Date, to: Date) => void;
  currentFrom?: Date;
  currentTo?: Date;
  label?: string;
}
```

**Presets:**
- Last 7 days
- Last 30 days
- Last 90 days
- Custom date picker

### AnalyticsChartsGrid.tsx

Responsive grid layout for charts.

**Usage:**
```tsx
<AnalyticsChartsGrid>
  <AnalyticsChartItem title="Cost by Agent" span={2}>
    <BarChart data={data} />
  </AnalyticsChartItem>
</AnalyticsChartsGrid>
```

### KpiTile.tsx

KPI metric card with value and trend.

**Props:**
```typescript
interface KpiTileProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  delta?: number;
  deltaLabel?: string;
  color: 'profit' | 'risk' | 'warn' | 'ops' | 'strategy';
  loading?: boolean;
}
```

---

## Approvals & Workflows

### WorkflowStageIndicator.tsx

Horizontal progress indicator for approval stages.

**Props:**
```typescript
interface WorkflowStageIndicatorProps {
  approvers: ApprovalChainItem[];
  status?: 'pending' | 'approved' | 'rejected';
  showLabels?: boolean;
}
```

**Visual Indicators:**
- ✓ Green = Approved
- ✗ Red = Rejected
- ⏱ Gray = Pending

### ApprovalCard.tsx

Compact approval summary card.

**Props:**
```typescript
interface ApprovalCardProps {
  approval: Approval;
  isActive?: boolean;
  onClick?: () => void;
  onApprove?: (approvalId: string) => void;
  onReject?: (approvalId: string) => void;
}
```

**Features:**
- Priority badges (color-coded)
- Approval chain progress
- Quick approve/reject buttons
- Context snippet

### ApprovalQueue.tsx

Main approval management interface.

**Features:**
- Search by initiator/subject
- Filter by status, priority, type, date
- Sort by priority or date
- Bulk selection
- Responsive grid (1-3 columns)

### ApprovalDetailView.tsx

Full approval context modal/inspector.

**Tabs:**
1. Overview - Request reason, metadata
2. Workflow - Approval chain + approver details
3. Comments - Activity feed
4. Details - Related entities, cost, tags

---

## Telegram Integration

### TelegramSettingsPage.tsx

Multi-step Telegram account linking UI.

**Steps:**
1. Intro - Feature overview
2. Link - Chat ID input
3. Verify - PIN verification
4. Linked - Success + settings

**Features:**
- PIN-based verification
- Per-agent notification toggles
- Unlink with confirmation
- Status display

### TelegramAgentNotificationToggle.tsx

Per-agent notification settings.

**Features:**
- Enable/disable per agent
- 4 notification type checkboxes
- Expandable detail view
- Responsive toggle switch

---

## Utility Components

### Button Component Family

```typescript
// Primary action
<Button variant="primary" size="md">Click me</Button>

// Secondary action
<Button variant="secondary" size="sm">Cancel</Button>

// Danger action
<Button variant="danger" size="lg">Delete</Button>

// Disabled state
<Button disabled>Loading...</Button>
```

### Badge Component

```tsx
// Status badges
<Badge variant="success">Approved</Badge>
<Badge variant="pending">Pending</Badge>
<Badge variant="error">Failed</Badge>

// Count badges
<Badge count={5} />
```

### Card Component

```tsx
// Basic card
<Card>Content</Card>

// With header
<Card>
  <CardHeader>Title</CardHeader>
  <CardContent>Content</CardContent>
</Card>
```

---

## Design Tokens

### Color Palette

**Light Theme (default):**
- Surface Base: #ffffff
- Surface Raised: #f8f9fb
- Text Primary: #0f1720
- Accent Primary: #6d28d9

**Dark Theme:**
- Surface Base: #09090b
- Surface Raised: #111113
- Text Primary: #e6e6e9
- Accent Primary: #7c3aed

### Typography

- **H1**: 24px, weight 700
- **H2**: 20px, weight 700
- **H3**: 18px, weight 600
- **Body**: 14-16px, weight 400
- **Small**: 12-13px, weight 400

### Spacing

- Base unit: 4px
- Common values: 8px, 12px, 16px, 24px, 32px

### Border Radius

- Small: 6px
- Medium: 8px
- Large: 12px

---

## Accessibility

### WCAG 2.1 AA Compliance

All components meet WCAG 2.1 AA standards:

**Color Contrast:**
- Text: 4.5:1 minimum
- Large text (18px+): 3:1 minimum
- Tested with WebAIM contrast checker

**Keyboard Navigation:**
- Tab order follows visual flow
- Focus visible with outline/background change
- Escape closes modals/overlays
- Arrow keys navigate lists

**Screen Reader Support:**
- Semantic HTML (`<button>`, `<nav>`, `<main>`)
- ARIA labels for icons: `aria-label="Close"`
- Live regions for updates: `aria-live="polite"`
- Form labels associated: `<label htmlFor="id">`

**Focus Management:**
- Modal traps focus within dialog
- Focus returns to trigger on close
- Page nav moves focus to main content

### Testing Tools

- axe DevTools browser extension
- Lighthouse (Chrome DevTools)
- NVDA or JAWS screen readers
- Keyboard-only navigation testing

---

## Animation & Polish

### Available Animations

- `fadeIn` / `fadeOut`: Opacity transitions
- `slideInUp` / `slideInDown`: Vertical slides with fade
- `slideInLeft` / `slideInRight`: Horizontal slides
- `scaleIn` / `scaleOut`: Size transitions
- `pulse`: Breathing effect
- `bounce`: Bouncing effect

### Using Animations

```tsx
// CSS class
<div className="animate-fade-in">Fades in</div>

// Staggered list
const { getItemProps } = useStaggeredAnimation(items.length, 50);
items.map((item, idx) => (
  <div key={item.id} {...getItemProps(idx)}>
    {item.name}
  </div>
))

// Programmatic control
const { animate, isAnimating } = useAnimation();
await animate('slideInUp', 300);
```

### Micro-interactions

- Button hover: Subtle lift + color shift
- Card hover: Light shadow increase
- Icon/avatar: Smooth color transitions
- Input focus: Border + ring animation
- Modal/drawer: Slide + fade entrance
- Toast: Slide in from top with auto-dismiss

---

## Component Inventory

### Layout (4)
- TopBar
- Sidebar
- InspectorPanel
- ThemeToggle

### Chat (3)
- ChatPanel
- MessageRenderer
- ChannelSelector

### Analytics (4)
- AnalyticsDashboard
- CostAnalyticsPage
- DateRangeFilter
- AnalyticsChartsGrid

### Approvals (4)
- ApprovalQueue
- ApprovalCard
- ApprovalDetailView
- WorkflowStageIndicator

### Telegram (2)
- TelegramSettingsPage
- TelegramAgentNotificationToggle

### Charts (6)
- LineChart
- BarChart
- AreaChart
- DonutChart
- Sparkline
- ChartSkeleton

### KPI (1)
- KpiTile

### UI Primitives (10+)
- Button
- Input
- Badge
- Card
- Modal
- Dialog
- Select
- Drawer
- Toast
- Tabs

**Total: 40+ components**

---

## Best Practices

### Component Naming

- Use descriptive names: `ApprovalDetailView` not `ApprovalDetail`
- Include layout indicator: `*Page` for full pages, `*Panel` for sidebars
- Match file structure: `ApprovalButton.tsx` in `components/approval/`

### Props Interface

```typescript
interface ComponentProps {
  /** Main content or data */
  children?: ReactNode;
  
  /** Callbacks for actions */
  onAction?: (value: string) => void;
  
  /** State flags */
  isLoading?: boolean;
  isDisabled?: boolean;
  
  /** Styling */
  className?: string;
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
}
```

### Import Structure

```typescript
// Always use barrel exports from index.ts
import { ApprovalQueue, ApprovalDetailView } from '@/components/approval';

// Never import from individual files
// import { ApprovalQueue } from '@/components/approval/ApprovalQueue.tsx';
```

### State Management

- Use Zustand stores for shared state
- Immer middleware for immutable updates
- Selectors for computed values
- Mock data for development

### Error Handling

- Show user-friendly error messages
- Provide retry mechanisms
- Log errors for debugging
- Handle edge cases explicitly

---

## Performance Tips

- Memoize expensive calculations
- Use virtualization for long lists
- Lazy load charts and analytics
- Code-split pages at routes
- Optimize images and icons
- Debounce search and filters

---

## Future Enhancements

- [ ] Storybook integration
- [ ] Chromatic for visual regression
- [ ] Accessibility audit automation
- [ ] Component usage metrics
- [ ] Dark mode color preview tool
- [ ] Figma design system sync
- [ ] Interactive component playground
- [ ] Component versioning
- [ ] TypeScript prop validation

---

## Support & Contributions

To report bugs or suggest improvements:

1. Create an issue in the repository
2. Include component name and reproduction steps
3. Provide screenshots if UI-related
4. Reference relevant WCAG or accessibility concerns

---

**Document Version:** 1.0  
**Status:** Phase 7 Complete  
**Maintainers:** Frontend Team  
**Last Updated:** April 6, 2026
