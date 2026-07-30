"""Stub tools for Phase 1.1.

Six tools, all deterministic, no external dependencies. These exist only to
prove the bridge between gateway and sidecar works. Real NeureCore tools
(Phase 2) replace these.

Plan ref: NC-AWL-IMP-2 §1.3, Phase 1 exit gate
"""

from __future__ import annotations

import time
from typing import Any


class ToolDefinition:
    """A tool's metadata. Mirrors `BaseStructuredTool` shape from upstream Hermes."""

    def __init__(
        self,
        name: str,
        description: str,
        schema: dict[str, Any],
        requires_approval: bool = False,
    ) -> None:
        self.name = name
        self.description = description
        self.schema = schema
        self.requires_approval = requires_approval


# ─── Tool definitions ─────────────────────────────────────────


ECHO = ToolDefinition(
    name="stub.echo",
    description="Returns the input message verbatim. Phase 1 stub.",
    schema={
        "type": "object",
        "properties": {"message": {"type": "string"}},
        "required": ["message"],
    },
)

WAIT = ToolDefinition(
    name="stub.wait",
    description="Waits for the given number of seconds (≤ 5). Phase 1 stub.",
    schema={
        "type": "object",
        "properties": {"seconds": {"type": "number", "minimum": 0, "maximum": 5}},
        "required": ["seconds"],
    },
)

APPROVAL_REQUIRED = ToolDefinition(
    name="stub.approval_required",
    description="Triggers an approval gate. Phase 1 stub.",
    schema={
        "type": "object",
        "properties": {"action": {"type": "string"}},
        "required": ["action"],
    },
    requires_approval=True,
)

FAIL = ToolDefinition(
    name="stub.fail",
    description="Returns a structured error. Phase 1 stub.",
    schema={
        "type": "object",
        "properties": {"message": {"type": "string"}},
        "required": ["message"],
    },
)

LIST_EVENTS = ToolDefinition(
    name="stub.list_events",
    description="Returns the events recorded so far for this execution. Phase 1 stub.",
    schema={
        "type": "object",
        "properties": {"executionId": {"type": "string"}},
        "required": ["executionId"],
    },
)

SLEEP = ToolDefinition(
    name="stub.sleep",
    description="Sleeps for the given number of milliseconds (≤ 1000). Phase 1 stub.",
    schema={
        "type": "object",
        "properties": {"ms": {"type": "number", "minimum": 0, "maximum": 1000}},
        "required": ["ms"],
    },
)


ALL_TOOLS: dict[str, ToolDefinition] = {
    t.name: t
    for t in (ECHO, WAIT, APPROVAL_REQUIRED, FAIL, LIST_EVENTS, SLEEP)
}


# ─── Tool execution ───────────────────────────────────────────


class ToolResult:
    """Result of a tool call. Normalized to {success, data} or {success, error}."""

    def __init__(self, success: bool, data: Any = None, error: str | None = None) -> None:
        self.success = success
        self.data = data
        self.error = error

    def to_dict(self) -> dict[str, Any]:
        if self.success:
            return {"success": True, "data": self.data}
        return {"success": False, "error": self.error}


def execute_tool(
    name: str, args: dict[str, Any], *, execution_id: str | None = None, all_events: list | None = None
) -> ToolResult:
    """Execute a stub tool. Returns a ToolResult.

    Args:
        name: tool name (must be in ALL_TOOLS)
        args: tool arguments (validated against schema in production; here we trust)
        execution_id: for stub.list_events
        all_events: the events list to return from stub.list_events
    """
    if name not in ALL_TOOLS:
        return ToolResult(False, error=f"unknown_tool:{name}")

    if name == "stub.echo":
        return ToolResult(True, data={"echo": args.get("message", "")})

    if name == "stub.wait":
        seconds = float(args.get("seconds", 0))
        time.sleep(min(seconds, 5.0))
        return ToolResult(True, data={"waited_seconds": seconds})

    if name == "stub.approval_required":
        # Caller (lifecycle) checks `requires_approval` BEFORE calling this.
        # If we got here, the approval was already granted. Return success.
        return ToolResult(True, data={"action": args.get("action"), "approved": True})

    if name == "stub.fail":
        return ToolResult(False, error=args.get("message", "stub_fail"))

    if name == "stub.list_events":
        return ToolResult(
            True,
            data={
                "executionId": execution_id or args.get("executionId", ""),
                "eventCount": len(all_events or []),
                "events": list(all_events or []),
            },
        )

    if name == "stub.sleep":
        ms = float(args.get("ms", 0))
        time.sleep(min(ms, 1000.0) / 1000.0)
        return ToolResult(True, data={"slept_ms": ms})

    return ToolResult(False, error=f"unhandled_tool:{name}")
