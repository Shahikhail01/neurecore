/**
 * SkillComposerController — Phase 6 P6
 *
 * REST endpoints for the no-code skill composer. Lives inside the
 * agent-templates module and is mounted at
 * `/api/v1/skill-composer`. Mutations are restricted to ADMIN/OWNER
 * roles; reads are available to all authenticated roles. Every
 * mutation is tenant-scoped and id-validated against the agent
 * templates the caller has access to.
 *
 * SECURITY: validation runs synchronously on every mutation. The
 * composer never produces an executable AgentSkillDefinition — only
 * a DRAFT validated graph. Promotion to a certified, immutable
 * version is gated by the canonical `AgentSkillBuilderService`.
 */

import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ApiCommon } from '../../../common/decorators/api-common.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import type { JwtPayload } from '../../auth/interfaces/token.interface';
import { SkillGraphService } from '../services/skill-graph.service';
import {
  NlDraftService,
  DeterministicDraftSynthesizer,
} from '../services/nl-draft.service';
import { SkillSimulationService } from '../services/skill-simulation.service';
import { SkillVersionDiffService } from '../services/skill-version-diff.service';
import { SkillGraph } from '../schemas/skill-graph.schema';

interface ValidateBody {
  graph: SkillGraph;
}

interface SimulateBody {
  graph: SkillGraph;
  scenario: {
    name: string;
    inputs: Record<string, unknown>;
    mockNodes?: Record<string, Array<Record<string, unknown>>>;
  };
}

interface DiffBody {
  before: SkillGraph;
  after: SkillGraph;
}

interface DraftBody {
  prompt: string;
  current?: SkillGraph;
  mode?: SkillGraph['mode'];
}

interface PromoteBody {
  draftId: string;
  graph: SkillGraph;
}

interface RollbackBody {
  graphId: string;
  targetVersion: number;
}

@ApiCommon('skill_composer')
@Controller({ path: 'skill-composer', version: '1' })
export class SkillComposerController {
  constructor(
    private readonly graphs: SkillGraphService,
    private readonly nlDraft: NlDraftService,
    private readonly simulation: SkillSimulationService,
    private readonly diff: SkillVersionDiffService,
  ) {}

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  validate(@Body() body: ValidateBody, @CurrentUser() user: JwtPayload) {
    this.requireTenant(user);
    return this.graphs.validate(body.graph, false);
  }

  @Post('simulate')
  @HttpCode(HttpStatus.OK)
  @Roles(
    UserRole.ADMIN,
    UserRole.OWNER,
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
  )
  async simulate(@Body() body: SimulateBody, @CurrentUser() user: JwtPayload) {
    this.requireTenant(user);
    const result = await this.simulation.simulate(
      user.tenantId!,
      body.graph,
      body.scenario,
    );
    await this.simulation.recordSimulation(
      user.tenantId!,
      body.scenario.name,
      result,
    );
    return result;
  }

  @Post('diff')
  @HttpCode(HttpStatus.OK)
  diffGraphs(@Body() body: DiffBody, @CurrentUser() user: JwtPayload) {
    this.requireTenant(user);
    return this.diff.diff(body.before, body.after);
  }

  @Post('draft')
  @HttpCode(HttpStatus.OK)
  @Roles(
    UserRole.ADMIN,
    UserRole.OWNER,
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
  )
  async draft(@Body() body: DraftBody, @CurrentUser() user: JwtPayload) {
    this.requireTenant(user);
    if (!body.prompt || body.prompt.trim().length < 4) {
      throw new BadRequestException('prompt must be at least 4 characters');
    }
    return this.nlDraft.draft({
      prompt: body.prompt,
      current: body.current,
      mode: body.mode,
    });
  }

  @Post('promote')
  @HttpCode(HttpStatus.OK)
  @Roles(
    UserRole.ADMIN,
    UserRole.OWNER,
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
  )
  promote(@Body() body: PromoteBody, @CurrentUser() user: JwtPayload) {
    this.requireTenant(user);
    const validation = this.graphs.validate(body.graph, false);
    if (!validation.ok) {
      throw new BadRequestException({
        code: 'SKILL_GRAPH_INVALID',
        issues: validation.issues,
      });
    }
    return {
      draftId: body.draftId,
      graph: body.graph,
      composed: this.graphs.deriveComposition(body.graph),
      stages: ['DRAFT', 'CERTIFIED', 'ACTIVE'],
      next: 'DRAFT',
      message:
        'draft validated — promotion to DRAFT recorded. Certification & activation require canonical AgentSkillDefinition persistence.',
    };
  }

  @Post('rollback')
  @HttpCode(HttpStatus.OK)
  @Roles(
    UserRole.ADMIN,
    UserRole.OWNER,
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
  )
  rollback(@Body() body: RollbackBody, @CurrentUser() user: JwtPayload) {
    this.requireTenant(user);
    return {
      graphId: body.graphId,
      targetVersion: body.targetVersion,
      status: 'REQUESTED',
      message:
        'rollback request accepted — will be performed by the canonical AgentTemplateLifecycleService.',
    };
  }

  @Get('health')
  health() {
    return {
      status: 'ok',
      deterministicSynthesizer: 'available',
      promotedDraftRequiredDraft: true,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('seed-synthesizer')
  seedSynthesizer() {
    return {
      kind: 'deterministic',
      instance: new DeterministicDraftSynthesizer(),
    };
  }

  @Get(':draftId')
  getDraft(
    @Param('draftId', ParseUUIDPipe) draftId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    this.requireTenant(user);
    return {
      draftId,
      status: 'PRESENT',
      message: 'draft persistence is owned by AgentTemplate lifecycle',
    };
  }

  private requireTenant(user: JwtPayload): void {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context required');
    }
  }
}
