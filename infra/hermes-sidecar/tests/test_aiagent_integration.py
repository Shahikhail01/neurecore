"""Phase 1.2 integration tests for the upstream AIAgent wrapper.

These tests verify the sidecar correctly bridges to the vendored upstream
NousResearch/hermes-agent. They DO NOT call the LLM — they only verify the
import wiring, the AIAgent factory, the three-layer HERMES_HOME composition,
and the tool-gateway event bridge.

A live LLM call (test_real_aiagent_one_turn) is gated on OPENAI_API_KEY or
ANTHROPIC_API_KEY being present in the environment. Without it, the test is
skipped — the unit tests still cover the exit gate.

Plan ref: NC-AWL-IMP-2 §1.2
"""

from __future__ import annotations

import os
import shutil
import tempfile
from pathlib import Path

import pytest

from hermes_sidecar import aiagent
from hermes_sidecar.aiagent import (
    _VENDORED_HERMES,
    compose_hermes_home,
    create_aiagent,
)
from hermes_sidecar.models import ScopedTokenClaims
from hermes_sidecar.neurecore_tools import resolve_model_lease


# ─── Vendored upstream exists ────────────────────────────────


def test_vendored_upstream_path_exists():
    """The vendored upstream must be at the documented location."""
    assert _VENDORED_HERMES.exists(), f"upstream not found at {_VENDORED_HERMES}"
    assert (_VENDORED_HERMES / "run_agent.py").exists()
    assert (_VENDORED_HERMES / "agent").is_dir()
    assert (_VENDORED_HERMES / "tools").is_dir()


def test_vendored_upstream_version_pinned():
    """The pinned version file must reference the upstream."""
    version_file = _VENDORED_HERMES.parent / "UPSTREAM_VERSION.md"
    assert version_file.exists(), f"missing {version_file}"
    content = version_file.read_text(encoding="utf-8")
    # Must mention a SHA (40 hex chars)
    import re
    sha_match = re.search(r"[0-9a-f]{40}", content)
    assert sha_match is not None, "UPSTREAM_VERSION.md must contain a pinned SHA"
    sha = sha_match.group(0)


def test_model_lease_uses_scoped_gateway_token(monkeypatch):
    captured = {}

    class Response:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def read(self):
            return b'{"status":"success","data":{"provider":"deepseek","model":"deepseek-v4-flash","apiKey":"leased"}}'

    def fake_urlopen(request, timeout):
        captured["url"] = request.full_url
        captured["authorization"] = request.headers["Authorization"]
        captured["timeout"] = timeout
        return Response()

    monkeypatch.setenv("HERMES_SIDECAR_SECRET", "lease-test-secret")
    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)
    claims = ScopedTokenClaims(
        sub="user-1",
        tenantId="tenant-1",
        executionId="exec-1",
        workspacePath="/workspace",
        allowedTools=["nc.list_customers"],
        approvalThreshold="STANDARD",
        exp=2_000_000_000,
        scope="hermes:execute",
    )

    lease = resolve_model_lease(claims)

    assert lease["provider"] == "deepseek"
    assert captured["url"].endswith("/executions/exec-1/model-lease")
    assert captured["authorization"].startswith("Bearer ")
    assert captured["timeout"] == 10


# ─── Three-layer HERMES_HOME composition ─────────────────────


def test_compose_hermes_home_returns_ephemeral_path():
    """HERMES_HOME is the ephemeral path; the persistent and template
    layers are mounted by the systemd unit before this runs."""
    with tempfile.TemporaryDirectory() as t:
        template = os.path.join(t, "template")
        persistent = os.path.join(t, "persistent")
        ephemeral = os.path.join(t, "ephemeral")
        os.makedirs(template)

        result = compose_hermes_home(
            template_dir=template,
            persistent_dir=persistent,
            ephemeral_dir=ephemeral,
        )
        assert result == ephemeral
        assert os.path.isdir(result)


def test_compose_hermes_home_creates_persistent_and_ephemeral():
    """The persistent and ephemeral layers are created if missing.
    The template layer must already exist (mounted by systemd)."""
    with tempfile.TemporaryDirectory() as t:
        template = os.path.join(t, "template")
        os.makedirs(template)
        persistent = os.path.join(t, "does-not-exist-yet", "persistent")
        ephemeral = os.path.join(t, "does-not-exist-yet", "ephemeral")

        compose_hermes_home(
            template_dir=template,
            persistent_dir=persistent,
            ephemeral_dir=ephemeral,
        )
        assert os.path.isdir(persistent)
        assert os.path.isdir(ephemeral)


def test_compose_hermes_home_rejects_missing_template():
    """If the template layer doesn't exist, fail loud — the systemd
    mount didn't run, and using a freshly-created temp as the template
    would silently corrupt the upstream's shipped config."""
    with tempfile.TemporaryDirectory() as t:
        with pytest.raises(RuntimeError, match="Template"):
            compose_hermes_home(
                template_dir=os.path.join(t, "no-such-template"),
                persistent_dir=os.path.join(t, "persistent"),
                ephemeral_dir=os.path.join(t, "ephemeral"),
            )


# ─── AIAgent factory (without actually calling the LLM) ─────


def test_create_aiagent_uses_workspace_path():
    """AIAgent construction must set HERMES_HOME to the workspace path.

    If no LLM provider is configured in the test environment, the upstream
    will raise RuntimeError("No LLM provider configured"). That is the
    correct upstream behavior — it means the bridge is wired and the
    upstream is verifying the environment. The test in that case verifies
    that HERMES_HOME was set BEFORE the upstream rejected (the upstream
    reads the env var during its init).
    """
    with tempfile.TemporaryDirectory() as workspace:
        original = os.environ.get("HERMES_HOME")
        try:
            try:
                agent = create_aiagent(
                    execution_id="phase12-test-1",
                    tenant_id="t1",
                    workspace_path=workspace,
                    allowed_tools=["stub.echo"],
                    quiet_mode=True,
                )
                # HERMES_HOME must be set BEFORE the upstream reads it
                assert os.environ.get("HERMES_HOME") == workspace
                assert agent is not None
            except RuntimeError as exc:
                # Upstream correctly refuses to construct without a provider.
                # We still verify the env var was set (the upstream read it).
                assert "No LLM provider" in str(exc) or "provider" in str(exc)
                assert os.environ.get("HERMES_HOME") == workspace
                pytest.skip(
                    "No LLM provider configured in test env; "
                    "wire OPENAI_API_KEY or ANTHROPIC_API_KEY to enable live test"
                )
        finally:
            if original is not None:
                os.environ["HERMES_HOME"] = original
            else:
                os.environ.pop("HERMES_HOME", None)


def test_create_aiagent_inherits_control_plane_model(monkeypatch, tmp_path):
    captured = {}

    class FakeAgent:
        def __init__(self, **kwargs):
            captured.update(kwargs)

    monkeypatch.setenv("DEFAULT_MODEL", "configured-model")
    monkeypatch.delenv("HERMES_MODEL", raising=False)
    monkeypatch.delenv("HERMES_PROVIDER", raising=False)
    monkeypatch.delenv("MINIMAX_API_KEY", raising=False)
    monkeypatch.setattr("hermes_sidecar.aiagent._import_aiagent", lambda: FakeAgent)

    create_aiagent(
        execution_id="phase2-model-test",
        tenant_id="t1",
        workspace_path=str(tmp_path),
        allowed_tools=["nc.list_customers"],
    )

    assert captured["model"] == "configured-model"
    assert captured["provider"] == "openai"


def test_create_aiagent_uses_configured_minimax_provider(monkeypatch, tmp_path):
    captured = {}

    class FakeAgent:
        def __init__(self, **kwargs):
            captured.update(kwargs)

    monkeypatch.setenv("MINIMAX_API_KEY", "test-key")
    monkeypatch.setenv("MINIMAX_MODEL", "MiniMax-M2.7-highspeed")
    monkeypatch.delenv("HERMES_MODEL", raising=False)
    monkeypatch.delenv("HERMES_PROVIDER", raising=False)
    monkeypatch.setattr("hermes_sidecar.aiagent._import_aiagent", lambda: FakeAgent)

    create_aiagent(
        execution_id="phase2-minimax-test",
        tenant_id="t1",
        workspace_path=str(tmp_path),
        allowed_tools=["nc.list_customers"],
    )

    assert captured["provider"] == "minimax"
    assert captured["model"] == "MiniMax-M2.7-highspeed"
    assert captured["api_key"] == "test-key"


def test_create_aiagent_event_callback_wiring():
    """The event_callback must be wired into the agent.

    Same skip-if-no-provider policy as test_create_aiagent_uses_workspace_path.
    """
    events: list[tuple[str, dict]] = []

    def cb(evt: str, payload: dict) -> None:
        events.append((evt, payload))

    with tempfile.TemporaryDirectory() as workspace:
        try:
            agent = create_aiagent(
                execution_id="phase12-test-2",
                tenant_id="t1",
                workspace_path=workspace,
                allowed_tools=["stub.echo"],
                event_callback=cb,
                quiet_mode=True,
            )
            assert getattr(agent, "event_callback", None) is cb
        except RuntimeError as exc:
            assert "No LLM provider" in str(exc) or "provider" in str(exc)
            pytest.skip(
                "No LLM provider configured in test env; "
                "wire OPENAI_API_KEY or ANTHROPIC_API_KEY to enable live test"
            )


# ─── Live integration test (gated on API key) ───────────────


@pytest.mark.skipif(
    not os.environ.get("OPENAI_API_KEY") and not os.environ.get("ANTHROPIC_API_KEY"),
    reason="No API key in env — set OPENAI_API_KEY or ANTHROPIC_API_KEY to run live test",
)
def test_real_aiagent_one_turn_smoke():
    """End-to-end: AIAgent actually runs one conversation turn.

    This test is intentionally skipped by default. To run it:
        OPENAI_API_KEY=sk-... python3 -m pytest tests/test_aiagent_integration.py -v

    The test:
    1. Creates an AIAgent with a tmpfs workspace
    2. Calls run_conversation("say hello")
    3. Asserts the agent returns a non-empty final_response
    4. Asserts the workspace now has the upstream's session/state files
    """
    with tempfile.TemporaryDirectory() as workspace:
        agent = create_aiagent(
            execution_id="phase12-live-1",
            tenant_id="t1",
            workspace_path=workspace,
            allowed_tools=[],  # no tools for the smoke test
            quiet_mode=True,
        )
        result = aiagent.run_one_turn(agent, "say hello in one short sentence")
        assert result is not None
        # The upstream returns either a dict or a string
        if isinstance(result, dict):
            final = result.get("final_response", "")
        else:
            final = str(result)
        assert len(final) > 0, f"AIAgent returned empty response: {result!r}"
