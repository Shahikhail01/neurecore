"""Accounting migration verification script.

Run from /home/najeeb/Linux-Dev/neurecore-2026/neurecore/backend/:

    python3 -m pytest -xvs ../infra/accounting-sidecar/tests/test_migration.py

Validates that:
  1. The Prisma schema parses (via `prisma validate`).
  2. The migration SQL is parseable PostgreSQL.
  3. Every new model has a corresponding CREATE TABLE in the migration.
  4. The SoD CHECK constraint is present.
  5. All enums have CREATE TYPE statements.
"""
from __future__ import annotations

import re
import subprocess
from pathlib import Path

import pglast
import pytest

# tests/ -> accounting-sidecar/ -> infra/ -> neurecore/
NEURECORE_ROOT = Path(__file__).resolve().parents[3]
BACKEND = NEURECORE_ROOT / "backend"
SCHEMA = BACKEND / "prisma" / "schema.prisma"
MIGRATION_DIR = BACKEND / "prisma" / "migrations" / "20260730_acct_capability_init"
MIGRATION_SQL = MIGRATION_DIR / "migration.sql"

EXPECTED_MODELS = {
    "ChartOfAccount",
    "AccountingPeriod",
    "UserAccountingRole",
    "JournalEntry",
    "AccountingRecord",
    "AccountingDataset",
    "AccountingReport",
    "AuditFinding",
    "OutboxMerkleRoot",
}

EXPECTED_ENUMS = {
    "AccountType",
    "AccountNormalBalance",
    "AccountingPeriodStatus",
    "AccountingDatasetKind",
    "AccountingRole",
    "AuditFindingSeverity",
    "AuditFindingStatus",
}


def test_prisma_schema_validates():
    """`prisma validate` exits 0 with the augmented schema."""
    result = subprocess.run(
        ["./node_modules/.bin/prisma", "validate"],
        cwd=str(BACKEND),
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == 0, f"stderr: {result.stderr}\nstdout: {result.stdout}"
    assert "is valid" in result.stdout


def test_prisma_client_generates():
    """`prisma generate` produces the client (proves the schema is usable)."""
    result = subprocess.run(
        ["./node_modules/.bin/prisma", "generate"],
        cwd=str(BACKEND),
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert result.returncode == 0, f"stderr: {result.stderr}"
    assert "Generated Prisma Client" in result.stdout


def test_migration_sql_exists():
    assert MIGRATION_SQL.exists(), f"missing: {MIGRATION_SQL}"


def test_migration_sql_parses():
    """pglast parses every statement without error."""
    sql = MIGRATION_SQL.read_text()
    statements = pglast.parse_sql(sql)
    assert len(statements) > 0
    # No statement should have a parse error (pglast raises on bad syntax)


def test_every_model_has_create_table():
    """For each expected model, the migration has a CREATE TABLE for the
    mapped PostgreSQL name (snake_case + plural)."""
    sql = MIGRATION_SQL.read_text()
    expected_tables = {
        "ChartOfAccount": "chart_of_accounts",
        "AccountingPeriod": "accounting_periods",
        "UserAccountingRole": "user_accounting_roles",
        "JournalEntry": "journal_entries",
        "AccountingRecord": "accounting_records",
        "AccountingDataset": "accounting_datasets",
        "AccountingReport": "accounting_reports",
        "AuditFinding": "audit_findings",
        "OutboxMerkleRoot": "outbox_merkle_roots",
    }
    for model, table in expected_tables.items():
        pattern = rf'CREATE TABLE "{table}"'
        assert re.search(pattern, sql), \
            f"missing CREATE TABLE for {model} -> {table}"


def test_every_enum_has_create_type():
    sql = MIGRATION_SQL.read_text()
    for enum in EXPECTED_ENUMS:
        pattern = rf'CREATE TYPE "{enum}"'
        assert re.search(pattern, sql), f"missing CREATE TYPE for {enum}"


def test_sod_check_constraint_present():
    """SoD: approvedById <> postingUserId when approvedById is set."""
    sql = MIGRATION_SQL.read_text()
    assert "journal_entries_sod_check" in sql
    assert '"approvedById" <> "postingUserId"' in sql or \
           '"postingUserId" <> "approvedById"' in sql


def test_posting_type_check_constraint_present():
    """AccountingRecord.postingType must be DEBIT or CREDIT."""
    sql = MIGRATION_SQL.read_text()
    assert "accounting_records_posting_type_check" in sql
    assert "'DEBIT'" in sql and "'CREDIT'" in sql


def test_schema_and_migration_in_sync():
    """No model in schema is missing from the migration."""
    schema_text = SCHEMA.read_text()
    migration_text = MIGRATION_SQL.read_text()
    for model in EXPECTED_MODELS:
        assert f"model {model}" in schema_text, \
            f"model {model} not in schema.prisma"
    # Reverse check: every table in migration has a model in schema
    tables_in_migration = re.findall(r'CREATE TABLE "(\w+)"', migration_text)
    # Map each table name to its expected model name (we know these directly)
    table_to_model = {
        "chart_of_accounts": "ChartOfAccount",
        "accounting_periods": "AccountingPeriod",
        "user_accounting_roles": "UserAccountingRole",
        "journal_entries": "JournalEntry",
        "accounting_records": "AccountingRecord",
        "accounting_datasets": "AccountingDataset",
        "accounting_reports": "AccountingReport",
        "audit_findings": "AuditFinding",
        "outbox_merkle_roots": "OutboxMerkleRoot",
    }
    for table in tables_in_migration:
        expected_model = table_to_model.get(table)
        assert expected_model is not None, \
            f"unexpected table {table} in migration"
        assert f"model {expected_model}" in schema_text, \
            f"table {table} → model {expected_model} not in schema.prisma"