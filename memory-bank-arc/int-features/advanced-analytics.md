# Advanced Analytics

## Overview
Comprehensive analytics dashboard for tenants. Provides insights into AI employee performance, task completion rates, cost tracking, usage patterns, and operational metrics.

## Category
ANALYTICS

## Backend Status
- ⚠️ **Partial** — analytics infrastructure exists but is admin-focused
- `adminMetricsService` provides platform-level metrics (KPIs, cost breakdown, task volume)
- `backend/src/modules/analytics/` — analytics module exists
- No tenant-scoped analytics APIs
- Cost records and task data are tracked in Prisma (`CostRecord`, `Task` models)

## Tenant Frontend Status
- ❌ **No dedicated analytics dashboard for tenants**
- No tenant-facing analytics UI or API

## Admin Frontend Status
- ✅ **Admin has full platform analytics** — Overview dashboard, billing analytics, strategy forecasting
- Platform KPIs, cost breakdowns, chart data hooks (`usePlatformKpis`, `usePlatformChartData`)
- Not exposed to tenant-level users

## AI Employee Integration
- ⚠️ **ReportsTool** generates task_summary, cost_summary, agent_workload, pipeline_overview — but these are per-agent, not tenant-wide analytics
- Agents can analyze their own performance but not tenant-wide metrics

## Package/Tier Integration
- Key: `advanced_analytics`
- Toggleable per tier
- Currently a placeholder — enabling grants nothing

## Implementation Gaps
- Tenant-scoped analytics API (task volume, agent utilization, cost per department, SLA compliance)
- Tenant analytics dashboard UI with charts and filters
- Exportable reports (CSV, PDF) at tenant level
- Real-time analytics via WebSocket
- Custom metric definition and tracking
