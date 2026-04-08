# Home Screen Analysis

**Saved:** 2026-04-07

**Note:** the hero photographic background is treated as an optional/selectable background image and should not drive layout decisions.

## Summary

- Three-column desktop layout: left vertical app navigation, central workspace/hero, right AI/forecast panel.
- Primary interactions: global search/omnibox, app navigation, quick-create actions, conversational AI assistant (right panel), and KPI/quick-action tiles in the center.

## Layout & Sizing (desktop recommendations)

- Left navigation: clamp(64px, 14%, 280px) — recommended 14% width (icon+label). Collapsed: 60–72px.
- Right panel (AI/forecast): clamp(280px, 24%, 360px) — recommended 24% width; collapsible/dockable.
- Center/main area: flex: 1 (remaining width).
- Top bar height: 56px. Nav item height: 48–56px. Card padding: 16–20px.

## Typography

- Base: 16px.
- Greeting (H1): clamp(22px, 2.2vw, 32px) — avoid oversized hero font.
- Body: 14–16px. Labels: 12–13px.

## Components (high level)

- `LeftNav`: search, app list (icons + labels), collapse toggle, badges.
- `TopBar`: app launcher, search, quick-create (+), notifications, avatar.
- `GreetingCard`: small greeting, single-line message composer, quick actions.
- `QuickActionsGrid`: icon tiles for common flows (create lead, import, reports, calendar).
- `KPIWidgets`: metric cards with value, delta, mini-sparkline.
- `ActivityFeed`: recent events list.
- `RightPanel` (AI assistant): forecast bullets, CTAs, composer, history; dockable.
- `BackgroundSelector`: thumbnail grid, upload, opacity overlay control.

## Iconography

- Use a consistent set (Heroicons / Material) for: Home, Feed, Leads, Accounts, Contacts, Activities, Opportunities, Chat, Orders, Invoices, Contracts, Search, Notifications, Settings, New.

## UX & Accessibility Notes

- Always provide a configurable overlay (dark/soft gradient) between background image and foreground cards to ensure contrast.
- Keyboard navigation and icon-only states must have clear tooltips and aria-labels.
- Respect `prefers-reduced-motion` and provide a compact/dense layout option.

## Background handling

- Background is per-tenant default with per-user override.
- Options: None, Image, Gradient, Solid color. Include an opacity slider and a quick-revert control.
- Performance: lazy-load hi-res, use low-res placeholder (LQIP) and defer until after first paint.

## Tenant-specific ideas

- Tenant theming and saved dashboard views.
- Role-based widget visibility and quick-action presets.
- Per-tenant AI forecast configuration and privacy controls.

## Prioritized improvements (impact → effort)

1. Contrast & readability overlay (High/Low)
2. Responsive collapsible nav + overlay right panel (High/Medium)
3. Background selector + lazy-load (Medium/Medium)
4. AI panel content density and chunking (Medium/Medium)
5. Tenant theming and saved dashboards (High/Large)

## Next steps

- Convert this into a component + props inventory (React/TS) with data shapes.
- Produce low-fidelity wireframes showing suggested sizes and collapsed states.
