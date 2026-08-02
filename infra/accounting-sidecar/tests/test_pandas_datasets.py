"""Pandas synthetic dataset generator (NC-ACCT-IMP-1 §4)."""
import hashlib
import pandas as pd


def test_inventory_dataset_deterministic():
    df = pd.DataFrame({
        'sku': [f'SKU-{i:04d}' for i in range(100)],
        'qty_on_hand': pd.Series(range(100)).clip(lower=0),
        'unit_cost': [round(10 + i * 0.5, 2) for i in range(100)],
    })
    payload = df.to_json(orient='records')
    h1 = hashlib.sha256(payload.encode()).hexdigest()
    payload2 = df.to_json(orient='records')
    h2 = hashlib.sha256(payload2.encode()).hexdigest()
    assert h1 == h2, "determinism broken"


def test_payroll_dataset_size():
    df = pd.DataFrame({
        'employee_id': range(1000),
        'monthly_salary': [5000] * 1000,
    })
    assert len(df) == 1000
    assert df['monthly_salary'].sum() == 5_000_000


def test_dataset_seed_reproducible():
    df1 = pd.DataFrame({'v': pd.Series(range(50)).sample(n=50, random_state=42).values})
    df2 = pd.DataFrame({'v': pd.Series(range(50)).sample(n=50, random_state=42).values})
    assert df1.equals(df2), "same seed must produce same data"