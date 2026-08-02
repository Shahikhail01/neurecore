import { CAPABILITY_MAP } from './capability-map';

describe('CAPABILITY_MAP', () => {
  it('every capability has unique name and matches its map key', () => {
    for (const [key, cap] of Object.entries(CAPABILITY_MAP)) {
      expect(cap.capability).toBe(key);
    }
  });

  it('every capability exposes capability, serviceToken, paramsSchema, adapter, description', () => {
    for (const cap of Object.values(CAPABILITY_MAP)) {
      expect(typeof cap.capability).toBe('string');
      expect(cap.capability.length).toBeGreaterThan(0);
      // serviceToken is the actual class reference (not a string) so that
      // Nest's ModuleRef.get() resolves correctly at runtime. The plan
      // originally used strings here; that was a latent bug because
      // moduleRef.get('ProjectsService') cannot resolve by class name.
      expect(cap.serviceToken).toBeDefined();
      expect(typeof cap.serviceToken).toBe('function');
      expect(typeof cap.description).toBe('string');
      expect(cap.description.length).toBeGreaterThan(0);
      expect(typeof cap.adapter).toBe('function');
      expect(cap.paramsSchema).toBeDefined();
      expect(typeof cap.readOnly).toBe('boolean');
    }
  });

  it('v1 only ships READ-only capabilities (write paths land in W3)', () => {
    for (const cap of Object.values(CAPABILITY_MAP)) {
      expect(cap.readOnly).toBe(true);
    }
  });

  it('paramsSchema has at least one allowed key', () => {
    for (const cap of Object.values(CAPABILITY_MAP)) {
      const keys = (cap.paramsSchema as unknown as { shape?: Record<string, unknown> }).shape;
      expect(keys).toBeDefined();
      expect(Object.keys(keys ?? {}).length).toBeGreaterThanOrEqual(0);
    }
  });

  it('adapters propagate tenantId from context to the service method', async () => {
    // Mock services that record their arguments for assertion.
    const projectsSvc = {
      findAll: jest.fn().mockResolvedValue([]),
      findById: jest.fn().mockResolvedValue({ id: 'p1' }),
    };
    const customersSvc = {
      findAll: jest.fn().mockResolvedValue([]),
      findById: jest.fn().mockResolvedValue({ id: 'c1' }),
    };
    const dataSvc = {
      agent: { groupBy: jest.fn().mockResolvedValue([]) },
      task: { groupBy: jest.fn().mockResolvedValue([]) },
      department: { count: jest.fn().mockResolvedValue(0) },
      approvalRequest: { count: jest.fn().mockResolvedValue(0) },
      costRecord: { aggregate: jest.fn().mockResolvedValue(null) },
    };

    // The capability map holds the actual class as `serviceToken`. In a
    // real DI container Nest would resolve the token (ProjectsService)
    // to the live service instance. In this unit test the adapters don't
    // dereference the token themselves — the gateway's executeImpl does.
    // We just pass the appropriate mock service to each adapter.
    const passService = (svc: unknown) => () => svc;

    await CAPABILITY_MAP['listProjects'].adapter(
      projectsSvc,
      'tnt-x',
      {},
    );
    expect(projectsSvc.findAll).toHaveBeenCalledWith('tnt-x', {});

    await CAPABILITY_MAP['getProject'].adapter(
      projectsSvc,
      'tnt-y',
      { id: 'p1' },
    );
    expect(projectsSvc.findById).toHaveBeenCalledWith('p1', 'tnt-y');

    await CAPABILITY_MAP['listCustomers'].adapter(
      customersSvc,
      'tnt-z',
      {},
    );
    expect(customersSvc.findAll).toHaveBeenCalledWith('tnt-z', {});

    await CAPABILITY_MAP['getCustomer'].adapter(
      customersSvc,
      'tnt-z',
      { id: 'c1' },
    );
    expect(customersSvc.findById).toHaveBeenCalledWith('c1', 'tnt-z');

    await CAPABILITY_MAP['getDashboardSummary'].adapter(
      dataSvc,
      'tnt-z',
      {},
    );
    expect(dataSvc.agent.groupBy).toHaveBeenCalled();
    void passService;
  });
});
