"""accounting-sidecar — FastAPI skeleton (NC-ACCT-IMP-1 §4).

Endpoints: TIER-1 compute (stateless) + ledger validate + report generators
(stateless in MVP, taking beancount text in the request body).

Production report path (mmap'd snapshot, stateful-but-isolated) is added
when NestJS wires the snapshot regeneration background job.

**Authentication:** All `/v1/*` endpoints require an HMAC-scoped bearer
token (see auth.py). `/healthz` and `/readyz` are unauthenticated for
load balancer health probes.
"""
from fastapi import FastAPI, HTTPException, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator
from typing import List, Literal
import numpy_financial as npf
from decimal import Decimal
import hashlib
import json
import time
import logging
from beancount import loader

from accounting_sidecar.reports import generate_report
from accounting_sidecar.snapshot import get_store
from accounting_sidecar.auth import require_accounting_token, AuthedClaims

logger = logging.getLogger("accounting-sidecar")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="accounting-sidecar", version="0.1.0")


@app.get("/healthz")
def healthz():
    return {"status": "ok", "service": "accounting-sidecar", "version": "0.1.0"}


@app.get("/readyz")
def readyz():
    return {"status": "ready"}


# Sub-router: every /v1/* route is gated by the HMAC token verifier.
# FastAPI's APIRouter with dependencies= applies the auth to all routes.
from fastapi import APIRouter
v1 = APIRouter(prefix="/v1", dependencies=[Depends(require_accounting_token)])


class NPVRequest(BaseModel):
    rate: float = Field(..., ge=-1.0, le=10.0, description="Discount rate per period")
    cashflows: List[float] = Field(..., min_length=1, max_length=1000)

    @field_validator("cashflows")
    @classmethod
    def finite_only(cls, v: List[float]) -> List[float]:
        for c in v:
            if not (-1e15 < c < 1e15):
                raise ValueError(f"non-finite cashflow: {c}")
        return v


class ComputeResponse(BaseModel):
    computationId: str
    npv: float
    converged: bool


@v1.post("/compute/investment/npv", response_model=ComputeResponse)
def compute_npv(req: NPVRequest):
    try:
        result = float(npf.npv(req.rate, req.cashflows))
    except Exception as e:
        raise HTTPException(400, f"npv failed: {e}")
    cid = hashlib.sha256(
        json.dumps({"rate": req.rate, "cf": req.cashflows, "ts": time.time()}).encode()
    ).hexdigest()[:16]
    return ComputeResponse(computationId=cid, npv=round(result, 4), converged=True)


class IRRRequest(BaseModel):
    cashflows: List[float] = Field(..., min_length=2, max_length=1000)


class IRRResponse(BaseModel):
    computationId: str
    irr: float | None
    converged: bool


@v1.post("/compute/investment/irr", response_model=IRRResponse)
def compute_irr(req: IRRRequest):
    import math
    cid = hashlib.sha256(
        json.dumps({"cf": req.cashflows, "ts": time.time()}).encode()
    ).hexdigest()[:16]
    try:
        result = npf.irr(req.cashflows)
        if result is None or (isinstance(result, float) and math.isnan(result)):
            return IRRResponse(computationId=cid, irr=None, converged=False)
        return IRRResponse(computationId=cid, irr=round(float(result), 6), converged=True)
    except Exception as e:
        raise HTTPException(400, f"irr failed: {e}")


class ValidateRequest(BaseModel):
    postings: List[dict] = Field(..., min_length=2, max_length=500)
    """Each posting: {"account": str, "amount": str (Decimal), "currency": str}"""


class ValidateResponse(BaseModel):
    validated: bool
    beancountChunk: str
    issues: List[str]


@v1.post("/ledger/validate", response_model=ValidateResponse)
def validate_postings(req: ValidateRequest):
    """Stateless double-entry check. Returns the beancount text chunk that
    would represent these postings, plus any issues found.

    Does NOT touch the filesystem or DB. NestJS owns the actual write.
    """
    issues: List[str] = []
    total = Decimal(0)
    currency_set = set()
    lines = []
    for p in req.postings:
        if "account" not in p or "amount" not in p:
            issues.append(f"posting missing account/amount: {p}")
            continue
        try:
            amt = Decimal(str(p["amount"]))
        except Exception:
            issues.append(f"invalid amount: {p.get('amount')}")
            continue
        cur = p.get("currency", "USD")
        currency_set.add(cur)
        total += amt
        lines.append(f"  {p['account']}    {amt} {cur}")
    if len(currency_set) > 1:
        issues.append(f"mixed currencies: {currency_set}")
    if abs(total) > Decimal("0.005"):
        issues.append(f"unbalanced: total={total} (debits must equal credits)")
    validated = len(issues) == 0
    chunk = "\n".join(lines) if lines else ""
    return ValidateResponse(validated=validated, beancountChunk=chunk, issues=issues)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8090)


# ─────────────────────────────────────────────────────────────────────────────
# Report endpoints (NC-ACCT-IMP-1 §4, §5)
# ─────────────────────────────────────────────────────────────────────────────


class ReportRequest(BaseModel):
    beancount: str | None = Field(
        None, max_length=2_000_000,
        description="Inline beancount text (MVP path)",
    )
    tenantId: str | None = Field(
        None, min_length=1, max_length=64,
        description="Tenant ID to read from mmap'd snapshot (production path)",
    )
    reportType: Literal["BALANCE_SHEET", "INCOME_STATEMENT", "CASH_FLOW"]


def _resolve_beancount(req: ReportRequest) -> str:
    """MVP path: inline `beancount` field. Production path: read from snapshot
    keyed by `tenantId`. Exactly one must be set; otherwise we default to
    inline if present, else snapshot."""
    if req.beancount:
        return req.beancount
    if req.tenantId:
        return get_store().read(req.tenantId)
    raise HTTPException(
        400,
        "ReportRequest must include either `beancount` (inline) or `tenantId` (snapshot)",
    )


class ReportResponse(BaseModel):
    reportType: str
    computedBy: Literal["beancount", "manual"]
    asOf: str | None = None
    periodStart: str | None = None
    periodEnd: str | None = None
    results: dict
    issues: List[str]


def _load_ledger_or_400(beancount_text: str):
    entries, errors, options = loader.load_string(beancount_text)
    if errors:
        issues = [f"{e.source}: {e.message}" for e in errors]
        raise HTTPException(400, {"validated": False, "issues": issues})
    return entries, options, []


@v1.post("/ledger/reports/balance-sheet", response_model=ReportResponse)
def report_balance_sheet(req: ReportRequest):
    text = _resolve_beancount(req)
    entries, options, issues = _load_ledger_or_400(text)
    results = generate_report(entries, options, "BALANCE_SHEET")
    return ReportResponse(
        reportType=results["reportType"],
        asOf=results.get("asOf"),
        periodStart=results.get("periodStart"),
        periodEnd=results.get("periodEnd"),
        results=results,
        computedBy="beancount",
        issues=issues,
    )


@v1.post("/ledger/reports/income-statement", response_model=ReportResponse)
def report_income_statement(req: ReportRequest):
    text = _resolve_beancount(req)
    entries, options, issues = _load_ledger_or_400(text)
    results = generate_report(entries, options, "INCOME_STATEMENT")
    return ReportResponse(
        reportType=results["reportType"],
        asOf=results.get("asOf"),
        periodStart=results.get("periodStart"),
        periodEnd=results.get("periodEnd"),
        results=results,
        computedBy="beancount",
        issues=issues,
    )


@v1.post("/ledger/reports/cash-flow", response_model=ReportResponse)
def report_cash_flow(req: ReportRequest):
    text = _resolve_beancount(req)
    entries, options, issues = _load_ledger_or_400(text)
    results = generate_report(entries, options, "CASH_FLOW")
    return ReportResponse(
        reportType=results["reportType"],
        asOf=results.get("asOf"),
        periodStart=results.get("periodStart"),
        periodEnd=results.get("periodEnd"),
        results=results,
        computedBy="beancount",
        issues=issues,
    )


@v1.get("/snapshot/{tenant_id}")
def get_snapshot(tenant_id: str):
    """Return the raw mmap'd beancount text for a tenant. Useful for the
    operator dashboard to verify snapshot freshness."""
    text = get_store().read(tenant_id)
    return {"tenantId": tenant_id, "sizeBytes": len(text), "beancount": text}


@v1.get("/snapshot/_health")
def snapshot_health():
    """Diagnostic: list cached tenants and the configured snapshot dir."""
    return get_store().health()

# Mount the auth-gated /v1/* sub-router.
app.include_router(v1)
