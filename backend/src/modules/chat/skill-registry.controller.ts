/**
 * Phase 11 — Skill registry HTTP surface.
 *
 * Source plan: IMPLEMENTATION_PLAN_PHASE11.md.
 *
 * The controller is now THIN. It delegates to the runtime
 * `SkillRegistry` service which is the single source of truth for
 * `implemented: true|false` — derived from the fact that every skill
 * in the module IS registered.
 *
 * The static `SKILL_REGISTRY` const that used to live here is GONE.
 * The F-1 integrity violation that declared `implemented: true` for
 * skills that had no handler is closed: the only way a skill can be
 * advertised as implemented is for the SkillRegistryModule to have
 * actually instantiated and registered it at boot.
 */

import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Req,
} from '@nestjs/common';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { SkillRegistry } from '../skill-registry/skill-registry.service';
import type { SkillId } from '../skill-registry/interfaces/skill.interface';

interface JwtPayload {
  sub: string;
  tenantId?: string;
  role: string;
}

interface AuthedRequest {
  user: JwtPayload;
}

export type SkillMode = 'chat' | 'workflow';
export type SkillCategory =
  | 'productivity'
  | 'communication'
  | 'analysis'
  | 'extraction'
  | 'translation'
  | 'generation'
  | 'comparison';

export type SkillInputType = 'text' | 'record' | 'file' | 'thread' | 'selection';
export type SkillOutputType = 'text' | 'json' | 'table' | 'markdown' | 'message';

export interface SkillImplementationRef {
  readonly owner: string;
  readonly endpoint: string;
}

export interface SkillDescriptor {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: SkillCategory;
  readonly modes: ReadonlyArray<SkillMode>;
  readonly supportedIntents: ReadonlyArray<string>;
  readonly inputTypes: ReadonlyArray<SkillInputType>;
  readonly outputTypes: ReadonlyArray<SkillOutputType>;
  readonly version: string;
  readonly certifiedAt: string;
  readonly implemented: boolean;
  readonly implementation: SkillImplementationRef;
  readonly requiresAuthorization: boolean;
}

/**
 * Per-skill display metadata. The `implemented` flag + endpoint
 * reference come from the live registry; everything else comes from
 * this canonical map.
 *
 * A skill present in `SkillRegistryModule` but absent from this map
 * is intentionally surfaced as `implemented: true` but with a generic
 * description — Phase 12 promotes the missing entries here.
 */
const SKILL_METADATA: Record<
  string,
  Omit<SkillDescriptor, 'id' | 'implemented' | 'implementation'>
> = {
  summarize: {
    name: 'Summarize',
    description:
      'Produce a concise summary of a record, thread, or uploaded document while preserving citations.',
    category: 'productivity',
    modes: ['chat', 'workflow'],
    supportedIntents: ['summarize', 'recap', 'tl;dr'],
    inputTypes: ['record', 'thread', 'file', 'text'],
    outputTypes: ['markdown'],
    version: '1.0.0',
    certifiedAt: '2026-08-06',
    requiresAuthorization: true,
  },
  rewrite: {
    name: 'Rewrite',
    description:
      'Rewrite the selected text for clarity, brevity, or tone without changing the meaning.',
    category: 'productivity',
    modes: ['chat', 'workflow'],
    supportedIntents: ['rewrite', 'rephrase', 'polish'],
    inputTypes: ['text', 'selection'],
    outputTypes: ['text'],
    version: '1.0.0',
    certifiedAt: '2026-08-06',
    requiresAuthorization: true,
  },
  translate: {
    name: 'Translate',
    description:
      "Translate text into the user's selected language while preserving entities, dates, and proper nouns.",
    category: 'translation',
    modes: ['chat', 'workflow'],
    supportedIntents: ['translate'],
    inputTypes: ['text', 'selection', 'record'],
    outputTypes: ['text'],
    version: '1.0.0',
    certifiedAt: '2026-08-06',
    requiresAuthorization: true,
  },
  extract: {
    name: 'Extract structured fields',
    description:
      'Extract a typed schema from unstructured text, returning JSON validated against the requested fields.',
    category: 'extraction',
    modes: ['chat', 'workflow'],
    supportedIntents: ['extract', 'parse'],
    inputTypes: ['text', 'record', 'file'],
    outputTypes: ['json'],
    version: '1.0.0',
    certifiedAt: '2026-08-06',
    requiresAuthorization: true,
  },
  compare: {
    name: 'Compare',
    description:
      'Compare two records or files and surface the differences with provenance per claim.',
    category: 'comparison',
    modes: ['chat', 'workflow'],
    supportedIntents: ['compare', 'diff'],
    inputTypes: ['record', 'file', 'text'],
    outputTypes: ['markdown', 'table'],
    version: '1.0.0',
    certifiedAt: '2026-08-06',
    requiresAuthorization: true,
  },
  'draft-report': {
    name: 'Draft report',
    description:
      'Compose a structured report (sections, evidence, recommendations) grounded in tenant data.',
    category: 'generation',
    modes: ['workflow'],
    supportedIntents: ['draft-report'],
    inputTypes: ['record', 'text'],
    outputTypes: ['markdown'],
    version: '0.1.0',
    certifiedAt: '2026-08-06',
    requiresAuthorization: true,
  },
  'draft-email': {
    name: 'Draft email',
    description:
      'Draft an email reply grounded in the source record/thread; sends only after explicit user approval.',
    category: 'communication',
    modes: ['chat', 'workflow'],
    supportedIntents: ['draft-email', 'reply'],
    inputTypes: ['thread', 'record', 'text'],
    outputTypes: ['text', 'message'],
    version: '1.0.0',
    certifiedAt: '2026-08-06',
    requiresAuthorization: true,
  },
  'nl-draft': {
    name: 'NL skill draft',
    description:
      'Generate a typed skill graph from natural language — drafts only, never activates. Operator reviews before saving.',
    category: 'generation',
    modes: ['workflow'],
    supportedIntents: ['nl-draft', 'skill-graph'],
    inputTypes: ['text'],
    outputTypes: ['json'],
    version: '1.0.0',
    certifiedAt: '2026-08-06',
    requiresAuthorization: true,
  },
  segment: {
    name: 'Audience segmentation',
    description: 'Permission-aware segmentation from tenant sources (CR-AI-0801).',
    category: 'analysis',
    modes: ['workflow'],
    supportedIntents: ['segment'],
    inputTypes: ['record', 'text'],
    outputTypes: ['json'],
    version: '1.0.0',
    certifiedAt: '2026-08-07',
    requiresAuthorization: true,
  },
  'campaign-brief': {
    name: 'Campaign brief',
    description:
      'Generate a campaign brief with themes, subject lines, brand voice (CR-AI-0802). Drafts only.',
    category: 'communication',
    modes: ['workflow'],
    supportedIntents: ['campaign-brief'],
    inputTypes: ['text'],
    outputTypes: ['json'],
    version: '1.0.0',
    certifiedAt: '2026-08-07',
    requiresAuthorization: true,
  },
  'case-resolve': {
    name: 'Cited knowledge resolution',
    description: 'Recommend case resolutions with citations (CR-AI-0902).',
    category: 'analysis',
    modes: ['chat', 'workflow'],
    supportedIntents: ['case-resolve'],
    inputTypes: ['thread', 'record', 'text'],
    outputTypes: ['json'],
    version: '1.0.0',
    certifiedAt: '2026-08-07',
    requiresAuthorization: true,
  },
  'case-response': {
    name: 'Case response draft',
    description: 'Draft a customer reply + escalation recommendation (CR-AI-0903). Drafts only.',
    category: 'communication',
    modes: ['chat', 'workflow'],
    supportedIntents: ['case-response', 'reply'],
    inputTypes: ['thread', 'record', 'text'],
    outputTypes: ['text', 'json'],
    version: '1.0.0',
    certifiedAt: '2026-08-07',
    requiresAuthorization: true,
  },
  'crm-event': {
    name: 'CRM event trigger',
    description:
      'CRM/commerce event-triggered workflow skill (CR-AI-1106) — HubSpot / Salesforce / generic webhook.',
    category: 'analysis',
    modes: ['workflow'],
    supportedIntents: ['crm-event', 'trigger'],
    inputTypes: ['text'],
    outputTypes: ['json'],
    version: '1.0.0',
    certifiedAt: '2026-08-07',
    requiresAuthorization: true,
  },
  'crm-webhook': {
    name: 'Generic CRM webhook',
    description: 'Generic CRM webhook with HMAC signature + tenant-scope guard (CR-AI-1106).',
    category: 'analysis',
    modes: ['workflow'],
    supportedIntents: ['crm-webhook'],
    inputTypes: ['text'],
    outputTypes: ['json'],
    version: '1.0.0',
    certifiedAt: '2026-08-07',
    requiresAuthorization: true,
  },
};

@Controller({ path: 'skill-registry', version: '1' })
@ApiCommon('skill-registry')
export class SkillRegistryController {
  constructor(private readonly registry: SkillRegistry) {}

  /**
   * Return the live registry. `implemented` is derived from the
   * runtime registry — only skills that the SkillRegistryModule
   * registered at boot appear with `implemented: true`.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  list(@Req() _req: AuthedRequest): { data: SkillDescriptor[]; total: number } {
    const implemented = new Set<string>(
      this.registry.list().map((s) => s.id as SkillId),
    );
    const data: SkillDescriptor[] = Object.entries(SKILL_METADATA).map(
      ([id, meta]) => ({
        id,
        ...meta,
        implemented: implemented.has(id),
        implementation: {
          owner: 'modules/skill-registry/skill-registry.service:SkillRegistry',
          endpoint: `POST /api/v1/chat/messages (intent=${id})`,
        },
      }),
    );
    return { data, total: data.length };
  }

  @Get('categories')
  @HttpCode(HttpStatus.OK)
  categories(@Req() _req: AuthedRequest): { data: SkillCategory[] } {
    const unique = Array.from(
      new Set(Object.values(SKILL_METADATA).map((s) => s.category)),
    ).sort();
    return { data: unique };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  getOne(
    @Param('id') id: string,
    @Req() _req: AuthedRequest,
  ): SkillDescriptor {
    const meta = SKILL_METADATA[id];
    if (!meta) {
      throw new NotFoundException(`Skill ${id} is not registered`);
    }
    const implemented = this.registry.list().some(
      (s) => (s.id as SkillId) === (id as SkillId),
    );
    return {
      id,
      ...meta,
      implemented,
      implementation: {
        owner: 'modules/skill-registry/skill-registry.service:SkillRegistry',
        endpoint: `POST /api/v1/chat/messages (intent=${id})`,
      },
    };
  }
}
