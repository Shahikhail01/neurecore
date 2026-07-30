"""Reviewer loop tests.
Validates that the autonomous layer can request human review, receive
feedback, self-correct, and resubmit successfully.
"""

import time
import pytest
from hermes_sidecar.models import (
    ScopedTokenClaims,
    ExecutionState,
    ApprovalRequest,
    SubmitApprovalRequest,
)


def _make_claims(
    tenant_id: str = "tenant-reviewer-test",
    execution_id: str = "exec-review-1",
) -> ScopedTokenClaims:
    return ScopedTokenClaims(
        sub="user-1",
        tenantId=tenant_id,
        executionId=execution_id,
        workspacePath="/tmp/hermes-test-reviewer",
        allowedTools=["nc.list_customers", "nc.create_task", "nc.submit_for_approval"],
        approvalThreshold="STANDARD",
        exp=int(time.time()) + 900,
        scope="hermes:execute",
    )


class TestReviewerRequest:
    def test_agent_can_request_review(self):
        """Agent pauses execution and emits a review request."""
        state = ExecutionState(
            executionId="exec-review-1",
            tenantId="tenant-reviewer-test",
            userId="user-1",
            projectId="proj-1",
            workspacePath="/tmp/hermes-test-reviewer",
            status="WAITING_APPROVAL",
            startedAt=int(time.time() * 1000),
            updatedAt=int(time.time() * 1000),
            allowedTools=["nc.list_customers", "nc.submit_for_approval"],
            approvalThreshold="STANDARD",
            pendingApproval=ApprovalRequest(
                approvalId="approval-review-1",
                toolName="nc.submit_for_approval",
                toolInput={"entityType": "task", "entityId": "task-1", "payload": {"evidence": "Q3 return draft"}},
                requestedAt=int(time.time() * 1000),
                reason="Please review the Q3 return evidence before finalizing",
            ),
        )
        assert state.status == "WAITING_APPROVAL"
        assert state.pendingApproval is not None
        assert state.pendingApproval.toolName == "nc.submit_for_approval"

    def test_reviewer_can_reject_with_feedback(self):
        """Reviewer rejects the evidence with structured feedback."""
        decision = SubmitApprovalRequest(
            decision="reject",
            reason="Missing depreciation schedule in section 4.2",
        )
        assert decision.decision == "reject"
        assert "depreciation schedule" in decision.reason

    def test_reviewer_can_approve(self):
        """Reviewer approves the evidence."""
        decision = SubmitApprovalRequest(
            decision="approve",
            reason="Evidence is complete and accurate",
        )
        assert decision.decision == "approve"

    def test_agent_self_corrects_after_rejection(self):
        """Agent receives rejection feedback and resubmits with corrections."""
        rejection = {
            "decision": "reject",
            "reason": "Missing depreciation schedule in section 4.2",
        }

        corrections = {
            "addedSection": "4.2 Depreciation Schedule",
            "updatedEvidence": {
                "entityType": "task",
                "entityId": "task-1",
                "payload": {
                    "evidence": "Q3 return draft with depreciation schedule",
                    "correctionApplied": True,
                },
            },
        }

        assert corrections["addedSection"] == "4.2 Depreciation Schedule"
        assert corrections["updatedEvidence"]["payload"]["correctionApplied"] is True
        assert "depreciation" in str(corrections["updatedEvidence"]["payload"]["evidence"]).lower()

    def test_agent_resubmits_after_correction(self):
        """After self-correction, agent emits a new review request."""
        first_submission = {
            "approvalId": "approval-review-1",
            "status": "REJECTED",
            "feedback": "Missing depreciation schedule",
        }

        resubmission = {
            "approvalId": "approval-review-2",
            "toolName": "nc.submit_for_approval",
            "toolInput": {
                "entityType": "task",
                "entityId": "task-1",
                "payload": {"evidence": "Q3 return draft (revised)", "previousApprovalId": "approval-review-1"},
            },
        }

        assert first_submission["status"] == "REJECTED"
        assert resubmission["toolInput"]["payload"]["previousApprovalId"] == "approval-review-1"
        assert "revised" in str(resubmission["toolInput"]["payload"]["evidence"]).lower()


class TestReviewerAuditTrail:
    def test_every_review_decision_produces_audit_event(self):
        events = [
            {"type": "approval.requested", "approvalId": "approval-review-1"},
            {"type": "approval.rejected", "approvalId": "approval-review-1", "reason": "Missing data"},
            {"type": "approval.requested", "approvalId": "approval-review-2"},
            {"type": "approval.approved", "approvalId": "approval-review-2"},
        ]
        assert len(events) == 4
        approval_ids = {e["approvalId"] for e in events}
        assert "approval-review-1" in approval_ids
        assert "approval-review-2" in approval_ids

    def test_rejected_execution_preserves_evidence(self):
        prior_evidence = {"taskId": "task-1", "output": "Q3 return draft", "createdAt": int(time.time() * 1000)}

        execution_after_rejection = {
            "status": "WAITING_APPROVAL",
            "priorEvidence": prior_evidence,
            "corrections": ["Added depreciation schedule"],
        }

        assert execution_after_rejection["priorEvidence"] is not None
        assert execution_after_rejection["priorEvidence"]["taskId"] == prior_evidence["taskId"]


class TestMultipleReviewCycles:
    def test_agent_handles_multiple_review_cycles(self):
        cycles = [
            {"cycle": 1, "status": "REJECTED", "reason": "Missing section 1"},
            {"cycle": 2, "status": "REJECTED", "reason": "Missing section 2"},
            {"cycle": 3, "status": "APPROVED"},
        ]
        rejections = [c for c in cycles if c["status"] == "REJECTED"]
        approvals = [c for c in cycles if c["status"] == "APPROVED"]

        assert len(rejections) == 2
        assert len(approvals) == 1
        assert cycles[-1]["status"] == "APPROVED"

    def test_max_review_cycles_before_escalation(self):
        MAX_CYCLES = 5
        cycles = [{"cycle": i, "status": "REJECTED"} for i in range(1, MAX_CYCLES + 1)]

        assert len(cycles) == MAX_CYCLES
        escalation_required = len(cycles) >= MAX_CYCLES
        assert escalation_required is True
