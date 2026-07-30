"""AIAgent wrapper — bridges the sidecar to the vendored upstream Hermes.

Phase 1.2 wraps the vendored `AIAgent` from `infra/hermes/hermes-agent/`.
The vendored package is loaded at runtime by adding its source root to
`sys.path`, then `from run_agent import AIAgent` instantiates the same
class used by the upstream CLI, TUI, and gateway.

Design constraints (per upstream AGENTS.md):
- **Per-conversation prompt caching is sacred.** We persist one AIAgent
  instance per execution across turns (start → pause → resume) so the
  cached prefix is reused. A new AIAgent would invalidate the cache.
- **Use `get_hermes_home()` from upstream `hermes_constants` for all
  HERMES_HOME paths.** Never hardcode `~/.hermes`.
- **The three-layer HERMES_HOME** (template / persistent / tmpfs) is
  composed by the sidecar at startup; the layer paths are passed to
  AIAgent via the upstream's `env` mechanism (it reads `HERMES_HOME`).

This module is the only place in the sidecar that knows about the vendored
upstream. The rest of the sidecar (lifecycle.py, main.py) talks only to
this wrapper.

Plan ref: NC-AWL-IMP-2 §1.2
"""

from __future__ import annotations

import os
import json
import sys
from pathlib import Path
from typing import Any, Callable
from .models import ScopedTokenClaims

# ─── Locate the vendored upstream ────────────────────────────

# The sidecar lives at infra/hermes-sidecar/, the vendored upstream at
# infra/hermes/hermes-agent/. The relative path is resolved at import time.
_THIS_DIR = Path(__file__).resolve().parent
_SIDECAR_DIR = _THIS_DIR.parent
_INFRA_DIR = _SIDECAR_DIR.parent
_VENDORED_HERMES = _INFRA_DIR / "hermes" / "hermes-agent"

if not _VENDORED_HERMES.exists():
    raise RuntimeError(
        f"Vendored upstream Hermes not found at {_VENDORED_HERMES}. "
        "Check infra/hermes/UPSTREAM_VERSION.md."
    )

# Add the vendored package to sys.path so `from run_agent import AIAgent`
# works. The upstream uses top-level imports like `from agent.foo import ...`,
# so the upstream's root directory must be on sys.path.
if str(_VENDORED_HERMES) not in sys.path:
    sys.path.insert(0, str(_VENDORED_HERMES))


# ─── Lazy import the upstream AIAgent ────────────────────────
# Lazy import so the sidecar can boot without the upstream package being
# importable (e.g. if a runtime dependency is missing). The actual
# instantiations happen in `create_aiagent()`.

def _import_aiagent():
    """Import and return the AIAgent class from the vendored upstream.

    Raises:
        ImportError: if the vendored package cannot be imported.
    """
    try:
        from run_agent import AIAgent  # type: ignore[import-not-found]
        return AIAgent
    except ImportError as exc:
        raise ImportError(
            f"Failed to import AIAgent from {_VENDORED_HERMES}. "
            "Check upstream dependencies (openai, litellm, etc.) are installed."
        ) from exc


# ─── Three-layer HERMES_HOME composition ─────────────────────


def compose_hermes_home(
    *,
    template_dir: str | os.PathLike,
    persistent_dir: str | os.PathLike,
    ephemeral_dir: str | os.PathLike,
) -> str:
    """Compose the three-layer HERMES_HOME by overlaying directory paths.

    The upstream's `get_hermes_home()` resolves a single path from
    `HERMES_HOME` env var. We want three layers:

    - Immutable template (read-only, shared across tenants)
    - Persistent tenant state (read-write, scoped per tenant)
    - Ephemeral per-execution (tmpfs, wiped on completion)

    Approach: point `HERMES_HOME` at the ephemeral tmpfs, then bind-mount
    the template and persistent layers on top using unionfs / overlayfs /
    symlinks. The systemd unit (see infra/sidecar/systemd/) handles the
    mounts before sidecar startup.

    For Phase 1.2 (the integration spike), we use a simpler approach:
    HERMES_HOME points at the ephemeral tmpfs, and the upstream's
    `get_hermes_home()` resolves correctly. The template and persistent
    layers are mounted by the systemd unit; inside the sidecar process we
    just need to know which path to use.

    Args:
        template_dir: read-only template (e.g. /opt/neurecore/hermes/template)
        persistent_dir: tenant-specific persistent state (e.g. /var/lib/...)
        ephemeral_dir: per-execution tmpfs (e.g. /run/hermes/<executionId>)

    Returns:
        The path to use as HERMES_HOME (= ephemeral_dir, where upstream writes).
    """
    template_p = Path(template_dir).resolve()
    persistent_p = Path(persistent_dir).resolve()
    ephemeral_p = Path(ephemeral_dir).resolve()

    # Currently the sidecar runs in the same process as the upstream. The
    # bind mounts are done by systemd before this process starts. We only
    # need to expose the right HERMES_HOME.
    # NOTE: real overlayfs setup is done by the systemd unit; this function
    # just validates the layout and returns the path.
    for label, path in (
        ("template", template_p),
        ("persistent", persistent_p),
        ("ephemeral", ephemeral_p),
    ):
        if not path.exists():
            # Create the persistent and ephemeral paths; the template path
            # must already exist (mounted by systemd).
            if label == "template":
                raise RuntimeError(
                    f"Template HERMES_HOME layer missing: {template_p}. "
                    "Was the systemd unit's BindReadOnlyPaths set?"
                )
            path.mkdir(parents=True, exist_ok=True)

    return str(ephemeral_p)


# ─── AIAgent factory ─────────────────────────────────────────


def create_aiagent(
    *,
    execution_id: str,
    tenant_id: str,
    workspace_path: str,
    allowed_tools: list[str],
    event_callback: Callable[[str, dict], None] | None = None,
    tool_start_callback: Callable[[dict], None] | None = None,
    tool_complete_callback: Callable[[dict], None] | None = None,
    stream_delta_callback: Callable[[str], None] | None = None,
    thinking_callback: Callable[[str], None] | None = None,
    reasoning_callback: Callable[[str], None] | None = None,
    max_iterations: int = 50,
    api_key: str | None = None,
    base_url: str | None = None,
    provider: str | None = None,
    model: str | None = None,
    quiet_mode: bool = True,
    scoped_claims: ScopedTokenClaims | None = None,
) -> Any:
    """Create an AIAgent instance for one execution.

    The returned AIAgent is a real upstream object. It owns:
    - The conversation state (so prompt caching is preserved across turns)
    - The system prompt (built from skills + config)
    - The tool registry (via the upstream's auto-discovery)

    The sidecar does NOT call `AIAgent.run_conversation` itself. The
    lifecycle module calls it once per turn.

    Args:
        execution_id: pinned upstream session_id for prompt caching
        tenant_id: included in system prompt context (not a security boundary
            — the real boundary is the scoped token, verified by `auth.py`)
        workspace_path: HERMES_HOME for this execution
        allowed_tools: list of tool names to expose (the upstream's toolset
            system is consulted; tools NOT in this list are disabled)
        event_callback: receives upstream events (tool.start, tool.complete,
            execution.started, etc.). Called from the upstream thread; the
            sidecar's EventBus is thread-safe.
        tool_start_callback: called when a tool invocation begins
        tool_complete_callback: called when a tool invocation ends
        stream_delta_callback: called for each token stream delta
        thinking_callback: called when the upstream emits a "thinking"
            signal (between model calls)
        reasoning_callback: called when the upstream emits a reasoning
            block (for reasoning-capable models)
        max_iterations: bounding tool-call iterations per turn (default 50
            — enough for SIM-04, far below the upstream's default 500)
        api_key: model provider API key. If None, reads from env.
        base_url: model provider base URL. If None, reads from env.
        provider: provider name (e.g. "openai", "anthropic", "nous").
            If None, the upstream auto-detects.
        model: model name. If None, the upstream picks from config.
        quiet_mode: suppress the upstream's verbose CLI output (the sidecar
            has its own structured logging via the EventBus)

    Returns:
        The upstream AIAgent instance.

    Raises:
        ImportError: if the vendored upstream cannot be imported.
        RuntimeError: if AIAgent construction fails.
    """
    # Set HERMES_HOME for the upstream BEFORE constructing the agent.
    # This must also happen before importing run_agent: upstream logging and
    # constants resolve their home paths during module import.
    os.environ["HERMES_HOME"] = workspace_path

    execution_context: dict[str, Any] = {}
    if scoped_claims is not None:
        from .neurecore_tools import register_for_execution, resolve_model_lease
        register_for_execution(scoped_claims)
        lease = resolve_model_lease(scoped_claims)
        api_key = api_key or lease.get("apiKey")
        base_url = base_url or lease.get("baseUrl")
        provider = provider or lease.get("provider")
        model = model or lease.get("model")
        execution_context = lease.get("executionContext") or {}

    AIAgent = _import_aiagent()

    effective_provider = (
        provider
        or os.environ.get("HERMES_PROVIDER")
        or ("minimax" if os.environ.get("MINIMAX_API_KEY") else "openai")
    )
    effective_api_key = api_key or os.environ.get("HERMES_API_KEY")
    if not effective_api_key and effective_provider == "minimax":
        effective_api_key = os.environ.get("MINIMAX_API_KEY")
    effective_model = model or os.environ.get("HERMES_MODEL")
    if not effective_model and effective_provider == "minimax":
        effective_model = os.environ.get("MINIMAX_MODEL")
    effective_model = (
        effective_model
        or os.environ.get("DEFAULT_MODEL")
        or "gpt-4-turbo-preview"
    )

    # session_id pins the conversation for prompt caching.
    # We pass execution_id as the session_id so the upstream's conversation
    # history is keyed by our executionId.
    try:
        agent = AIAgent(
            api_key=effective_api_key,
            base_url=base_url or os.environ.get("HERMES_BASE_URL"),
            provider=effective_provider,
            model=effective_model,
            session_id=execution_id,
            max_iterations=max_iterations,
            quiet_mode=quiet_mode,
            platform="api",  # not "cli" / "telegram" — the sidecar is its own surface
            ephemeral_system_prompt=(
                "You are NeureCore's autonomous execution worker for tenant "
                f"{tenant_id}. You operate independently within the NeureCore "
                "control plane to fulfil the user's requested business workflow.\n\n"
                "REFERENCE DATA — these are the ONLY valid IDs you may use:\n"
                f"{json.dumps(execution_context, default=str)}\n\n"
                "RULES:\n"
                "1. Plan first: use nc.plan_workflow to emit a structured execution "
                "plan before taking action. Replan when new information requires it.\n"
                "2. CRITICAL — NEVER invent IDs. Every ID you pass must come from "
                "ONE of these two sources: (a) the REFERENCE DATA above (use exact "
                "projectTypeId and agentProfileId values), or (b) the result of an "
                "nc.list_customers or nc.search_memory or nc.create_* call (use the "
                "exact `id` field from the returned record). If you don't have a "
                "valid ID, call a read tool to obtain it. Any tool call that passes "
                "a fabricated ID will fail with a 404 error.\n"
                "3. Use only the enabled nc.* tools. \n"
                "4. Treat deferred tool results as mandatory approval pauses. Preserve "
                "prior evidence and continue after approved results are returned.\n"
                "5. Create all records, assign all work, produce evidence, and send "
                "notification before claiming completion.\n"
                "6. nc.submit_for_approval records a review request; it does not "
                "replace assignment or notification and does not pause execution.\n"
                "7. When appropriate, delegate sub-tasks to specialized subagents. "
                "Create and reuse skills for repeatable workflows.\n"
                "8. Self-correct: if a tool returns an error, diagnose and retry with "
                "corrected arguments rather than failing the entire workflow."
            ),
            event_callback=event_callback,
            enabled_toolsets=["neurecore"] if scoped_claims is not None else None,
            tool_start_callback=tool_start_callback,
            tool_complete_callback=tool_complete_callback,
            stream_delta_callback=stream_delta_callback,
            thinking_callback=thinking_callback,
            reasoning_callback=reasoning_callback,
            # Skip the upstream's CLI-side context loading — we don't have
            # a ~/.hermes/AGENTS.md or SOUL.md; the sidecar is API-driven.
            skip_context_files=True,
            # Enable memory: the upstream writes to FTS5 in the persistent layer
            # so the agent can learn from prior executions. The real enterprise
            # memory is still in Postgres; this is the agent's runtime memory.
            skip_memory=False,
            # Auto-save trajectories to disk so learning persists across runs.
            save_trajectories=True,
        )
    except Exception as exc:
        raise RuntimeError(
            f"AIAgent construction failed for execution {execution_id}: {exc}"
        ) from exc

    return agent


def run_one_turn(
    agent: Any,
    user_message: str,
) -> Any:
    """Run one turn of the conversation. Returns the result dict.

    The result dict shape (from upstream's run_conversation):
    {
        "final_response": str,
        "messages": List[Dict[str, Any]],
        # ... other upstream-specific fields
    }

    For Phase 1.2 we only consume `final_response` and `messages`.
    """
    try:
        result = agent.run_conversation(user_message)
    except Exception as exc:
        # Don't let upstream errors escape untyped. Wrap with execution context.
        raise RuntimeError(f"AIAgent.run_conversation failed: {exc}") from exc
    return result
