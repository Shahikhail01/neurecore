# SMS

## Overview
Enable AI employees to send and receive SMS messages. Integrates with SMS providers (Twilio, AWS SNS, etc.) for transactional notifications, alerts, and conversational SMS.

## Category
COMMUNICATION

## Backend Status
- ❌ **No backend implementation exists**
- No SMS provider integration
- No webhook receiver for inbound SMS

## Tenant Frontend Status
- ❌ **No tenant UI**

## Admin Frontend Status
- ❌ **No admin UI**
- `IntegrationSettings` type does not include SMS fields

## AI Employee Integration
- ❌ **No agent tools** — agents cannot send or receive SMS

## Package/Tier Integration
- Key: `sms`
- Currently a placeholder flag

## Implementation Gaps
- SMS provider integration (Twilio SMS, AWS SNS, or similar)
- Agent tool for sending SMS (with template support)
- Inbound SMS webhook receiver
- Two-way SMS conversation handling for agents
- SMS analytics (delivery rates, response rates)
- Phone number provisioning and management
