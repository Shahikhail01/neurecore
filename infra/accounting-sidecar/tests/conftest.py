"""Conftest — make the package importable from tests/.

Sets ACCOUNTING_SIDECAR_SECRET BEFORE any sidecar module is imported so
that the auth module picks it up at import time.
"""
import os
import sys
from pathlib import Path

# Set the env var FIRST, before any sidecar imports.
os.environ.setdefault("ACCOUNTING_SIDECAR_SECRET", "test-secret-32-bytes-min-12")

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

"""Shared auth helper for sidecar tests — mint a valid scoped bearer token."""
import os
import sys
from pathlib import Path

# Ensure _common is importable
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))

from accounting_sidecar.auth import issue_token_for_test  # noqa: E402

SECRET = os.environ.get("ACCOUNTING_SIDECAR_SECRET", "test-secret-32-bytes-min-12")


def auth_headers() -> dict:
    token = issue_token_for_test(
        {
            "sub": "test-user",
            "tenantId": "test-tenant",
            "executionId": "test-exec",
            "workspacePath": "/var/lib/neurecore/accounting/tenants/test-tenant/",
            "allowedTools": [],
            "approvalThreshold": "NONE",
        },
        ttl_seconds=3600,
    )
    return {"Authorization": f"Bearer {token}"}


def authed_client(client):
    """Return a wrapper that auto-injects auth headers on .get/.post calls."""
    class _Client:
        def get(self, url, **kw):
            kw.setdefault("headers", {}).update(auth_headers())
            return client.get(url, **kw)
        def post(self, url, **kw):
            kw.setdefault("headers", {}).update(auth_headers())
            return client.post(url, **kw)
    return _Client()
