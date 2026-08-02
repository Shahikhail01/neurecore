"""Report generator tests — BS, IS, CF (NC-ACCT-IMP-1 §10 / A6, A11)."""
from decimal import Decimal
from beancount import loader
from accounting_sidecar.reports import (
    aggregate_balances, classify, balance_sheet, income_statement,
    cash_flow, generate_report,
)


BEAN = """\
2026-01-01 open Assets:Bank:Checking USD
2026-01-01 open Assets:Bank:Savings USD
2026-01-01 open Equity:OpeningBalances USD
2026-01-01 open Equity:RetainedEarnings USD
2026-01-01 open Expenses:Office:Supplies USD
2026-01-01 open Expenses:Office:Rent USD
2026-01-01 open Income:Consulting USD

2026-01-01 * "Opening balances"
  Assets:Bank:Checking      10000.00 USD
  Assets:Bank:Savings       20000.00 USD
  Equity:OpeningBalances   -30000.00 USD

2026-01-15 * "Office supplies"
  Expenses:Office:Supplies    500.00 USD
  Assets:Bank:Checking        -500.00 USD

2026-01-31 * "Office rent"
  Expenses:Office:Rent       2000.00 USD
  Assets:Bank:Checking       -2000.00 USD

2026-02-10 * "Client invoice paid"
  Assets:Bank:Checking       5000.00 USD
  Income:Consulting         -5000.00 USD

2026-02-28 * "Close period — net income to retained earnings"
  Equity:RetainedEarnings  -2500.00 USD
  Income:Consulting         5000.00 USD
  Expenses:Office:Supplies  -500.00 USD
  Expenses:Office:Rent     -2000.00 USD
"""
# Sanity: the fixture balances after closing.  Net income = 5000 - 2500 = 2500.
# Pre-closing, A + L + E ≠ 0 because Income/Expense are not yet closed.


def _load():
    entries, errors, options = loader.load_string(BEAN)
    assert not errors, errors
    return entries, options


def test_classify_root_prefix():
    entries, options = _load()
    assert classify("Assets:Bank:Checking", options) == "asset"
    assert classify("Liabilities:Payable", options) == "liability"
    assert classify("Equity:OpeningBalances", options) == "equity"
    assert classify("Income:Consulting", options) == "income"
    assert classify("Expenses:Office:Rent", options) == "expense"
    assert classify("Unknown:Foo", options) == "unknown"


def test_aggregate_balances():
    """Pre-closing balances (the closing entries zero out income/expense)."""
    from datetime import date
    entries, options = _load()
    cutoff = date(2026, 2, 27)
    pre = [e for e in entries
           if not hasattr(e, "date") or e.date <= cutoff]
    b = aggregate_balances(pre, options)
    # Checking: 10000 - 500 - 2000 + 5000 = 12500
    assert b["Assets:Bank:Checking"] == Decimal("12500.00")
    assert b["Assets:Bank:Savings"] == Decimal("20000.00")
    assert b["Equity:OpeningBalances"] == Decimal("-30000.00")
    assert b["Income:Consulting"] == Decimal("-5000.00")
    assert b["Expenses:Office:Supplies"] == Decimal("500.00")
    assert b["Expenses:Office:Rent"] == Decimal("2000.00")


def test_balance_sheet_balances():
    """A + L + E == 0 after closing entries (Beancount convention)."""
    entries, options = _load()
    bs = balance_sheet(entries, options)
    assert bs["reportType"] == "BALANCE_SHEET"
    # A = 12500 + 20000 = 32500 (post-closing same as pre)
    assert Decimal(bs["totalAssets"]) == Decimal("32500.00")
    # L = 0
    assert Decimal(bs["totalLiabilities"]) == Decimal("0")
    # E = -30000 (opening) + (-2500) (retained earnings closing) = -32500
    assert Decimal(bs["totalEquity"]) == Decimal("-32500.00")
    # Identity: A + L + E = 32500 + 0 + (-32500) = 0
    assert Decimal(bs["balances"]) == Decimal("0"), f"unbalanced: {bs['balances']}"


def test_income_statement_net():
    """IS uses pre-closing entries (period_end = day before closing)."""
    from datetime import date
    entries, options = _load()
    cutoff = date(2026, 2, 27)
    is_ = income_statement(entries, options, period_end=cutoff)
    # Income: -5000 reported as 5000 (revenue)
    assert Decimal(is_["totalIncome"]) == Decimal("5000.00")
    # Expenses: 500 + 2000 = 2500
    assert Decimal(is_["totalExpenses"]) == Decimal("2500.00")
    # Net: 5000 - 2500 = 2500
    assert Decimal(is_["netIncome"]) == Decimal("2500.00")


def test_cash_flow_delta():
    """Cash flow uses pre-closing (otherwise operating flows are zeroed)."""
    from datetime import date
    entries, options = _load()
    cutoff = date(2026, 2, 27)
    pre = [e for e in entries
           if not hasattr(e, "date") or e.date <= cutoff]
    cf = cash_flow(pre, options)
    # Cash accounts: Bank:Checking + Bank:Savings = 32500
    assert Decimal(cf["cashAtEnd"]) == Decimal("32500.00")
    # Operating inflow: 5000 (Income:Consulting flipped)
    assert Decimal(cf["operatingInflows"]) == Decimal("5000.00")
    # Operating outflow: 2500
    assert Decimal(cf["operatingOutflows"]) == Decimal("2500.00")
    # Net operating: 5000 - 2500 = 2500
    assert Decimal(cf["netOperatingCash"]) == Decimal("2500.00")


def test_generate_report_dispatch():
    entries, options = _load()
    assert generate_report(entries, options, "BALANCE_SHEET")["reportType"] == "BALANCE_SHEET"
    assert generate_report(entries, options, "INCOME_STATEMENT")["reportType"] == "INCOME_STATEMENT"
    assert generate_report(entries, options, "CASH_FLOW")["reportType"] == "CASH_FLOW"
    try:
        generate_report(entries, options, "FOO")
        assert False, "should have raised"
    except ValueError:
        pass


def test_empty_ledger_no_crash():
    """Empty ledger produces zeroed reports, not crashes."""
    EMPTY = "2026-01-01 open Assets:Bank:Checking USD\n"
    entries, errors, options = loader.load_string(EMPTY)
    assert not errors
    bs = balance_sheet(entries, options)
    assert Decimal(bs["totalAssets"]) == Decimal("0")
    assert Decimal(bs["totalLiabilities"]) == Decimal("0")
    assert Decimal(bs["totalEquity"]) == Decimal("0")