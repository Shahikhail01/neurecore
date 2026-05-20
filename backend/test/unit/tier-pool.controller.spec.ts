/// <reference types="jest" />
import 'reflect-metadata';

declare const jest: any;
declare const describe: any;
declare const beforeEach: any;
declare const it: any;
declare const expect: any;

import { ROLES_KEY } from '../../src/common/decorators/roles.decorator';
import { TENANT_ADMIN_ROLES } from '../../src/common/types/user-role.utils';
import { TierPoolController } from '../../src/modules/tiers/tier-pool.controller';

const mockTierPoolService = {
  getPoolStatusForTenant: jest.fn(),
  getDepartmentPoolStatusForTenant: jest.fn(),
};

const mockPoolProvisioningService = {
  provisionFromSlot: jest.fn(),
  releaseSlot: jest.fn(),
  replaceChoiceSlot: jest.fn(),
};

const mockDepartmentPoolProvisioningService = {
  provisionFromSlot: jest.fn(),
};

const mockTierEnforcementService = {
  enforceAgentLimit: jest.fn(),
};

describe('TierPoolController', () => {
  let controller: TierPoolController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new TierPoolController(
      mockTierPoolService as any,
      mockPoolProvisioningService as any,
      mockDepartmentPoolProvisioningService as any,
      mockTierEnforcementService as any,
      {} as any,
    );
  });

  it.each([
    'getTenantPoolStatus',
    'getTenantDepartmentPoolStatus',
    'provisionFromSlot',
    'provisionDepartmentFromSlot',
    'releaseSlot',
    'replaceSlotAgent',
  ])('requires tenant-admin roles on %s', (methodName: string) => {
    const handler = TierPoolController.prototype[
      methodName as keyof TierPoolController
    ] as unknown as Function;

    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([
      ...TENANT_ADMIN_ROLES,
    ]);
  });

  it('provisions slots in the authenticated tenant context', async () => {
    mockTierEnforcementService.enforceAgentLimit.mockResolvedValue(undefined);
    mockPoolProvisioningService.provisionFromSlot.mockResolvedValue({
      agentId: 'agent-1',
    });

    await controller.provisionFromSlot(
      { slotId: 'slot-1' } as any,
      { tenantId: 'tenant-1', userId: 'owner-1' } as any,
    );

    expect(mockTierEnforcementService.enforceAgentLimit).toHaveBeenCalledWith(
      'tenant-1',
    );
    expect(mockPoolProvisioningService.provisionFromSlot).toHaveBeenCalledWith(
      'tenant-1',
      'slot-1',
      'owner-1',
    );
  });
});
