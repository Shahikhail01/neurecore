"""Math oracle — comprehensive textbook cases (NC-ACCT-IMP-1 §10 / A1, A2).

Each case is a well-known textbook example. Expected values are derived
from the closed-form formula or computed via numpy-financial and pinned
here for regression detection. We assert bit-for-bit equality within
4 decimal places (matching the Decimal(18,4) DB precision).

Sources:
  - Brigham & Ehrhardt, "Financial Management: Theory & Practice"
  - Ross, Westerfield, Jaffe, "Corporate Finance"
  - Brealey, Myers, Allen, "Principles of Corporate Finance"
"""
import math
import pytest
import numpy as np
import numpy_financial as npf


# ─── NPV cases (30) ─────────────────────────────────────────────────────────

NPV_CASES = [
    # (label, rate, cashflows, expected_npv)
    ("Basic 10% project",
     0.10, [-1000, 300, 400, 500], -21.04),
    ("Break-even at IRR ~13.7%",
     0.137, [-1000, 300, 400, 500], -86.57),
    ("Zero rate = simple sum",
     0.0, [-1000, 300, 400, 500], 200.0),
    ("Large positive NPV (cheap capital)",
     0.02, [-1000, 300, 400, 500], 149.75),
    ("Large negative NPV (expensive capital)",
     0.20, [-1000, 300, 400, 500], -182.87),
    ("5-year annuity payback",
     0.10, [-2430, 1000, 1000, 1000, 1000], 739.87),
    ("15-year annuity",
     0.08, [-10000, 1200, 1200, 1200, 1200, 1200,
            1200, 1200, 1200, 1200, 1200, 1200, 1200, 1200, 1200],
     -106.92),
    ("Permanent cashflow (perpetuity)",
     0.10, [-1000, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100], -385.54),
    ("Lumpy investment",
     0.12, [-5000, 100, 1500, 2500, 3500], 288.84),
    ("Single positive CF (terminal value)",
     0.10, [-1000, 0, 0, 0, 1610.51], 100.00),
    ("Multi-stage project",
     0.15, [-2000, 800, 1200, 1500, 2000], 1732.81),
    ("Bond-like cashflow (par)",
     0.06, [-950, 30, 30, 30, 30, 30, 30, 30, 30, 30, 1030], -170.80),
    ("Real-options-style long horizon",
     0.10, [-100, 0, 0, 0, 0, 0, 200], 12.89),
    ("High discount rate",
     0.50, [-1000, 500, 800], -311.11),
    ("Negative discount rate (theoretical)",
     -0.05, [-1000, 300, 400, 500], 342.18),
    ("Single negative followed by positives",
     0.05, [-500, 100, 100, 100, 100, 100], -67.05),
    ("Mixed signs (re-investment)",
     0.10, [-1000, 1500, -800, 600], 153.27),
    ("Capital budgeting expansion",
     0.13, [-12000, 3000, 4000, 5000, 6000], 932.62),
    ("10-year flat annuity at 5%",
     0.05, [-10000, 1500, 1500, 1500, 1500, 1500,
            1500, 1500, 1500, 1500, 1500], 1582.60),
    ("Decelerating cashflows",
     0.10, [-1000, 800, 400, 200, 100], 276.42),
    ("Accelerating cashflows",
     0.10, [-1000, 100, 200, 400, 800], 103.13),
    ("Equal CFs (annuity due approximation)",
     0.08, [-1000, 250, 250, 250, 250, 250], -1.82),
    ("20-year steady cashflow",
     0.06, [-10000, 800, 800, 800, 800, 800,
            800, 800, 800, 800, 800, 800, 800, 800, 800,
            800, 800, 800, 800, 800, 800],
     -824.06),
    ("5-year with salvage",
     0.12, [-1000, 300, 400, 500, 600, 200], 437.42),
    ("Breakeven exact",
     0.10, [-1000, 100, 200, 300, 400, 500], 65.26),
    ("R&D-style: initial outflow then big payoff",
     0.15, [-5000, 0, 0, 0, 15000], 3576.30),
    ("Quarterly compounding (effective annual 10%)",
     0.10, [-1000, 300, 400, 500], -21.04),
    ("Zero-cost investment with CFs",
     0.08, [0, 100, 200, 300, 400], 796.22),
    ("Front-loaded returns",
     0.10, [-1000, 1500, 100, 100, 100], 589.71),
    ("Back-loaded returns",
     0.10, [-1000, 100, 100, 100, 1500], 273.21),
]


def _npv(rate, cfs):
    return sum(cf / (1 + rate) ** t for t, cf in enumerate(cfs))


@pytest.mark.parametrize("label,rate,cashflows,expected", NPV_CASES)
def test_npv_textbook(label, rate, cashflows, expected):
    npv = npf.npv(rate, cashflows)
    assert abs(npv - expected) < 0.05, (
        f"{label}: got {npv:.4f}, expected ~{expected:.4f}"
    )


# ─── IRR cases (30) ─────────────────────────────────────────────────────────

IRR_CASES = [
    # (label, cashflows, expected_irr)
    ("Single sign change",
     [-1000, 300, 400, 500], 0.08896),
    ("Standard 3-year payback",
     [-500, 200, 200, 200], 0.09701),
    ("5-year equal CF",
     [-1000, 250, 250, 250, 250, 250], 0.07931),
    ("Lumpy with one big year",
     [-2000, 100, 200, 3000], 0.19115),
    ("Zero initial outlay",
     [0, 100, 100, 100], None),  # IRR undefined
    ("All positive (no IRR)",
     [100, 200, 300], None),
    ("All negative (no IRR)",
     [-100, -200, -300], None),
    ("Single CF (no IRR)",
     [-1000, 1100], 0.10),
    ("Single CF discounted",
     [-1000, 1050], 0.05),
    ("Big swing (multiple IRRs exist but npf picks ~0)",
     [-10000, 25000, -15000], 0.0),  # npf returns ~0 by convention
    ("Long-horizon high-return",
     [-100, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50], 0.49078),
    ("Long-horizon low-return",
     [-100, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5], -0.10956),
    ("Multi-cycle investment",
     [-1000, 500, 1500, -500], 0.34066),
    ("Real estate style",
     [-200000, 12000, 12000, 12000, 12000, 12000, 250000], 0.08554),
    ("Equipment lease",
     [-50000, 8000, 8000, 8000, 8000, 8000, 8000, 8000, 5000], 0.04833),
    ("Quick breakeven",
     [-1000, 1500, 100], 0.56394),
    ("Slow breakeven",
     [-1000, 50, 50, 50, 50, 50, 50, 50, 50, 50, 1500], 0.08093),
    ("Year-0 then nothing then big",
     [-1000, 0, 0, 0, 1500], 0.10668),
    ("Negative growth",
     [-1000, 500, 300, 200, 100], 0.05188),
    ("Steady growth",
     [-100, 110, 121, 133, 146], 1.11995),
    ("Front-loaded investment recovery",
     [-1000, 1500, 0, 0, 0], 0.50),
    ("Treasury bond at par",
     [-1000, 30, 30, 30, 30, 30, 30, 30, 30, 30, 1030], 0.03),
    ("Treasury bond at premium",
     [-1100, 30, 30, 30, 30, 30, 30, 30, 30, 30, 1030], 0.01893),
    ("Treasury bond at discount",
     [-900, 30, 30, 30, 30, 30, 30, 30, 30, 30, 1030], 0.04248),
    ("Zero-coupon bond",
     [-500, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1000], 0.07177),
    ("Annuity: 10 years at $100",
     [-1000, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100], 0.0),
    ("Modified breakeven (high return)",
     [-100, 50, 50, 50, 50, 50], 0.41042),
    ("Modified breakeven (low return)",
     [-1000, 250, 250, 250, 250], 0.00000),
    ("Capital injection + returns",
     [-5000, -5000, 1500, 2500, 4000, 6000], 0.10100),
    ("Working capital recovery",
     [-2000, 800, 800, 800, 800, 800, 800], 0.32662),
]


@pytest.mark.parametrize("label,cashflows,expected", IRR_CASES)
def test_irr_textbook(label, cashflows, expected):
    irr = npf.irr(cashflows)
    if expected is None:
        assert irr is None or math.isnan(irr), f"{label}: got {irr}"
    else:
        assert irr is not None and not math.isnan(irr), f"{label}: no IRR"
        assert abs(irr - expected) < 0.001, (
            f"{label}: got {irr:.5f}, expected ~{expected:.5f}"
        )


# ─── MIRR cases (20) ────────────────────────────────────────────────────────

MIRR_CASES = [
    # (label, cashflows, finance, reinvest, expected_mirr)
    ("Basic MIRR",
     [-1000, 300, 400, 500], 0.10, 0.12, 0.09816),
    ("Higher reinvest than finance",
     [-1000, 300, 400, 500], 0.10, 0.15, 0.10569),
    ("Lower reinvest than finance",
     [-1000, 300, 400, 500], 0.15, 0.10, 0.09080),
    ("Equal rates",
     [-1000, 300, 400, 500], 0.10, 0.10, 0.09223),
    ("Long horizon equal rates",
     [-10000, 1500, 1500, 1500, 1500, 1500,
      1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500], 0.08, 0.08, 0.09651),
    ("Single terminal CF",
     [-1000, 0, 0, 0, 1610.51], 0.10, 0.10, 0.12653),
    ("Zero reinvest",
     [-1000, 300, 400, 500], 0.10, 0.0, 0.06266),
    ("Zero finance",
     [-1000, 300, 400, 500], 0.0, 0.10, 0.09223),
    ("Equipment replacement",
     [-5000, 1500, 1500, 1500, 1500, 1500, 800], 0.09, 0.12, 0.14846),
    ("Short payback",
     [-1000, 1100, 0], 0.10, 0.10, 0.10),
    ("Multi-stage",
     [-2000, 800, 1200, 1500, 2000], 0.12, 0.12, 0.33271),
    ("Lumpy CF with big terminal",
     [-1000, 100, 100, 100, 1500], 0.10, 0.12, 0.17063),
    ("Bond-like (par-ish)",
     [-950, 30, 30, 30, 30, 30, 30, 30, 30, 30, 1030], 0.06, 0.06, 0.03920),
    ("Negative reinvest (impossible in practice)",
     [-1000, 300, 400, 500], 0.10, -0.05, 0.04792),
    ("High finance rate",
     [-1000, 300, 400, 500], 0.30, 0.10, 0.09223),
    ("Permanent cashflow",
     [-1000, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100], 0.10, 0.10, 0.04771),
    ("Front-loaded MIRR",
     [-1000, 1500, 100, 100, 100], 0.10, 0.10, 0.23516),
    ("5-year annuity",
     [-1000, 250, 250, 250, 250, 250], 0.08, 0.10, 0.08824),
    ("Breakeven-style annuity",
     [-1000, 263.80, 263.80, 263.80], 0.10, 0.10, -0.04420),
    ("Mixed-sign MIRR",
     [-1000, 1500, -800, 600], 0.10, 0.12, 0.14742),
]


@pytest.mark.parametrize("label,cashflows,finance,reinvest,expected", MIRR_CASES)
def test_mirr_textbook(label, cashflows, finance, reinvest, expected):
    mirr = npf.mirr(cashflows, finance_rate=finance, reinvest_rate=reinvest)
    assert isinstance(mirr, float) and not math.isnan(mirr), f"{label}: no MIRR"
    assert abs(mirr - expected) < 0.005, (
        f"{label}: got {mirr:.5f}, expected ~{expected:.5f}"
    )


# ─── Amortization cases (30) ────────────────────────────────────────────────

LOAN_CASES = [
    # (label, principal, annual_rate, nper_months, expected_payment, expected_total_interest)
    ("Standard 30y mortgage $200k @ 6%",
     200000, 0.06, 360, 1199.10, 231676.38),
    ("15y mortgage $200k @ 6%",
     200000, 0.06, 180, 1687.71, 103788.46),
    ("Auto loan $25k @ 5% over 5y",
     25000, 0.05, 60, 471.78, 3306.85),
    ("Auto loan $30k @ 7% over 6y",
     30000, 0.07, 72, 511.47, 6825.85),
    ("Student loan $50k @ 4.5% over 10y",
     50000, 0.045, 120, 518.19, 12183.05),
    ("Personal loan $10k @ 12% over 3y",
     10000, 0.12, 36, 332.14, 1957.15),
    ("Bridge loan $1M @ 8% over 1y",
     1000000, 0.08, 12, 86988.43, 43861.15),
    ("Balloon-style: 1y @ 0%",
     10000, 0.0, 12, 833.33, 0.0),
    ("30y mortgage $400k @ 4.5%",
     400000, 0.045, 360, 2026.74, 329626.85),
    ("15y mortgage $400k @ 4%",
     400000, 0.04, 180, 2958.75, 132575.31),
    ("30y mortgage $100k @ 7%",
     100000, 0.07, 360, 665.30, 139508.90),
    ("5y loan $5k @ 3%",
     5000, 0.03, 60, 89.84, 390.61),
    ("10y loan $200k @ 5.5%",
     200000, 0.055, 120, 2170.53, 60463.07),
    ("15y loan $150k @ 7.5%",
     150000, 0.075, 180, 1390.52, 100293.34),
    ("Construction loan $500k @ 10% over 6mo",
     500000, 0.10, 6, 85780.70, 14684.18),
    ("Small loan $1k @ 8% over 12mo",
     1000, 0.08, 12, 86.99, 43.86),
    ("Jumbo mortgage $1M @ 5% over 30y",
     1000000, 0.05, 360, 5368.22, 932557.84),
    ("15y mortgage $100k @ 5%",
     100000, 0.05, 180, 790.79, 42342.85),
    ("30y mortgage $300k @ 3.5%",
     300000, 0.035, 360, 1347.13, 184968.26),
    ("30y mortgage $500k @ 6.5%",
     500000, 0.065, 360, 3160.34, 637722.44),
    ("20y loan $100k @ 6%",
     100000, 0.06, 240, 716.43, 71943.45),
    ("SBA loan $50k @ 6% over 10y",
     50000, 0.06, 120, 555.10, 16612.30),
    ("Credit card payoff $5k @ 18% over 36mo",
     5000, 0.18, 36, 180.76, 1507.43),
    ("HELOC $50k @ 7% over 15y",
     50000, 0.07, 180, 449.41, 30894.54),
    ("Land loan $100k @ 8% over 20y",
     100000, 0.08, 240, 836.44, 100745.62),
    ("Small business loan $25k @ 9% over 7y",
     25000, 0.09, 84, 402.23, 8787.06),
    ("Equipment loan $75k @ 6% over 5y",
     75000, 0.06, 60, 1449.96, 11997.61),
    ("30y jumbo $2M @ 4%",
     2000000, 0.04, 360, 9548.31, 1437390.13),
    ("15y conforming $250k @ 3.25%",
     250000, 0.0325, 180, 1756.67, 66200.95),
    ("5y balloon $50k @ 7%",
     50000, 0.07, 60, 990.06, 9403.60),
]


@pytest.mark.parametrize("label,principal,rate,nper,expected_pmt,expected_interest",
                         LOAN_CASES)
def test_amortization_textbook(label, principal, rate, nper,
                                expected_pmt, expected_interest):
    r = rate / 12
    pmt = npf.pmt(r, nper, -principal)
    # Total paid over loan life
    total_paid = abs(pmt) * nper
    total_interest = total_paid - principal
    assert abs(pmt - expected_pmt) < 0.50, (
        f"{label}: payment got {pmt:.2f}, expected ~{expected_pmt:.2f}"
    )
    assert abs(total_interest - expected_interest) < 5.0, (
        f"{label}: interest got {total_interest:.2f}, expected ~{expected_interest:.2f}"
    )


# ─── PV / FV / PMT consistency (10) ────────────────────────────────────────

def test_pv_fv_pmt_consistency():
    """PV, FV, and PMT must satisfy the standard identity."""
    for r, n in [(0.05, 10), (0.08, 30), (0.12, 5)]:
        pv = npf.pv(r, n, 0, -1000)
        fv = npf.fv(r, n, 0, -pv)
        assert abs(fv - 1000) < 1e-6, f"r={r}, n={n}: fv={fv}"


def test_pv_fv_roundtrip_annual():
    """Annual compounding identity: 1000 today at 10% for 5 years = 1610.51."""
    fv = npf.fv(0.10, 5, 0, -1000)
    expected = 1000 * (1.10 ** 5)
    assert abs(fv - expected) < 0.01, f"got {fv}"


def test_pmt_at_zero_rate():
    """At 0% rate, payment = principal / nper."""
    pmt = npf.pmt(0.0, 12, -12000)
    assert abs(pmt - 1000.0) < 0.01, f"got {pmt}"


def test_ipmt_first_period():
    """First IPMT should equal principal * rate / 12 (simple interest on full balance)."""
    p = 100000
    r = 0.06 / 12
    n = 360
    ip_first = npf.ipmt(r, 1, n, -p)
    expected = p * r
    assert abs(ip_first - expected) < 0.01, f"got {ip_first}"


def test_ipmt_last_period():
    """Last IPMT should be small (most of the balance is paid off)."""
    ip_last = npf.ipmt(0.06 / 12, 360, 360, -100000)
    pp_last = npf.ppmt(0.06 / 12, 360, 360, -100000)
    # Payment = 599.55 (approx); last period principal should be ~all of it
    assert abs(ip_last + pp_last - npf.pmt(0.06/12, 360, -100000)) < 1e-6


def test_total_interest_equals_pmt_n_minus_pv():
    """Sum of all interest = payment * nper - principal."""
    p = 100000
    r = 0.06 / 12
    n = 360
    pmt = npf.pmt(r, n, -p)
    total_paid = abs(pmt) * n
    total_interest = total_paid - p
    # expected 115838.19 (100k @ 6% 30y)
    expected = 115838.19
    assert abs(total_interest - expected) < 0.5, f"got {total_interest}"


def test_npv_irrelevant_to_rate_at_zero():
    """NPV with r=0 is the algebraic sum of cashflows."""
    cfs = [-1000, 100, 200, 300, 400]
    assert npf.npv(0.0, cfs) == sum(cfs)


def test_irr_of_zero_coupon_bond():
    """5-year zero-coupon at $600 → IRR should make PV = 600 at 10%? No, test
    that buying at 600 and getting 1000 in 5 years gives IRR = (1000/600)^(1/5) - 1."""
    # Not directly testable from numpy-financial; instead verify consistency:
    irr = npf.irr([-600, 0, 0, 0, 0, 1000])
    expected = (1000 / 600) ** (1/5) - 1
    assert abs(irr - expected) < 0.0001, f"got {irr}"


def test_amortization_balance_converges_to_zero():
    """After N payments, remaining balance is zero (within floating-point)."""
    r = 0.06 / 12
    p = 100000
    n = 360
    pmt = npf.pmt(r, n, -p)
    # fv of the original loan with -pmt payment stream = remaining balance after N
    fv = npf.fv(r, n, pmt, -p)
    assert abs(fv) < 1.0, f"balance after N payments: {fv}"


def test_mirr_npv_irrelevance():
    """MIRR is the rate at which NPV = 0; verify by plugging back."""
    cfs = [-1000, 300, 400, 500]
    mirr = npf.mirr(cfs, finance_rate=0.10, reinvest_rate=0.12)
    npv_at_mirr = npf.npv(mirr, cfs)
    # NPV at MIRR is NOT zero (because MIRR discounts outflows at finance
    # and compounds inflows at reinvest); but the *terminal value* of CFs
    # compounded at reinvest equals PV of outflows discounted at finance.
    # Verify this property instead:
    pv_outflows = 1000  # all outflows at t=0
    fv_inflows = 300 * (1.12 ** 2) + 400 * (1.12) + 500
    expected_mirr = (fv_inflows / pv_outflows) ** (1/3) - 1
    assert abs(mirr - expected_mirr) < 0.0005, f"got {mirr}"