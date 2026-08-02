/**
 * Phase 8 (NC-AWL-IMP-1 §11.3) — service-gateway-v2 rollout tests.
 *
 * These tests cover the four kill-switch axes:
 *   1. Process kill switch honors `CHAT_USE_SERVICE_GATEWAY_V2`
 *   2. Per-tenant override disable returns false (after the write
 *      round-trips through the in-memory cache)
 *   3. SLO counters return non-zero numbers after at least one
 *      observation
 *   4. The rollback script exists and is executable
 *
 * No database / Redis fixture is used. The flags service and the SLO
 * counters both have in-memory modes that are fully exercised here.
 */

import { ConfigService } from '@nestjs/config';
import { ServiceGatewayFlagsService } from './service-gateway-flags';
import { SloCounters } from './slo-counters';
import { existsSync, statSync } from 'fs';
import { join } from 'path';

function makeFlags(
  env: Record<string, string | undefined> = {},
): ServiceGatewayFlagsService {
  const merged: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) {
    if (v !== undefined) merged[k] = v;
  }
  const config = {
    get: (key: string) => merged[key],
  } as unknown as ConfigService;
  return new ServiceGatewayFlagsService(config, undefined, undefined);
}

describe('ServiceGatewayFlagsService (Phase 8 rollout)', () => {
  describe('process kill switch (CHAT_USE_SERVICE_GATEWAY_V2)', () => {
    it('defaults to OFF when the env var is unset', async () => {
      const flags = makeFlags();
      flags.refresh();
      expect(flags.isEnabledSync('read', 'webchat')).toBe(false);
      await expect(flags.isEnabled('read', 'webchat')).resolves.toBe(false);
    });

    it('honors CHAT_USE_SERVICE_GATEWAY_V2=true', async () => {
      const flags = makeFlags({ CHAT_USE_SERVICE_GATEWAY_V2: 'true' });
      flags.refresh();
      // Phase + channel defaults are still off — process alone is not
      // enough to enable the gateway.
      expect(flags.isEnabledSync('read', 'webchat')).toBe(false);
      flags.setPhaseEnabled('read', true);
      flags.setChannelEnabled('webchat', true);
      expect(flags.isEnabledSync('read', 'webchat')).toBe(true);
      await expect(flags.isEnabled('read', 'webchat')).resolves.toBe(true);
    });

    it('honors CHAT_USE_SERVICE_GATEWAY_V2=false explicitly', async () => {
      const flags = makeFlags({ CHAT_USE_SERVICE_GATEWAY_V2: 'false' });
      flags.refresh();
      flags.setPhaseEnabled('read', true);
      flags.setChannelEnabled('webchat', true);
      // Process is off → everything is off, even if phase/channel are on.
      expect(flags.isEnabledSync('read', 'webchat')).toBe(false);
    });

    it('accepts "1" / "yes" / "on" as truthy', async () => {
      for (const truthy of ['1', 'yes', 'on', 'TRUE', 'Yes']) {
        const flags = makeFlags({ CHAT_USE_SERVICE_GATEWAY_V2: truthy });
        flags.refresh();
        flags.setPhaseEnabled('read', true);
        flags.setChannelEnabled('webchat', true);
        expect(flags.isEnabledSync('read', 'webchat')).toBe(true);
      }
    });
  });

  describe('phase / channel axes', () => {
    it('phase is OFF by default', () => {
      const flags = makeFlags({ CHAT_USE_SERVICE_GATEWAY_V2: 'true' });
      flags.refresh();
      expect(flags.isEnabledSync('mutate', 'webchat')).toBe(false);
    });

    it('channel is OFF by default', () => {
      const flags = makeFlags({ CHAT_USE_SERVICE_GATEWAY_V2: 'true' });
      flags.refresh();
      flags.setPhaseEnabled('mutate', true);
      expect(flags.isEnabledSync('mutate', 'brevo')).toBe(false);
    });

    it('can be toggled per phase at runtime', () => {
      const flags = makeFlags({ CHAT_USE_SERVICE_GATEWAY_V2: 'true' });
      flags.refresh();
      flags.setChannelEnabled('webchat', true);
      expect(flags.isEnabledSync('read', 'webchat')).toBe(false);
      flags.setPhaseEnabled('read', true);
      expect(flags.isEnabledSync('read', 'webchat')).toBe(true);
      flags.setPhaseEnabled('read', false);
      expect(flags.isEnabledSync('read', 'webchat')).toBe(false);
    });

    it('can be toggled per channel at runtime', () => {
      const flags = makeFlags({ CHAT_USE_SERVICE_GATEWAY_V2: 'true' });
      flags.refresh();
      flags.setPhaseEnabled('read', true);
      expect(flags.isEnabledSync('read', 'email')).toBe(false);
      flags.setChannelEnabled('email', true);
      expect(flags.isEnabledSync('read', 'email')).toBe(true);
    });
  });

  describe('rollback', () => {
    it('disables every phase, every channel, and the process switch', () => {
      const flags = makeFlags({ CHAT_USE_SERVICE_GATEWAY_V2: 'true' });
      flags.refresh();
      flags.setPhaseEnabled('read', true);
      flags.setPhaseEnabled('mutate', true);
      flags.setChannelEnabled('webchat', true);
      flags.setChannelEnabled('email', true);

      const summary = flags.rollbackAll();
      expect(summary).toEqual({ phases: 2, channels: 2, process: false });

      const snap = flags.snapshot();
      expect(snap.processEnabled).toBe(false);
      for (const v of Object.values(snap.phase)) expect(v).toBe(false);
      for (const v of Object.values(snap.channel)) expect(v).toBe(false);
    });

    it('is idempotent (second call reports zero changes)', () => {
      const flags = makeFlags();
      flags.refresh();
      flags.rollbackAll();
      const second = flags.rollbackAll();
      expect(second).toEqual({ phases: 0, channels: 0, process: false });
    });
  });

  describe('tenant override', () => {
    it('disable returns false after a per-tenant override', async () => {
      const flags = makeFlags({ CHAT_USE_SERVICE_GATEWAY_V2: 'true' });
      flags.refresh();
      flags.setPhaseEnabled('read', true);
      flags.setChannelEnabled('webchat', true);
      // No Prisma available — setTenantOverride logs a warn and keeps
      // the override in memory. Read the flag back without invalidating
      // the cache so the override is still visible.
      await flags.setTenantOverride(
        'tenant-a',
        'service-gateway-v2.enabled',
        false,
      );
      const result = await flags.isEnabled('read', 'webchat', 'tenant-a');
      expect(result).toBe(false);
    });
  });

  describe('SLO counters', () => {
    it('return non-zero counters after at least one observation', async () => {
      const slo = new SloCounters();
      slo.recordRouting({
        latencyMs: 12,
        verdict: 'allow',
        phase: 'read',
        channel: 'webchat',
      });
      slo.recordRouting({
        latencyMs: 18,
        verdict: 'deny',
        phase: 'mutate',
        channel: 'email',
      });
      slo.recordRouting({
        latencyMs: 24,
        verdict: 'approval',
        phase: 'recommend',
        channel: 'webchat',
      });
      slo.recordDuplicateEffect();
      slo.recordRecovery(150);
      // Wait for the mutex chain to drain (mutations are async).
      await new Promise((r) => setImmediate(r));
      const snap = slo.snapshot();
      expect(snap.routingTotal).toBe(3);
      expect(snap.denials).toBe(1);
      expect(snap.approvalsRequired).toBe(1);
      expect(snap.duplicateEffects).toBe(1);
      expect(snap.recoveries).toBe(1);
      expect(snap.recoveryTimeMsTotal).toBe(150);
      expect(snap.denialRate).toBeCloseTo(1 / 3);
      expect(snap.approvalRate).toBeCloseTo(1 / 3);
      expect(snap.byPhase.read.total).toBe(1);
      expect(snap.byPhase.mutate.denials).toBe(1);
      expect(snap.byChannel.email.denials).toBe(1);
      expect(snap.byChannel.webchat.approvals).toBe(1);
      // Latency p95 over [12, 18, 24] sorted is 24; nearest-rank p95
      // is index floor(0.95 * 3) = 2 → 24.
      expect(snap.latencyP95Ms).toBe(24);
    });

    it('aggregated snapshot works without Redis', async () => {
      const slo = new SloCounters();
      slo.recordRouting({ latencyMs: 5, verdict: 'allow' });
      await new Promise((r) => setImmediate(r));
      const snap = await slo.aggregatedSnapshot();
      expect(snap.routingTotal).toBe(1);
      expect(snap.redisMirrored).toBe(false);
    });
  });

  describe('rollback.sh', () => {
    const SCRIPT = join(__dirname, 'rollback.sh');

    it('exists', () => {
      expect(existsSync(SCRIPT)).toBe(true);
    });

    it('is executable', () => {
      const st = statSync(SCRIPT);
      // Owner-execute bit (0o100). The script must be runnable.
      expect(st.mode & 0o100).toBeGreaterThan(0);
    });
  });
});
