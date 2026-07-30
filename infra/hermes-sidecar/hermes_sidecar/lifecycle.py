"""Execution lifecycle: start / resume / cancel / getStatus.

Phase 1.2 keeps state in-process + persists to state.json on every transition.
Also persists the upstream `AIAgent` instance per execution for prompt-cache
reuse across turns (per upstream AGENTS.md: "Per-conversation prompt caching
is sacred").

SIGKILL recovery: state.json has the metadata; the AIAgent instance is
rebuilt on cold start (a new instance is fine — the conversation history
itself is persisted by the upstream under HERMES_HOME/sessions/).

Plan ref: NC-AWL-IMP-2 §1.3, Phase 1 exit gate
"""

from __future__ import annotations

import logging
import json
import os
import threading
from pathlib import Path
from typing import Any

from . import aiagent
from .events import EventBus
from .models import (
    ApprovalRequest,
    ExecutionState,
    ExecStatus,
    ScopedTokenClaims,
    now_ms,
)
from .stub_tools import ALL_TOOLS, execute_tool


logger = logging.getLogger(__name__)


class ExecutionNotFound(Exception):
    pass


class InvalidStateTransition(Exception):
    pass


class ExecutionManager:
    """Single-process execution manager for Phase 1.2.

    Thread-safe via a single lock. The state.json snapshot is written on every
    transition so that SIGKILL recovery works. The upstream AIAgent instance
    is cached in-process; on cold start it is rebuilt (the upstream persists
    the conversation itself under HERMES_HOME/sessions/).
    """

    def __init__(self, state_dir: str, event_bus: EventBus, *, use_real_aiagent: bool = False) -> None:
        self.state_dir = Path(state_dir)
        self.state_dir.mkdir(parents=True, exist_ok=True)
        self.event_bus = event_bus
        self._lock = threading.RLock()
        # Cache of in-memory states. Reloaded from disk on demand.
        self._states: dict[str, ExecutionState] = {}
        # Cache of upstream AIAgent instances (per executionId).
        # Per the upstream AGENTS.md "prompt caching is sacred" rule, we keep
        # one instance per execution so the cached prefix is reused.
        self._agents: dict[str, Any] = {}
        # Phase 1.2 toggle: if False, use the stub intent parsing (Phase 1.1).
        # If True, call the real upstream AIAgent.
        self.use_real_aiagent = use_real_aiagent

    # ─── Persistence ──────────────────────────────────────────

    def _state_path(self, execution_id: str) -> Path:
        return self.state_dir / f"{execution_id}.json"

    def _persist(self, state: ExecutionState) -> None:
        state.updatedAt = now_ms()
        tmp = self._state_path(state.executionId).with_suffix(".json.tmp")
        tmp.write_text(state.model_dump_json(indent=2), encoding="utf-8")
        os.replace(tmp, self._state_path(state.executionId))

    def _load_if_needed(self, execution_id: str) -> ExecutionState | None:
        if execution_id in self._states:
            return self._states[execution_id]
        path = self._state_path(execution_id)
        if not path.exists():
            return None
        try:
            state = ExecutionState.model_validate_json(path.read_text(encoding="utf-8"))
        except Exception as exc:
            raise InvalidStateTransition(f"failed to load state for {execution_id}: {exc}") from exc
        self._states[execution_id] = state
        return state

    # ─── Lifecycle ────────────────────────────────────────────

    def start(
        self,
        claims: ScopedTokenClaims,
        initial_message: str,
        project_id: str | None = None,
    ) -> ExecutionState:
        with self._lock:
            existing = self._load_if_needed(claims.executionId)
            if existing is not None:
                self._assert_owner(existing, claims)
                if existing.status in ("RUNNING", "WAITING_APPROVAL"):
                    raise InvalidStateTransition(
                        f"execution {claims.executionId} already exists in status {existing.status}"
                    )
                # Idempotent: same executionId, terminal state → reuse
                if existing.status in ("COMPLETED", "FAILED", "CANCELLED"):
                    return existing

            state = ExecutionState(
                executionId=claims.executionId,
                tenantId=claims.tenantId,
                userId=claims.sub,
                projectId=project_id,
                workspacePath=claims.workspacePath,
                status="RUNNING",
                startedAt=now_ms(),
                updatedAt=now_ms(),
                allowedTools=list(claims.allowedTools),
                approvalThreshold=claims.approvalThreshold,
                messages=[{"role": "user", "content": initial_message}],
                events=[],
                pendingApproval=None,
            )
            self.event_bus.emit(
                "execution.started",
                claims.executionId,
                {
                    "tenantId": claims.tenantId,
                    "userId": claims.sub,
                    "projectId": project_id,
                    "allowedTools": claims.allowedTools,
                },
            )
            state.events.append(
                {"type": "execution.started", "ts": now_ms(), "payload": {}}
            )
            self._states[claims.executionId] = state
            self._persist(state)

            # Drive the initial message through approved tools synchronously
            self._drive_one_turn(state, claims)

            return state

    def _drive_one_turn(
        self,
        state: ExecutionState,
        claims: ScopedTokenClaims,
    ) -> None:
        """One synchronous turn: pick the most recent user message, call a stub,
        append an assistant message, transition state.

        Phase 1.1: simple intent parsing — if the user says "approval",
        route to stub.approval_required. Otherwise stub.echo.

        Phase 1.2: if `use_real_aiagent=True`, defer to the upstream AIAgent.
        The AIAgent runs the actual conversation loop, including tool calls.
        The upstream's tool callbacks fire and emit events to our EventBus.
        The upstream's `getAllowedToolNames(...)` is honored by the upstream
        itself; we additionally gate on claims.allowedTools in `_call_tool`.
        """
        if not state.messages:
            return

        last_user = next(
            (m for m in reversed(state.messages) if m.get("role") == "user"),
            None,
        )
        if not last_user:
            return

        if self.use_real_aiagent:
            self._drive_real_turn(state, claims, last_user)
            return

        # Phase 1.1 stub path
        content = str(last_user.get("content", "")).lower()
        # Match "approv" to cover approve/approval/approved.
        if "approv" in content:
            tool_name = "stub.approval_required"
        else:
            tool_name = "stub.echo"

        result = self._call_tool(
            state,
            claims,
            tool_name=tool_name,
            tool_input={"message": last_user.get("content", "")},
        )

        if state.status == "WAITING_APPROVAL":
            return  # parked; caller will resume

        if result.success:
            state.messages.append(
                {"role": "assistant", "content": str(result.data), "tool": tool_name}
            )
            if state.status == "RUNNING":
                state.status = "COMPLETED"
                state.completedAt = now_ms()
                self.event_bus.emit(
                    "execution.completed",
                    state.executionId,
                    {"messages": len(state.messages)},
                )
                state.events.append(
                    {"type": "execution.completed", "ts": now_ms(), "payload": {}}
                )
        else:
            state.status = "FAILED"
            state.failureReason = result.error
            state.completedAt = now_ms()
            self.event_bus.emit(
                "execution.failed",
                state.executionId,
                {"reason": result.error},
            )
            state.events.append(
                {"type": "execution.failed", "ts": now_ms(), "payload": {}}
            )

        self._persist(state)

    def _drive_real_turn(
        self,
        state: ExecutionState,
        claims: ScopedTokenClaims,
        last_user: dict[str, Any],
    ) -> None:
        """Phase 1.2: drive one turn using the real upstream AIAgent.

        - Get or create the AIAgent (cached for prompt-cache reuse).
        - Call run_conversation with the last user message.
        - Map the result back to our state shape.
        - Append the final assistant message; transition to COMPLETED.
        """
        user_message = str(last_user.get("content", ""))

        # Get-or-create the AIAgent for this execution.
        agent = self._agents.get(state.executionId)
        if agent is None:
            try:
                agent_holder: dict[str, Any] = {}
                agent = aiagent.create_aiagent(
                    execution_id=state.executionId,
                    tenant_id=state.tenantId,
                    workspace_path=claims.workspacePath,
                    allowed_tools=list(state.allowedTools),
                    event_callback=lambda evt, payload: self._on_upstream_event(
                        state, evt, payload
                    ),
                    tool_start_callback=lambda *info: self._on_tool_start(state, info),
                    tool_complete_callback=lambda *info: self._on_tool_complete(
                        state, info, agent_holder.get("agent")
                    ),
                    stream_delta_callback=lambda token: self._on_stream_delta(state, token),
                    quiet_mode=True,
                    scoped_claims=claims,
                )
                agent_holder["agent"] = agent
            except Exception as exc:
                logger.exception(
                    "AIAgent create failed for execution %s: %s",
                    state.executionId,
                    exc,
                )
                state.status = "FAILED"
                state.failureReason = f"aiagent_create_error:{exc}"
                state.completedAt = now_ms()
                self.event_bus.emit(
                    "execution.failed",
                    state.executionId,
                    {"reason": state.failureReason},
                )
                state.events.append(
                    {"type": "execution.failed", "ts": now_ms(), "payload": {}}
                )
                self._persist(state)
                return
            self._agents[state.executionId] = agent

        # Run one turn.
        try:
            result = aiagent.run_one_turn(agent, user_message)
        except Exception as exc:
            state.status = "FAILED"
            state.failureReason = f"aiagent_error:{exc}"
            state.completedAt = now_ms()
            self.event_bus.emit(
                "execution.failed",
                state.executionId,
                {"reason": state.failureReason},
            )
            state.events.append(
                {"type": "execution.failed", "ts": now_ms(), "payload": {}}
            )
            self._persist(state)
            return

        # Map the result to our state.
        final = ""
        if isinstance(result, dict):
            final = result.get("final_response", "") or ""
        elif isinstance(result, str):
            final = result
        if not final:
            final = "(no response from AIAgent)"

        state.messages.append({"role": "assistant", "content": final})
        if state.status == "WAITING_APPROVAL":
            self._persist(state)
            return
        provider_error_prefixes = (
            "api call failed",
            "authentication error",
            "connection error",
            "http 4",
            "http 5",
        )
        if final.lower().startswith(provider_error_prefixes):
            state.status = "FAILED"
            state.failureReason = f"provider_error:{final}"
            state.completedAt = now_ms()
            self.event_bus.emit(
                "execution.failed",
                state.executionId,
                {"reason": state.failureReason},
            )
            state.events.append(
                {"type": "execution.failed", "ts": now_ms(), "payload": {}}
            )
            self._persist(state)
            return
        state.status = "COMPLETED"
        state.completedAt = now_ms()
        self.event_bus.emit(
            "execution.completed",
            state.executionId,
            {"messages": len(state.messages)},
        )
        state.events.append(
            {"type": "execution.completed", "ts": now_ms(), "payload": {}}
        )
        self._persist(state)

    def _drive_stub_turn(
        self,
        state: ExecutionState,
        claims: ScopedTokenClaims,
        user_message: str,
    ) -> None:
        """Same as the stub path in _drive_one_turn, factored for fallback."""
        content = user_message.lower()
        tool_name = "stub.approval_required" if "approv" in content else "stub.echo"
        result = self._call_tool(
            state,
            claims,
            tool_name=tool_name,
            tool_input={"message": user_message},
        )
        if state.status == "WAITING_APPROVAL":
            return
        if result.success:
            state.messages.append(
                {"role": "assistant", "content": str(result.data), "tool": tool_name}
            )
            state.status = "COMPLETED"
            state.completedAt = now_ms()
        else:
            state.status = "FAILED"
            state.failureReason = result.error
            state.completedAt = now_ms()
        self._persist(state)

    # ─── Upstream event bridges ───────────────────────────────

    def _on_upstream_event(self, state: ExecutionState, evt: str, payload: dict) -> None:
        """Bridge upstream `event_callback` to our EventBus + state events."""
        self.event_bus.emit(f"upstream.{evt}", state.executionId, payload)
        state.events.append(
            {"type": f"upstream.{evt}", "ts": now_ms(), "payload": payload}
        )
        # Persist every event so SIGKILL recovery has the full audit trail.
        try:
            self._persist(state)
        except Exception:
            pass

    def _on_tool_start(self, state: ExecutionState, raw_info: tuple[Any, ...]) -> None:
        info = dict(raw_info[0]) if len(raw_info) == 1 and isinstance(raw_info[0], dict) else {
            "toolCallId": raw_info[0] if len(raw_info) > 0 else None,
            "name": raw_info[1] if len(raw_info) > 1 else "unknown",
            "arguments": raw_info[2] if len(raw_info) > 2 else {},
        }
        tool_name = info.get("name") or info.get("tool") or "unknown"
        # Enforce server-side tool gateway: if the tool isn't in allowedTools,
        # the upstream shouldn't be calling it. We log + deny here.
        if state.allowedTools and tool_name not in state.allowedTools:
            self.event_bus.emit(
                "tool.denied",
                state.executionId,
                {"toolName": tool_name, "reason": "not_in_allowed_tools"},
            )
            state.events.append(
                {
                    "type": "tool.denied",
                    "ts": now_ms(),
                    "payload": {"toolName": tool_name},
                }
            )
            return
        self.event_bus.emit("tool.start", state.executionId, {"toolName": tool_name})
        state.events.append(
            {"type": "tool.start", "ts": now_ms(), "payload": {"toolName": tool_name}}
        )

    def _on_tool_complete(
        self,
        state: ExecutionState,
        raw_info: tuple[Any, ...],
        agent: Any | None = None,
    ) -> None:
        info = dict(raw_info[0]) if len(raw_info) == 1 and isinstance(raw_info[0], dict) else {
            "toolCallId": raw_info[0] if len(raw_info) > 0 else None,
            "name": raw_info[1] if len(raw_info) > 1 else "unknown",
            "arguments": raw_info[2] if len(raw_info) > 2 else {},
            "result": raw_info[3] if len(raw_info) > 3 else None,
        }
        tool_name = info.get("name") or info.get("tool") or "unknown"
        result = info.get("result")
        try:
            parsed_result = json.loads(result) if isinstance(result, str) else result
        except (TypeError, json.JSONDecodeError):
            parsed_result = None
        if isinstance(parsed_result, dict) and isinstance(parsed_result.get("data"), dict):
            parsed_result = parsed_result["data"]
        if isinstance(parsed_result, dict) and parsed_result.get("deferred"):
            approval = ApprovalRequest(
                approvalId=str(parsed_result["approvalId"]),
                toolName=str(tool_name),
                toolInput=info.get("arguments") or {},
                requestedAt=now_ms(),
                reason=f"tool:{tool_name} requires approval",
            )
            state.pendingApproval = approval
            state.status = "WAITING_APPROVAL"
            self.event_bus.emit(
                "approval.requested",
                state.executionId,
                {"approvalId": approval.approvalId, "toolName": tool_name},
            )
            state.events.append({
                "type": "approval.requested",
                "ts": now_ms(),
                "payload": {"approvalId": approval.approvalId, "toolName": tool_name},
            })
            self._persist(state)
            interrupt = getattr(agent, "interrupt", None)
            if callable(interrupt):
                interrupt()
        self.event_bus.emit(
            "tool.complete", state.executionId, {"toolName": tool_name}
        )
        state.events.append(
            {"type": "tool.complete", "ts": now_ms(), "payload": {"toolName": tool_name}}
        )

    def _on_stream_delta(self, state: ExecutionState, token: str) -> None:
        # Don't write every token to state.json (too I/O heavy).
        # Just emit to the event bus for live streaming.
        self.event_bus.emit(
            "stream.delta", state.executionId, {"len": len(token)}
        )

    def _call_tool(
        self,
        state: ExecutionState,
        claims: ScopedTokenClaims,
        *,
        tool_name: str,
        tool_input: dict[str, Any],
    ) -> Any:
        """Server-side tool-gateway check + (optional) approval gate + execute."""
        if tool_name not in ALL_TOOLS:
            self._record_tool_decision(state, tool_name, tool_input, "denied", "unknown_tool")
            from .stub_tools import ToolResult as _TR

            return _TR(False, error=f"unknown_tool:{tool_name}")

        if tool_name not in state.allowedTools and tool_name not in claims.allowedTools:
            self._record_tool_decision(state, tool_name, tool_input, "denied", "not_in_allowed_tools")
            from .stub_tools import ToolResult as _TR

            return _TR(False, error=f"tool_not_allowed:{tool_name}")

        tool_def = ALL_TOOLS[tool_name]
        if tool_def.requires_approval:
            # Approval required → park the execution
            approval = ApprovalRequest(
                approvalId=f"apr-{state.executionId}-{now_ms()}",
                toolName=tool_name,
                toolInput=tool_input,
                requestedAt=now_ms(),
                reason=f"tool:{tool_name} requires approval",
            )
            state.pendingApproval = approval
            state.status = "WAITING_APPROVAL"
            self._record_tool_decision(state, tool_name, tool_input, "pending_approval", "")
            self.event_bus.emit(
                "approval.requested",
                state.executionId,
                {"approvalId": approval.approvalId, "toolName": tool_name},
            )
            state.events.append(
                {
                    "type": "approval.requested",
                    "ts": now_ms(),
                    "payload": {"approvalId": approval.approvalId, "toolName": tool_name},
                }
            )
            self._persist(state)
            from .stub_tools import ToolResult as _TR

            return _TR(False, error="deferred_for_approval")

        self._record_tool_decision(state, tool_name, tool_input, "allowed", "")
        result = execute_tool(
            tool_name,
            tool_input,
            execution_id=state.executionId,
            all_events=state.events,
        )
        self.event_bus.emit(
            "tool.completed",
            state.executionId,
            {"toolName": tool_name, "success": result.success},
        )
        state.events.append(
            {
                "type": "tool.completed",
                "ts": now_ms(),
                "payload": {"toolName": tool_name, "success": result.success},
            }
        )
        self._persist(state)
        return result

    def _record_tool_decision(
        self,
        state: ExecutionState,
        tool_name: str,
        tool_input: dict[str, Any],
        decision: str,
        reason: str,
    ) -> None:
        """Record a tool-call decision.

        Phase 1.4: this event is broadcast to the webhook (the events-bridge
        consumes it) AND persisted to the state for SIGKILL recovery. The
        bridge stores it in HermesAuditLog-shaped rows.
        """
        event = {
            "type": "tool.call",
            "ts": now_ms(),
            "payload": {
                "toolName": tool_name,
                "decision": decision,
                "reason": reason,
            },
        }
        state.events.append(event)
        # Broadcast to the webhook so the events-bridge captures it.
        self.event_bus.emit(
            "tool.call",
            state.executionId,
            {
                "toolName": tool_name,
                "decision": decision,
                "reason": reason,
            },
        )

    # ─── Public lifecycle ops ─────────────────────────────────

    @staticmethod
    def _assert_owner(state: ExecutionState, claims: ScopedTokenClaims) -> None:
        if state.tenantId != claims.tenantId or state.userId != claims.sub:
            raise ExecutionNotFound(f"execution {claims.executionId} not found")

    def resume(
        self,
        claims: ScopedTokenClaims,
        approval_id: str,
        decision: str,
        reason: str = "",
    ) -> ExecutionState:
        with self._lock:
            state = self._load_if_needed(claims.executionId)
            if state is None:
                raise ExecutionNotFound(f"execution {claims.executionId} not found")
            self._assert_owner(state, claims)
            if state.status != "WAITING_APPROVAL":
                raise InvalidStateTransition(
                    f"execution {claims.executionId} not waiting for approval (status={state.status})"
                )
            if state.pendingApproval is None or state.pendingApproval.approvalId != approval_id:
                raise InvalidStateTransition(
                    f"approval_id {approval_id} does not match pending approval"
                )

            pending = state.pendingApproval
            execution_claims = claims.model_copy(update={
                "workspacePath": state.workspacePath,
                "allowedTools": list(state.allowedTools),
                "approvalThreshold": state.approvalThreshold,
            })

            if decision == "reject":
                state.status = "CANCELLED"
                state.completedAt = now_ms()
                state.failureReason = f"approval_rejected:{reason}"
                state.pendingApproval = None
                self.event_bus.emit(
                    "approval.rejected",
                    state.executionId,
                    {"approvalId": approval_id, "reason": reason},
                )
                state.events.append(
                    {
                        "type": "approval.rejected",
                        "ts": now_ms(),
                        "payload": {"approvalId": approval_id, "reason": reason},
                    }
                )
                self._persist(state)
                return state

            # Approve: re-execute the parked tool, then continue the turn
            state.pendingApproval = None
            state.status = "RUNNING"
            self.event_bus.emit(
                "approval.granted",
                state.executionId,
                {"approvalId": approval_id},
            )
            state.events.append(
                {
                    "type": "approval.granted",
                    "ts": now_ms(),
                    "payload": {"approvalId": approval_id},
                }
            )
            self._persist(state)

            # NeureCore tools always execute in the control plane. Phase 1
            # stubs remain local for their certification path.
            if pending.toolName.startswith("nc."):
                from .neurecore_tools import execute_approved_tool
                from .stub_tools import ToolResult
                try:
                    gateway_result = execute_approved_tool(
                        execution_claims,
                        pending.toolName,
                        pending.toolInput,
                        approval_id,
                    )
                    result = ToolResult(
                        bool(gateway_result.get("success")),
                        data=gateway_result.get("data"),
                        error=(gateway_result.get("error") or {}).get("message"),
                    )
                except Exception as exc:
                    result = ToolResult(False, error=f"gateway_error:{exc}")
            else:
                result = execute_tool(
                    pending.toolName,
                    pending.toolInput,
                    execution_id=state.executionId,
                    all_events=state.events,
                )
            if result.success:
                state.messages.append(
                    {
                        "role": "assistant",
                        "content": str(result.data),
                        "tool": pending.toolName,
                    }
                )
                if self.use_real_aiagent and pending.toolName.startswith("nc."):
                    original_request = next(
                        (
                            str(message.get("content", ""))
                            for message in state.messages
                            if message.get("role") == "user"
                        ),
                        "",
                    )
                    continuation = {
                        "role": "user",
                        "content": (
                            f"Control-plane approval {approval_id} was granted. "
                            f"The {pending.toolName} call completed with this trusted result: "
                            f"{json.dumps(result.data, default=str)}. Continue the original "
                            f"request ({original_request}) from this result. Do not repeat the "
                            "completed action. Use only nc.* tools and pause at the next approval."
                        ),
                    }
                    state.messages.append(continuation)
                    self._persist(state)
                    agent = self._agents.get(state.executionId)
                    clear_interrupt = getattr(agent, "clear_interrupt", None)
                    if callable(clear_interrupt):
                        clear_interrupt()
                    threading.Thread(
                        target=self._drive_real_turn,
                        args=(state, execution_claims, continuation),
                        name=f"hermes-resume-{state.executionId}",
                        daemon=True,
                    ).start()
                else:
                    state.status = "COMPLETED"
                    state.completedAt = now_ms()
                    self.event_bus.emit(
                        "execution.completed",
                        state.executionId,
                        {"messages": len(state.messages)},
                    )
                    state.events.append(
                        {"type": "execution.completed", "ts": now_ms(), "payload": {}}
                    )
            else:
                state.status = "FAILED"
                state.failureReason = result.error
                state.completedAt = now_ms()
                self.event_bus.emit(
                    "execution.failed",
                    state.executionId,
                    {"reason": result.error},
                )
                state.events.append(
                    {"type": "execution.failed", "ts": now_ms(), "payload": {}}
                )
            self._persist(state)
            return state

    def cancel(self, claims: ScopedTokenClaims) -> ExecutionState:
        with self._lock:
            state = self._load_if_needed(claims.executionId)
            if state is None:
                raise ExecutionNotFound(f"execution {claims.executionId} not found")
            self._assert_owner(state, claims)
            if state.status in ("COMPLETED", "FAILED", "CANCELLED"):
                return state
            state.status = "CANCELLED"
            state.completedAt = now_ms()
            self.event_bus.emit("execution.cancelled", state.executionId, {})
            state.events.append(
                {"type": "execution.cancelled", "ts": now_ms(), "payload": {}}
            )
            self._persist(state)
            return state

    def get_status(self, claims: ScopedTokenClaims) -> ExecutionState:
        with self._lock:
            state = self._load_if_needed(claims.executionId)
            if state is None:
                raise ExecutionNotFound(f"execution {claims.executionId} not found")
            self._assert_owner(state, claims)
            return state
