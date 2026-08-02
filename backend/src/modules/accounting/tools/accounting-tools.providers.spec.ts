/**
 * Tests for the 4 TIER-1 accounting structured tools (NC-ACCT-IMP-1 §7).
 *
 * Verifies that the tools:
 *   1. Have correct name + schema
 *   2. Reject malformed inputs
 *   3. Pass through to AccountingService correctly
 *   4. Extract tenantId/userId from ToolExecutionContext
 *   5. Return proper StructuredToolResult shape
 */

import { NpvTool, IrrTool, MirrTool, AmortizeLoanTool } from './accounting-tools.providers';

const mockCtx = (overrides: Partial<{ tenantId: string; userId: string }> = {}) => ({
  tenantId: overrides.tenantId ?? 'tenant-1',
  userId: overrides.userId ?? 'user-1',
  agentId: 'agent-1',
  taskId: 'task-1',
});

function mockAccounting(overrides: Partial<{
  computeNpv: jest.Mock;
  computeIrr: jest.Mock;
  computeMirr: jest.Mock;
  amortizeLoan: jest.Mock;
}> = {}) {
  return {
    computeNpv: overrides.computeNpv ?? jest.fn(async () => ({ npv: -21.04, computationId: 'npv-1', converged: true })),
    computeIrr: overrides.computeIrr ?? jest.fn(async () => ({ irr: 0.089, computationId: 'irr-1', converged: true })),
    computeMirr: overrides.computeMirr ?? jest.fn(async () => ({ mirr: 0.098, computationId: 'mirr-1', converged: true })),
    amortizeLoan: overrides.amortizeLoan ?? jest.fn(async () => ({ schedule: [{ period: 1, payment: 100 }] })),
  } as any;
}

describe('Accounting TIER-1 structured tools', () => {
  describe('NpvTool', () => {
    let tool: NpvTool;
    let acc: ReturnType<typeof mockAccounting>;

    beforeEach(() => {
      acc = mockAccounting();
      tool = new NpvTool(acc);
    });

    it('has correct name + schema', () => {
      expect(tool.name).toBe('nc.accounting.compute_npv');
      expect(tool.category).toBeTruthy();
      expect(tool.inputSchema).toBeDefined();
    });

    it('rejects malformed input', () => {
      const result = tool.inputSchema.safeParse({ wrong: 'shape' });
      expect(result.success).toBe(false);
    });

    it('rejects extra fields (strict mode)', () => {
      const result = tool.inputSchema.safeParse({
        rate: 0.1, cashflows: [-1000, 300], extra: 'bad',
      });
      expect(result.success).toBe(false);
    });

    it('rejects rate outside [-1, 10]', () => {
      expect(tool.inputSchema.safeParse({ rate: 11, cashflows: [1] }).success).toBe(false);
      expect(tool.inputSchema.safeParse({ rate: -2, cashflows: [1] }).success).toBe(false);
      // Boundary checks: rate=10 and rate=-1 are accepted (closed interval)
      expect(tool.inputSchema.safeParse({ rate: 10, cashflows: [1] }).success).toBe(true);
      expect(tool.inputSchema.safeParse({ rate: -1, cashflows: [1] }).success).toBe(true);
      // 1.5 IS valid — it's within the range
      expect(tool.inputSchema.safeParse({ rate: 1.5, cashflows: [1] }).success).toBe(true);
    });

    it('rejects empty cashflows', () => {
      expect(tool.inputSchema.safeParse({ rate: 0.1, cashflows: [] }).success).toBe(false);
    });

    it('passes tenantId/userId from ctx and returns result', async () => {
      const result = await tool.execute(
        { rate: 0.1, cashflows: [-1000, 300, 400, 500] },
        mockCtx(),
      );
      expect(result.success).toBe(true);
      expect((result.data as any).npv).toBe(-21.04);
      expect(acc.computeNpv).toHaveBeenCalledWith('tenant-1', 'user-1', 0.1, [-1000, 300, 400, 500]);
    });

    it('returns MISSING_CONTEXT when ctx lacks tenantId', async () => {
      const result = await tool.execute(
        { rate: 0.1, cashflows: [-1000, 300] },
        { userId: 'u' } as any,
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('MISSING_CONTEXT');
    });

    it('returns MISSING_CONTEXT when ctx lacks userId', async () => {
      const result = await tool.execute(
        { rate: 0.1, cashflows: [-1000, 300] },
        { tenantId: 't' } as any,
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('MISSING_CONTEXT');
    });

    it('catches exceptions and returns COMPUTE_FAILED', async () => {
      const acc2 = mockAccounting({ computeNpv: jest.fn(async () => { throw new Error('boom'); }) });
      const t = new NpvTool(acc2);
      const r = await t.execute({ rate: 0.1, cashflows: [-1000, 300] }, mockCtx());
      expect(r.success).toBe(false);
      expect((r.error ?? '').toString()).toContain('COMPUTE_FAILED');
    });
  });

  describe('IrrTool', () => {
    let tool: IrrTool;
    let acc: ReturnType<typeof mockAccounting>;

    beforeEach(() => {
      acc = mockAccounting();
      tool = new IrrTool(acc);
    });

    it('has correct name', () => {
      expect(tool.name).toBe('nc.accounting.compute_irr');
    });

    it('requires ≥2 cashflows (matches sidecar schema)', () => {
      expect(tool.inputSchema.safeParse({ cashflows: [100] }).success).toBe(false);
      expect(tool.inputSchema.safeParse({ cashflows: [100, 200] }).success).toBe(true);
    });

    it('passes tenantId/userId from ctx', async () => {
      const r = await tool.execute({ cashflows: [-1000, 300, 400, 500] }, mockCtx());
      expect(r.success).toBe(true);
      expect((r.data as any).irr).toBe(0.089);
      expect(acc.computeIrr).toHaveBeenCalledWith('tenant-1', 'user-1', [-1000, 300, 400, 500]);
    });

    it('propagates converged=false', async () => {
      const acc2 = mockAccounting({
        computeIrr: jest.fn(async () => ({ irr: null, computationId: 'irr-2', converged: false })),
      });
      const t = new IrrTool(acc2);
      const r = await t.execute({ cashflows: [100, 200, 300] }, mockCtx());
      expect(r.success).toBe(true);
      expect((r.data as any).converged).toBe(false);
    });
  });

  describe('MirrTool', () => {
    let tool: MirrTool;
    let acc: ReturnType<typeof mockAccounting>;

    beforeEach(() => {
      acc = mockAccounting();
      tool = new MirrTool(acc);
    });

    it('requires both financeRate and reinvestRate', () => {
      expect(tool.inputSchema.safeParse({ financeRate: 0.1, cashflows: [1, 2] }).success).toBe(false);
      expect(tool.inputSchema.safeParse({ reinvestRate: 0.1, cashflows: [1, 2] }).success).toBe(false);
      expect(tool.inputSchema.safeParse({ financeRate: 0.1, reinvestRate: 0.1, cashflows: [1, 2] }).success).toBe(true);
    });

    it('passes both rates + cashflows', async () => {
      const r = await tool.execute(
        { financeRate: 0.1, reinvestRate: 0.12, cashflows: [-1000, 300, 400, 500] },
        mockCtx(),
      );
      expect(r.success).toBe(true);
      expect(acc.computeMirr).toHaveBeenCalledWith('tenant-1', 'user-1', 0.1, 0.12, [-1000, 300, 400, 500]);
    });
  });

  describe('AmortizeLoanTool', () => {
    let tool: AmortizeLoanTool;
    let acc: ReturnType<typeof mockAccounting>;

    beforeEach(() => {
      acc = mockAccounting();
      tool = new AmortizeLoanTool(acc);
    });

    it('rejects zero principal', () => {
      expect(tool.inputSchema.safeParse({ principal: 0, rate: 0.06, nper: 12 }).success).toBe(false);
    });

    it('rejects non-positive nper', () => {
      expect(tool.inputSchema.safeParse({ principal: 100, rate: 0.06, nper: 0 }).success).toBe(false);
      expect(tool.inputSchema.safeParse({ principal: 100, rate: 0.06, nper: -1 }).success).toBe(false);
    });

    it('rejects too-large nper (600 = 50 years)', () => {
      expect(tool.inputSchema.safeParse({ principal: 100, rate: 0.06, nper: 601 }).success).toBe(false);
    });

    it('passes principal + rate + nper', async () => {
      const r = await tool.execute(
        { principal: 10000, rate: 0.06, nper: 12 },
        mockCtx(),
      );
      expect(r.success).toBe(true);
      expect(acc.amortizeLoan).toHaveBeenCalledWith('tenant-1', 'user-1', 10000, 0.06, 12);
    });
  });
});