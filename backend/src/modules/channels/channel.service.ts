/**
 * Channels — Service.
 *
 * Composes the adapter registry + the persistence repository. Owns the
 * outbound dispatch path and the inbound event ingestion path.
 *
 * Solid:
 *   • SRP — channels business rules only.
 *   • DIP — depends on the registry + repository abstractions.
 *
 * Per v3 P-1 rule §11: every tenant-scoped method refuses the wildcard
 * tenant id with ForbiddenException.
 */

import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ChannelKind, Prisma } from '@prisma/client';
import {
  ChannelRegistry,
  ChannelOutboundRequest,
  ChannelOutboundResult,
  ChannelInboundEvent,
} from './channel-adapter.registry';
import { ChannelRepository } from './channel.repository';

@Injectable()
export class ChannelService {
  private readonly logger = new Logger(ChannelService.name);

  constructor(
    private readonly registry: ChannelRegistry,
    private readonly repo: ChannelRepository,
  ) {}

  // ─── Catalog ────────────────────────────────────────────────────

  listAdapters() {
    return this.registry.list();
  }

  mcpCatalog() {
    return this.registry.mcpCatalog();
  }

  // ─── Connections ───────────────────────────────────────────────

  async listConnections(tenantId: string) {
    this.assertRealTenant(tenantId);
    return this.repo.listConnections(tenantId);
  }

  async createConnection(args: {
    tenantId: string;
    kind: ChannelKind;
    displayName: string;
    secretRef?: string;
    config?: Record<string, unknown>;
  }) {
    this.assertRealTenant(args.tenantId);
    const existing = await this.repo.findConnectionByKind(
      args.tenantId,
      args.kind,
      args.displayName,
    );
    if (existing) {
      throw new ForbiddenException(
        `connection (${args.kind}, ${args.displayName}) already exists for tenant ${args.tenantId}`,
      );
    }
    return this.repo.createConnection({
      tenantId: args.tenantId,
      kind: args.kind,
      displayName: args.displayName,
      secretRef: args.secretRef,
      config: args.config as unknown as Prisma.InputJsonValue | undefined,
    });
  }

  async findConnection(tenantId: string, id: string) {
    this.assertRealTenant(tenantId);
    const c = await this.repo.findConnection(tenantId, id);
    if (!c) throw new NotFoundException(`connection ${id} not found`);
    if (c.tenantId !== tenantId) {
      throw new ForbiddenException('connection belongs to a different tenant');
    }
    return c;
  }

  // ─── Outbound dispatch ─────────────────────────────────────────

  async dispatch(args: ChannelOutboundRequest): Promise<ChannelOutboundResult> {
    this.assertRealTenant(args.tenantId);
    const conn = await this.repo.findConnection(args.tenantId, args.connectionId);
    if (!conn) throw new NotFoundException(`connection ${args.connectionId} not found`);
    if (conn.tenantId !== args.tenantId) {
      throw new ForbiddenException('connection belongs to a different tenant');
    }
    const adapter = this.registry.get(args.kind);
    if (!adapter) {
      throw new NotFoundException(`no adapter registered for kind ${args.kind}`);
    }
    if (!adapter.mcpActions.some((a) => a.name === args.actionName)) {
      throw new NotFoundException(
        `action ${args.actionName} is not exposed by adapter ${args.kind}`,
      );
    }
    const result = await adapter.dispatch(args);
    await this.repo.appendEvent({
      tenantId: args.tenantId,
      kind: args.kind,
      connectionId: args.connectionId,
      direction: 'outbound',
      payload: args.payload as unknown as Prisma.InputJsonValue,
      status: result.ok ? 'PROCESSED' : 'FAILED',
      errorMessage: result.error,
    });
    if (!result.ok) {
      await this.repo.updateConnectionStatus(args.connectionId, 'ERROR', result.error);
    }
    return result;
  }

  // ─── Inbound ingestion ─────────────────────────────────────────

  async ingest(args: {
    tenantId: string;
    kind: ChannelKind;
    connectionId: string | null;
    raw: unknown;
  }): Promise<ChannelInboundEvent | null> {
    this.assertRealTenant(args.tenantId);
    const adapter = this.registry.get(args.kind);
    if (!adapter) {
      throw new NotFoundException(`no adapter registered for kind ${args.kind}`);
    }
    const normalised = adapter.normalizeInbound(args.raw, {
      tenantId: args.tenantId,
      connectionId: args.connectionId,
    });
    if (normalised) {
      await this.repo.appendEvent({
        tenantId: args.tenantId,
        kind: args.kind,
        connectionId: args.connectionId,
        direction: 'inbound',
        payload: normalised.payload as unknown as Prisma.InputJsonValue,
        status: 'PROCESSED',
      });
    }
    return normalised;
  }

  async listEvents(tenantId: string, args: { kind?: ChannelKind; status?: string } = {}) {
    this.assertRealTenant(tenantId);
    return this.repo.listEvents({ tenantId, ...args });
  }

  // ─── Helpers ───────────────────────────────────────────────────

  private assertRealTenant(tenantId: string) {
    if (!tenantId || tenantId === '*') {
      throw new ForbiddenException(
        'tenantId "*" is forbidden; use a platform-admin port for cross-tenant queries',
      );
    }
  }
}
