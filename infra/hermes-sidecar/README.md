# hermes-sidecar

NeureCore Hermes execution sidecar — Phase 1.1 integration spike.

**Plan ref:** NC-AWL-IMP-2 §1.3, Phase 1.1

This is the Phase 1 integration spike. The lifecycle gate intentionally uses
stub tools, while `aiagent.py` wraps the pinned upstream runtime for the
credential-gated construction and live-smoke tests.

## What's in Phase 1.1

- FastAPI app with 5 endpoints: `startExecution`, `resumeExecution`, `cancelExecution`, `getExecutionStatus`, `submitApprovalDecision`
- 6 stub tools (no real NeureCore APIs yet)
- HMAC-SHA256 scoped token verification (no DB access)
- In-memory state machine for one execution at a time
- SIGKILL recovery via state.json snapshot to disk
- 5 pytest cases that drive the Phase 1 exit gate

## What's NOT in Phase 1

- Real NeureCore API calls (Phase 2)
- nftables enforcement (separate infra workstream)
- Permanent NeureCore audit/approval persistence (Phase 2)

## Running

```bash
# Install (uses a local venv; not committed)
cd infra/hermes-sidecar
python3 -m venv venv
source venv/bin/activate
pip install -e ".[dev]"

# Run the Phase 1 exit gate
./infra/sidecar/scripts/phase1-exit-gate.sh
# OR equivalently:
pytest tests/ -v
```

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `HERMES_SIDECAR_PORT` | `8080` | uvicorn port |
| `HERMES_SIDECAR_SECRET` | `dev-secret-do-not-use-in-prod` | HMAC signing key |
| `HERMES_SIDECAR_STATE_DIR` | `./.state` | where execution state.json files live |
| `HERMES_SIDECAR_EVENT_WEBHOOK` | `""` | URL to forward events to (gateway) |

## Layout

```
hermes-sidecar/
├── pyproject.toml
├── README.md
├── hermes_sidecar/
│   ├── __init__.py
│   ├── main.py            # FastAPI app + endpoints
│   ├── lifecycle.py       # state machine (start/resume/cancel/getStatus)
│   ├── auth.py            # HMAC scoped token verify
│   ├── stub_tools.py      # 6 stub tools
│   ├── events.py          # event emission (in-memory + webhook)
│   └── models.py          # Pydantic models
└── tests/
    ├── __init__.py
    └── test_lifecycle.py  # 5 real exit-gate tests
```
