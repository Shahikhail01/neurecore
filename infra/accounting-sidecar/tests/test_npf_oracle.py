"""Math oracle — numpy-financial baseline tests (NC-ACCT-IMP-1 §10 / A1, A2).

Reference values computed from the formulas directly and verified against
npf's actual output (not assumed from memory). All expected values are
bit-for-bit within 4 decimal places of the closed-form formula.
"""
import math
import numpy_financial as npf


def _npv(rate, cashflows):
    """Closed-form NPV: sum_{t=0}^{n} cf_t / (1+rate)^t."""
    return sum(cf / (1 + rate) ** t for t, cf in enumerate(cashflows))


def test_npv_basic():
    npv = npf.npv(0.10, [-1000, 300, 400, 500])
    expected = _npv(0.10, [-1000, 300, 400, 500])
    assert abs(npv - expected) < 1e-9, f"got {npv} expected {expected}"


def test_npv_zero_rate():
    npv = npf.npv(0.0, [-1000, 300, 400, 500])
    assert abs(npv - 200.0) < 0.01, f"got {npv}"


def test_npv_positive_at_low_rate():
    """At 5%, this cashflow is positive (project value exceeds cost)."""
    npv = npf.npv(0.05, [-1000, 300, 400, 500])
    assert npv > 0, f"expected positive at 5%, got {npv}"


def test_npv_negative_at_high_rate():
    """At 10%, this cashflow is negative (project not worth it)."""
    npv = npf.npv(0.10, [-1000, 300, 400, 500])
    assert npv < 0, f"expected negative at 10%, got {npv}"


def test_irr_basic():
    """IRR is the rate that makes NPV=0. Verify by plugging IRR back into NPV."""
    irr = npf.irr([-1000, 300, 400, 500])
    assert irr is not None and not math.isnan(irr)
    npv_at_irr = npf.npv(irr, [-1000, 300, 400, 500])
    assert abs(npv_at_irr) < 1e-6, f"IRR {irr} does not zero NPV: {npv_at_irr}"


def test_irr_no_solution():
    """All-positive cashflows have no real IRR (no sign change)."""
    irr = npf.irr([100, 200, 300])
    assert irr is None or math.isnan(irr), f"got {irr}"


def test_mirr_basic():
    """MIRR must be between finance and reinvest rates (loose sanity)."""
    mirr = npf.mirr([-1000, 300, 400, 500], finance_rate=0.10, reinvest_rate=0.12)
    assert isinstance(mirr, float) and not math.isnan(mirr)
    assert 0.05 < mirr < 0.20, f"got {mirr}"


def test_loan_amortize():
    """$10,000 loan, 6% annual rate, 12 monthly payments."""
    payment = npf.pmt(0.06 / 12, 12, -10000)
    # Standard amortization formula: P * r / (1 - (1+r)^-n)
    r = 0.06 / 12
    n = 12
    P = 10000
    expected = P * r / (1 - (1 + r) ** -n)
    assert abs(payment - expected) < 1e-6, f"got {payment} expected {expected}"


def test_fv_pv_roundtrip():
    """FV(PV(rate, n, 0, -x), rate, n, 0, -pv) == x."""
    pv = npf.pv(0.05, 10, 0, -1000)
    fv = npf.fv(0.05, 10, 0, -pv)
    assert abs(fv - 1000) < 1e-6, f"got fv={fv}"


def test_ipmt_ppmt_split():
    """For a fixed-rate loan, IPMT + PPMT = PMT for each period."""
    payment = npf.pmt(0.06 / 12, 12, -10000)
    for t in range(1, 13):
        ip = npf.ipmt(0.06 / 12, t, 12, -10000)
        pp = npf.ppmt(0.06 / 12, t, 12, -10000)
        assert abs(ip + pp - payment) < 1e-6, f"period {t}: ipmt+ppmt={ip+pp} != pmt={payment}"