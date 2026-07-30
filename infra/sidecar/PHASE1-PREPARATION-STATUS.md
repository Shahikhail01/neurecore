# Phase 1 Preparation — Status (2026-07-29)

**Plan ref:** NC-AWL-IMP-2 (NEURECORE-AUTONOMOUS-WORK-LAYER-IMPLEMENTATION-PLAN-v2.md)
**Phase:** 1 — Integration Spike
**Status:** Preparation complete; implementation not yet started

## What was done in this preparation pass

### 1. Upstream Hermes vendored ✓

- **Source verified:** local copy at `/home/najeeb/Linux-Dev/Temp-resources/hermes-agent-main/` was a partial snapshot (115 files diverged from upstream HEAD)
- **Upstream probed:** `https://github.com/NousResearch/hermes-agent.git`
- **HEAD SHA pinned:** `219c04a34122a0de7101526a7753c63446dec375` (2026-07-28 22:38:51 -0700, "docs(integrations): unified Buzz integration overview page")
- **Upstream version:** `0.19.0` (from `pyproject.toml`)
- **Vendor copy:** `neurecore/infra/hermes/hermes-agent/` (7,879 files, 163MB)
- **Verification:** `diff -rq` returned 0 differences between vendored copy and upstream HEAD (− the `.git/` directory)
- **Pin file:** `neurecore/infra/hermes/UPSTREAM_VERSION.md`
- **SHA-256 anchors:** `neurecore/infra/hermes/UPSTREAM_VERSION.sha256`

The local Temp-resources snapshot was **not** the upstream HEAD — it was an older extraction. The vendored copy in the repo is now the authoritative canonical snapshot at the pinned SHA.

### 2. Sidecar scaffolding created ✓

| File | Size | Purpose |
|---|---|---|
| `infra/sidecar/README.md` | overview | Directory map + Phase 1 progress checklist |
| `infra/sidecar/egress-allowlist.yaml` | 70 LOC | Default-deny egress policy |
| `infra/sidecar/nftables-hermes.nft` | 70 LOC | Generated nftables rules |
| `infra/sidecar/systemd/hermes-sidecar.service` | 100 LOC | systemd unit with hardening |
| `infra/sidecar/RUNBOOK.md` | 130 LOC | On-call runbook (kill switch, upgrade) |
| `infra/sidecar/PHASE1-EXIT-GATE.md` | 130 LOC | Binary pass/fail spec |
| `infra/sidecar/scripts/load-egress-rules.sh` | 60 LOC | nftables applier (fail-closed) |
| `infra/sidecar/scripts/phase1-exit-gate.sh` | 90 LOC | Gate runner (honest: rejects skeleton-only) |

### 3. Phase 1 exit gate wired (skeleton) ✓

The gate script `phase1-exit-gate.sh`:
- Currently runs all 5 steps as skeleton (matches spec file presence)
- **Honest rejection:** fails with explicit message if the sidecar source is not yet implemented (`hermes-sidecar/hermes_sidecar/main.py` missing)
- This prevents the skeleton from being mistaken for a real PASS

### 4. Three-layer HERMES_HOME storage specified ✓

| Layer | Mount | Path |
|---|---|---|
| Template (immutable) | `ro` bind | `/opt/neurecore/hermes/template/` |
| Persistent (tenant) | `rw` bind | `/var/lib/neurecore/hermes/tenants/<tenantId>/` |
| Ephemeral (per-execution) | `tmpfs` | `RuntimeDirectory=hermes-sidecar` |

Specified in `systemd/hermes-sidecar.service` lines `BindReadOnlyPaths`, `BindPaths`, `PrivateTmp`, `RuntimeDirectory`.

### 5. Default-deny network egress specified ✓

- Allowlist: `gateway.neurecore.internal`, `api.openai.com`, `api.anthropic.com`, `telemetry.neurecore.internal`
- Explicit deny: PostgreSQL subnet `10.0.0.0/8:5432`, `10.0.0.0/8:5433`, postgres-anywhere `*:5432`, redis-anywhere `*:6379`
- Loaded via `nftables-hermes.nft` with `policy drop`
- Verified through `load-egress-rules.sh` (fails closed if not root, or `nft` missing)

## What is NOT yet done (Phase 1.1 — next sprint)

These are the actual Phase 1 deliverables. The preparation above is the
*scaffolding* they plug into.

| Deliverable | Owner | ETA |
|---|---|---|
| `infra/hermes-sidecar/hermes_sidecar/main.py` (FastAPI app) | backend | Week 1 |
| `infra/hermes-sidecar/hermes_sidecar/stub_tools.py` (6 stub tools) | backend | Week 1 |
| `infra/hermes-sidecar/hermes_sidecar/lifecycle.py` (start/resume/cancel) | backend | Week 1 |
| `infra/hermes-sidecar/hermes_sidecar/auth.py` (scoped token verify) | backend | Week 1 |
| `infra/hermes-sidecar/scripts/setup-sidecar-netns.sh` | infra | Week 1 |
| `infra/hermes-sidecar/scripts/revoke-token.sh` | infra | Week 1 |
| `infra/hermes-sidecar/pyproject.toml` (Python deps) | backend | Week 1 |
| `infra/hermes-sidecar/venv/` (built in CI; not committed) | CI | Week 1 |
| `tests/integration/hermes-sidecar.spec.ts` | backend | Week 1 |
| `infra/hermes-sidecar/tests/test_lifecycle.py` | backend | Week 1 |
| `backend/src/modules/hermes-adapter/` (NestJS gateway) | backend | Week 1 |
| `backend/src/modules/hermes-adapter/services/token.service.ts` | backend | Week 1 |
| CI workflow: `infra/sidecar/.github/workflows/phase1-gate.yml` | infra | Week 1 |

## Risks logged during preparation

| Risk | Mitigation |
|---|---|
| Local copy divergence (115 files) from upstream HEAD | Vendor copy is now the upstream HEAD; local Temp-resources is no longer authoritative |
| Upstream moves fast (CI weekly probe) | Pin is enforced; upgrade is a separate sprint |
| nftables rules silently disabled | `load-egress-rules.sh` fails closed; systemd unit can include `nft -f` call at start |
| tmpfs size unconstrained | `RuntimeDirectoryMode=0750` + `MemoryMax=512M` on the systemd unit caps the working set |
| Three-layer storage composition done wrong | Documented in Plan §6 + systemd unit; needs review before deploy |

## Next actions

1. **Owner:** backend engineering team
2. **First task:** implement `infra/hermes-sidecar/hermes_sidecar/main.py` (FastAPI app skeleton)
3. **Test against:** the pinned SHA `219c04a34122a0de7101526a7753c63446dec375` vendored at `infra/hermes/hermes-agent/`
4. **Definition of "Phase 1 complete":** `phase1-exit-gate.sh` returns 0 with **real** sidecar code (not skeleton)

---

Approved: Phase 1 preparation is complete. Implementation is the next sprint.
