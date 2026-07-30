# Custom Branding

## Overview
Allow tenants to customize the platform appearance with their own logo, color scheme, and theme. Distinct from White Label in that NeureCore attribution remains visible.

## Category
BRANDING

## Backend Status
- ❌ **No backend implementation** for per-tenant branding storage
- No branding configuration model in Prisma
- No API endpoints for branding asset management

## Tenant Frontend Status
- ❌ **No tenant branding settings page**
- Tenant cannot upload logo or change colors

## Admin Frontend Status
- ⚠️ **General settings page exists** (`/settings/general`) — but it's a client-side mock with no real save
- Admin can set platform name, support email, default language/timezone — these are platform-wide, not per-tenant
- No per-tenant branding management

## AI Employee Integration
- ✅ **Not applicable** — branding is a UI concern

## Package/Tier Integration
- Key: `custom_branding`
- Toggleable per tier
- Currently a placeholder flag

## Implementation Gaps
- Tenant branding model in Prisma: `logo_url`, `favicon_url`, `primary_color`, `secondary_color`, `accent_color`, `font_family`, `custom_css`
- API endpoints for branding CRUD
- Tenant Branding settings page in tenant frontend
- Dynamic theme injection based on tenant branding config
- Email branding (logo in email footers, branded email templates)
