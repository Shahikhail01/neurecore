/**
 * Phase 14 — InventoryWithHygiene unit tests.
 */

import { InventoryWithHygieneService } from './inventory-with-hygiene.service';

const invEmpty = { agents: [], skills: [], models: [], knowledge: [], channels: [], tenantId: 't', fetchedAt: new Date().toISOString() };

describe('Phase 14 — InventoryWithHygieneService', () => {
  function makeService(getInventoryResp: unknown = invEmpty): InventoryWithHygieneService {
    const inventoryStub = {
      getInventory: jest.fn(async () => getInventoryResp),
    };
    return new InventoryWithHygieneService(inventoryStub as never);
  }

  it('returns zeroed hygiene for an empty inventory', async () => {
    const svc = makeService();
    const out = await svc.computeHygiene('tenant-A');
    expect(out.staleSkills).toBe(0);
    expect(out.orphanedAgents).toBe(0);
    expect(out.zeroUseSkills).toBe(0);
    expect(out.unpublishedArticles).toBe(0);
    expect(out.windowDays).toBe(30);
  });

  it('counts archived skills as stale', async () => {
    const inventory = {
      ...invEmpty,
      skills: [
        { id: 's1', name: 'x', slug: 'x', version: '1.0.0', status: 'active', updatedAt: '', source: 'AgentSkillDefinition' },
        { id: 's2', name: 'y', slug: 'y', version: '1.0.0', status: 'archived', updatedAt: '', source: 'AgentSkillDefinition' },
      ],
    };
    const out = await makeService(inventory).computeHygiene('t');
    expect(out.staleSkills).toBe(1);
  });

  it('counts department-null agents as orphaned', async () => {
    const inventory = {
      ...invEmpty,
      agents: [
        { id: 'a1', name: 'A', status: 'active', model: 'x', departmentId: null, updatedAt: '', source: 'Agent' },
        { id: 'a2', name: 'B', status: 'active', model: 'x', departmentId: 'd-1', updatedAt: '', source: 'Agent' },
      ],
    };
    const out = await makeService(inventory).computeHygiene('t');
    expect(out.orphanedAgents).toBe(1);
  });

  it('counts draft skills as zero-use', async () => {
    const inventory = {
      ...invEmpty,
      skills: [
        { id: 's1', name: 'x', slug: 'x', version: '1.0.0', status: 'draft', updatedAt: '', source: 'AgentSkillDefinition' },
        { id: 's2', name: 'y', slug: 'y', version: '1.0.0', status: 'active', updatedAt: '', source: 'AgentSkillDefinition' },
      ],
    };
    const out = await makeService(inventory).computeHygiene('t');
    expect(out.zeroUseSkills).toBe(1);
  });
});
