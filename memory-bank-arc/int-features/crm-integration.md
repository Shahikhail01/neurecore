# CRM Integration

## Overview
Synchronize NeureCore AI employees with Customer Relationship Management (CRM) platforms. Currently supports HubSpot, Salesforce, and Pipedrive via the connectors system.

## Category
INTEGRATION (integrationKey: `crm`)

## Backend Status
- ⚠️ **Partial implementation** — connector framework exists
- `backend/src/modules/connectors/` — `connectors.service.ts`, `oauth.service.ts`, `oauth-token.service.ts`
- Providers: HubSpot, Salesforce, Pipedrive (provider list from backend)
- OAuth token storage in `OAuthToken` model (generic, keyed by `provider` string)
- Sync operations: Sync Contacts, Sync Leads per connector

## Tenant Frontend Status
- ⚠️ **Partial** — callable from admin UI but tenant-facing CRM pages TBD
- No dedicated tenant CRM integration page in the tenant frontend

## Admin Frontend Status
- ⚠️ **Admin has `/connectors` page** — register new connectors, trigger sync, delete
- Connector management UI: name + provider selection, sync buttons
- No detailed per-tenant CRM status view

## AI Employee Integration
- ⚠️ **No dedicated agent tools** for CRM operations
- Agents may access CRM data indirectly if the backend exposes it, but no structured `CrmTool` exists
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
