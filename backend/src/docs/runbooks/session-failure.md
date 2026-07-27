# Session Refresh Failure Runbook

**Trigger:** 5xx on `/auth/refresh` for > 2min or
`session_refresh_failure_total` rising faster than baseline.

## Symptoms
- Users reporting "session expired" while they are actively working.
- CSRF errors on subsequent requests.
- `auth.refresh` returning 500 in the request log.

## Diagnosis
1. Filter request logs by `tenantId` and the affected `userId`.
2. Inspect `LoginAttempt` rows for the most recent failures on that
   user.
3. Check Redis (if used for refresh tokens) for connectivity and
   memory pressure.
4. Check the JWT signing key rotation history.

## Resolution
1. If the issue is a misconfigured rotation, fall back to the
   previous public key (`JWT_PUBLIC_KEY_PREVIOUS`) — the auth
   service keeps a 24h overlap window for exactly this scenario.
2. If Redis is the failure point:
   - Switch the refresh flow to the database-backed path
     (`RefreshToken` table) until Redis recovers.
   - Both paths produce identical signed JWTs so the user
     experience is uninterrupted.
3. If the signing key is corrupt, rotate and re-issue a forced
   logout broadcast to all sockets.
4. Once the failure is resolved, replay any dropped refresh
   requests (the client retries automatically).

## Verification
- A synthetic refresh succeeds end-to-end.
- No `session_refresh_failure_total` increments in the next 5min.
- Affected users can complete a clean refresh on their next
  attempt without re-authentication.
