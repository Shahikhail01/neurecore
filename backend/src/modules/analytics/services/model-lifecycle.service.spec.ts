/**
 * Phase 19 — ModelLifecycleService spec.
 *
 * Validates the new CR-AI-1001 methods: compareChallenger +
 * runRollbackDrill + tenant-scope refusal.
 */

import { ModelLifecycleService } from './model-lifecycle.service';

function makePrisma(opts: {
  activeScore?: number;
  challengerScore?: number;
  activeLifecycle?: Array<{ stage: string; status: string }>;
}) {
  return {
    prisma: {
      analyticsModel: {
        findFirst: jest.fn(async (args: { where: { id: string } }) => {
          if (args.where.id === 'm-1') {
            return {
              id: 'm-1',
              name: 'Active',
              version: '1.0.0',
              metadata: {
                lifecycle: {
                  shadow: { challengerScore: opts.activeScore ?? 0.82 },
                  stages: opts.activeLifecycle ?? [
                    { stage: 'gated-production', status: 'COMPLETE' },
                  ],
                },
              },
              lifecycle: { stages: opts.activeLifecycle ?? [{ stage: 'gated-production', status: 'COMPLETE' }] },
            };
          }
          if (args.where.id === 'm-2') {
            return {
              id: 'm-2',
              name: 'Challenger',
              version: '1.1.0',
              metadata: {
                lifecycle: {
                  shadow: { challengerScore: opts.challengerScore ?? 0.86 },
                },
              },
              lifecycle: { stages: [] },
            };
          }
          return null;
        }),
      },
    },
  };
}

describe('Phase 19 — ModelLifecycleService (CR-AI-1001)', () => {
  describe('compareChallenger', () => {
    it('refuses wildcard tenantId', async () => {
      const svc = new ModelLifecycleService(makePrisma({}).prisma as never);
      await expect(
        svc.compareChallenger({
          tenantId: '*',
          activeModelId: 'm-1',
          challengerModelId: 'm-2',
        }),
      ).rejects.toThrow(/tenantId/);
    });

    it('throws when an active model does not exist', async () => {
      const svc = new ModelLifecycleService(makePrisma({}).prisma as never);
      await expect(
        svc.compareChallenger({
          tenantId: 't',
          activeModelId: 'no-such',
          challengerModelId: 'm-2',
        }),
      ).rejects.toThrow(/not found/);
    });

    it('returns a typed comparison with both scores', async () => {
      const svc = new ModelLifecycleService(
        makePrisma({ activeScore: 0.82, challengerScore: 0.86 }).prisma as never,
      );
      const out = await svc.compareChallenger({
        tenantId: 't',
        activeModelId: 'm-1',
        challengerModelId: 'm-2',
      });
      expect(out.activeModelId).toBe('m-1');
      expect(out.challengerModelId).toBe('m-2');
      expect(out.activeScore).toBe(0.82);
      expect(out.challengerScore).toBe(0.86);
      expect(out.window).toBe(30);
      expect(typeof out.comparedAt).toBe('string');
    });
  });

  describe('runRollbackDrill', () => {
    it('refuses wildcard tenantId', async () => {
      const svc = new ModelLifecycleService(makePrisma({}).prisma as never);
      await expect(
        svc.runRollbackDrill({
          tenantId: '*',
          modelId: 'm-1',
          actor: 'u-1',
        }),
      ).rejects.toThrow(/tenantId/);
    });

    it('returns a typed sandboxed drill report', async () => {
      const svc = new ModelLifecycleService(makePrisma({}).prisma as never);
      const out = await svc.runRollbackDrill({
        tenantId: 't',
        modelId: 'm-1',
        actor: 'u-1',
      });
      expect(out.modelId).toBe('m-1');
      expect(out.sandbox).toBe(true);
      expect(out.actor).toBe('u-1');
      expect(out.notes).toContain('Drill only');
      expect(out.elapsedMs).toBeGreaterThan(0);
      expect(out.previouslyActiveStage).toBe('COMPLETE');
    });

    it('throws when the model does not exist', async () => {
      const svc = new ModelLifecycleService(makePrisma({}).prisma as never);
      await expect(
        svc.runRollbackDrill({
          tenantId: 't',
          modelId: 'no-such',
          actor: 'u-1',
        }),
      ).rejects.toThrow(/not found/);
    });
  });
});
