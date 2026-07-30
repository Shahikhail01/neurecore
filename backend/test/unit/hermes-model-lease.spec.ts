import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HermesModelLeaseController } from '../../src/modules/hermes-adapter/controllers/hermes-model-lease.controller';
import { HermesTokenService } from '../../src/modules/hermes-adapter/services/token.service';

const claims = {
  sub: 'user-1',
  tenantId: 'tenant-1',
  executionId: 'exec-1',
  workspacePath: '/workspace',
  allowedTools: ['nc.list_customers'],
  approvalThreshold: 'STANDARD' as const,
};

describe('Hermes model lease', () => {
  const tokens = new HermesTokenService(
    new ConfigService({ HERMES_SIDECAR_SECRET: 'lease-test-secret' }),
  );
  const prisma = {
    projectType: { findMany: jest.fn(async () => [{ id: 'project-type-1', name: 'Tax Filing', slug: 'tax-filing' }]) },
    agent: { findMany: jest.fn(async () => [{ id: 'agent-1', name: 'Tax Accountant' }]) },
  };

  it('resolves the tenant tools model without caching the credential', async () => {
    const select = jest.fn(async () => ({
      provider: { slug: 'deepseek', apiBaseUrl: 'https://api.deepseek.com' },
      model: { modelId: 'deepseek-v4-flash' },
      apiKey: 'resolved-only-in-memory',
    }));
    const controller = new HermesModelLeaseController(tokens, { select } as never, prisma as never);
    const setHeader = jest.fn();
    const token = tokens.mint(claims);

    await expect(
      controller.getLease('exec-1', `Bearer ${token}`, { setHeader } as never),
    ).resolves.toMatchObject({
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      apiKey: 'resolved-only-in-memory',
      executionContext: {
        requestingUserId: 'user-1',
        projectTypes: [{ id: 'project-type-1', name: 'Tax Filing', slug: 'tax-filing' }],
        agents: [{ id: 'agent-1', name: 'Tax Accountant' }],
      },
    });
    expect(select).toHaveBeenCalledWith('tenant-1', 'tools', { preferSpeed: true });
    expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store, private');
  });

  it('rejects a token minted for a different execution', async () => {
    const controller = new HermesModelLeaseController(tokens, {} as never, prisma as never);
    const token = tokens.mint(claims);
    await expect(
      controller.getLease('exec-2', `Bearer ${token}`, { setHeader: jest.fn() } as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
