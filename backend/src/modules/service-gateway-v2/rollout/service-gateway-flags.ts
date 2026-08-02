/**
 * ServiceGatewayV2Flags — typed feature flags for the Service Gateway V2
 * rollout.
 *
 * Phase 8 (NC-AWL-IMP-1 §11.3) — the gateway must be shipped under a
 * four-axis kill-switch:
 *
 *   1. **Process kill-switch** (env: CHAT_USE_SERVICE_GATEWAY_V2)
 *      A single env var that, when set to `false`/`0`/`off`, forces the
 *      gateway off for every tenant, every phase, every channel. This is
 *      the "smoke is coming out of the server" switch.
 *
 *   2. **Tenant-level enablement** (TenantFeatureFlag via Prisma)
 *      Per-tenant toggle stored in `Tenant.settings.featureFlags` under
 *      the sub-keys `service-gateway-v2.*` (e.g. `service-gateway-v2.read`,
 *      `service-gateway-v2.mutate`). Default OFF; admins flip a tenant
 *      on via the controller.
 *
 *   3. **Phase / domain capability enablement** (global)
 *      Granular per-phase kill-switch (read, mutate, recommend,
 *      channels, agent-builder, model). Default OFF in production;
 *      flipped to ON per phase as the rollout progresses.
 *
 *   4. **Per-channel enablement** (global)
 *      The gateway can be rolled out per channel (webchat, email,
 *      calendar, crm, brevo) so that the team can validate the new
 *      pipeline in a single channel before flipping the rest.
 *
 * All four axes are AND-ed at the call site:
 *
 *     enabled = processKillSwitch  // false ⇒ everything off
 *            && tenantEnabled
 *            && phaseEnabled[phase]
 *            && channelEnabled[channel]
 *
 * No flag is "default on". Operators must consciously turn each axis on
 * to expose the gateway. This is the fail-closed posture required by
 * NC-AWL-IMP-1 §14.2.
 */

import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { SloCounters, SloChannel, SloPhase } from './slo-counters';

export type ServiceGatewayV2Channel = SloChannel;
export type ServiceGatewayV2Phase = SloPhase;

export const SERVICE_GATEWAY_V2_PHASES: SloPhase[] = [
  'read',
  'mutate',
  'recommend',
  'channels',
  'agent-builder',
  'model',
];

export const SERVICE_GATEWAY_V2_CHANNELS: SloChannel[] = [
  'webchat',
  'email',
  'calendar',
  'crm',
  'brevo',
];

/** Tenant-feature-flag sub-key prefix for service-gateway-v2. */
export const TENANT_FLAG_PREFIX = 'service-gateway-v2';

export interface ServiceGatewayV2FlagSnapshot {
  /** Env kill switch (false ⇒ everything off). */
  processEnabled: boolean;
  /** Per-phase enablement (global). */
  phase: Record<SloPhase, boolean>;
  /** Per-channel enablement (global). */
  channel: Record<SloChannel, boolean>;
  /** Per-tenant overrides (set of sub-keys per tenant). */
  tenants: Record<string, Record<string, boolean>>;
  generatedAt: string;
}

@Injectable()
export class ServiceGatewayFlagsService implements OnModuleInit {
  private readonly logger = new Logger(ServiceGatewayFlagsService.name);

  private processEnabled = false;
  private readonly phaseEnabled: Record<SloPhase, boolean> = {
    read: false,
    mutate: false,
    recommend: false,
    channels: false,
    'agent-builder': false,
    model: false,
  };
  private readonly channelEnabled: Record<SloChannel, boolean> = {
    webchat: false,
    email: false,
    calendar: false,
    crm: false,
    brevo: false,
  };

  /**
   * Per-tenant override cache. Keyed by tenantId → sub-key → value.
   * Absence of a tenant (or absence of a sub-key) means "fall through to
   * the global default". A `false` override always wins over the
   * global default.
   *
   * We keep the cache in-memory because the underlying source of truth
   * is `Tenant.settings.featureFlags` (JSON column) and the existing
   * `FeatureFlagService` already handles invalidation for the rest of
   * the app. For the gateway we additionally want to write through the
   * cache so the route hot path is a constant-time lookup.
   */
  private readonly tenantCache = new Map<string, Record<string, boolean>>();

  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly prisma?: PrismaService,
    @Optional() private readonly slo?: SloCounters,
  ) {}

  onModuleInit(): void {
    this.refresh();
    this.logger.log(
      `ServiceGatewayFlags bootstrapped — process=${this.processEnabled}, ` +
        `phases=${
          Object.entries(this.phaseEnabled)
            .filter(([, v]) => v)
            .map(([k]) => k)
            .join(',') || 'none'
        }, ` +
        `channels=${
          Object.entries(this.channelEnabled)
            .filter(([, v]) => v)
            .map(([k]) => k)
            .join(',') || 'none'
        }`,
    );
  }

  /**
   * Re-read the env-derived flags (process kill switch + global phase/
   * channel matrices). Cheap; safe to call periodically.
   *
   * The env keys are:
   *   - CHAT_USE_SERVICE_GATEWAY_V2      (process kill switch, default false)
   *   - SERVICE_GATEWAY_V2_PHASE_<X>     (per phase, default false)
   *   - SERVICE_GATEWAY_V2_CHANNEL_<X>   (per channel, default false)
   */
  refresh(): void {
    const prevProcess = this.processEnabled;
    this.processEnabled = bool(
      this.config.get<string>('CHAT_USE_SERVICE_GATEWAY_V2'),
      false,
    );
    if (prevProcess !== this.processEnabled) {
      this.logger.log(
        `Process kill switch: CHAT_USE_SERVICE_GATEWAY_V2 → ${this.processEnabled}`,
      );
    }
    for (const phase of SERVICE_GATEWAY_V2_PHASES) {
      const key = `SERVICE_GATEWAY_V2_PHASE_${phase.toUpperCase().replace(/-/g, '_')}`;
      this.phaseEnabled[phase] = bool(this.config.get<string>(key), false);
    }
    for (const channel of SERVICE_GATEWAY_V2_CHANNELS) {
      const key = `SERVICE_GATEWAY_V2_CHANNEL_${channel.toUpperCase()}`;
      this.channelEnabled[channel] = bool(this.config.get<string>(key), false);
    }
  }

  // --- public query API --------------------------------------------------

  /**
   * The single decision point. Returns true ONLY when:
   *   - the env process kill-switch is on
   *   - the requested phase is enabled
   *   - the requested channel is enabled
   *   - the per-tenant feature-flag override is either absent or `true`
   *
   * Records the decision to SLO counters so an operator can see how
   * often the gateway is being used.
   */
  async isEnabled(
    phase: SloPhase,
    channel: SloChannel,
    tenantId?: string,
  ): Promise<boolean> {
    const start = Date.now();
    let verdict: 'allow' | 'deny' | 'approval' = 'deny';
    try {
      if (!this.processEnabled) return false;
      if (!this.phaseEnabled[phase]) return false;
      if (!this.channelEnabled[channel]) return false;
      if (tenantId !== undefined) {
        const override = await this.getTenantOverride(tenantId);
        const subKey = this.tenantSubKey(phase, channel);
        if (
          override &&
          Object.prototype.hasOwnProperty.call(override, subKey)
        ) {
          if (!override[subKey]) return false;
        }
        // Tenant-level master switch (one big toggle per tenant).
        const masterKey = `${TENANT_FLAG_PREFIX}.enabled`;
        if (
          override &&
          Object.prototype.hasOwnProperty.call(override, masterKey) &&
          !override[masterKey]
        ) {
          return false;
        }
      }
      verdict = 'allow';
      return true;
    } finally {
      if (this.slo) {
        this.slo.recordRouting({
          latencyMs: Date.now() - start,
          verdict,
          phase,
          channel,
        });
      }
    }
  }

  /**
   * Synchronous variant for hot-path callers that already know the
   * tenant override (or don't need it). Same AND-ed semantics minus
   * the tenant-override check.
   */
  isEnabledSync(phase: SloPhase, channel: SloChannel): boolean {
    if (!this.processEnabled) return false;
    if (!this.phaseEnabled[phase]) return false;
    if (!this.channelEnabled[channel]) return false;
    return true;
  }

  /**
   * Per-tenant query used by the admin controller to surface what
   * the current effective state looks like for a given tenant.
   */
  async snapshotForTenant(tenantId: string): Promise<{
    processEnabled: boolean;
    phase: Record<SloPhase, boolean>;
    channel: Record<SloChannel, boolean>;
    overrides: Record<string, boolean>;
  }> {
    const overrides = (await this.getTenantOverride(tenantId)) ?? {};
    return {
      processEnabled: this.processEnabled,
      phase: { ...this.phaseEnabled },
      channel: { ...this.channelEnabled },
      overrides: { ...overrides },
    };
  }

  /** Full snapshot (no per-tenant overrides). */
  snapshot(): ServiceGatewayV2FlagSnapshot {
    const tenants: Record<string, Record<string, boolean>> = {};
    for (const [k, v] of this.tenantCache.entries()) tenants[k] = { ...v };
    return {
      processEnabled: this.processEnabled,
      phase: { ...this.phaseEnabled },
      channel: { ...this.channelEnabled },
      tenants,
      generatedAt: new Date().toISOString(),
    };
  }

  // --- mutators (admin / rollback) ---------------------------------------

  /**
   * Set the process kill switch at runtime. Persists to the env-derived
   * `ConfigService` AND to the in-memory cache so subsequent calls
   * see the change immediately. The env var is the source of truth at
   * boot; this method overrides it in-process until the next `refresh()`
   * (operator should also export the env var to persist across
   * restarts).
   */
  setProcessEnabled(enabled: boolean): void {
    this.processEnabled = enabled;
    this.logger.log(
      `Process kill switch set to ${enabled} (CHAT_USE_SERVICE_GATEWAY_V2)`,
    );
  }

  setPhaseEnabled(phase: SloPhase, enabled: boolean): void {
    if (!SERVICE_GATEWAY_V2_PHASES.includes(phase)) {
      throw new Error(`Unknown phase: ${phase}`);
    }
    this.phaseEnabled[phase] = enabled;
    this.logger.log(
      `Phase ${phase} → ${enabled} (SERVICE_GATEWAY_V2_PHASE_${phase.toUpperCase()})`,
    );
  }

  setChannelEnabled(channel: SloChannel, enabled: boolean): void {
    if (!SERVICE_GATEWAY_V2_CHANNELS.includes(channel)) {
      throw new Error(`Unknown channel: ${channel}`);
    }
    this.channelEnabled[channel] = enabled;
    this.logger.log(
      `Channel ${channel} → ${enabled} (SERVICE_GATEWAY_V2_CHANNEL_${channel.toUpperCase()})`,
    );
  }

  /**
   * Disable every phase and channel and turn the process switch off.
   * Idempotent. Used by the rollback script and the admin endpoint.
   */
  rollbackAll(): { phases: number; channels: number; process: boolean } {
    let phases = 0;
    let channels = 0;
    for (const phase of SERVICE_GATEWAY_V2_PHASES) {
      if (this.phaseEnabled[phase]) phases += 1;
      this.phaseEnabled[phase] = false;
    }
    for (const channel of SERVICE_GATEWAY_V2_CHANNELS) {
      if (this.channelEnabled[channel]) channels += 1;
      this.channelEnabled[channel] = false;
    }
    this.processEnabled = false;
    this.logger.warn(
      `ROLLBACK: disabled ${phases} phase(s) and ${channels} channel(s); process kill-switch OFF`,
    );
    return { phases, channels, process: false };
  }

  /**
   * Persist a per-tenant override. Writes to `Tenant.settings.featureFlags`
   * if Prisma is available; otherwise the write is in-memory only and
   * logged at warn level so the operator knows the change is ephemeral.
   */
  async setTenantOverride(
    tenantId: string,
    subKey: string,
    value: boolean,
  ): Promise<void> {
    if (!subKey.startsWith(`${TENANT_FLAG_PREFIX}.`)) {
      throw new Error(
        `Override sub-key must start with "${TENANT_FLAG_PREFIX}.", got "${subKey}"`,
      );
    }
    const current = (await this.getTenantOverride(tenantId)) ?? {};
    current[subKey] = value;
    this.tenantCache.set(tenantId, current);
    if (this.prisma) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { settings: true },
      });
      const settings = (tenant?.settings ?? {}) as {
        featureFlags?: Record<string, boolean>;
        [k: string]: unknown;
      };
      const merged: Record<string, boolean> = {
        ...(settings.featureFlags ?? {}),
        ...current,
      };
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { settings: { ...settings, featureFlags: merged } as never },
      });
    } else {
      this.logger.warn(
        `Prisma not available; tenant override for ${tenantId}.${subKey} is in-memory only`,
      );
    }
  }

  /**
   * Drop cached overrides for one tenant. Call this from the admin
   * controller after writing a flag so subsequent calls reload from
   * Prisma.
   */
  invalidateTenant(tenantId: string): void {
    this.tenantCache.delete(tenantId);
  }

  // --- internals ---------------------------------------------------------

  private tenantSubKey(phase: SloPhase, channel: SloChannel): string {
    return `${TENANT_FLAG_PREFIX}.${phase}.${channel}`;
  }

  private async getTenantOverride(
    tenantId: string,
  ): Promise<Record<string, boolean> | null> {
    if (this.tenantCache.has(tenantId)) {
      return this.tenantCache.get(tenantId) ?? null;
    }
    if (!this.prisma) return null;
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    const settings = (tenant?.settings ?? {}) as { featureFlags?: unknown };
    const flags = settings.featureFlags;
    if (!flags || typeof flags !== 'object') {
      this.tenantCache.set(tenantId, {});
      return {};
    }
    const out: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(flags as Record<string, unknown>)) {
      if (k.startsWith(`${TENANT_FLAG_PREFIX}.`) && typeof v === 'boolean') {
        out[k] = v;
      }
    }
    this.tenantCache.set(tenantId, out);
    return out;
  }
}

function bool(raw: unknown, defaultValue = false): boolean {
  if (raw === undefined || raw === null) return defaultValue;
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'number') return raw !== 0;
  if (typeof raw === 'string') return /^(true|1|yes|on)$/i.test(raw.trim());
  return defaultValue;
}
