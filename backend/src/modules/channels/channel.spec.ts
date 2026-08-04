/**
 * Channels — Registry + Service + MCP catalog tests.
 *
 * Asserts:
 *   1. All 12 OOB adapters register on the registry.
 *   2. MCP catalog contains every action with required fields.
 *   3. Service refuses wildcard tenant on every entry point.
 *   4. Service refuses to dispatch unknown actions.
 *   5. Service.ingest normalises inbound events.
 *   6. Inbound-only channels (Webhook) refuse outbound dispatch.
 */

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ChannelKind } from '@prisma/client';
import {
  ChannelRegistry,
  registerOobChannelAdapters,
  OOB_CHANNEL_ADAPTERS,
} from './channel-adapter.registry';
import { ChannelService } from './channel.service';
import { ChannelRepository } from './channel.repository';

function mockRepo(): jest.Mocked<ChannelRepository> {
  return {
    listConnections: jest.fn().mockResolvedValue([]),
    findConnection: jest.fn(),
    findConnectionByKind: jest.fn().mockResolvedValue(null),
    createConnection: jest.fn(),
    updateConnectionStatus: jest.fn(),
    appendEvent: jest.fn(),
    listEvents: jest.fn().mockResolvedValue([]),
  } as unknown as jest.Mocked<ChannelRepository>;
}

describe('Channel Registry', () => {
  it('ships 12 OOB adapters', () => {
    expect(OOB_CHANNEL_ADAPTERS.length).toBe(12);
  });

  it('every adapter registers without collision', () => {
    const registry = new ChannelRegistry();
    registerOobChannelAdapters(registry);
    expect(registry.list().length).toBe(12);
  });

  it('MCP catalog contains every action with required fields', () => {
    const registry = new ChannelRegistry();
    registerOobChannelAdapters(registry);
    const catalog = registry.mcpCatalog();
    expect(catalog.length).toBe(12);
    for (const entry of catalog) {
      for (const action of entry.actions) {
        expect(action.name).toMatch(/^[a-z][a-z0-9-]*$/);
        expect(action.description.length).toBeGreaterThan(0);
        expect([1, 2, 3, 4, 5]).toContain(action.riskTier);
        expect(action.inputSchema).toBeDefined();
      }
    }
  });

  it('refuses to register the same kind twice', () => {
    const registry = new ChannelRegistry();
    registry.register(OOB_CHANNEL_ADAPTERS[0]);
    expect(() => registry.register(OOB_CHANNEL_ADAPTERS[0])).toThrow();
  });
});

describe('ChannelService', () => {
  let svc: ChannelService;
  let repo: jest.Mocked<ChannelRepository>;
  let registry: ChannelRegistry;

  beforeEach(() => {
    registry = new ChannelRegistry();
    registerOobChannelAdapters(registry);
    repo = mockRepo();
    svc = new ChannelService(registry, repo);
  });

  describe('tenant guard', () => {
    it('listConnections refuses wildcard', async () => {
      await expect(svc.listConnections('*')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
    it('createConnection refuses wildcard', async () => {
      await expect(
        svc.createConnection({
          tenantId: '*',
          kind: ChannelKind.EMAIL,
          displayName: 'x',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
    it('dispatch refuses wildcard', async () => {
      await expect(
        svc.dispatch({
          kind: ChannelKind.EMAIL,
          tenantId: '*',
          connectionId: 'c1',
          actionName: 'email-draft',
          payload: {},
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
    it('ingest refuses wildcard', async () => {
      await expect(
        svc.ingest({
          tenantId: '*',
          kind: ChannelKind.WEBHOOK,
          connectionId: null,
          raw: {},
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('cross-tenant connection lookup', () => {
    it('findConnection throws when row belongs to a different tenant', async () => {
      (repo.findConnection as jest.Mock).mockResolvedValue({
        id: 'c1',
        tenantId: 'tenant-b',
        kind: ChannelKind.EMAIL,
      });
      await expect(svc.findConnection('tenant-a', 'c1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('dispatch', () => {
    it('refuses when adapter is not registered for the kind', async () => {
      // Force the registry to be empty for this test.
      const empty = new ChannelRegistry();
      const localSvc = new ChannelService(empty, repo);
      (repo.findConnection as jest.Mock).mockResolvedValue({
        id: 'c1',
        tenantId: 'tenant-a',
        kind: ChannelKind.EMAIL,
      });
      await expect(
        localSvc.dispatch({
          kind: ChannelKind.EMAIL,
          tenantId: 'tenant-a',
          connectionId: 'c1',
          actionName: 'email-draft',
          payload: {},
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuses when action is not exposed by the adapter', async () => {
      (repo.findConnection as jest.Mock).mockResolvedValue({
        id: 'c1',
        tenantId: 'tenant-a',
        kind: ChannelKind.EMAIL,
      });
      await expect(
        svc.dispatch({
          kind: ChannelKind.EMAIL,
          tenantId: 'tenant-a',
          connectionId: 'c1',
          actionName: 'bogus-action',
          payload: {},
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('dispatches successfully and appends a PROCESSED event', async () => {
      (repo.findConnection as jest.Mock).mockResolvedValue({
        id: 'c1',
        tenantId: 'tenant-a',
        kind: ChannelKind.EMAIL,
      });
      const result = await svc.dispatch({
        kind: ChannelKind.EMAIL,
        tenantId: 'tenant-a',
        connectionId: 'c1',
        actionName: 'email-draft',
        payload: { to: 'a@b.test', subject: 's', bodyText: 'hi' },
      });
      expect(result.ok).toBe(true);
      expect(repo.appendEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-a',
          kind: ChannelKind.EMAIL,
          status: 'PROCESSED',
          direction: 'outbound',
        }),
      );
    });
  });

  describe('ingest', () => {
    it('normalises inbound voice event', async () => {
      const evt = await svc.ingest({
        tenantId: 'tenant-a',
        kind: ChannelKind.VOICE,
        connectionId: 'c1',
        raw: { CallSid: 'CA123', From: '+15551234567' },
      });
      expect(evt).not.toBeNull();
      expect(evt!.direction).toBe('inbound');
      expect(evt!.payload['CallSid']).toBe('CA123');
      expect(repo.appendEvent).toHaveBeenCalled();
    });

    it('returns null when adapter does not normalise', async () => {
      const evt = await svc.ingest({
        tenantId: 'tenant-a',
        kind: ChannelKind.EMAIL,
        connectionId: 'c1',
        raw: { unknown: 'shape' },
      });
      expect(evt).toBeNull();
    });
  });

  describe('webhook channel', () => {
    it('refuses outbound dispatch (inbound-only)', async () => {
      (repo.findConnection as jest.Mock).mockResolvedValue({
        id: 'c1',
        tenantId: 'tenant-a',
        kind: ChannelKind.WEBHOOK,
      });
      // The webhook channel's adapter does not export any outbound
      // action; the request fails with NotFoundException because the
      // action is unknown.
      await expect(
        svc.dispatch({
          kind: ChannelKind.WEBHOOK,
          tenantId: 'tenant-a',
          connectionId: 'c1',
          actionName: 'webhook-send',
          payload: {},
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
