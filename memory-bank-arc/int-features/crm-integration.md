# CRM Integration

## Overview
Synchronize NeureCore AI employees with Customer Relationship Management (CRM) platforms. Currently supports HubSpot, Salesforce, Pipedrive, Shopify, and Square via the connectors system.

**Note:** The connectors module has adapters for these providers, but the tenant-facing OAuth connect flow and agent tools are not yet built.

## Category
INTEGRATION (integrationKey: `crm`)

## Backend Status
- ⚠️ **Partial implementation** — connector framework exists
- `backend/src/modules/connectors/` — connector registry, adapters
- **Connector adapters** (`backend/src/modules/connectors/adapters/`):
  - `hubspot.adapter.ts` — HubSpot CRM adapter
  - `pipedrive.adapter.ts` — Pipedrive CRM adapter
  - `salesforce.adapter.ts` — Salesforce CRM adapter
  - `shopify.adapter.ts` — Shopify e-commerce adapter
  - `square.adapter.ts` — Square payments adapter
- `OAuthToken` model for credential storage per provider
- No tenant-facing OAuth connect flow for CRM providers yet

## Tenant Frontend Status
- ❌ **No tenant CRM integration page**
- CRM settings not exposed to tenants

## Admin Frontend Status
- ⚠️ **Admin has `/connectors` page** — register new connectors, trigger sync, delete
- Connector management UI: name + provider selection, sync buttons
- No detailed per-tenant CRM status view

## AI Employee Integration
- ❌ **No dedicated agent tools** for CRM operations
- No CRM tools in the agent tool registry
- Potential: agents could query contact/lead data, create records, update deals

## Package/Tier Integration
- Referenced in accounting packages by key `crm_integration`
- Directly relates to the connector sync feature

## Implementation Gaps
- Agent tool wrapping CRM operations (query contacts, create leads, update deals)
- Tenant-facing CRM settings page for OAuth connect and sync configuration
- Real-time sync via webhooks (currently sync is manually triggered)
- Support for additional CRM providers (Zoho CRM, Freshsales, etc.)
- Bidirectional sync with conflict resolution
