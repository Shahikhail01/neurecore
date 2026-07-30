# WhatsApp

## Overview
Integrate NeureCore AI employees with WhatsApp Business API for customer messaging, notifications, and conversational AI over WhatsApp.

## Category
INTEGRATION (integrationKey: `whatsapp`)

## Backend Status
- ❌ **No backend implementation exists**
- No WhatsApp Business API client
- No webhook receiver for incoming WhatsApp messages
- No message sending service

## Tenant Frontend Status
- ❌ **No tenant UI** — no WhatsApp connection page or settings
- Not present in integrations listing

## Admin Frontend Status
- ❌ **No admin UI** — no WhatsApp management
- `IntegrationSettings` type does not include WhatsApp

## AI Employee Integration
- ❌ **No agent tools** — agents cannot send or receive WhatsApp messages
- No WhatsApp channel in the agent communication system

## Package/Tier Integration
- Referenced in accounting packages by key `whatsapp`
- Currently acts as a placeholder flag only

## Implementation Gaps
- WhatsApp Business API account setup required (Meta Business verification)
- Inbound webhook receiver needed for message handling
- Outbound message sending via WhatsApp Cloud API
- Agent tool for WhatsApp messaging (send, read, respond)
- Tenant UI for WhatsApp number connection and settings
- Message template management for proactive notifications
