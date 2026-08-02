import { MutationDispatcher } from './mutation-dispatcher';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import type {
  IWorkRuntime,
  WorkRunView,
  ActorType,
} from '../../work-runtime/contracts/work-runtime.interface';
import type { TenantContext } from '../../../common/context/tenant-context';

describe('MutationDispatcher', () => {
  const tenantContext = {
    run: jest.fn(),
    get: jest.fn(),
    get tenantId() {
      return 'tenant-from-context';
    },
    getOrNull: jest.fn(),
  } as unknown as TenantContextService & { get: jest.Mock };

  const workRuntime: { createRun: jest.Mock } & Partial<IWorkRuntime> = {
    createRun: jest.fn(),
  };

  beforeEach(() => {
    (tenantContext.get as jest.Mock).mockReset();
    workRuntime.createRun.mockReset();
  });

  function makeDispatcher() {
    return new MutationDispatcher(workRuntime as IWorkRuntime, tenantContext);
  }

  it('derives tenantId and actorId from authenticated tenant context (not from request)', async () => {
    const authContext: TenantContext = {
      tenantId: 'tenant-auth',
      isCrossTenant: false,
      actorRole: 'USER' as never,
      actorUserId: 'user-42',
    };
    (tenantContext.get as jest.Mock).mockReturnValue(authContext);
    const run: WorkRunView = {
      id: 'run-1',
      tenantId: 'tenant-auth',
      actorId: 'user-42',
      actorType: 'HUMAN' as ActorType,
      status: 'CREATED',
      request: 'create something',
      currentStepIndex: 0,
      planVersion: 0,
      summary: null,
      failureCode: null,
      failureReason: null,
      createdAt: new Date().toISOString(),
    };
    workRuntime.createRun.mockResolvedValue(run);

    const dispatcher = makeDispatcher();
    const result = await dispatcher.createGovernedRun({
      request: 'create something',
      scope: { projectId: 'p1' },
    });

    expect(workRuntime.createRun).toHaveBeenCalledTimes(1);
    const params = workRuntime.createRun.mock.calls[0][0];
    expect(params.tenantId).toBe('tenant-auth');
    expect(params.actorId).toBe('user-42');
    expect(params.actorType).toBe('HUMAN');
    expect(params.request).toBe('create something');
    expect(params.scope).toEqual({ projectId: 'p1' });
    expect(result).toEqual(run);
  });

  it('throws when there is no authenticated tenant context', async () => {
    (tenantContext.get as jest.Mock).mockImplementation(() => {
      throw new Error('no context');
    });
    const dispatcher = makeDispatcher();
    await expect(
      dispatcher.createGovernedRun({ request: 'x' }),
    ).rejects.toThrow(/no context/);
    expect(workRuntime.createRun).not.toHaveBeenCalled();
  });
});
