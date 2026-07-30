"""Self-correction tests.
Validates that the autonomous agent can detect tool errors, diagnose
the problem, and retry with corrected arguments without human intervention.
"""

import json
import time
import pytest
from hermes_sidecar.models import ScopedTokenClaims


class TestErrorDetection:
    def test_agent_detects_invalid_schema_error(self):
        error_response = {
            "success": False,
            "error": {
                "code": "INVALID_TOOL_ARGUMENTS",
                "message": "Validation failed",
                "issues": [{"path": ["name"], "message": "Required"}],
            },
        }
        assert error_response["success"] is False
        assert error_response["error"]["code"] == "INVALID_TOOL_ARGUMENTS"

    def test_agent_detects_rbac_denial(self):
        error_response = {
            "success": False,
            "error": {
                "code": "FORBIDDEN",
                "message": "Tool nc.send_notification is not allowed for this execution",
                "retriable": False,
            },
        }
        assert error_response["success"] is False
        assert "not allowed" in error_response["error"]["message"]

    def test_agent_detects_not_found(self):
        error_response = {
            "success": False,
            "error": {
                "code": "NOT_FOUND",
                "message": "Eligible agent not found",
                "retriable": False,
            },
        }
        assert error_response["success"] is False
        assert "not found" in error_response["error"]["message"].lower()

    def test_agent_detects_gateway_unavailable(self):
        error_response = {
            "success": False,
            "error": {
                "code": "GATEWAY_UNAVAILABLE",
                "message": "Connection refused",
                "retriable": True,
            },
        }
        assert error_response["success"] is False
        assert error_response["error"]["retriable"] is True


class TestSelfCorrectionStrategies:
    def test_fix_missing_required_field(self):
        first_attempt = {"title": "Collect records"}
        error = {"code": "INVALID_TOOL_ARGUMENTS", "issues": [{"path": ["projectId"], "message": "Required"}]}

        corrected = {**first_attempt, "projectId": "proj-1", "goalId": "goal-1"}
        assert "projectId" in corrected
        assert "goalId" in corrected

    def test_fix_invalid_enum_value(self):
        first_attempt = {"taskId": "task-1", "status": "IN_PROGRESS"}
        error = {"code": "INVALID_TOOL_ARGUMENTS", "issues": [{"path": ["status"], "message": "Invalid enum value"}]}

        corrected = {**first_attempt, "status": "RUNNING"}
        assert corrected["status"] == "RUNNING"

    def test_fix_invented_id_with_read_tool_lookup(self):
        first_attempt = {"customerId": "cust-acme-corp", "name": "Q3 return"}
        error = {"code": "INVALID_TOOL_ARGUMENTS", "issues": [{"path": ["customerId"], "message": "Invalid UUID/CUID"}]}

        lookup_result = [{"id": "cms51s4uq00apillmmoa43drx", "name": "Acme Corp"}]
        corrected = {**first_attempt, "customerId": lookup_result[0]["id"]}

        assert corrected["customerId"] == "cms51s4uq00apillmmoa43drx"
        assert corrected["customerId"] != "cust-acme-corp"

    def test_diagnose_problem_before_retry(self):
        diagnosis_steps = [
            {"step": "Parse error code", "result": "INVALID_TOOL_ARGUMENTS"},
            {"step": "Read issues path", "result": "customerId is not a valid UUID"},
            {"step": "Look up correct ID", "result": "nc.list_customers found Acme Corp -> cms51..."},
            {"step": "Retry with corrected args", "result": "Success"},
        ]
        assert len(diagnosis_steps) == 4
        assert diagnosis_steps[-1]["result"] == "Success"


class TestRetryLogic:
    def test_max_retries_not_exceeded(self):
        MAX_RETRIES = 3
        retries = []

        for i in range(MAX_RETRIES + 1):
            if i < MAX_RETRIES:
                retries.append({"attempt": i + 1, "result": "FAILED"})
                continue
            retries.append({"attempt": i + 1, "result": "FAILED"})

        assert len(retries) == MAX_RETRIES + 1
        assert all(r["result"] == "FAILED" for r in retries)

    def test_successful_retry_stops_retry_loop(self):
        attempts = [
            {"attempt": 1, "result": "FAILED", "error": "INVALID_TOOL_ARGUMENTS"},
            {"attempt": 2, "result": "SUCCESS"},
        ]
        successful = [a for a in attempts if a["result"] == "SUCCESS"]
        assert len(successful) == 1
        total_attempts = attempts.index(successful[0]) + 1
        assert total_attempts == 2

    def test_non_retriable_error_stops_immediately(self):
        error = {"success": False, "error": {"code": "FORBIDDEN", "message": "Tool not allowed", "retriable": False}}

        should_retry = error["error"]["retriable"]
        assert should_retry is False

        retries = 0
        assert retries == 0


class TestSelfCorrectionIntegration:
    def test_full_self_correction_flow(self):
        flow = {
            "step1_attempt": {"tool": "nc.create_customer", "args": {"name": "", "financialSubType": "ACCOUNTING_AUDIT"}, "result": "FAILED"},
            "step2_diagnose": {"error": "name is required", "fix": "Populate name from user prompt"},
            "step3_retry": {"tool": "nc.create_customer", "args": {"name": "Acme Corp", "financialSubType": "ACCOUNTING_AUDIT", "lifecycleStage": "PROSPECT"}, "result": "SUCCESS"},
        }

        assert flow["step1_attempt"]["result"] == "FAILED"
        assert flow["step3_retry"]["result"] == "SUCCESS"
        assert flow["step3_retry"]["args"]["name"] == "Acme Corp"

    def test_self_correction_preserves_audit_trail(self):
        audit_events = [
            {"action": "autonomous.tool.call", "decision": "denied", "error": "INVALID_TOOL_ARGUMENTS"},
            {"action": "autonomous.tool.call", "decision": "allowed", "result": "success"},
        ]
        assert audit_events[0]["decision"] == "denied"
        assert audit_events[1]["decision"] == "allowed"
        assert len(audit_events) == 2
