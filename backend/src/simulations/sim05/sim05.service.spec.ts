/**
 * Unit tests for Sim05Service (NC-SIM05-IMP-2).
 *
 * Verifies the scenario catalog (20 scenarios) + the
 * runComputeStep inference logic.
 */

import { Test } from '@nestjs/testing';
import { Sim05Service } from './sim05.service';
import {
  SIM05_SCENARIOS, COMPUTE_SCENARIOS, JUDGMENT_SCENARIOS,
} from './sim05-scenarios';
import { AccountingService } from '../../modules/accounting/services/accounting.service';

const mockAccounting = () => ({
  computeNpv: jest.fn(async (_t, _u, rate, cfs) => ({ npv: -21.04, computationId: 'npv-1', converged: true, rate, cfs })),
  computeIrr: jest.fn(async (_t, _u, cfs) => ({ irr: 0.089, computationId: 'irr-1', converged: true, cfs })),
  computeMirr: jest.fn(async (_t, _u, fr, rr, cfs) => ({ mirr: 0.098, computationId: 'mirr-1', converged: true, financeRate: fr, reinvestRate: rr, cfs })),
  amortizeLoan: jest.fn(async (_t, _u, p, r, n) => ({ schedule: [{ period: 1, payment: 100 }] })),
});

describe('Sim05Service', () => {
  let service: Sim05Service;

  beforeEach(async () => {
    const acc = mockAccounting();
    const module = await Test.createTestingModule({
      providers: [
        Sim05Service,
        { provide: AccountingService, useValue: acc },
      ],
    }).compile();
    service = module.get(Sim05Service);
  });

  describe('Scenario catalog (NC-SIM05-IMP-2)', () => {
    it('exposes exactly 20 scenarios', () => {
      expect(service.list()).toHaveLength(20);
      expect(SIM05_SCENARIOS).toHaveLength(20);
    });

    it('divides into 6 COMPUTE and 14 JUDGMENT scenarios', () => {
      expect(COMPUTE_SCENARIOS).toHaveLength(6);
      expect(JUDGMENT_SCENARIOS).toHaveLength(14);
    });

    it('COMPUTE scenarios include scenarios 9, 11, 12, 13, 17, and 5', () => {
      const ids = COMPUTE_SCENARIOS.map((s) => s.id).sort((a, b) => a - b);
      expect(ids).toEqual([5, 9, 11, 12, 13, 17]);
    });

    it('each scenario has all required fields', () => {
      for (const s of SIM05_SCENARIOS) {
        expect(s.id).toBeGreaterThan(0);
        expect(s.title.length).toBeGreaterThan(0);
        expect(s.company.length).toBeGreaterThan(0);
        expect(['COMPUTE', 'JUDGMENT']).toContain(s.category);
        expect(Array.isArray(s.tools)).toBe(true);
        expect(s.requiredOutputs.length).toBeGreaterThan(0);
        expect(s.difficulty).toBeTruthy();
      }
    });

    it('COMPUTE scenarios reference nc.accounting.* tools', () => {
      for (const s of COMPUTE_SCENARIOS) {
        // Either no tools (uses sidecar-side HTTP) or compute tools.
        for (const t of s.tools) {
          expect(t).toMatch(/^nc\.accounting\./);
        }
      }
    });

    it('listByCategory filters correctly', () => {
      expect(service.listByCategory('COMPUTE')).toHaveLength(6);
      expect(service.listByCategory('JUDGMENT')).toHaveLength(14);
    });
  });

  describe('get(id)', () => {
    it('returns scenario by id', () => {
      expect(service.get(9).title).toContain('Capital Investment');
      expect(service.get(13).category).toBe('COMPUTE');
    });

    it('throws NotFoundException for unknown id', () => {
      expect(() => service.get(999)).toThrow(/scenario 999 not found/);
    });
  });

  describe('runComputeStep inference', () => {
    it('inferred COMPUTE_NPV when discount_rate + cashflows', async () => {
      const acc = (service as any).accounting as ReturnType<typeof mockAccounting>;
      await service.runComputeStep('t1', 'u1', 9, {
        // scenario 9 requires initial_investment + discount_rate (both provided).
        initial_investment: 1000,
        discount_rate: 0.10,
        cashflows: [-1000, 300, 400, 500],
      });
      expect(acc.computeNpv).toHaveBeenCalledWith('t1', 'u1', 0.10, [-1000, 300, 400, 500]);
      expect(acc.computeMirr).not.toHaveBeenCalled();
      expect(acc.computeIrr).not.toHaveBeenCalled();
    });

    it('COMPUTE_NPV inferred for scenario 13 (IPO DCF) when all required fields present', async () => {
      const acc = (service as any).accounting as ReturnType<typeof mockAccounting>;
      // Scenario 13 (IPO) requires cashflows + discount_rate + shares_outstanding.
      await service.runComputeStep('t1', 'u1', 13, {
        cashflows: [-100, 200, 300, 400, 500],   // actual array
        discount_rate: 0.10,
        shares_outstanding: 1000,
      });
      // discount_rate present → NPV inference.
      expect(acc.computeNpv).toHaveBeenCalledWith('t1', 'u1', 0.10, [-100, 200, 300, 400, 500]);
    });

    it('inferred COMPUTE_MIRR when reinvest_rate present', async () => {
      const acc = (service as any).accounting as ReturnType<typeof mockAccounting>;
      await service.runComputeStep('t1', 'u1', 9, {
        initial_investment: 1000,
        discount_rate: 0.10,
        reinvest_rate: 0.12,
        cashflows: [-1000, 300, 400, 500],
      });
      expect(acc.computeMirr).toHaveBeenCalledWith('t1', 'u1', 0.10, 0.12, [-1000, 300, 400, 500]);
    });

    it('inferred AMORTIZE_LOAN when principal + rate + nper', async () => {
      const acc = (service as any).accounting as ReturnType<typeof mockAccounting>;
      // Scenario 17 (Lease Accounting, COMPUTE) requires leases JSON.
      await service.runComputeStep('t1', 'u1', 17, {
        leases: '[]',
        // These trigger AMORTIZE_LOAN inference.
        principal: 100_000,
        rate: 0.06,
        nper: 12,
      });
      expect(acc.amortizeLoan).toHaveBeenCalledWith('t1', 'u1', 100_000, 0.06, 12);
    });

    it('rejects JUDGMENT scenarios', async () => {
      await expect(
        service.runComputeStep('t1', 'u1', 1, { cashflows: [100] }),
      ).rejects.toThrow(/is JUDGMENT, not COMPUTE/);
    });

    it('rejects missing required fields', async () => {
      // Scenario 9 requires initial_investment + discount_rate; provide
      // neither — the validation phase rejects before inference.
      await expect(
        service.runComputeStep('t1', 'u1', 9, { cashflows: [-1000, 300] }),
      ).rejects.toThrow(/Missing required fields: .*initial_investment/);
    });

    it('parses CSV string for cashflows', async () => {
      const acc = (service as any).accounting as ReturnType<typeof mockAccounting>;
      await service.runComputeStep('t1', 'u1', 9, {
        initial_investment: 1000,
        discount_rate: 0.10,
        cashflows: '-1000, 300, 400, 500',
      });
      expect(acc.computeNpv).toHaveBeenCalledWith('t1', 'u1', 0.10, [-1000, 300, 400, 500]);
    });

    it('returns step + result in shape', async () => {
      const acc = (service as any).accounting as ReturnType<typeof mockAccounting>;
      const result = await service.runComputeStep('t1', 'u1', 9, {
        initial_investment: 1000,
        discount_rate: 0.10,
        cashflows: [-1000, 300, 400, 500],
      });
      expect(result.scenarioId).toBe(9);
      expect(result.step).toBe('COMPUTE_NPV');
      expect((result.result as any).npv).toBe(-21.04);
    });
  });
});