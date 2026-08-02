"""Beancount loader + ops baseline (NC-ACCT-IMP-1 §2).

Beancount 3.x removed the `beancount.report` package. Reports are
generated from loaded entries using `beancount.core.inventory` and
aggregation. This module validates that the parser + double-entry
invariants work, which is the foundation for our BS/IS/CF generators.
"""
from beancount import loader
from beancount.core import data
from beancount.core.inventory import Inventory


BEAN = """\
2026-01-01 open Assets:Bank:Checking USD
2026-01-01 open Equity:OpeningBalances USD
2026-01-01 open Expenses:Office:Supplies USD
2026-01-01 open Income:Consulting USD

2026-01-01 * "Opening balances"
  Assets:Bank:Checking      10000.00 USD
  Equity:OpeningBalances   -10000.00 USD

2026-01-15 * "Office supplies"
  Expenses:Office:Supplies    500.00 USD
  Assets:Bank:Checking        -500.00 USD

2026-01-20 * "Client invoice paid"
  Assets:Bank:Checking       3000.00 USD
  Income:Consulting         -3000.00 USD
"""


def test_loader_parses():
    entries, errors, _ = loader.load_string(BEAN)
    assert len(errors) == 0, errors
    # 4 opens + 3 transactions = 7 entries
    assert len(entries) == 7, f"got {len(entries)} entries"
    txns = [e for e in entries if isinstance(e, data.Transaction)]
    assert len(txns) == 3


def test_double_entry_balances():
    entries, errors, _ = loader.load_string(BEAN)
    assert not errors
    for entry in entries:
        if isinstance(entry, data.Transaction):
            total = sum(p.units.number for p in entry.postings)
            assert abs(total) < 1e-9, f"{entry.date}: sum={total}"


def test_balance_aggregation():
    """Walk postings ourselves; sum by account. This is what our BS/IS/CF
    generators will use as the foundation (since beancount.report is gone)."""
    from decimal import Decimal
    entries, errors, _ = loader.load_string(BEAN)
    assert not errors
    balances: dict = {}
    for entry in entries:
        if isinstance(entry, data.Transaction):
            for posting in entry.postings:
                acct = posting.account
                # posting.units.number is a Decimal in Beancount 3.x
                balances.setdefault(acct, Decimal(0))
                balances[acct] += posting.units.number
    # Bank:Checking: 10000 - 500 + 3000 = 12500
    assert balances['Assets:Bank:Checking'] == Decimal('12500.00')
    assert balances['Expenses:Office:Supplies'] == Decimal('500.00')
    assert balances['Income:Consulting'] == Decimal('-3000.00')
    assert balances['Equity:OpeningBalances'] == Decimal('-10000.00')


def test_account_type_prefixes():
    """Beancount 3.x exposes the 5 root-account prefixes as options."""
    entries, errors, opts = loader.load_string(BEAN)
    assert not errors
    assert opts['name_assets'] == 'Assets'
    assert opts['name_liabilities'] == 'Liabilities'
    assert opts['name_equity'] == 'Equity'
    assert opts['name_income'] == 'Income'
    assert opts['name_expenses'] == 'Expenses'