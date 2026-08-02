/**
 * kill-switch.spec.ts — KillSwitchService unit coverage (P8 CR-AI-1207).
 *
 * Wraps ServiceGatewayFlagsService and writes an AuditLog entry on
 * every toggle. These tests assert the validation surface and the
 * audit-row creation; the underlying flag mutation is delegated to
 * the (mocked) flags service.
 */

import { BadRequestException } from '@nestjs/common';
import { KillSwitchService } from '../kill-switch.service';

interface FlagMutation {
  method: string;
  scope?: string;
  target?: string;
  enabled?: boolean;
}

class FakeFlagsService {
  mutations: FlagMutation[] = [];
  processEnabled = false;
  setProcessEnabled(enabled: boolean): void {
    this.processEnabled = enabled;
    this.mutations.push({ method: 'setProcessEnabled', enabled });
  }
  setPhaseEnabled(phase: string, enabled: boolean): void {
    this.mutations.push({ method: 'setPhaseEnabled', scope: phase, enabled });
  }
  setChannelEnabled(channel: string, enabled: boolean): void {
    this.mutations.push({
      method: 'setChannelEnabled',
      scope: channel,
      enabled,
    });
  }
  async setTenantOverride(
    tenantId: string,
    subKey: string,
    value: boolean,
  ): Promise<void> {
    this.mutations.push({
      method: 'setTenantOverride',
      scope: tenantId,
      target: subKey,
      enabled: value,
    });
  }
  async snapshotForTenant(_tenantId: string) {
    return {
      processEnabled: this.processEnabled,
      phase: {
        read: false,
        mutate: false,
        recommend: false,
        channels: false,
        'agent-builder': false,
        model: false,
      },
      channel: {
        webchat: false,
        email: false,
        calendar: false,
        crm: false,
        brevo: false,
      },
      overrides: {},
    };
  }
}

class FakePrisma {
  created: Array<{ data: Record<string, unknown> }> = [];
  auditLog = {
    create: (args: { data: Record<string, unknown> }) => {
      this.created.push(args);
      return Promise.resolve({
        id: 'audit-1',
        createdAt: new Date('2026-01-01T00:00:00Z'),
      });
    },
  };
}

describe('KillSwitchService (P8 CR-AI-1207)', () => {
  let flags: FakeFlagsService;
  let prisma: FakePrisma;
  let service: KillSwitchService;

  beforeEach(() => {
    flags = new FakeFlagsService();
    prisma = new FakePrisma();
    service = new KillSwitchService(
      prisma as unknown as never,
      flags as unknown as never,
    );
  });

  it('list() returns entries for every phase, channel, and override', async () => {
    flags.setProcessEnabled(true);
    const out = await service.list('t-1');
    expect(out.processEnabled).toBe(true);
    expect(out.entries.length).toBeGreaterThanOrEqual(11); // 6 phases + 5 channels
    const phases = out.entries.filter((e) => e.scope === 'phase');
    const channels = out.entries.filter((e) => e.scope === 'channel');
    expect(phases.length).toBe(6);
    expect(channels.length).toBe(5);
  });

  it('set(process, true) mutates flag and writes audit row', async () => {
    const out = await service.set('t-1', { sub: 'user-1' } as never, {
      scope: 'process',
      enabled: true,
      reason: 'incident response',
    });
    expect(out.enabled).toBe(true);
    expect(out.auditLogId).toBe('audit-1');
    expect(flags.mutations).toEqual([
      { method: 'setProcessEnabled', enabled: true },
    ]);
    expect(prisma.created[0].data).toMatchObject({
      tenantId: 't-1',
      result: 'success',
      action: 'command-center.kill_switch.enabled',
      resource: 'process',
    });
  });

  it('set(phase) validates unknown phase', async () => {
    await expect(
      service.set('t-1', { sub: 'u' } as never, {
        scope: 'phase',
        target: 'made-up',
        enabled: false,
        reason: 'test',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('set(channel) routes through setChannelEnabled', async () => {
    const out = await service.set('t-1', { sub: 'u' } as never, {
      scope: 'channel',
      target: 'email',
      enabled: false,
      reason: 'rotate creds',
    });
    expect(out.target).toBe('email');
    expect(flags.mutations).toEqual([
      { method: 'setChannelEnabled', scope: 'email', enabled: false },
    ]);
  });

  it('set(tenant-feature) requires service-gateway-v2 prefix', async () => {
    await expect(
      service.set('t-1', { sub: 'u' } as never, {
        scope: 'tenant-feature',
        target: 'something-else.read',
        enabled: false,
        reason: 'lockdown',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('set(tenant-feature) writes per-tenant override', async () => {
    const out = await service.set('t-1', { sub: 'u' } as never, {
      scope: 'tenant-feature',
      target: 'service-gateway-v2.read',
      enabled: false,
      reason: 'compliance',
    });
    expect(out.enabled).toBe(false);
    expect(flags.mutations).toEqual([
      {
        method: 'setTenantOverride',
        scope: 't-1',
        target: 'service-gateway-v2.read',
        enabled: false,
      },
    ]);
  });

  it('rejects body without reason', async () => {
    await expect(
      service.set('t-1', { sub: 'u' } as never, {
        scope: 'process',
        enabled: true,
        reason: 'no',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects non-process scope without target', async () => {
    await expect(
      service.set('t-1', { sub: 'u' } as never, {
        scope: 'phase',
        enabled: false,
        reason: 'lockdown',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
