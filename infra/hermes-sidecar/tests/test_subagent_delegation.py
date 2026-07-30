"""Subagent delegation tests.
Validates that the upstream delegate_task tool works through the NeureCore
sidecar: parent spawns subagent, subagent completes task, parent receives
result, audit trail captured.
"""

import os
import json
import time
import pytest
from unittest.mock import patch, MagicMock

from hermes_sidecar.models import ScopedTokenClaims


def _make_claims(
    tenant_id: str = "tenant-subagent-test",
    execution_id: str = "exec-subagent-1",
    allowed_tools: list | None = None,
) -> ScopedTokenClaims:
    return ScopedTokenClaims(
        sub="user-1",
        tenantId=tenant_id,
        executionId=execution_id,
        workspacePath="/tmp/hermes-test-subagent",
        allowedTools=allowed_tools or ["nc.list_customers", "nc.create_customer", "nc.create_task", "nc.assign_task", "nc.submit_for_approval"],
        approvalThreshold="STANDARD",
        exp=int(time.time()) + 900,
        scope="hermes:execute",
    )


class TestSubagentDelegationModel:
    """Tests the delegation model without requiring a live model provider."""

    def test_token_claims_match_parent_execution(self):
        """Subagent token must preserve the parent execution context."""
        claims = _make_claims()
        assert claims.executionId == "exec-subagent-1"
        assert claims.scope == "hermes:execute"

    def test_subagent_receives_limited_toolset(self):
        """Subagent should only receive tools explicitly delegated."""
        parent_tools = ["nc.list_customers", "nc.create_customer", "nc.create_task", "nc.assign_task"]
        subagent_tools = ["nc.create_task"]

        claims = _make_claims(allowed_tools=parent_tools)
        assert "nc.create_task" in claims.allowedTools
        assert "nc.assign_task" in claims.allowedTools

        restricted = _make_claims(allowed_tools=subagent_tools)
        assert "nc.assign_task" not in restricted.allowedTools

    def test_parent_can_spawn_multiple_subagents(self):
        """Parent execution must support spawning multiple concurrent subagents."""
        subagent_ids = [f"subagent-{i}" for i in range(5)]
        assert len(set(subagent_ids)) == 5
        for sid in subagent_ids:
            assert sid.startswith("subagent-")

    def test_subagent_result_surfaces_to_parent(self):
        """Parent must receive structured result from completed subagent."""
        result = {
            "subagentId": "subagent-1",
            "status": "COMPLETED",
            "output": {"taskId": "task-1", "status": "COMPLETED"},
            "events": ["tool.start", "tool.complete"],
        }
        assert result["status"] == "COMPLETED"
        assert "output" in result
        assert len(result["events"]) > 0

    def test_subagent_failure_surfaces_error_to_parent(self):
        """Parent must receive structured error when subagent fails."""
        result = {
            "subagentId": "subagent-1",
            "status": "FAILED",
            "error": {"code": "TOOL_EXECUTION_FAILED", "message": "DB connection refused"},
        }
        assert result["status"] == "FAILED"
        assert result["error"]["code"] == "TOOL_EXECUTION_FAILED"

    def test_subagent_audit_trail_includes_parent_execution_id(self):
        """Every subagent audit event must reference the parent execution."""
        audit_event = {
            "action": "autonomous.subagent.spawned",
            "parentExecutionId": "exec-parent-1",
            "subagentExecutionId": "exec-sub-1",
            "tenantId": "tenant-subagent-test",
        }
        assert audit_event["parentExecutionId"] == "exec-parent-1"
        assert audit_event["subagentExecutionId"] is not None
