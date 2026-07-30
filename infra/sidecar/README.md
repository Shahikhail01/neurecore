# infra/sidecar/

Hermes execution sidecar — the isolated Python service that wraps the upstream
`NousResearch/hermes-agent` (vendored at `../hermes/hermes-agent/`, pinned SHA
in `../hermes/UPSTREAM_VERSION.md`).

**Plan ref:** NC-AWL-IMP-2 §1.3, §6

## What's in this directory (Phase 1 deliverables)

| File/Dir | Purpose | Status |
|---|---|---|
| `egress-allowlist.yaml` | Default-deny network egress policy | ✅ Created (Phase 1.0) |
| `nftables-hermes.nft` | Linux nftables rules generated from the allowlist | ✅ Created (Phase 1.0) |
| `systemd/hermes-sidecar.service` | hardened execution service | Complete |
| `systemd/hermes-events-bridge.service` | signed event persistence service | Complete |
| `RUNBOOK.md` | On-call runbook (start/stop/kill switch/upgrade) | ✅ Created (Phase 1.0) |
| `PHASE1-EXIT-GATE.md` | Binary pass/fail criterion for Phase 1 completion | ✅ Created (Phase 1.0) |
| `scripts/load-egress-rules.sh` | Applies nftables rules; fails closed | ✅ Created (Phase 1.0) |
| `scripts/phase1-exit-gate.sh` | Runs the 5-step exit gate | ✅ Created (Phase 1.0) |
| `hermes-sidecar/` (Python source) | FastAPI/uvicorn app wrapping `AIAgent` | Complete |

## Phase 1 Progress

See `PHASE1-EXIT-GATE.md` for the binary gate. Until 5/5 PASS, Phase 2 does not begin.

## Phase 1 Audit Status (2026-07-29)

- [✓] Vendor copy of upstream Hermes at pinned SHA `219c04a34...`
- [✓] Egress allowlist defined
- [✓] nftables rules generated
- [✓] systemd unit file drafted
- [✓] Runbook drafted
- [✓] Phase 1 exit gate script skeleton in place
- [x] FastAPI/uvicorn sidecar implementation
- [x] Stub toolset (6 tools)
- [x] Scoped token mint/verify in adapter gateway
- [x] Signed event persistence in the Phase 1 SQLite bridge
- [x] CI integration of the exit gate
- [ ] Production UID-scoped nftables deployment and egress verification
- [ ] Phase 2 handoff from the bridge to NeureCore's permanent audit store

## Related

- Plan: `neurecore/memory-bank-arc/plans/NEURECORE-AUTONOMOUS-WORK-LAYER-IMPLEMENTATION-PLAN-v2.md`
- Vendored Hermes: `../hermes/hermes-agent/`
- Adapter gateway (NestJS): `../../backend/src/modules/hermes-adapter/` (Phase 1.1)
- Three-layer HERMES_HOME spec: Plan §6
