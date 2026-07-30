# Phase 1 Exit Gate — Hermes Sidecar

**Plan ref:** NC-AWL-IMP-2 §1.4, Phase 1 exit gate
**Mandatory before Phase 2 begins.**

This is the **binary pass/fail** criterion for completing Phase 1. The bridge
must work end-to-end with stub tools before any real NeureCore APIs are wired.

---

## Gate: `start → pause → approve → resume → complete`

The following end-to-end test must pass **5/5**:

### Step 1 — `startExecution`
```bash
curl -X POST https://adapter.neurecore.internal/v1/executions \
  -H "Authorization: Bearer $SCOPED_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "executionId": "phase1-gate-test-1",
    "tenantId": "test-tenant",
    "projectId": "test-project",
    "workspaceSpec": { "layers": ["template", "persistent", "tmpfs"] },
    "allowedTools": ["stub.echo", "stub.approval_required"],
    "initialMessage": "hello"
  }'
```
**Expected:** HTTP 201 with the execution ID and current status.

### Step 2 — Run a stub tool (no approval needed)
The sidecar should call `stub.echo` and return a stub reply.
**Expected:** persisted events include `tool.call` → `tool.completed` → `execution.completed`.

### Step 3 — Start with an approval-required stub
```bash
curl -X POST https://adapter.neurecore.internal/v1/executions \
  -H "Authorization: Bearer $SCOPED_TOKEN" \
  -d '{
    "executionId": "phase1-gate-test-2",
    "initialMessage": "use the approval-required tool"
  }'
```
**Expected:** Status becomes `WAITING_APPROVAL`, response includes `approvalId`

### Step 4 — Recover from SIGKILL
```bash
PID=$(systemctl show -p MainPID hermes-sidecar | cut -d= -f2)
kill -9 $PID
sleep 2
systemctl status hermes-sidecar
```
**Expected:** Sidecar restarts, status remains `WAITING_APPROVAL` (state recovered from disk)

### Step 5 — Submit approval decision and resume
```bash
curl -X POST https://adapter.neurecore.internal/v1/executions/phase1-gate-test-2/approvals/<approvalId> \
  -H "Authorization: Bearer $SCOPED_TOKEN" \
  -d '{ "decision": "approve", "reason": "phase1-gate-test" }'
```
**Expected:**
- Sidecar resumes execution
- Tool completes successfully
- Execution status = `COMPLETED`
- All events captured in the signed Phase 1 event store

---

## Verifying the gate

```bash
# Run the automated gate script
./infra/sidecar/scripts/phase1-exit-gate.sh

# Expected output:
#   [✓] Step 1: startExecution
#   [✓] Step 2: stub tool call
#   [✓] Step 3: approval-required stub
#   [✓] Step 4: SIGKILL recovery
#   [✓] Step 5: approval resume
#   ─────────────────────────────────
#   Phase 1 exit gate: 5/5 PASS
#
#   Phase 2 (SIM-04 vertical slice) is GO.
```

If any step fails, the gate is **FAIL**. Phase 2 does NOT begin. Investigate
the failure, fix the integration, re-run the gate.

---

## CI integration

This gate is wired into CI as a required job:
- File: `.github/workflows/hermes-phase1-gate.yml`
- Trigger: every PR that touches `infra/hermes/`, `infra/hermes-sidecar/`, or `backend/src/modules/hermes-adapter/`
- Required status: green before merge

---

## Stub toolset

The Phase 1 sidecar has only **6 stub tools** (no real NeureCore APIs):

| Tool | Schema | Approval |
|---|---|---|
| `stub.echo` | `{message: string}` | no |
| `stub.wait` | `{seconds: number}` | no |
| `stub.approval_required` | `{action: string}` | yes |
| `stub.fail` | `{message: string}` | no |
| `stub.list_events` | `{executionId: string}` | no |
| `stub.sleep` | `{ms: number}` | no |

These are defined in `infra/hermes-sidecar/hermes_sidecar/stub_tools.py`
(Phase 1 implementation file).
