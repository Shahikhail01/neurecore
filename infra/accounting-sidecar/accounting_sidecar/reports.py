"""Report generation — BS, IS, CF.

Beancount 3.x removed `beancount.report`. We generate reports from loaded
entries using our own aggregation. The Python side here accepts a beancount
text payload (or a snapshot path in production), validates it, and returns
structured JSON that NestJS will persist as `AccountingReport.results`.

NC-ACCT-IMP-1 §3, §4 — report endpoints.
"""
from __future__ import annotations

from beancount import loader
from beancount.core import data
from decimal import Decimal
from collections import defaultdict
from dataclasses import dataclass, asdict
from typing import Any


# ─────────────────────────────────────────────────────────────────────────────
# Account classification
#
# Beancount's account-type inference is: the *first component* of the account
# name (before the first colon) maps to one of the five root types: Assets,
# Liabilities, Equity, Income, Expenses. The mapping is configurable via
# loader options, but defaults are exactly those five names.
#
# Reports rely on this classification:
#   Balance Sheet  = Assets + Liabilities + Equity
#   Income Statement = Income - Expenses
#   Cash Flow       = delta in Assets:Bank:* over a period
# ─────────────────────────────────────────────────────────────────────────────


def classify(account: str, options: dict) -> str:
    """Return one of 'asset','liability','equity','income','expense'."""
    root = account.split(":", 1)[0]
    if root == options.get("name_assets", "Assets"):
        return "asset"
    if root == options.get("name_liabilities", "Liabilities"):
        return "liability"
    if root == options.get("name_equity", "Equity"):
        return "equity"
    if root == options.get("name_income", "Income"):
        return "income"
    if root == options.get("name_expenses", "Expenses"):
        return "expense"
    return "unknown"


def aggregate_balances(entries, options) -> dict[str, Decimal]:
    """Sum postings by account across all transactions. Beancount 3.x uses
    Decimal for units.number, so we keep Decimal arithmetic throughout."""
    balances: dict[str, Decimal] = defaultdict(lambda: Decimal(0))
    for entry in entries:
        if isinstance(entry, data.Transaction):
            for posting in entry.postings:
                balances[str(posting.account)] += posting.units.number
    return dict(balances)


def balance_sheet(entries, options) -> dict[str, Any]:
    """Standard balance sheet: Assets = Liabilities + Equity."""
    balances = aggregate_balances(entries, options)

    assets = []
    liabilities = []
    equity = []
    for acct, bal in sorted(balances.items()):
        kind = classify(acct, options)
        if kind == "asset":
            assets.append({"account": acct, "balance": str(bal)})
        elif kind == "liability":
            liabilities.append({"account": acct, "balance": str(bal)})
        elif kind == "equity":
            equity.append({"account": acct, "balance": str(bal)})

    total_assets = sum((Decimal(r["balance"]) for r in assets), Decimal(0))
    total_liab = sum((Decimal(r["balance"]) for r in liabilities), Decimal(0))
    total_equity = sum((Decimal(r["balance"]) for r in equity), Decimal(0))

    # Accounting identity (signed): Assets + Liabilities + Equity == 0.
    # Beancount stores debits as positive on Assets/Expenses and credits as
    # positive on Liabilities/Equity/Income (i.e. the entered sign). The
    # identity holds with stored signs.
    balances_sum = total_assets + total_liab + total_equity

    return {
        "reportType": "BALANCE_SHEET",
        "asOf": max(e.date for e in entries if hasattr(e, "date")).isoformat()
                if entries else None,
        "assets": assets,
        "liabilities": liabilities,
        "equity": equity,
        "totalAssets": str(total_assets),
        "totalLiabilities": str(total_liab),
        "totalEquity": str(total_equity),
        "balances": str(balances_sum),
    }


def income_statement(entries, options, period_end=None) -> dict[str, Any]:
    """Income statement: Income - Expenses over the period of the entries.

    If `period_end` is given (a `datetime.date`), only entries on or before
    that date are included. This lets the caller run the income statement
    BEFORE the closing entries (which would zero everything out).
    """
    if period_end is not None:
        entries = [e for e in entries
                   if not hasattr(e, "date") or e.date <= period_end]

    balances = aggregate_balances(entries, options)

    income_rows = []
    expense_rows = []
    for acct, bal in sorted(balances.items()):
        kind = classify(acct, options)
        if kind == "income":
            income_rows.append({"account": acct, "balance": str(bal)})
        elif kind == "expense":
            expense_rows.append({"account": acct, "balance": str(bal)})

    total_income = sum((Decimal(r["balance"]) for r in income_rows), Decimal(0))
    total_expense = sum((Decimal(r["balance"]) for r in expense_rows), Decimal(0))
    # Beancount stores credits as negative on Income/Equity; for reporting we
    # flip the sign so income shows as positive revenue and the net is
    # revenue - expense.
    total_income = -total_income
    net = total_income - total_expense

    return {
        "reportType": "INCOME_STATEMENT",
        "periodStart": min(e.date for e in entries if hasattr(e, "date")).isoformat()
                       if entries else None,
        "periodEnd": max(e.date for e in entries if hasattr(e, "date")).isoformat()
                     if entries else None,
        "income": income_rows,
        "expenses": expense_rows,
        "totalIncome": str(total_income),
        "totalExpenses": str(total_expense),
        "netIncome": str(net),
    }


def cash_flow(entries, options) -> dict[str, Any]:
    """Cash flow (simplified indirect method).

    Computes the delta in Assets:Bank:* balances over the loaded period.
    For the MVP we report:
      - cash_at_start, cash_at_end (from balances)
      - operating_inflows  (sum of all Income:* postings)
      - operating_outflows (sum of all Expenses:* postings)
      - net_change (cash_at_end - cash_at_start)
    """
    balances = aggregate_balances(entries, options)

    # Cash accounts: any Assets:* account that contains 'Bank' or 'Cash' in
    # the path. The MVP heuristic — the schema in NC-ACCT-IMP-1 §5 has a
    # dedicated BankAccount model for production; this is the sidecar's
    # local view.
    cash_accounts = [a for a in balances if a.startswith("Assets:Bank") or
                                                a.startswith("Assets:Cash")]
    cash_now = sum((balances[a] for a in cash_accounts), Decimal(0))

    # Operating flows: Income/Expense totals (with the same sign convention
    # as income_statement).
    income_total = sum(
        (bal for acct, bal in balances.items()
         if classify(acct, options) == "income"),
        Decimal(0),
    )
    expense_total = sum(
        (bal for acct, bal in balances.items()
         if classify(acct, options) == "expense"),
        Decimal(0),
    )

    operating_inflow = -income_total
    operating_outflow = expense_total

    return {
        "reportType": "CASH_FLOW",
        "asOf": max(e.date for e in entries if hasattr(e, "date")).isoformat()
                if entries else None,
        "cashAccounts": [{"account": a, "balance": str(balances[a])}
                          for a in cash_accounts],
        "cashAtEnd": str(cash_now),
        "operatingInflows": str(operating_inflow),
        "operatingOutflows": str(operating_outflow),
        "netOperatingCash": str(operating_inflow - operating_outflow),
        # For MVP, financing/investing are zero — production implementation
        # (NC-ACCT-IMP-1 §15) adds them once we have a proper BankAccount
        # register and LoanContract model.
        "financingCash": "0",
        "investingCash": "0",
        "netChange": str(cash_now),  # No prior period in MVP
    }


def generate_report(entries, options, report_type: str) -> dict[str, Any]:
    if report_type == "BALANCE_SHEET":
        return balance_sheet(entries, options)
    if report_type == "INCOME_STATEMENT":
        return income_statement(entries, options)
    if report_type == "CASH_FLOW":
        return cash_flow(entries, options)
    raise ValueError(f"unknown report type: {report_type}")