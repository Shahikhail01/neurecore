# Socket Failure Runbook

**Trigger:** `socket_reconnect_total` > 10 per minute or
`socket_error_total` rising with no recovery.

## Symptoms
- Realtime timeline / chat panels stop updating without a refresh.
- "Connection lost" toast appears for multiple users.
- The metrics dashboard shows a sustained socket error rate.

## Diagnosis
1. Confirm the alert by checking the `socket_reconnect_total` and
   `socket_error_total` metrics.
2. Inspect the request logger output for the most recent
   `upgrade` failures (look for 4xx/5xx on the WebSocket handshake).
3. Cross-check the load balancer / ingress for stale connections.
4. Verify the `correlationId` of the failing users to identify a
   common tenant, region, or platform.

## Resolution
1. If the load balancer is dropping connections:
   - Increase the idle timeout (default 60s → 120s).
   - Verify sticky-session configuration for socket-aware routes.
2. If the application is the source of errors:
   - Roll back the most recent socket-related deploy.
   - Restart the affected pods (clients will reconnect automatically
     with the `socket_reconnect_total{result="success"}` counter
     incrementing).
3. If a single tenant is affected (e.g. their auth handshake fails
   mid-reconnect), force-revoke the affected sessions and instruct
   users to re-authenticate.

## Verification
- `socket_error_total` returns to baseline within 5min.
- `socket_reconnect_total{result="success"}` increments as clients
  recover.
- The unified timeline resumes streaming without manual refresh.
