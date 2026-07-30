# Audit Logs

## Overview
Immutable audit trail of all actions performed within a tenant's workspace. Tracks who did what and when — covering agent actions, user logins, configuration changes, and system events.

## Category
SECURITY

## Backend Status
- ⚠️ **Platform audit exists but tenant-scoped audit is partial**
- `backend/src/modules/observability/` — logs platform events
- `GET /observability/logs` — returns audit trail (platform-wide)
- `ExecutionLog` model tracks agent execution details
- No tenant-specific audit API that scopes logs to a single tenant

## Tenant Frontend Status
- ❌ **No tenant audit log viewer**
- Tenants cannot see their own audit trail

## Admin Frontend Status
- ✅ **Admin has `/audit` page** — full platform audit log with search, filter, detail modal, CSV/JSON/PDF export
- `/settings/audit` — same audit viewer with export options
- Level filter (info/warning/error/critical), category filter, text search
- Detail modal shows old/new values, IP, user agent

## AI Employee Integration
- ⚠️ Agent actions are logged in `ExecutionLog` — agents cannot query audit logs
- No agent tool for audit log review

## Package/Tier Integration
- Key: `audit_logs`
- Toggleable per tier in tier settings
- Referenced in accounting packages

## Implementation Gaps
- Tenant-scoped audit API (`GET /api/v1/audit?tenantId=...`)
- Tenant audit log viewer UI
- Agent tool: "show me recent audit events"
- Retention policy configuration per tier
- Real-time audit event streaming via WebSocket
- Compliance exports (SOC2, GDPR data export)
