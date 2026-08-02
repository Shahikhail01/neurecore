"""Report endpoint HTTP tests — via TestClient (NC-ACCT-IMP-1 §4)."""
from decimal import Decimal
from fastapi.testclient import TestClient
from conftest import authed_client
from accounting_sidecar.main import app

client = authed_client(TestClient(app))

BEAN = """\
2026-01-01 open Assets:Bank:Checking USD
2026-01-01 open Equity:OpeningBalances USD
2026-01-01 open Income:Consulting USD
2026-01-01 open Expenses:Office:Supplies USD

2026-01-01 * "Opening"
  Assets:Bank:Checking      10000.00 USD
  Equity:OpeningBalances   -10000.00 USD

2026-01-20 * "Sale"
  Assets:Bank:Checking       3000.00 USD
  Income:Consulting         -3000.00 USD

2026-01-25 * "Supplies"
  Expenses:Office:Supplies    500.00 USD
  Assets:Bank:Checking        -500.00 USD
"""


def test_balance_sheet_endpoint():
    r = client.post("/v1/ledger/reports/balance-sheet",
                    json={"beancount": BEAN, "reportType": "BALANCE_SHEET"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["reportType"] == "BALANCE_SHEET"
    assert body["computedBy"] == "beancount"
    assert Decimal(body["results"]["totalAssets"]) == Decimal("12500.00")


def test_income_statement_endpoint():
    r = client.post("/v1/ledger/reports/income-statement",
                    json={"beancount": BEAN, "reportType": "INCOME_STATEMENT"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["reportType"] == "INCOME_STATEMENT"
    assert Decimal(body["results"]["netIncome"]) == Decimal("2500.00")


def test_cash_flow_endpoint():
    r = client.post("/v1/ledger/reports/cash-flow",
                    json={"beancount": BEAN, "reportType": "CASH_FLOW"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["reportType"] == "CASH_FLOW"
    assert Decimal(body["results"]["cashAtEnd"]) == Decimal("12500.00")


def test_invalid_ledger_returns_400():
    BAD = "2026-01-01 * \"Oops\"\n  Assets:Bank  100.00 USD\n  Equity:X   -50.00 USD\n"
    r = client.post("/v1/ledger/reports/balance-sheet",
                    json={"beancount": BAD, "reportType": "BALANCE_SHEET"})
    assert r.status_code == 400
    body = r.json()
    assert "validated" in str(body).lower() or "issues" in str(body).lower()