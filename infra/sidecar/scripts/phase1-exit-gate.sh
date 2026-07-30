#!/usr/bin/env bash
# phase1-exit-gate.sh — Phase 1 exit gate runner
#
# Plan ref: NC-AWL-IMP-2 §1.4
#
# Runs the 5-step end-to-end test that proves the bridge between
# NeureCore gateway and Hermes sidecar works with stub tools.
#
# Usage: ./phase1-exit-gate.sh
# Exit: 0 on PASS, 1 on FAIL

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GATE_SPEC="$SCRIPT_DIR/../PHASE1-EXIT-GATE.md"
SIDECAR_DIR="$SCRIPT_DIR/../../hermes-sidecar"
SIDECAR_SRC="$SIDECAR_DIR/hermes_sidecar/main.py"
TESTS_DIR="$SIDECAR_DIR/tests/test_lifecycle.py"

# ─── Honest prelude ─────────────────────────────────────────
if [[ ! -f "$SIDECAR_SRC" ]]; then
    echo "────────────────────────────────────────────────────────────────"
    echo "PHASE 1 EXIT GATE: FAIL (skeleton only)"
    echo ""
    echo "Sidecar source not yet present:"
    echo "  expected: $SIDECAR_SRC"
    echo ""
    echo "Phase 1 deliverable gap: FastAPI/uvicorn sidecar + stub tools."
    echo "Phase 2 (SIM-04 vertical slice) is BLOCKED."
    echo "────────────────────────────────────────────────────────────────"
    exit 1
fi

if [[ ! -f "$TESTS_DIR" ]]; then
    echo "PHASE 1 EXIT GATE: FAIL — tests missing at $TESTS_DIR"
    exit 1
fi

# ─── Run the 5 real pytest cases ───────────────────────────
cd "$SIDECAR_DIR"

# Use a venv if it exists, otherwise fall back to system python
if [[ -d "venv" ]]; then
    # shellcheck source=/dev/null
    source venv/bin/activate
fi

# Make sure dependencies are installed
if ! python3 -c "import fastapi, pydantic, httpx" 2>/dev/null; then
    echo "────────────────────────────────────────────────────────────────"
    echo "PHASE 1 EXIT GATE: FAIL — missing dependencies"
    echo ""
    echo "Run:  pip install -e '.[dev]'  inside $SIDECAR_DIR"
    echo "Or:  python3 -m venv venv && source venv/bin/activate && pip install -e '.[dev]'"
    echo "────────────────────────────────────────────────────────────────"
    exit 1
fi

echo "────────────────────────────────────────────────────────────────"
echo "Phase 1 exit gate: running 5 real pytest cases"
echo "────────────────────────────────────────────────────────────────"

# Run the 5 phase-1 tests (the ones marked as exit gate steps)
# Plus the 4 auth tests for completeness
PYTEST_TARGETS=(
    "tests/test_lifecycle.py::test_step_1_start_execution_simple"
    "tests/test_lifecycle.py::test_step_2_stub_echo_no_approval"
    "tests/test_lifecycle.py::test_step_3_approval_required_parks_execution"
    "tests/test_lifecycle.py::test_step_4_sigkill_recovery"
    "tests/test_lifecycle.py::test_step_5_approval_resume_completes"
    "tests/test_lifecycle.py::test_auth_missing_token_rejected"
    "tests/test_lifecycle.py::test_auth_bad_signature_rejected"
    "tests/test_lifecycle.py::test_auth_execution_id_mismatch_rejected"
    "tests/test_lifecycle.py::test_auth_tenant_id_mismatch_rejected"
)

set +e
python3 -m pytest -v --tb=short "${PYTEST_TARGETS[@]}"
RC=$?
set -e

echo ""
echo "────────────────────────────────────────────────────────────────"

if [[ "$RC" -ne 0 ]]; then
    echo "PHASE 1 EXIT GATE: FAIL"
    echo "Phase 2 (SIM-04 vertical slice) is BLOCKED."
    exit 1
fi

echo "PHASE 1 EXIT GATE: PASS"
echo "Local lifecycle gate passed. Production route and egress gates remain required."
exit 0
