# Single Sign-On (SSO)

## Overview
Allow tenant users to authenticate via their corporate identity provider using SAML 2.0 or OpenID Connect (OIDC). Supports Okta, Azure AD, Google Workspace, OneLogin, and generic IdP providers.

## Category
SECURITY

## Backend Status
- ❌ **No SSO implementation exists**
- No SAML or OIDC library integration
- No IdP metadata management
- No Just-In-Time (JIT) user provisioning

## Tenant Frontend Status
- ❌ **No tenant SSO configuration page**

## Admin Frontend Status
- ❌ **No SSO management page**
- `IntegrationSettings` type does not include SSO fields

## AI Employee Integration
- ✅ **Not applicable** — SSO is an authentication concern, agents are unaffected

## Package/Tier Integration
- Key: `sso`
- Toggleable per tier in tier settings
- Referenced in accounting packages

## Implementation Gaps
- SAML 2.0 service provider implementation (login flow, ACS endpoint, logout)
- OIDC provider support (discovery URL, client credentials, callback)
- IdP metadata upload/URL configuration UI
- Certificate management for SAML signing
- JIT user provisioning (auto-create users on first SSO login)
- Role mapping from IdP attributes to NeureCore roles
- Multi-IdP support (different IdP per tenant)
- SSO session management (IdP-initiated logout, session timeout)
