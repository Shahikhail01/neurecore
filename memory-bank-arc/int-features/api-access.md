# API Access

## Overview
Grants tenants programmatic access to the NeureCore platform via REST APIs. Enables external systems to create tasks, manage agents, query data, and integrate NeureCore into existing workflows.

## Category
API

## Backend Status
- ✅ **Core API infrastructure exists** — all backend endpoints are RESTful via NestJS `@Controller`
- API versioning: `/api/v1/` prefix on all routes
- Authentication: JWT bearer tokens for all endpoints
- Role-based access control via `@Roles()` decorator and `RolesGuard`
- Rate limiting and throttling can be applied per-tenant when feature is enabled
- Swagger/OpenAPI docs at `/api/docs`

## Tenant Frontend Status
- ⚠️ **No dedicated "API Access" tenant page**
- API keys / tokens management UI not built
- Developers would need to authenticate as a user and use JWT tokens directly

## Admin Frontend Status
- ✅ **API is inherent** — admin itself consumes the same API via Next.js route handlers (`/app/api/v1/*`)
- No API key provisioning UI for tenants

## AI Employee Integration
- ✅ **Agents are API-native** — all agent tool execution goes through the same backend API
- External API access allows third-party systems to trigger agent tasks programmatically

## Package/Tier Integration
- Referenced in accounting packages by key `api_access`
- Controls whether a tenant can make external API calls beyond the UI
- Tier settings include "API Access" as a feature toggle (in `TierSettingsPage`)

## Implementation Gaps
- Tenant API key management UI (generate/revoke/rotate keys)
- Per-key permission scoping (which endpoints a key can access)
- Rate limit configuration per tier
- API usage analytics and billing metering
- Developer portal / API documentation accessible to tenants
