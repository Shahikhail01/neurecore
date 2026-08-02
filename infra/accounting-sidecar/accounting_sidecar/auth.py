"""HMAC token authentication for accounting-sidecar endpoints.

Mirrors `infra/_common/scope_token.py` exactly. The wire format is:

    Authorization: Bearer <base64url-claims-json>.<base64url-hmac-sha256>

Claims must include `scope == 'accounting:execute'`. Anything else is rejected.

The NestJS adapter (`HttpAccountingSidecarClient`) mints tokens via the
same library; this sidecar verifies them. Both sides must agree on the
shared secret (`ACCOUNTING_SIDECAR_SECRET`).
"""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

# Locate infra/_common/scope_token.py relative to this file.
# Layout: <root>/infra/accounting-sidecar/accounting_sidecar/auth.py
#         <root>/infra/_common/scope_token.py
# So go up 3 levels from this file → <root>/infra, then into _common.
_THIS = Path(__file__).resolve()
_SHARED_PARENT = _THIS.parents[2]  # <root>/infra (parents[0]=pkg, [1]=src, [2]=infra)
if str(_SHARED_PARENT) not in sys.path:
    sys.path.insert(0, str(_SHARED_PARENT))

from _common.scope_token import (  # type: ignore
    ScopeTokenError, sign as _sign, verify as _verify,
)


SECRET = os.environ.get("ACCOUNTING_SIDECAR_SECRET")
ACCOUNTING_SCOPE = "accounting:execute"

# HTTPAuthorizationCredentials (returns Bearer token or None)
_bearer = HTTPBearer(auto_error=True)


def _require_secret() -> str:
    if not SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error": "sidecar_not_configured",
                "code": "ACCOUNTING_SIDECAR_SECRET not set on the sidecar",
            },
        )
    return SECRET


class AuthedClaims(dict):
    """Marker subclass so request handlers can see the verified claims."""
    pass


def require_accounting_token(
    creds: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
) -> AuthedClaims:
    """FastAPI dependency: extract + verify the bearer token.

    Returns the claims dict on success.
    Raises HTTP 401 on bad/missing/expired/wrong-scope token.
    """
    secret = _require_secret()
    try:
        claims = _verify(creds.credentials, secret, expected_scope=ACCOUNTING_SCOPE)
    except ScopeTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "auth_failed",
                "code": e.code,
                "message": e.message,
            },
            headers={"WWW-Authenticate": "Bearer"},
        )
    return AuthedClaims(claims)


def issue_token_for_test(claims: dict, ttl_seconds: int = 900) -> str:
    """Mint a test token (used by tests; never in production)."""
    full = dict(claims)
    full["scope"] = ACCOUNTING_SCOPE
    full["exp"] = int(time.time()) + ttl_seconds
    return _sign(full, SECRET or "test-secret")