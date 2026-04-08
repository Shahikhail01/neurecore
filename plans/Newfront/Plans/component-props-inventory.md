# Component + Props Inventory (React / TypeScript)

This document converts the `home-analysis` findings into a component inventory with props and sample data shapes. Save companion TypeScript interfaces in `component-props.ts` (same folder).

## Conventions

- `IconName` — string identifier from the chosen icon set (Heroicons / Material).
- All callbacks are passed as typed functions; presentational components accept lightweight props.

---

### `LeftNav`

- Description: main app navigation (icons + labels), search and collapse toggle.
- Props:
  - `apps: AppItem[]` — required
  - `collapsed?: boolean`
  - `width?: string | number`
  - `onNavigate(route: string): void`
  - `onToggle?(): void`

### `TopBar`

- Description: global actions — launcher, search/omnibox, quick-create, notifications, avatar.
- Props:
  - `user: User`
  - `onSearch(query: string): void`
  - `onQuickCreate(type: string): void`
  - `notificationsCount?: number`
  - `onOpenSettings?(): void`

### `GreetingCard`

- Description: center greeting with short composer and quick-actions.
- Props:
  - `user: User`
  - `message?: string`
  - `onSendMessage(text: string): void`
  - `quickActions?: ActionItem[]`

### `QuickActionTile`

- Description: icon-tile for quick flows (create lead, import, reports).
- Props:
  - `action: ActionItem`
  - `size?: 'sm' | 'md' | 'lg'`

### `KPIWidget`

- Description: small metric card with value, delta, and optional sparkline.
- Props:
  - `id: string`
  - `title: string`
  - `value: number | string`
  - `delta?: number` (relative percent)
  - `trend?: number[]`
  - `unit?: string`
  - `icon?: IconName`
  - `onClick?(): void`

### `ActivityFeed`

- Description: chronological list of recent items.
- Props:
  - `items: ActivityItem[]`
  - `onOpenItem?(id: string): void`

### `RightPanel` (AI Assistant / Forecast)

- Description: dockable panel containing forecast bullets and conversation composer.
- Props:
  - `open: boolean`
  - `title?: string`
  - `forecast: ForecastItem[]`
  - `onClose(): void`
  - `onOpenForecast?(id: string): void`
  - `onMessage?(text: string): void`

### `BackgroundSelector`

- Description: thumbnails, upload, and overlay opacity control.
- Props:
  - `options: BackgroundOption[]`
  - `selectedId?: string`
  - `onSelect(id: string): void`
  - `onUpload?(file: File): Promise<string>`
  - `onOpacityChange?(id: string, opacity: number): void`

---

## Data / API shape examples (summary)

- `DashboardData` — root DTO for the home screen:

```ts
interface DashboardData {
  kpis: KPI[];
  quickActions: ActionItem[];
  recentActivities: ActivityItem[];
  forecast: ForecastItem[];
}
```

Sample endpoints:

- `GET /api/dashboard?tenant={id}` -> `DashboardData`
- `GET /api/apps` -> `AppItem[]`
- `POST /api/backgrounds` -> upload background (returns URL)

---

## Sample JSON (dashboard)

```json
{
  "kpis": [{ "id": "leads", "title": "Leads", "value": 124, "delta": 5 }],
  "quickActions": [
    { "id": "create-lead", "label": "Create Lead", "icon": "plus" }
  ],
  "recentActivities": [
    {
      "id": "a1",
      "type": "email",
      "actor": { "id": "u1", "name": "Audrey" },
      "time": "2026-04-07T09:40:00Z",
      "message": "Follow up on prospect"
    }
  ],
  "forecast": [
    { "heading": "Lead Generation", "details": "48 new in 24h, 24% conversion" }
  ]
}
```
