# Integration Features Index

This directory documents the atomic platform capabilities (Features) managed in the Admin `Features` page and assignable to tenant Tiers and Packages.

## Feature Documents

### INTEGRATION
| Doc | Key | Summary |
|-----|-----|---------|
| [ms365-integration.md](./ms365-integration.md) | `ms365_integration` | Microsoft 365 (Outlook, Teams, SharePoint, OneDrive) |
| [google-workspace.md](./google-workspace.md) | `google_workspace` | Google Workspace (Gmail, Drive, Calendar, Sheets) |
| [whatsapp.md](./whatsapp.md) | `whatsapp` | WhatsApp Business messaging |
| [erp-integration.md](./erp-integration.md) | `erp_integration` | ERP system connectivity |
| [crm-integration.md](./crm-integration.md) | `crm_integration` | CRM platform sync (HubSpot, Salesforce, Pipedrive) |

### API
| Doc | Key | Summary |
|-----|-----|---------|
| [api-access.md](./api-access.md) | `api_access` | REST/GraphQL API access for external systems |
| [webhooks.md](./webhooks.md) | `webhooks` | Outbound webhook event notifications |

### COMMUNICATION
| Doc | Key | Summary |
|-----|-----|---------|
| [voice-calling.md](./voice-calling.md) | `voice_calling` | Voice call capabilities |
| [sms.md](./sms.md) | `sms` | SMS messaging integration |

### BRANDING
| Doc | Key | Summary |
|-----|-----|---------|
| [white-label.md](./white-label.md) | `white_label` | White-label (remove NeureCore branding, custom domain) |
| [custom-branding.md](./custom-branding.md) | `custom_branding` | Custom branding (logo, colors, theme) |

### ANALYTICS
| Doc | Key | Summary |
|-----|-----|---------|
| [advanced-analytics.md](./advanced-analytics.md) | `advanced_analytics` | Advanced analytics dashboard and insights |
| [custom-reports.md](./custom-reports.md) | `custom_reports` | Custom report builder and scheduling |

### AUTOMATION
| Doc | Key | Summary |
|-----|-----|---------|
| [workflow-automation.md](./workflow-automation.md) | `workflow_automation` | Multi-step workflow automation engine |
| [routines.md](./routines.md) | `routines` | Scheduled routine execution for agents |

### SECURITY
| Doc | Key | Summary |
|-----|-----|---------|
| [sso.md](./sso.md) | `sso` | Single Sign-On (SAML 2.0 / OIDC) |
| [audit-logs.md](./audit-logs.md) | `audit_logs` | Immutable audit trail |
| [two-factor.md](./two-factor.md) | `two_factor` | Two-factor authentication (TOTP) |

### PLATFORM
| Doc | Key | Summary |
|-----|-----|---------|
| [multi-tenant.md](./multi-tenant.md) | `multi_tenant` | Multi-tenant isolation and management |

### AUTH (cross-cutting, not a feature flag)
| Doc | Summary |
|-----|---------|
| [auth-architecture.md](./auth-architecture.md) | **The authoritative reference for the IAuthService facade (FIX-020).** 7 SOLID interfaces, 7 implementations, DI container, atomic `killSession()`, banned patterns. **Read this before any auth change.** |

## Reference

- **Prisma model**: `Feature` at `schema.prisma:2788` — fields: `id`, `key` (unique), `name`, `description`, `category` (enum), `icon`, `integrationKey`, `sortOrder`
- **Enum**: `FeatureCategory` at `schema.prisma:2711` — `INTEGRATION | API | COMMUNICATION | BRANDING | ANALYTICS | AUTOMATION | SECURITY | PLATFORM`
- **Seed file**: `backend/prisma/seed-business-composition.cjs:47` — 19 features upserted idempotently
- **Backend module**: `backend/src/modules/features/` — CRUD via `PoolController`, filters by category as "status", unique key is `key`, default sort by `sortOrder`
- **API**: `GET/POST /api/v1/features`, `GET/PATCH/DELETE /api/v1/features/:id` — SUPER_ADMIN/PLATFORM_ADMIN for writes
- **Admin frontend**: `frontend-admin/src/app/features/page.tsx` — grid with category filter, search, CRUD modal
- **Service**: `frontend-admin/src/services/featuresPool.service.ts` — implements `IPoolAdminService`
- **Package linking**: Features are linked to Packages via many-to-many `PackageFeatures` relation in `seed-accounting-packages.cjs`

## Status Legend
- ✅ Implemented — fully built and functional
- ⚠️ Partial — core exists but gaps remain
- ❌ Not implemented — placeholder flag only
