# NeureCore AI — Live Channel OAuth Provisioning Runbook

**Document:** NC-OAUTH-RUNBOOK
**Date:** 2026-08-08
**Audience:** Operators, DevOps, Platform team
**Status:** Code complete; OAuth credentials must be provisioned per tenant

---

## 1. Purpose

The following channel integrations have **real, gate-tested code** but require
live OAuth credentials to function in production. Without these credentials,
the integrations operate in a fail-closed mode (typed errors, no data loss).

| Channel | Capability | Code Location | Gate |
|---------|------------|---------------|------|
| Outlook | CR-AI-1103 | `meetings/providers/outlook-call-graph.client.ts` | G25, G27 |
| Teams | CR-AI-1104 | `meetings/providers/teams-call-graph.client.ts` | G25, G27 |
| HubSpot | CR-AI-1106 | `channels/crm/hubspot-adapter.ts` | G27 |
| Salesforce | CR-AI-1106 | `channels/crm/salesforce-adapter.ts` | G27 |
| Google Mail | CR-AI-1102 | `integrations/google/google-gmail.service.ts` | G20 |
| Google Calendar | CR-AI-1102 | `integrations/google/google-calendar.service.ts` | G20 |

---

## 2. Microsoft Graph (Outlook + Teams)

### 2.1 Prerequisites

- Azure AD / Entra ID tenant with admin consent capability
- Registered app in [Azure Portal → App registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)

### 2.2 App Registration

| Setting | Value |
|---------|-------|
| Name | `NeureCore-Outlook-Teams` |
| Account type | Single tenant (your org only) |
| Redirect URI (Web) | `https://<your-domain>/api/v1/integrations/microsoft/callback` |

### 2.3 API Permissions (delegated)

| Permission | Scope | Required For |
|------------|-------|-------------|
| `Mail.Read` | Delegated | Email inbox sync |
| `Mail.Send` | Delegated | Email drafting |
| `Calendars.Read` | Delegated | Calendar event sync |
| `OnlineMeetings.Read` | Delegated | Teams meeting transcript ingestion |
| `OnlineMeetingTranscript.Read.All` | Delegated | Meeting summary generation |

### 2.4 Environment Variables

```bash
MS_GRAPH_CLIENT_ID=<app-registration-client-id>
MS_GRAPH_CLIENT_SECRET=<app-registration-client-secret>
MS_GRAPH_TENANT_ID=<your-azure-ad-tenant-id>
MS_GRAPH_REDIRECT_URI=https://<your-domain>/api/v1/integrations/microsoft/callback
```

### 2.5 Verify

```bash
# Test OAuth flow renders consent screen
curl -v "https://<your-domain>/api/v1/integrations/microsoft/auth-url?tenantId=<tenant-id>"

# After consent, test transcript ingestion (requires a real meeting)
curl -X POST "https://<your-domain>/api/v1/meetings/transcripts/ingest" \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"provider":"OUTLOOK","providerMeetingId":"<real-meeting-id>"}'
```

---

## 3. HubSpot

### 3.1 Prerequisites

- HubSpot developer account
- App created in [HubSpot Developer](https://developers.hubspot.com/)

### 3.2 App Setup

| Setting | Value |
|---------|-------|
| Auth type | OAuth 2.0 |
| Scopes | `crm.objects.contacts.read`, `crm.objects.contacts.write`, `crm.objects.deals.read`, `crm.schemas.custom.read` |
| Redirect URI | `https://<your-domain>/api/v1/integrations/hubspot/callback` |

### 3.3 Environment Variables

```bash
HUBSPOT_CLIENT_ID=<hubspot-app-client-id>
HUBSPOT_CLIENT_SECRET=<hubspot-app-client-secret>
HUBSPOT_REDIRECT_URI=https://<your-domain>/api/v1/integrations/hubspot/callback
```

### 3.4 Webhook Secret Rotation

HubSpot webhook signatures must be rotated. The adapter (`hubspot-adapter.ts`)
validates signatures using the secret from the credential store.

```bash
# Set webhook secret per tenant
curl -X PUT "https://<your-domain>/api/v1/integrations/credentials" \
  -H "Authorization: Bearer <admin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"connector":"HUBSPOT","tenantId":"<tenant-id>","webhookSecret":"<generated-secret>"}'
```

---

## 4. Salesforce

### 4.1 Prerequisites

- Salesforce org with API access
- Connected App in [Salesforce Setup → App Manager](https://login.salesforce.com/lightning/setup/Navigation)

### 4.2 Connected App Setup

| Setting | Value |
|---------|-------|
| Enable OAuth Settings | Yes |
| Callback URL | `https://<your-domain>/api/v1/integrations/salesforce/callback` |
| Selected OAuth Scopes | `api`, `refresh_token`, `offline_access` |
| Require Secret for Web Server Flow | Yes |

### 4.3 Environment Variables

```bash
SALESFORCE_CLIENT_ID=<connected-app-consumer-key>
SALESFORCE_CLIENT_SECRET=<connected-app-consumer-secret>
SALESFORCE_REDIRECT_URI=https://<your-domain>/api/v1/integrations/salesforce/callback
SALESFORCE_LOGIN_URL=https://login.salesforce.com
```

### 4.4 Channel Binding

```bash
curl -X POST "https://<your-domain>/api/v1/integrations/salesforce/channels/bind" \
  -H "Authorization: Bearer <admin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"<tenant-id>","instanceUrl":"https://<instance>.my.salesforce.com"}'
```

---

## 5. Google (Gmail + Calendar)

### 5.1 Prerequisites

- Google Cloud Console project
- OAuth 2.0 consent screen configured and verified

### 5.2 OAuth Client Setup

| Setting | Value |
|---------|-------|
| Application type | Web application |
| Authorized redirect URI | `https://<your-domain>/api/v1/integrations/google/callback` |
| Scopes | `https://www.googleapis.com/auth/gmail.readonly`, `https://www.googleapis.com/auth/gmail.send`, `https://www.googleapis.com/auth/calendar.readonly` |

### 5.3 Environment Variables

```bash
GOOGLE_CLIENT_ID=<google-cloud-client-id>
GOOGLE_CLIENT_SECRET=<google-cloud-client-secret>
GOOGLE_REDIRECT_URI=https://<your-domain>/api/v1/integrations/google/callback
```

---

## 6. Tenant-Scoped Credential Store

All credentials are stored per-tenant in `IntegrationCredentialStore`
(`backend/src/modules/integrations/credential-store/integration-credential.store.ts`).
Credentials are encrypted at rest and never logged.

To provision credentials for a specific tenant through the admin API:

```bash
curl -X POST "https://<your-domain>/command-center/integrations/credentials" \
  -H "Authorization: Bearer <admin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "<tenant-id>",
    "connector": "OUTLOOK",
    "credentials": {
      "clientId": "...",
      "clientSecret": "...",
      "tenantId": "..."
    }
  }'
```

---

## 7. Verification Checklist

| # | Check | Command / Evidence |
|---|-------|--------------------|
| 1 | MS Graph OAuth flow | Browse to `/api/v1/integrations/microsoft/auth-url?tenantId=<id>`, complete consent, verify redirect stores token |
| 2 | Outlook transcript ingest | `POST /api/v1/meetings/transcripts/ingest` with real meeting ID |
| 3 | Teams meeting summary | Verify `TeamsCallGraphClient` fetches a real transcript |
| 4 | HubSpot webhook | Send test webhook, verify `CrmEventTriggerService` logs event |
| 5 | Salesforce channel bind | `POST /api/v1/integrations/salesforce/channels/bind`, verify event push |
| 6 | Google OAuth flow | Browse to `/api/v1/integrations/google/auth-url?tenantId=<id>`, complete consent |
| 7 | Credential store audit | `SELECT tenant_id, connector, created_at FROM integration_credentials WHERE connector IN (...)` |

---

## 8. Failure Modes

| Scenario | Behavior |
|----------|----------|
| No credentials for tenant | `GET /integrations/microsoft/auth-url` returns `409 Conflict` with typed `IntegrationNotProvisionedError` |
| Expired refresh token | Adapter returns `401`; connector module retries once, then raises `TokenRefreshFailedError` |
| Invalid webhook signature | `CrmEventTriggerService` rejects with 403; event logged to audit |
| Credential rotation | Old tokens revoked; new tokens provisioned via admin API |

All failure modes are gate-tested (G27-M-006 through G27-M-010).

---

## 9. Document Control

- 2026-08-08 — created. Author: parity completion certification.
- Owner: `@integrations`, `@platform`, `@operations`
- This runbook must be executed before any public parity claim involving
  live channel integrations.

---

## 10. Simulation & Verification (No Real Credentials Required)

The following steps verify that the OAuth plumbing is correct **without** live
upstream credentials. These can be run immediately after deployment.

### 10.1 Fail-Closed Behavior Verification

All six connectors fail gracefully when no credentials are provisioned. Run
these checks to confirm:

```bash
# Microsoft: should return 409 with typed IntegrationNotProvisionedError
curl -s "https://<your-domain>/api/v1/integrations/microsoft/auth-url?tenantId=<test-tenant-id>" | jq '.error'

# Expected: { "code": "INTEGRATION_NOT_PROVISIONED", "connector": "OUTLOOK" }

# HubSpot: should return 409
curl -s "https://<your-domain>/api/v1/integrations/hubspot/auth-url?tenantId=<test-tenant-id>" | jq '.error'

# Salesforce: should return 409
curl -s "https://<your-domain>/api/v1/integrations/salesforce/auth-url?tenantId=<test-tenant-id>" | jq '.error'

# Google: should return 409
curl -s "https://<your-domain>/api/v1/integrations/google/auth-url?tenantId=<test-tenant-id>" | jq '.error'
```

### 10.2 Tenant Isolation Verification

```bash
# Cross-tenant access attempt — must return 404
curl -s -H "X-Tenant-Id: <other-tenant-id>" \
  "https://<your-domain>/api/v1/integrations/microsoft/auth-url?tenantId=<test-tenant-id>" | jq '.statusCode'
# Expected: 404
```

### 10.3 Stub Adapter Simulation

The `HubSpotAdapter` and `SalesforceAdapter` support a test mode for
dry-run verification without live upstream calls:

```bash
# HubSpot test: simulate webhook event
curl -X POST "https://<your-domain>/api/v1/integrations/hubspot/webhook" \
  -H "Content-Type: application/json" \
  -H "X-HubSpot-Signature: test-signature" \
  -d '{
    "test": true,
    "events": [{
      "subscriptionType": "contact.creation",
      "objectId": 12345,
      "propertyName": null,
      "propertyValue": null
    }]
  }'

# Expected: 202 Accepted with event logged to CrmEventTriggerService
# (when hubspot adapter is in SIMULATION mode without live credentials)
```

### 10.4 Credential Store Integrity

```bash
# Verify no credentials exist yet (fresh deployment)
# Run against the admin API:
curl -s "https://<your-domain>/command-center/integrations/credentials" \
  -H "Authorization: Bearer <admin-jwt>" | jq '.items | length'
# Expected: 0 (or count of already-provisioned connectors)

# Verify credential encryption: insert a test credential, then query it
# and confirm the secret is redacted in the response
```

### 10.5 Gate Runner Regression Check

All channel-related gate runners must still pass after deployment:

```bash
cd backend
pnpm jest --config jest.config.js \
  src/test/certification/g20-channels-studio.spec.ts \
  src/test/certification/g25-meetings-live.spec.ts \
  src/test/certification/g27-channels-live.spec.ts
# Expected: all APPROVED
```

### 10.6 Post-Provisioning Health Check

After real OAuth credentials are provisioned per tenant (Sections 2–5), run
this end-to-end smoke test:

```bash
# 1. Verify auth URL redirects to provider
curl -s -L "https://<your-domain>/api/v1/integrations/microsoft/auth-url?tenantId=<tenant-id>" \
  -o /dev/null -w "%{url_effective}\n"
# Expected: redirects to https://login.microsoftonline.com/...

# 2. Verify token refresh works (requires a previously-obtained refresh token)
curl -X POST "https://<your-domain>/api/v1/integrations/microsoft/refresh" \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"<tenant-id>","connector":"OUTLOOK"}'
# Expected: 200 with fresh access token

# 3. Verify webhook secret validation
# (Send a webhook from the upstream provider and check the event log)
```

### 10.7 Operator Dashboard

The Command Center integration health dashboard shows real-time status
for all connectors:

```bash
open "https://<your-domain>/command-center/integrations"
```

Expected columns: Connector, Tenant, Status (PROVISIONED / PENDING / ERROR),
Last Token Refresh, Webhook Health.

---

## 11. Document Control

- 2026-08-08 — created. Author: parity completion certification.
- 2026-08-08 — extended with simulation/verification section (§10) for
  pre-credential testing.
- Owner: `@integrations`, `@platform`, `@operations`
- This runbook must be executed before any public parity claim involving
  live channel integrations.
