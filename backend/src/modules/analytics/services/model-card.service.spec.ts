/**
 * Phase 19 — ModelCardService spec (CR-AI-1003).
 */
import { ModelCardService } from './model-card.service';

function prismaFor(found: boolean) {
  return {
    analyticsModel: {
      findFirst: async () => {
        if (!found) return null;
        return {
          id: 'm-1',
          name: 'Lead Score',
          version: '1.0.0',
          description: 'enterprise',
          metadata: {
            limitations: ['no cross-tenant transfer'],
            monitoring: { url: 'https://example.com' },
          },
          tenantId: 'tenant-A',
          updatedAt: new Date(),
        };
      },
    },
  };
}

describe('Phase 19 — ModelCardService (CR-AI-1003)', () => {
  it('forModel throws when the model does not exist', async () => {
    const svc = new ModelCardService(prismaFor(false) as never);
    await expect(svc.forModel('no-such', 't')).rejects.toThrow(/not found/);
  });

  it('forModel returns a typed card with version, scope, limitations, monitoring', async () => {
    const svc = new ModelCardService(prismaFor(true) as never);
    const card = await svc.forModel('m-1', 't');
    expect(card.modelId).toBe('m-1');
    expect(card.version).toBe('1.0.0');
    expect(card.scope).toContain('enterprise');
    expect(card.limitations.length).toBeGreaterThan(0);
    expect(typeof card.monitoring).toBe('object');
  });

  it('forRow produces the same typed shape with no DB call', () => {
    const svc = new ModelCardService(prismaFor(true) as never);
    const card = svc.forRow({
      id: 'm-2',
      name: 'Forecast',
      version: '1.0.0',
      description: 'Forecast',
      metadata: {},
      tenantId: null,
      updatedAt: new Date(),
    });
    expect(card.tenantScope).toBe('PLATFORM');
  });
});
