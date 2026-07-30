# Two-Factor Authentication

## Overview
Enhance account security with time-based one-time passwords (TOTP). Requires users to provide a verification code from their authenticator app in addition to their password when logging in.

## Category
SECURITY

## Backend Status
- ❌ **No 2FA implementation exists**
- No TOTP library integration
- No backup code generation
- No 2FA enforcement mechanism

## Tenant Frontend Status
- ❌ **No 2FA setup or login flow**
- Login is email/password only (or Google Sign-In)

## Admin Frontend Status
- ❌ **No 2FA management or enforcement**
- No admin policies for requiring 2FA

## AI Employee Integration
- ✅ **Not applicable** — 2FA is a user authentication concern

## Package/Tier Integration
- Key: `two_factor`
- Referenced in accounting packages
- Currently a placeholder flag

## Implementation Gaps
- TOTP secret generation and QR code display
- Authenticator app enrollment flow (setup → verify → enable)
- 2FA challenge step in login flow (after password verification)
- Backup/recovery codes for account recovery
- "Remember this device" cookie/trust flow
- Admin enforcement policy (optional/required per role or tenant)
- 2FA status indicator in user profile/settings
- WebAuthn/FIDO2 support as alternative to TOTP
