"""End-to-end smoke test for the FastAPI sidecar (NC-ACCT-IMP-1 §1a).
Spins up the app via TestClient (no real socket).
"""
from fastapi.testclient import TestClient
from conftest import authed_client
from accounting_sidecar.main import app

client = authed_client(TestClient(app))


def test_healthz():
    r = client.get("/healthz")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["service"] == "accounting-sidecar"


def test_readyz():
    r = client.get("/readyz")
    assert r.status_code == 200
    assert r.json()["status"] == "ready"


def test_npv_endpoint():
    r = client.post("/v1/compute/investment/npv",
                    json={"rate": 0.10, "cashflows": [-1000, 300, 400, 500]})
    assert r.status_code == 200
    body = r.json()
    assert body["converged"] is True
    assert abs(body["npv"] - (-21.0368)) < 0.01, f"got {body['npv']}"


def test_irr_endpoint():
    r = client.post("/v1/compute/investment/irr",
                    json={"cashflows": [-1000, 300, 400, 500]})
    assert r.status_code == 200
    body = r.json()
    assert body["converged"] is True
    assert abs(body["irr"] - 0.088963) < 1e-4, f"got {body['irr']}"


def test_irr_no_solution():
    r = client.post("/v1/compute/investment/irr",
                    json={"cashflows": [100, 200, 300]})
    assert r.status_code == 200
    body = r.json()
    assert body["converged"] is False
    assert body["irr"] is None


def test_validate_balanced():
    r = client.post("/v1/ledger/validate", json={
        "postings": [
            {"account": "Assets:Bank", "amount": "500.00", "currency": "USD"},
            {"account": "Expenses:Office", "amount": "-500.00", "currency": "USD"},
        ]
    })
    assert r.status_code == 200
    body = r.json()
    assert body["validated"] is True, f"got issues: {body['issues']}"
    assert body["issues"] == []
    assert "Assets:Bank" in body["beancountChunk"]


def test_validate_unbalanced():
    r = client.post("/v1/ledger/validate", json={
        "postings": [
            {"account": "Assets:Bank", "amount": "500.00", "currency": "USD"},
            {"account": "Expenses:Office", "amount": "-499.00", "currency": "USD"},
        ]
    })
    body = r.json()
    assert body["validated"] is False
    assert any("unbalanced" in i for i in body["issues"])


def test_validate_mixed_currency():
    r = client.post("/v1/ledger/validate", json={
        "postings": [
            {"account": "Assets:Bank", "amount": "500.00", "currency": "USD"},
            {"account": "Liabilities:Payable", "amount": "-500.00", "currency": "EUR"},
        ]
    })
    body = r.json()
    assert body["validated"] is False
    assert any("currencies" in i for i in body["issues"])