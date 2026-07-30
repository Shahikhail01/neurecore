# White Label

## Overview
Remove NeureCore branding from the tenant experience. Enables resellers and enterprises to present the platform as their own with custom domain, custom login page, and no NeureCore references in the UI or communications.

## Category
BRANDING

## Backend Status
- ⚠️ **Partial** — platform supports custom domains via LiteSpeed vhosts (Contabo)
- No dynamic white-label configuration service
- Branding removal hooks not implemented in UI rendering

## Tenant Frontend Status
- ❌ **No tenant white-label settings page**
- Branding is currently hardcoded with NeureCore references

## Admin Frontend Status
- ❌ **No white-label management page**
- `IntegrationSettings` type does not include white-label fields

## AI Employee Integration
- ✅ **Not applicable** — white-label is a UI/branding concern, agents are unaffected

## Package/Tier Integration
- Key: `white_label`
- Toggleable per tier
- Currently a placeholder flag

## Implementation Gaps
- Custom domain configuration (CNAME setup, SSL cert management)
- Remove all NeureCore branding from tenant UI (logo, favicon, colors, typography)
- Custom login page with tenant's own branding
- White-label email templates (remove "Powered by NeureCore" from agent emails)
- Custom terms of service and privacy policy URLs
- Reseller management console (optional, for multi-tenant resellers)
