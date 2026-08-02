# Webhooks

## Overview
Receive real-time event notifications from NeureCore to external systems. Triggers HTTP callbacks on configurable events such as task completion, agent status changes, new messages, and report generation.

## Category
API

## Backend Status
- ⚠️ **Partial — Brevo inbound webhooks fully implemented; general-purpose outbound webhooks not implemented**
- **Brevo inbound webhooks** (`backend/src/modules/integrations/brevo/brevo-webhook.service.ts`):
  - `POST /integrations/brevo/webhook` — public HMAC-SHA256-verified endpoint
  - Event persistence in `brevo_webhook_events` table with idempotent dedup
  - Hard-bounce → quota refund wiring
  - Suppression hooks on bounce/unsub/spam events
- **Routine webhook triggers** (`backend/src/modules/routines/`):
  - `WEBHOOK` trigger type for routines — routines can be triggered via HTTP POST to `/webhooks/routines/:path`
  - Webhook secret validation on incoming requests
  - `WebhooksController` at `routines.controller.ts:461`
- `backend/src/modules/notifications/` — `NotificationsService`, notification types (notification dispatch only)
- **No general-purpose outbound webhook system** — tenants cannot register arbitrary webhook URLs to receive platform events

## Tenant Frontend Status
- ❌ **No tenant webhook configuration UI for general webhooks**
- Brevo webhook events visible via `GET /integrations/brevo/events`
- No UI for registering custom webhook URLs or selecting events

## Admin Frontend Status
- ✅ **Brevo webhook admin dashboard** at `/admin/brevo/events` — cross-tenant webhook event explorer with filters
- ✅ Brevo webhook health probe at `/admin/brevo/health`
- ❌ No UI for general outbound webhook management

## AI Employee Integration
- ✅ Routine WEBHOOK triggers — agents can create routines triggered by incoming webhooks
- ❌ No agent tools for webhook management

## Package/Tier Integration
- Key: `webhooks`
- Toggleable per tier in tier settings
- Currently acts as placeholder flag — Brevo webhooks work regardless of this flag

## Implementation Gaps
- General-purpose outbound webhook system (tenant registers URL + selects events)
- Payload signing (HMAC) for general outbound webhooks
- Retry logic with exponential backoff for general webhooks
- Delivery logs visible to tenants for general webhooks
- Agent-triggered webhook events (task done, report ready, etc.)
- Inbound webhook → task creation for non-Brevo integrations
