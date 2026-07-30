# Hermes Sidecar — Runbook

**Plan ref:** NC-AWL-IMP-2 §6
**Audience:** NeureCore on-call engineers

---

## 1. What this sidecar is

The `hermes-sidecar` is the Python execution service that wraps the upstream
`NousResearch/hermes-agent` (vendored at `infra/hermes/hermes-agent/`, pinned
SHA in `infra/hermes/UPSTREAM_VERSION.md`).

It accepts scoped bearer tokens from the NeureCore gateway (`backend/src/modules/hermes-adapter/`)
and runs agentic loops on behalf of one tenant execution at a time.

It must NEVER have direct access to PostgreSQL. All data access is mediated
by the gateway.

---

## 2. Start / stop / restart

```bash
# Check status
systemctl status hermes-sidecar

# Start
systemctl start hermes-sidecar

# Stop
systemctl stop hermes-sidecar

# Restart
systemctl restart hermes-sidecar

# Tail logs
journalctl -u hermes-sidecar -f
```

---

## 3. Emergency kill switch (3 AM procedure)

If the sidecar is misbehaving (token leak, runaway tool calls, network egress
suspicion), do this **first**:

```bash
# 1. Forensic snapshot (do NOT skip this)
journalctl -u hermes-sidecar --since "1 hour ago" > /tmp/hermes-snapshot.log
cp -r /opt/neurecore/hermes/tenants/<tenantId>/ /tmp/hermes-tenant-snapshot/

# 2. Kill the sidecar
systemctl kill -s SIGKILL hermes-sidecar

# 3. Revoke the scoped token at the gateway
#    (curl to the gateway's revoke endpoint, or:
curl -X POST https://gateway.neurecore.internal/v1/executions/<executionId>/revoke \
     -H "Authorization: Bearer $ADMIN_TOKEN"

# 4. Verify nftables isolation is still active
nft list table inet hermes_sidecar_egress

# 5. Notify #neurecore-incidents
```

---

## 4. Upstream Hermes upgrade procedure

⚠️ Upstream Hermes is **pinned** at SHA `219c04a34122a0de7101526a7753c63446dec375`
(see `infra/hermes/UPSTREAM_VERSION.md`). Upgrading is a separate sprint.

```bash
# 1. Clone the upstream in a probe directory
cd /opt/neurecore/hermes/upgrade-probes/
git clone --depth 1 https://github.com/NousResearch/hermes-agent.git probe-<date>
cd probe-<date>
NEW_SHA=$(git rev-parse HEAD)
echo "Probing $NEW_SHA"

# 2. Diff against pinned vendor
diff -rq /opt/neurecore/hermes/hermes-agent/ . | tee /tmp/diff-$NEW_SHA.txt

# 3. Run the Phase 1 exit gate against the new SHA
#    (see infra/sidecar/PHASE1-EXIT-GATE.md)
./infra/sidecar/scripts/phase1-exit-gate.sh /opt/neurecore/hermes/upgrade-probes/probe-<date>

# 4. Only if the gate passes: update the pinned version
#    - Update infra/hermes/UPSTREAM_VERSION.md
#    - Run `cp -r probe-<date>/* /opt/neurecore/hermes/hermes-agent/`
#    - Re-run the Phase 1 exit gate against the production vendor
#    - Commit the version-pin change as a single PR
```

---

## 5. Egress isolation verification

The nftables rules in `infra/sidecar/nftables-hermes.nft` enforce default-deny
egress. To verify they are active:

```bash
# 1. List the rules
nft list table inet hermes_sidecar_egress

# 2. Attempt a denied connection under the sidecar UID
runuser -u hermes-sidecar -- \
    timeout 3 bash -c 'echo > /dev/tcp/127.0.0.1/5432' 2>&1
# Expected: connection refused / timeout

# 3. Attempt an allowed connection
runuser -u hermes-sidecar -- \
    timeout 3 bash -c 'echo > /dev/tcp/127.0.0.1/8082'
# Expected: connection established
```

If either test fails, escalate to security team immediately.

---

## 6. Common failure modes

| Symptom | Likely cause | Action |
|---|---|---|
| Sidecar won't start | `EnvironmentFile=/opt/neurecore/hermes-sidecar/config/environment` missing | Create env file with at least `OPENAI_API_KEY` (or `ANTHROPIC_API_KEY`) and `NEURECORE_GATEWAY` |
| `HermesAgent ... not found` | Workspace not provisioned | Check `HermesAdapterGateway` logs for the workspace creation step |
| Token rejected | Token expired (>15 min) | Re-mint via gateway; check NTP drift |
| Egress blocked on allowed host | DNS resolution failed | Check `/etc/resolv.conf`; verify host in allowlist |
| Restart loop | Bad config or provider outage | Check `journalctl -u hermes-sidecar -n 200` |

---

## 7. Where to find logs

| Stream | Path |
|---|---|
| Sidecar stdout/stderr | `journalctl -u hermes-sidecar` |
| Phase 1 execution events | Signed event bridge SQLite store |
| Permanent audit and approval records | Phase 2 deliverable; do not claim these exist yet |
| Token mint | `backend/src/modules/hermes-adapter/services/token.service.ts` logs |
| Upstream Hermes internal | `$HERMES_HOME/logs/` (ephemeral, wiped on completion) |

---

## 8. Escalation

- **P1 (production down, data leak, security incident):** Page security team immediately; pin Slack `#neurecore-incidents`
- **P2 (one tenant execution failing):** Stop the sidecar, create incident, continue investigation
- **P3 (single-run failure, retry succeeds):** Log and continue; review in next weekly retro
