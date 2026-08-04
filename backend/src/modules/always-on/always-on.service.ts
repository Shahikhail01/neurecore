/**
 * Always-on CRM — Capability Matrix + Tenant Configuration.
 *
 * Source plan: creatio-ai-parity-implementation-plan-v2.md §5.12.
 *
 * Three surfaces:
 *   • Freedom UI: tenant-configurable list of UI capabilities.
 *   • Productivity Tools: tenant-configurable list of embedded productivity
 *     integrations (Outlook, Teams, Zoom, Calendar) and their status.
 *   • Conversational CRM: NL command plane — every chat / Twin invocation
 *     is "conversational CRM"; the surface is the wiring.
 *
 * Solid:
 *   • SRP — capability matrix only. NL parsing / chat logic lives in
 *     chat/ and ai-twin/.
 *   • OCP — adding a new capability = new entry; no other code changes.
 *   • Single source of truth — capability IDs are stable strings so the
 *     audit log can reference them.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';

/**
 * CapabilityId — the stable identifier of an Always-on capability.
 * Every capability ships with id, label, domain, requiresScopes, defaultOn.
 */
export interface AlwaysOnCapability {
  id: string;
  label: string;
  domain: 'freedom-ui' | 'productivity' | 'conversational';
  // Scopes required for the capability to be enabled.
  requiredScopes: ReadonlyArray<string>;
  // Whether the capability is enabled by default for a new tenant.
  defaultOn: boolean;
}

/**
 * OOB_ALWAYS_ON_CAPABILITIES — the single canonical list. Adding a
 * capability = new entry; no other file changes.
 */
export const OOB_ALWAYS_ON_CAPABILITIES: ReadonlyArray<AlwaysOnCapability> = [
  // ─── Freedom UI (§5.12.1) ───────────────────────────────────────
  {
    id: 'ui.list-view',
    label: 'List view (sortable, filterable, paginated)',
    domain: 'freedom-ui',
    requiredScopes: ['ui.read'],
    defaultOn: true,
  },
  {
    id: 'ui.detail-view',
    label: 'Detail view with inline edit',
    domain: 'freedom-ui',
    requiredScopes: ['ui.read', 'ui.write'],
    defaultOn: true,
  },
  {
    id: 'ui.form-view',
    label: 'Form view with validation + autosave',
    domain: 'freedom-ui',
    requiredScopes: ['ui.write'],
    defaultOn: true,
  },
  {
    id: 'ui.dashboard',
    label: 'Dashboard with KPI tiles + charts',
    domain: 'freedom-ui',
    requiredScopes: ['ui.read', 'analytics.read'],
    defaultOn: true,
  },
  // ─── Productivity tools (§5.12.2) ──────────────────────────────
  {
    id: 'outlook.embed',
    label: 'Outlook inbox + calendar embed',
    domain: 'productivity',
    requiredScopes: ['mail.read', 'calendar.read'],
    defaultOn: false,
  },
  {
    id: 'teams.embed',
    label: 'Microsoft Teams embed',
    domain: 'productivity',
    requiredScopes: ['chat.read'],
    defaultOn: false,
  },
  {
    id: 'zoom.embed',
    label: 'Zoom meeting embed',
    domain: 'productivity',
    requiredScopes: ['calendar.read'],
    defaultOn: false,
  },
  {
    id: 'calendar.embed',
    label: 'Unified calendar embed',
    domain: 'productivity',
    requiredScopes: ['calendar.read', 'calendar.write'],
    defaultOn: false,
  },
  // ─── Conversational CRM (§5.12.3) ─────────────────────────────
  {
    id: 'nl.create',
    label: 'Natural-language create (e.g. "new deal for Acme")',
    domain: 'conversational',
    requiredScopes: ['nl.invoke', 'crm.write'],
    defaultOn: true,
  },
  {
    id: 'nl.update',
    label: 'Natural-language update ("mark Acme as closed-won")',
    domain: 'conversational',
    requiredScopes: ['nl.invoke', 'crm.write'],
    defaultOn: true,
  },
  {
    id: 'nl.search',
    label: 'Natural-language search ("show me Q3 deals > $100k")',
    domain: 'conversational',
    requiredScopes: ['nl.invoke', 'crm.read'],
    defaultOn: true,
  },
  {
    id: 'nl.summarise',
    label: 'Natural-language summarise ("give me the Acme weekly recap")',
    domain: 'conversational',
    requiredScopes: ['nl.invoke', 'crm.read'],
    defaultOn: true,
  },
];

/**
 * Surface status — a tenant's effective Always-on CRM configuration.
 */
export interface AlwaysOnSurface {
  freedomUi: Array<{ capabilityId: string; enabled: boolean }>;
  productivity: Array<{ capabilityId: string; enabled: boolean }>;
  conversational: Array<{ capabilityId: string; enabled: boolean }>;
}

/**
 * Per-tenant override lives as a TenantFeatureFlag (Phase 0 already
 * ships feature-flag service). We don't duplicate that table; we
 * compose it.
 */
@Injectable()
export class AlwaysOnService {
  private readonly logger = new Logger(AlwaysOnService.name);

  constructor(private readonly prisma: PrismaService) {}

  listCatalog(): ReadonlyArray<AlwaysOnCapability> {
    return OOB_ALWAYS_ON_CAPABILITIES;
  }

  /**
   * Effective tenant surface. Combines the OOB catalog with the
   * tenant-specific overrides from the feature-flag table.
   *
   * This service is the single source of truth for "what is enabled
   * for this tenant right now". The frontend reads /always-on/surface
   * and renders the Freedom UI + Productivity + Conversational tabs
   * from the response.
   */
  async getSurface(tenantId: string): Promise<AlwaysOnSurface> {
    // If the tenant row has no overrides, every default-on capability
    // is enabled. Override rows flip the bit per capability id.
    const overrides = await this.prisma.tenantFeatureFlagOverride.findMany({
      where: { tenantId, flagKey: { startsWith: 'always-on.' } },
    });
    const overrideMap = new Map<string, boolean>();
    for (const o of overrides) {
      const capId = o.flagKey.replace(/^always-on\./, '');
      overrideMap.set(capId, o.enabled);
    }

    const resolve = (cap: AlwaysOnCapability) => {
      if (overrideMap.has(cap.id)) {
        return { capabilityId: cap.id, enabled: overrideMap.get(cap.id)! };
      }
      return { capabilityId: cap.id, enabled: cap.defaultOn };
    };

    return {
      freedomUi: OOB_ALWAYS_ON_CAPABILITIES
        .filter((c) => c.domain === 'freedom-ui')
        .map(resolve),
      productivity: OOB_ALWAYS_ON_CAPABILITIES
        .filter((c) => c.domain === 'productivity')
        .map(resolve),
      conversational: OOB_ALWAYS_ON_CAPABILITIES
        .filter((c) => c.domain === 'conversational')
        .map(resolve),
    };
  }

  async setCapabilityEnabled(args: {
    tenantId: string;
    capabilityId: string;
    enabled: boolean;
  }): Promise<void> {
    const cap = OOB_ALWAYS_ON_CAPABILITIES.find((c) => c.id === args.capabilityId);
    if (!cap) {
      throw new Error(`unknown capability ${args.capabilityId}`);
    }
    await this.prisma.tenantFeatureFlagOverride.upsert({
      where: {
        tenantId_flagKey: { tenantId: args.tenantId, flagKey: `always-on.${args.capabilityId}` },
      },
      create: {
        tenantId: args.tenantId,
        flagKey: `always-on.${args.capabilityId}`,
        enabled: args.enabled,
        setByActorId: 'system',
      },
      update: { enabled: args.enabled },
    });
  }
}
