# Webhooks

## Overview
Receive real-time event notifications from NeureCore to external systems. Triggers HTTP callbacks on configurable events such as task completion, agent status changes, new messages, and report generation.

## Category
API

## Backend Status
- ⚠️ **Partial implementation** — webhook infrastructure exists in the notifications module
- `backend/src/modules/notifications/` — `NotificationsService`, notification types
- Webhook event dispatching needs to be wired per domain event
- No dedicated webhook receiver endpoint or retry logic module

## Tenant Frontend Status
- ❌ **No tenant webhook configuration UI**
- Tenants cannot register webhook URLs or select events to subscribe to

## Admin Frontend Status
- ⚠️ **IntegrationSettings type includes `webhookEnabled` and `webhookUrl`** — but as a platform setting, not per-tenant
- No tenant webhook management UI

## AI Employee Integration
- ❌ **No agent tools for webhook management**
- Agents cannot register, test, or manage webhooks

## Package/Tier Integration
- Key: `webhooks`
- Toggleable per tier in tier settings
- Currently listed but not wired to actual webhook delivery

## Implementation Gaps
- Webhook registration CRUD (tenant creates/manages webhook URLs)
- Event type selection and filtering per webhook
- Payload signing (HMAC) for security
- Retry logic with exponential backoff
- Delivery logs visible to tenants
- Agent-triggered webhook events (task done, report ready, etc.)
