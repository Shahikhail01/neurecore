# ERP Integration

## Overview
Connect NeureCore AI employees with Enterprise Resource Planning (ERP) systems such as SAP, Oracle NetSuite, Microsoft Dynamics 365, and Odoo for data synchronization and process automation.

## Category
INTEGRATION (integrationKey: `erp`)

## Backend Status
- ❌ **No backend implementation exists** for generic ERP connectivity
- No OAuth or API client for any ERP system
- The existing `OAuthToken` model and connector infrastructure could be extended

## Tenant Frontend Status
- ❌ **No tenant UI** — no ERP connection page or settings

## Admin Frontend Status
- ❌ **No admin UI** — no ERP management page
- `IntegrationSettings` type does not include ERP fields

## AI Employee Integration
- ❌ **No agent tools** — agents cannot query or push data to ERP systems

## Package/Tier Integration
- Referenced in accounting packages by key `erp_integration`
- Currently acts as a placeholder flag

## Implementation Gaps
- ERP connector architecture needed (OAuth2, API key, or basic auth per system)
- Provider-specific adapters: SAP (RFC/REST), NetSuite (SOAP/REST), Dynamics 365 (OData), Odoo (JSON-RPC)
- Agent tools for ERP query (inventory, orders, customers) and mutation (create order, update record)
- Tenant UI for ERP connection configuration per provider
- Sync scheduling and webhook receivers for real-time updates
