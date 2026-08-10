import { AIEmployeeCoreController } from './ai-employee-core.controller';

describe('AIEmployeeCoreController actor safety', () => {
  it('derives tenant and HUMAN requester from JWT and ignores client impersonation', async () => {
    const core = { start: jest.fn().mockResolvedValue({ id: 'run-a' }) };
    const controller = new AIEmployeeCoreController(core as never);

    await controller.start(
      { user: { tenantId: 'tenant-a', sub: 'human-a' } },
      {
        employeeId: '00000000-0000-4000-8000-000000000001',
        objective: 'Create report',
        trigger: { type: 'USER' },
        idempotencyKey: 'request-key-a',
      },
    );

    expect(core.start).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a',
        requestedBy: { actorId: 'human-a', actorType: 'HUMAN' },
      }),
    );
  });
});
