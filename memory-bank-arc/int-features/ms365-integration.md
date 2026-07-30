# Microsoft 365 Integration

## Overview
Integrate NeureCore AI employees with Microsoft 365 services including Outlook (email), Teams (messaging), SharePoint (document management), and OneDrive (file storage).

## Category
INTEGRATION (integrationKey: `ms365`)

## Backend Status
- ❌ **No backend implementation exists**
- No OAuth module for Microsoft Identity Platform
- No Microsoft Graph API service classes
- No controllers or endpoints for Outlook, Teams, SharePoint, OneDrive

## Tenant Frontend Status
- ❌ **No tenant UI** — no Microsoft integration page exists
- Not listed in the integrations listing page
- No Microsoft Connect / Disconnect flow

## Admin Frontend Status
- ❌ **No admin UI** — no Microsoft integration management
- `IntegrationSettings` type does not include Microsoft fields

## AI Employee Integration
- ❌ **No agent tools** — no email, document, or calendar tools for Microsoft
- Agents cannot access or create Outlook emails, Teams messages, SharePoint docs, or OneDrive files via Microsoft

## Package/Tier Integration
- Referenced in accounting packages by key `ms365_integration`
- Requires `integrationKey: 'ms365'` to be set on the feature record
- Currently acts as a placeholder flag — enabling it on a tier grants nothing

## Implementation Gaps
- Full Microsoft Identity Platform OAuth flow needed (app registration, tenant consent, token refresh)
- Microsoft Graph API integration required for: Outlook Mail, Teams, SharePoint, OneDrive, Calendar
- AI agent tools analogous to the Google suite needed: EmailTool → Outlook, DocumentsTool → SharePoint/OneDrive
- Tenant UI for Microsoft OAuth connect/disconnect/status
- Admin monitoring of Microsoft integration status per tenant
- No `application/vnd.google-apps.*` equivalent for Microsoft MIME types
