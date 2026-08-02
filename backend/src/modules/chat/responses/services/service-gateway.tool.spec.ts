import { Test } from '@nestjs/testing';
import { ModuleRef } from '@nestjs/core';
import { ServiceGatewayTool } from './service-gateway.tool';
import { ResponseEnvelopeBuilder } from '../builders/response-envelope.builder';
import { CAPABILITY_MAP } from '../maps/capability-map';

describe('ServiceGatewayTool', () => {
  let tool: ServiceGatewayTool;

  const fakeProjectsService = {
    findAll: jest.fn(),
    findById: jest.fn(),
  };

  const moduleRefGet = jest.fn();

  beforeEach(async () => {
    fakeProjectsService.findAll.mockReset();
    fakeProjectsService.findById.mockReset();
    moduleRefGet.mockReset();

    const mod = await Test.createTestingModule({
      providers: [
        ServiceGatewayTool,
        ResponseEnvelopeBuilder,
        {
          provide: ModuleRef,
          useValue: { get: moduleRefGet },
        },
      ],
    }).compile();
    tool = mod.get(ServiceGatewayTool);
  });

  it('has name "service-gateway" and category API', () => {
    expect(tool.name).toBe('service-gateway');
    expect(tool.category).toBeDefined();
  });

  it('description enumerates every capability in CAPABILITY_MAP (snapshot)', async () => {
    // Snapshot captures the full tool description as presented to the LLM.
    // This test breaks intentionally any time CAPABILITY_MAP changes —
    // the snapshot diff is the diff the LLM would see, so it doubles as
    // a human-readable changelog for the tool catalogue.
    expect(tool.description).toMatchSnapshot();
  });

  it('returns structured error when tenantId missing', async () => {
    const result = await tool.execute(
      { capability: 'listProjects', params: {} },
      {},
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/tenant/i);
  });

  it('returns structured error for unknown capability', async () => {
    const result = await tool.execute(
      { capability: 'nope', params: {} },
      { tenantId: 'tnt-a' },
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/unknown capability/i);
  });

  it('rejects a write capability even if one is accidentally registered', async () => {
    CAPABILITY_MAP['testWrite'] = {
      capability: 'testWrite',
      serviceToken: class TestWriteService {},
      paramsSchema: { shape: {}, safeParse: jest.fn() } as never,
      adapter: jest.fn(),
      readOnly: false as never,
      description: 'test-only write',
    };
    try {
      const result = await tool.execute(
        { capability: 'testWrite', params: {} },
        { tenantId: 'tnt-a' },
      );
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not permitted/i);
      expect(CAPABILITY_MAP['testWrite'].adapter).not.toHaveBeenCalled();
    } finally {
      delete CAPABILITY_MAP['testWrite'];
    }
  });

  it('rejects unknown params keys (strict key whitelist)', async () => {
    const result = await tool.execute(
      { capability: 'listProjects', params: { includeRelatons: true } },
      { tenantId: 'tnt-a' },
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/unknown params/i);
    expect(result.error).toMatch(/includeRelatons/);
  });

  it('rejects params that fail the schema (negative integer)', async () => {
    const result = await tool.execute(
      { capability: 'listProjects', params: { limit: -3 } },
      { tenantId: 'tnt-a' },
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/invalid params/i);
  });

  it('returns structured error when service token unresolved', async () => {
    moduleRefGet.mockReturnValue(null);
    const result = await tool.execute(
      { capability: 'listProjects', params: {} },
      { tenantId: 'tnt-a' },
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/unavailable/i);
  });

  it('calls adapter with (service, tenantId, params) exactly once', async () => {
    moduleRefGet.mockReturnValue(fakeProjectsService);
    fakeProjectsService.findAll.mockResolvedValue([
      { id: 'p1', name: 'Alpha' },
    ]);
    const result = await tool.execute(
      { capability: 'listProjects', params: { status: 'ACTIVE' } },
      { tenantId: 'tnt-a' },
    );
    expect(result.success).toBe(true);
    expect(fakeProjectsService.findAll).toHaveBeenCalledTimes(1);
    expect(fakeProjectsService.findAll).toHaveBeenCalledWith('tnt-a', {
      status: 'ACTIVE',
    });
    // Envelope is attached to metadata so chat-sse can ship it.
    expect(
      (result.metadata as { envelope?: { components?: unknown[] } })
        .envelope?.components,
    ).toBeDefined();
  });

  it('returns adapter exception as structured error (never throws)', async () => {
    moduleRefGet.mockReturnValue(fakeProjectsService);
    fakeProjectsService.findAll.mockRejectedValue(new Error('db down'));
    const result = await tool.execute(
      { capability: 'listProjects', params: {} },
      { tenantId: 'tnt-a' },
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe('db down');
  });

  it('NEVER reads tenantId from input — rejects input.tenantId as unknown key', async () => {
    moduleRefGet.mockReturnValue(fakeProjectsService);
    fakeProjectsService.findAll.mockResolvedValue([]);
    const result = await tool.execute(
      { capability: 'listProjects', params: { tenantId: 'EVIL' } },
      { tenantId: 'tnt-a' },
    );
    // The whitelist rejects `tenantId` because it is not in
    // cap.paramsSchema.shape. The adapter is NEVER called with the
    // attacker-supplied tenantId.
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/unknown params/i);
    expect(fakeProjectsService.findAll).not.toHaveBeenCalled();
  });
});
