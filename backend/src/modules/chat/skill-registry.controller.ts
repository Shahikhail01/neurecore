import { Controller, Get, HttpCode, HttpStatus, NotFoundException, Param, Req } from '@nestjs/common';
import { ApiCommon } from '../../common/decorators/api-common.decorator';

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
  /** Backend service that owns the runtime execution path. */
  owner: string;
  /** Endpoint or method id the chat service calls to dispatch the skill. */
  endpoint: string;
}

export interface SkillDescriptor {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  modes: SkillMode[];
  supportedIntents: string[];
  inputTypes: SkillInputType[];
  outputTypes: SkillOutputType[];
  version: string;
  certifiedAt: string;
  implemented: boolean;
  implementation: SkillImplementationRef;
  /** Authorisation notes for the FE — the runtime re-checks every time. */
  requiresAuthorization: boolean;
}

/**
 * Skill registry — P1 of the Creatio AI parity plan.
 *
 * The registry is the canonical read surface for the FE skill catalog. The
 * "implemented" flag distinguishes:
 *
 *  - real, production-certified skills whose owner service is a registered
 *    Work Runtime / agent path; and
 *  - declared-but-not-yet-implemented skills that the FE can advertise but
 *    must mark as `implemented: false` (so the UI does not offer a "Use"
 *    button that would 404 / fake-success).
 *
 * The P−1 integrity rule forbids a stub from ever returning success. The
 * `implemented` flag is therefore the typed, machine-checkable contract that
 * the FE honours: when false, the composer disables invocation but still
 * shows the card so the user can see what is coming.
 */
const SKILL_REGISTRY: readonly SkillDescriptor[] = [
  {
    id: 'summarize',
    name: 'Summarize',
    description:
      'Produce a concise summary of a record, thread, or uploaded document while preserving citations.',
    category: 'productivity',
    modes: ['chat', 'workflow'],
    supportedIntents: ['summarize', 'recap', 'tl;dr'],
    inputTypes: ['record', 'thread', 'file', 'text'],
    outputTypes: ['markdown'],
    version: '1.0.0',
    certifiedAt: '2026-08-02',
    implemented: true,
    implementation: {
      owner: 'modules/chat/chat.service:ChatService',
      endpoint: 'POST /api/v1/chat/messages (intent=summarize)',
    },
    requiresAuthorization: true,
  },
  {
    id: 'rewrite',
    name: 'Rewrite',
    description: 'Rewrite the selected text for clarity, brevity, or tone without changing the meaning.',
    category: 'productivity',
    modes: ['chat', 'workflow'],
    supportedIntents: ['rewrite', 'rephrase', 'polish'],
    inputTypes: ['text', 'selection'],
    outputTypes: ['text'],
    version: '1.0.0',
    certifiedAt: '2026-08-02',
    implemented: true,
    implementation: {
      owner: 'modules/chat/chat.service:ChatService',
      endpoint: 'POST /api/v1/chat/messages (intent=rewrite)',
    },
    requiresAuthorization: true,
  },
  {
    id: 'translate',
    name: 'Translate',
    description:
      'Translate text into the user\'s selected language while preserving entities, dates, and proper nouns.',
    category: 'translation',
    modes: ['chat', 'workflow'],
    supportedIntents: ['translate'],
    inputTypes: ['text', 'selection', 'record'],
    outputTypes: ['text'],
    version: '1.0.0',
    certifiedAt: '2026-08-02',
    implemented: true,
    implementation: {
      owner: 'modules/chat/chat.service:ChatService',
      endpoint: 'POST /api/v1/chat/messages (intent=translate)',
    },
    requiresAuthorization: true,
  },
  {
    id: 'extract',
    name: 'Extract structured fields',
    description:
      'Extract a typed schema from unstructured text, returning JSON validated against the requested fields.',
    category: 'extraction',
    modes: ['chat', 'workflow'],
    supportedIntents: ['extract', 'parse'],
    inputTypes: ['text', 'record', 'file'],
    outputTypes: ['json'],
    version: '1.0.0',
    certifiedAt: '2026-08-02',
    implemented: true,
    implementation: {
      owner: 'modules/chat/chat.service:ChatService',
      endpoint: 'POST /api/v1/chat/messages (intent=extract)',
    },
    requiresAuthorization: true,
  },
  {
    id: 'compare',
    name: 'Compare',
    description: 'Compare two records or files and surface the differences with provenance per claim.',
    category: 'comparison',
    modes: ['chat', 'workflow'],
    supportedIntents: ['compare', 'diff'],
    inputTypes: ['record', 'file', 'text'],
    outputTypes: ['markdown', 'table'],
    version: '1.0.0',
    certifiedAt: '2026-08-02',
    implemented: true,
    implementation: {
      owner: 'modules/chat/chat.service:ChatService',
      endpoint: 'POST /api/v1/chat/messages (intent=compare)',
    },
    requiresAuthorization: true,
  },
  {
    id: 'draft-report',
    name: 'Draft report',
    description: 'Compose a structured report (sections, evidence, recommendations) grounded in tenant data.',
    category: 'generation',
    modes: ['workflow'],
    supportedIntents: ['draft-report'],
    inputTypes: ['record', 'text'],
    outputTypes: ['markdown'],
    version: '0.1.0',
    certifiedAt: '2026-08-02',
    implemented: false,
    implementation: {
      owner: 'modules/chat/chat.service:ChatService',
      endpoint: 'POST /api/v1/chat/messages (intent=draft-report) — planned',
    },
    requiresAuthorization: true,
  },
  {
    id: 'draft-email',
    name: 'Draft email',
    description:
      'Draft an email reply grounded in the source record/thread; sends only after explicit user approval.',
    category: 'communication',
    modes: ['chat', 'workflow'],
    supportedIntents: ['draft-email', 'reply'],
    inputTypes: ['thread', 'record', 'text'],
    outputTypes: ['text', 'message'],
    version: '1.0.0',
    certifiedAt: '2026-08-02',
    implemented: true,
    implementation: {
      owner: 'modules/chat/chat.service:ChatService',
      endpoint: 'POST /api/v1/chat/messages (intent=draft-email)',
    },
    requiresAuthorization: true,
  },
] as const;

@Controller({ path: 'skill-registry', version: '1' })
@ApiCommon('skill-registry')
export class SkillRegistryController {
  @Get()
  @HttpCode(HttpStatus.OK)
  list(@Req() _req: AuthedRequest): { data: SkillDescriptor[]; total: number } {
    return { data: [...SKILL_REGISTRY], total: SKILL_REGISTRY.length };
  }

  @Get('categories')
  @HttpCode(HttpStatus.OK)
  categories(@Req() _req: AuthedRequest): { data: SkillCategory[] } {
    const unique = Array.from(new Set(SKILL_REGISTRY.map((s) => s.category))).sort();
    return { data: unique };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  getOne(@Param('id') id: string, @Req() _req: AuthedRequest): SkillDescriptor {
    const skill = SKILL_REGISTRY.find((s) => s.id === id);
    if (!skill) {
      throw new NotFoundException(`Skill ${id} is not registered`);
    }
    return skill;
  }
}
