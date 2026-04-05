# Google OAuth Test - Demo Tenant

## Date: 2026-04-04

## Goal

Implement per-tenant Google OAuth for the demo marketing agency tenant, enable real Google Workspace API access (Gmail, Calendar, Drive, Docs, Sheets).

## Google Credentials Provided

- **Client ID**: `665034346909-tn10p946kfpnckp817cv0d2kscealdup.apps.googleusercontent.com`
- **Client Secret**: `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`
- **Account**: gecdropship@gmail.com

## Implementation

### 1. OAuth Service (backend/src/modules/connectors/services/oauth.service.ts)

Added:

- `authorizeGoogle()` - generates OAuth URL with scopes for Gmail, Calendar, Drive, Docs, Sheets
- `callbackGoogle()` - exchanges authorization code for tokens, stores per-tenant
- `refreshGoogleToken()` - refreshes expired tokens
- `isGoogleConnected()` - checks if tenant has valid tokens

### 2. OAuth Controller (backend/src/modules/connectors/controllers/connectors.controller.ts)

Added endpoints:

- `GET /connectors/oauth/google/authorize` - initiate OAuth flow
- `GET /connectors/oauth/google/callback` - handle OAuth callback
- `GET /connectors/oauth/google/status` - check connection status
- `POST /connectors/oauth/google/refresh` - refresh tokens

### 3. Credentials Configuration

Added to `.env` and `backend/.env`:

```
GOOGLE_CLIENT_ID=665034346909-tn10p946kfpnckp817cv0d2kscealdup.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
GOOGLE_REDIRECT_URI=http://localhost:3000/api/v1/connectors/oauth/google/callback
```

### 4. Demo Tenant

- **Tenant**: Growth Marketing Agency (slug: growth-marketing-agency)
- **Login**: demo@marketing-agency.local / Marketing@123!
- **User ID**: b2d50661-cf7f-450a-85f7-e0895b10dbc7
- **Tenant ID**: 4109424f-59fa-463a-8f5e-52299fcf47f0

## Issues Encountered

### Issue 1: Invalid Email Format

Initial email had space: `demo@marketing agency.local`

- Fix: Created fix-user-email.cjs script to update to valid format

### Issue 2: ConfigService not loading Google credentials

The OAuth service was using `this.config.get('google.clientId')` but config didn't have nested `google` section.

- Fix: Changed to use `process.env.GOOGLE_CLIENT_ID` directly, then added ConfigService fallback

### Issue 3: Server environment loading

The NestJS server wasn't loading `.env` into process.env when started via pnpm

- Fix: Added dual support `(this.config.get('GOOGLE_CLIENT_ID') as string) || process.env.GOOGLE_CLIENT_ID`

## Testing Commands

```bash
# Start backend
cd backend && pnpm run start:dev

# Login
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@marketing-agency.local","password":"Marketing@123!"}' | jq -r '.data.tokens.accessToken')

# Get OAuth URL
curl -s -X GET "http://localhost:3000/api/v1/connectors/oauth/google/authorize" \
  -H "Authorization: Bearer $TOKEN"

# Expected: Returns OAuth URL to visit in browser
```

## OAuth Flow

1. User calls `/authorize` endpoint → returns Google OAuth URL
2. User visits URL in browser → logs into Google
3. Google redirects to `/callback` with auth code
4. Server exchanges code for tokens
5. Tokens stored encrypted (per tenant) in database
6. Tools can now use real Google APIs

## Next Steps

1. Run backend and complete OAuth flow manually
2. Test Google Workspace tool with real API calls
3. Verify AI Agents can send emails, create calendar events, access Drive

---

## Status: 2026-04-05

### Completed ✅

- [x] OAuth Service implementation with all methods
- [x] OAuth Controller endpoints
- [x] Google credentials configuration in .env
- [x] Demo tenant created and configured
- [x] All 3 issues fixed

### In Progress ⏳

- [ ] Manual OAuth flow testing with running backend
- [ ] Testing Google Workspace tools with real APIs
- [ ] Verifying AI Agents integration

### Testing Status

Waiting for backend to be started to execute OAuth flow test commands.

## Files Modified

- `backend/src/modules/connectors/services/oauth.service.ts` - Added Google OAuth methods
- `backend/src/modules/connectors/controllers/connectors.controller.ts` - Added endpoints
- `backend/src/modules/connectors/connectors.module.ts` - Imported ConfigModule
- `.env` - Added GOOGLE\_\* variables
- `backend/.env` - Added GOOGLE\_\* variables
- `backend/scripts/create-demo-tenant.cjs` - Fixed email validation
- `backend/scripts/test-google-oauth.js` - Test script
