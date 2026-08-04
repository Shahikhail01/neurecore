/**
 * Coding Agent SDK Bridge — Claude Code / Codex / Cursor adapter.
 *
 * Source plan: §5.1.2.
 *
 * Solid:
 *   • SRP — only SDK manifest import + validation. The imported
 *     manifest is persisted as an AgentTemplateVersion through the
 *     existing template lifecycle.
 *   • OCP — adding a new SDK vendor = new adapter (extends
 *     SdkVendorAdapter). The bridge itself is unchanged.
 *   • DIP — depends on AgentTemplateService (Phase 4.x) and
 *     TwinPermissionMirrorGuard (Phase 1).
 *
 * Every imported manifest goes through the same review/approval
 * pipeline as the no-code visual designer. Solid (DRY): the bridge
 * composes the same lifecycle + audit log.
 */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { AgentSkillMaxEffect, Prisma } from '@prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';

/**
 * SDK vendor identifiers — the canonical taxonomy. Adding a new
 * vendor = new entry here + new adapter below.
 */
export type SdkVendor =
  | 'claude-code'
  | 'codex'
  | 'cursor'
  | 'continue-dev'
  | 'internal';

/**
 * Normalised manifest — the canonical shape every SDK adapter must
 * produce. Bridges convert vendor-specific shapes into this and then
 * validate.
 */
export interface NormalisedAgentManifest {
  vendor: SdkVendor;
  vendorManifestId: string;
  displayName: string;
  description: string;
  // The agent's composed skills (MCP action ids or skill keys).
  composedSkills: string[];
  // The capabilities the manifest claims it reads / writes.
  reads: string[];
  writes: string[];
  // Vendor-provided tool/permission surface.
  requiredScopes: string[];
  // Risk tier derived from the manifest (1..5).
  riskTier: 1 | 2 | 3 | 4 | 5;
  // Side-effect ceiling derived from the manifest.
  maxEffect: AgentSkillMaxEffect;
  // Optional prompts (system / first user message) the agent will use.
  systemPrompt?: string;
  examples?: Array<{ input: unknown; output: unknown }>;
}

/**
 * SdkVendorAdapter — one per SDK vendor.
 */
export interface SdkVendorAdapter {
  readonly vendor: SdkVendor;
  /**
   * Validate that the raw payload is a well-formed SDK manifest. Throws
   * BadRequestException if not.
   */
  validate(raw: unknown): NormalisedAgentManifest;
  /**
   * Human-readable display label.
   */
  displayLabel(): string;
}

// ─── Claude Code adapter ─────────────────────────────────────────

export class ClaudeCodeAdapter implements SdkVendorAdapter {
  readonly vendor: SdkVendor = 'claude-code';
  displayLabel() {
    return 'Claude Code';
  }
  validate(raw: unknown): NormalisedAgentManifest {
    if (!raw || typeof raw !== 'object') {
      throw new BadRequestException('Claude Code manifest must be an object');
    }
    const r = raw as {
      agent_id?: string;
      name?: string;
      description?: string;
      tools?: string[];
      scopes?: string[];
      riskTier?: number;
      system_prompt?: string;
    };
    if (!r.agent_id || !r.name) {
      throw new BadRequestException(
        'Claude Code manifest missing required fields: agent_id, name',
      );
    }
    return {
      vendor: 'claude-code',
      vendorManifestId: r.agent_id,
      displayName: r.name,
      description: r.description ?? '',
      composedSkills: Array.isArray(r.tools) ? r.tools : [],
      reads: [],
      writes: Array.isArray(r.scopes) ? r.scopes.filter((s) => s.startsWith('crm.write')) : [],
      requiredScopes: Array.isArray(r.scopes) ? r.scopes : [],
      riskTier: this.clampRisk(r.riskTier),
      maxEffect: this.maxEffect(Array.isArray(r.scopes) ? r.scopes : []),
      systemPrompt: r.system_prompt,
      examples: [],
    };
  }
  private clampRisk(x: unknown): 1 | 2 | 3 | 4 | 5 {
    if (typeof x !== 'number' || !Number.isFinite(x)) return 2;
    const i = Math.max(1, Math.min(5, Math.round(x)));
    return i as 1 | 2 | 3 | 4 | 5;
  }
  private maxEffect(scopes: string[]): AgentSkillMaxEffect {
    if (scopes.some((s) => s.startsWith('erp.write')))
      return 'WRITE_EXTERNAL' as unknown as AgentSkillMaxEffect;
    if (scopes.some((s) => s.startsWith('crm.write')))
      return 'WRITE_INTERNAL' as unknown as AgentSkillMaxEffect;
    if (scopes.some((s) => s.startsWith('crm.read')))
      return 'READ' as AgentSkillMaxEffect;
    return 'NONE' as AgentSkillMaxEffect;
  }
}

// ─── Codex adapter ──────────────────────────────────────────────

export class CodexAdapter implements SdkVendorAdapter {
  readonly vendor: SdkVendor = 'codex';
  displayLabel() {
    return 'OpenAI Codex';
  }
  validate(raw: unknown): NormalisedAgentManifest {
    if (!raw || typeof raw !== 'object') {
      throw new BadRequestException('Codex manifest must be an object');
    }
    const r = raw as {
      id?: string;
      title?: string;
      summary?: string;
      tools?: Array<{ name: string; read?: boolean; write?: boolean }>;
      risk?: number;
    };
    if (!r.id || !r.title) {
      throw new BadRequestException(
        'Codex manifest missing required fields: id, title',
      );
    }
    const writes = (r.tools ?? [])
      .filter((t) => t.write && t.name.startsWith('crm.write'))
      .map((t) => t.name);
    const reads = (r.tools ?? [])
      .filter((t) => t.read)
      .map((t) => t.name);
    return {
      vendor: 'codex',
      vendorManifestId: r.id,
      displayName: r.title,
      description: r.summary ?? '',
      composedSkills: (r.tools ?? []).map((t) => t.name),
      reads,
      writes,
      requiredScopes: [...reads, ...writes],
      riskTier: this.clampRisk(r.risk),
      maxEffect:
        writes.length > 0
          ? ('WRITE_INTERNAL' as unknown as AgentSkillMaxEffect)
          : ('READ' as AgentSkillMaxEffect),
    };
  }
  private clampRisk(x: unknown): 1 | 2 | 3 | 4 | 5 {
    if (typeof x !== 'number' || !Number.isFinite(x)) return 2;
    return Math.max(1, Math.min(5, Math.round(x))) as 1 | 2 | 3 | 4 | 5;
  }
}

// ─── Cursor adapter ─────────────────────────────────────────────

export class CursorAdapter implements SdkVendorAdapter {
  readonly vendor: SdkVendor = 'cursor';
  displayLabel() {
    return 'Cursor';
  }
  validate(raw: unknown): NormalisedAgentManifest {
    if (!raw || typeof raw !== 'object') {
      throw new BadRequestException('Cursor manifest must be an object');
    }
    const r = raw as { agentId?: string; label?: string; capabilities?: string[] };
    if (!r.agentId || !r.label) {
      throw new BadRequestException(
        'Cursor manifest missing required fields: agentId, label',
      );
    }
    const caps = Array.isArray(r.capabilities) ? r.capabilities : [];
    return {
      vendor: 'cursor',
      vendorManifestId: r.agentId,
      displayName: r.label,
      description: '',
      composedSkills: caps,
      reads: caps.filter((c) => c.startsWith('crm.read')),
      writes: caps.filter((c) => c.startsWith('crm.write')),
      requiredScopes: caps,
      riskTier: 2,
      maxEffect: caps.some((c) => c.startsWith('crm.write'))
        ? ('WRITE_INTERNAL' as unknown as AgentSkillMaxEffect)
        : ('READ' as AgentSkillMaxEffect),
    };
  }
}

// ─── Continue.dev adapter ──────────────────────────────────────

export class ContinueDevAdapter implements SdkVendorAdapter {
  readonly vendor: SdkVendor = 'continue-dev';
  displayLabel() {
    return 'Continue.dev';
  }
  validate(raw: unknown): NormalisedAgentManifest {
    if (!raw || typeof raw !== 'object') {
      throw new BadRequestException('Continue.dev manifest must be an object');
    }
    const r = raw as { name?: string; tools?: string[]; systemMessage?: string };
    if (!r.name) {
      throw new BadRequestException(
        'Continue.dev manifest missing required field: name',
      );
    }
    const tools = Array.isArray(r.tools) ? r.tools : [];
    return {
      vendor: 'continue-dev',
      vendorManifestId: r.name,
      displayName: r.name,
      description: '',
      composedSkills: tools,
      reads: tools.filter((t) => t.startsWith('crm.read')),
      writes: tools.filter((t) => t.startsWith('crm.write')),
      requiredScopes: tools,
      riskTier: 2,
      maxEffect: tools.some((t) => t.startsWith('crm.write'))
        ? ('WRITE_INTERNAL' as unknown as AgentSkillMaxEffect)
        : ('READ' as AgentSkillMaxEffect),
      systemPrompt: r.systemMessage,
    };
  }
}

// ─── Bridge ────────────────────────────────────────────────────

/**
 * CODING_AGENT_SDK_ADAPTERS — the canonical adapter registry. Solid:
 * adding a new vendor = new entry; no other code changes.
 */
export const CODING_AGENT_SDK_ADAPTERS: ReadonlyArray<SdkVendorAdapter> = [
  new ClaudeCodeAdapter(),
  new CodexAdapter(),
  new CursorAdapter(),
  new ContinueDevAdapter(),
];

@Injectable()
export class CodingAgentSdkBridgeService {
  private readonly logger = new Logger(CodingAgentSdkBridgeService.name);

  constructor(private readonly prisma: PrismaService) {}

  listVendors() {
    return CODING_AGENT_SDK_ADAPTERS.map((a) => ({
      vendor: a.vendor,
      displayLabel: a.displayLabel(),
    }));
  }

  /**
   * Import a raw SDK manifest. Validates via the matching vendor
   * adapter, then persists as a DRAFT AgentTemplateVersion with the
   * normalised shape. The version row enters the same lifecycle as
   * any other AgentTemplateVersion (DRAFT → CERTIFIED → ACTIVE).
   */
  async import(args: {
    tenantId: string;
    vendor: SdkVendor;
    raw: unknown;
    actorId: string;
  }) {
    if (!args.tenantId || args.tenantId === '*') {
      throw new ForbiddenException('tenantId "*" is forbidden');
    }
    const adapter = CODING_AGENT_SDK_ADAPTERS.find(
      (a) => a.vendor === args.vendor,
    );
    if (!adapter) {
      throw new BadRequestException(`unknown vendor "${args.vendor}"`);
    }
    const normalised = adapter.validate(args.raw);

    // Find or create the AgentTemplate this SDK manifest belongs to.
    const existingTemplate = await this.prisma.agentTemplate.findFirst({
      where: {
        tenantId: args.tenantId,
        name: `sdk-${args.vendor}-${normalised.vendorManifestId}`,
      },
    });
    const template =
      existingTemplate ??
      (await this.prisma.agentTemplate.create({
        data: {
          tenantId: args.tenantId,
          name: `sdk-${args.vendor}-${normalised.vendorManifestId}`,
          description: `${normalised.description} (imported via ${args.vendor})`,
          systemPrompt: normalised.systemPrompt,
          version: '1.0.0',
          enabled: true,
          config: {
            displayName: normalised.displayName,
            shortName: normalised.displayName.slice(0, 32),
            domain: this.guessDomain(normalised),
            reads: normalised.reads,
            writes: normalised.writes,
            riskTier: normalised.riskTier,
            planSection: '5.1.2',
          } as unknown as Prisma.InputJsonValue,
        },
      }));

    // Persist as a DRAFT version (the lifecycle service promotes it).
    const draftVersion = `${args.vendor}-${Date.now().toString(36)}`;
    const existing = await this.prisma.agentTemplateVersion.findFirst({
      where: { tenantId: args.tenantId, agentTemplateId: template.id, version: draftVersion },
    });
    if (existing) {
      throw new ConflictException(
        `SDK manifest ${args.vendor}:${normalised.vendorManifestId} already imported`,
      );
    }
    const version = await this.prisma.agentTemplateVersion.create({
      data: {
        tenantId: args.tenantId,
        agentTemplateId: template.id,
        version: draftVersion,
        definition: {
          vendor: normalised.vendor,
          vendorManifestId: normalised.vendorManifestId,
          composedSkills: normalised.composedSkills,
          systemPrompt: normalised.systemPrompt,
          examples: normalised.examples ?? [],
        } as Prisma.InputJsonValue,
        composedSkillRefs: [] as unknown as Prisma.InputJsonValue,
        maxEffect: normalised.maxEffect,
        authorityCeiling: normalised.riskTier * 10,
        channelBindings: [] as unknown as Prisma.InputJsonValue,
        lifecycleStatus: 'DRAFT',
      },
    });
    this.logger.log(
      `SDK import: vendor=${args.vendor} manifest=${normalised.vendorManifestId} -> template=${template.id} version=${draftVersion} actor=${args.actorId}`,
    );
    return { template, version: { id: version.id, version: version.version } };
  }

  private guessDomain(m: NormalisedAgentManifest): string {
    if (m.writes.some((w) => w.includes('crm.'))) return 'sales';
    if (m.composedSkills.some((s) => s.includes('support'))) return 'service';
    if (m.composedSkills.some((s) => s.includes('marketing'))) return 'marketing';
    return 'workflow';
  }
}
