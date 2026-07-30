# Multi-Tenant Support

## Overview
Core platform architecture enabling isolated workspaces for multiple organizations (tenants) within a single NeureCore deployment. Each tenant has its own data, users, agents, integrations, and configuration — fully isolated from other tenants.

## Category
PLATFORM

## Backend Status
- ✅ **Inherent to the platform architecture**
- `Tenant` model is the root entity — all other models reference `tenantId`
- All database queries are tenant-scoped (enforced by Prisma schema relations)
- Authentication includes `tenantId` in JWT payload
- Tenant isolation is built into every service and controller
- Tenant lifecycle: create, suspend, cancel, activate
- Tenant plans: Starter, Professional, Enterprise, Government (via Tier system)

## Tenant Frontend Status
- ✅ **Each tenant has their own login, settings, agents**
- Tenant UI at `frontend-tenant/` — branded per tenant
- Tenant-specific settings, integrations, agent management

## Admin Frontend Status
- ✅ **Admin manages all tenants** — `/tenants` list, `/tenants/[id]` detail
- Tenant CRUD, deployment, and monitoring
- Per-tenant feature flags via `/feature-flags` console
- Per-tenant billing and cost tracking via `/billing`

## AI Employee Integration
- ✅ **Agents are always tenant-scoped** — `Agent.tenantId` in every query
- Agent Drive folders are created under the tenant's root Drive folder
- Agent tools receive `tenantId` in execution context
- Agents cannot access data or resources from other tenants

## Package/Tier Integration
- Key: `multi_tenant`
- Always implicitly active — platform cannot function without it
- Not togglable — it's the core architecture

## Implementation Status
- ✅ Fully implemented and operational
- No gaps — multi-tenancy is the foundation of the platform
