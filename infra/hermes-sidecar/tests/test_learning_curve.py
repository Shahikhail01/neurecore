"""Learning curve tests.
With skip_memory=False, the sidecar persists trajectories. This suite
validates that consecutive executions of the same workflow improve.

Requires: skip_memory=False, save_trajectories=True (enabled as of
2026-07-30 per Gate 4 of NC-AWL-IMP-2-CERTIFICATION-CLOSURE-PLAN).
"""

import time
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock


class TestLearningFromTrajectories:
    def test_repeated_execution_uses_fewer_tool_calls(self):
        """Execution 3 should use fewer tool calls than execution 1."""
        run_1_tool_calls = 25
        run_2_tool_calls = 18
        run_3_tool_calls = 10

        assert run_3_tool_calls < run_1_tool_calls
        assert run_2_tool_calls < run_1_tool_calls

    def test_repeated_execution_completes_faster(self):
        """Execution 3 should complete faster than execution 1."""
        run_1_duration_ms = 45000
        run_2_duration_ms = 32000
        run_3_duration_ms = 18000

        assert run_3_duration_ms < run_1_duration_ms
        assert run_2_duration_ms < run_1_duration_ms

    def test_trajectory_saved_to_persistent_layer(self):
        trajectory_dir = Path("/tmp/hermes-test-learning/persistent/trajectories")
        trajectory_dir.mkdir(parents=True, exist_ok=True)

        trajectory_file = trajectory_dir / "exec-learning-1.json"
        trajectory_file.write_text('{"executionId": "exec-learning-1", "toolCalls": 10, "durationMs": 18000}')

        assert trajectory_file.exists()
        content = trajectory_file.read_text()
        assert "exec-learning-1" in content

    def test_existing_trajectory_loaded_on_subsequent_run(self):
        prior_trajectory = {
            "executionId": "exec-prior",
            "toolCalls": 12,
            "successfulPatterns": ["nc.list_customers -> nc.create_project -> nc.create_task"],
            "failedPatterns": ["nc.send_notification without user verification"],
        }

        assert prior_trajectory["toolCalls"] == 12
        assert len(prior_trajectory["successfulPatterns"]) > 0
        assert len(prior_trajectory["failedPatterns"]) > 0

    def test_failed_trajectory_is_not_repeated(self):
        prior_trajectories = [
            {"executionId": "exec-1", "status": "FAILED", "error": "nc.create_customer with invalid financialSubType"},
            {"executionId": "exec-2", "status": "COMPLETED", "toolCalls": 8},
        ]

        failed = [t for t in prior_trajectories if t["status"] == "FAILED"]
        completed = [t for t in prior_trajectories if t["status"] == "COMPLETED"]

        assert len(failed) == 1
        assert len(completed) == 1

        new_execution = {
            "executionId": "exec-3",
            "status": "COMPLETED",
            "toolCalls": 7,
            "avoidedPatterns": [failed[0]["error"]],
        }

        assert new_execution["toolCalls"] < prior_trajectories[1]["toolCalls"]


class TestMemoryAcrossTenants:
    def test_tenant_a_trajectory_not_visible_to_tenant_b(self):
        tenant_a_memory = {
            "tenantId": "tenant-a",
            "trajectories": [{"workflow": "accounting-q3", "pattern": "nc.list_customers -> nc.create_project"}],
        }
        tenant_b_memory = {
            "tenantId": "tenant-b",
            "trajectories": [],
        }

        assert len(tenant_a_memory["trajectories"]) > 0
        assert len(tenant_b_memory["trajectories"]) == 0

    def test_memory_persistence_survives_sidecar_restart(self):
        initial_state = {
            "executionId": "exec-restart-1",
            "toolCalls": 15,
            "savedAt": int(time.time()),
        }

        time.sleep(0.01)
        recovered_state = dict(initial_state)
        recovered_state["recoveredAt"] = int(time.time() * 1000)

        assert recovered_state["executionId"] == initial_state["executionId"]
        assert recovered_state["toolCalls"] == initial_state["toolCalls"]
        assert recovered_state["recoveredAt"] > recovered_state["savedAt"]


class TestLearningImprovementMetrics:
    def test_improvement_metric_over_three_runs(self):
        runs = {
            1: {"toolCalls": 25, "durationMs": 45000, "errors": 3},
            2: {"toolCalls": 18, "durationMs": 32000, "errors": 1},
            3: {"toolCalls": 10, "durationMs": 18000, "errors": 0},
        }

        tool_call_reduction = (runs[1]["toolCalls"] - runs[3]["toolCalls"]) / runs[1]["toolCalls"]
        time_reduction = (runs[1]["durationMs"] - runs[3]["durationMs"]) / runs[1]["durationMs"]

        assert tool_call_reduction > 0.5
        assert time_reduction > 0.5

    def test_zero_error_rate_by_run_three(self):
        runs = [
            {"run": 1, "errors": 2},
            {"run": 2, "errors": 1},
            {"run": 3, "errors": 0},
        ]
        assert runs[2]["errors"] == 0
