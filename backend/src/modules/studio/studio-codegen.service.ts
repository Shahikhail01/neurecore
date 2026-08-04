/**
 * Studio Codegen — AI-Driven Development.
 *
 * Source plan: creatio-ai-parity-implementation-plan-v2.md §5.13.6/7/8.
 *
 * Solid:
 *   • SRP — only the codegen business rules. The LLM call is
 *     delegated to Phase 1.2's LLM Registry.
 *   • OCP — adding a new prompt-to-X target = new branch in
 *     `runCodegen`. The schema validation lives next to the target.
 *   • DRY — every codegen job persists the same shape (prompt, output,
 *     validation, status) so dashboards can render uniformly.
 */

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  StudioCodegenKind,
  StudioCodegenStatus,
  StudioPromptKind,
} from '@prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';

/**
 * OOB_PROMPT_TEMPLATES — the canonical prompt library. Adding a new
 * template = new row; no other file changes.
 *
 * Every template has:
 *   - a system prompt body,
 *   - an output schema (validated by the codegen service),
 *   - a risk tier consumed by the HITL policy engine.
 */
export const OOB_PROMPT_TEMPLATES: ReadonlyArray<{
  kind: StudioPromptKind;
  slug: string;
  displayName: string;
  body: string;
  outputSchema: Record<string, unknown>;
  riskTier: number;
}> = [
  {
    kind: StudioPromptKind.PromptToApp,
    slug: 'prompt-to-app',
    displayName: 'Prompt → App',
    body:
      'You are an app architect. Given a goal, produce a JSON manifest for a Business Studio app. ' +
      'Return ONLY valid JSON of the form: {"displayName": string, "pages": [{slug, displayName, kind}], ' +
      '"processes": [{slug, displayName, kind}], "dataModels": [{slug, displayName, fields: ' +
      '[{name, type}]}]}. Do not invent pages outside the user goal.',
    outputSchema: {
      displayName: { type: 'string', required: true },
      pages: { type: 'array', required: true },
      processes: { type: 'array', required: false },
      dataModels: { type: 'array', required: false },
    },
    riskTier: 2,
  },
  {
    kind: StudioPromptKind.PromptToPage,
    slug: 'prompt-to-page',
    displayName: 'Prompt → Page',
    body:
      'You are a UI designer. Given a goal, produce a JSON layout for a Studio page. ' +
      'Return ONLY valid JSON of the form: {"blocks": [{type, props}], "dataBindings": [...]}. ' +
      'Use only the component kinds: panel, kpi, table, form, chart, button.',
    outputSchema: {
      blocks: { type: 'array', required: true },
      dataBindings: { type: 'array', required: false },
    },
    riskTier: 1,
  },
  {
    kind: StudioPromptKind.PromptToProcess,
    slug: 'prompt-to-process',
    displayName: 'Prompt → Process',
    body:
      'You are a process modeller. Given a goal, produce a JSON process definition. ' +
      'Return ONLY valid JSON of the form: {"steps": [{name, type, next}], "triggers": [...]}. ' +
      'Use step types: action, decision, approval, sub-process.',
    outputSchema: {
      steps: { type: 'array', required: true },
      triggers: { type: 'array', required: false },
    },
    riskTier: 2,
  },
  {
    kind: StudioPromptKind.PromptToDataModel,
    slug: 'prompt-to-data-model',
    displayName: 'Prompt → Data Model',
    body:
      'You are a data modeller. Given a goal, produce a JSON data-model spec. ' +
      'Return ONLY valid JSON of the form: {"slug", "displayName", "fields": [{name, type, required}]}. ' +
      'Use field types: string, number, boolean, date, json.',
    outputSchema: {
      slug: { type: 'string', required: true },
      displayName: { type: 'string', required: true },
      fields: { type: 'array', required: true },
    },
    riskTier: 1,
  },
];

@Injectable()
export class StudioCodegenService {
  private readonly logger = new Logger(StudioCodegenService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Catalog ──────────────────────────────────────────────────────

  listTemplates(): ReadonlyArray<(typeof OOB_PROMPT_TEMPLATES)[number]> {
    return OOB_PROMPT_TEMPLATES;
  }

  // ─── Jobs ──────────────────────────────────────────────────────────

  async enqueueJob(args: {
    tenantId: string;
    appId: string;
    kind: StudioCodegenKind;
    prompt: string;
    createdBy: string;
  }) {
    if (!args.tenantId || args.tenantId === '*') {
      throw new ForbiddenException('tenantId "*" is forbidden');
    }
    const app = await this.prisma.studioApp.findUnique({
      where: { id: args.appId },
    });
    if (!app) throw new NotFoundException(`app ${args.appId} not found`);
    if (app.tenantId !== args.tenantId) {
      throw new ForbiddenException('app belongs to a different tenant');
    }
    return this.prisma.studioCodegenJob.create({
      data: {
        tenantId: args.tenantId,
        appId: args.appId,
        kind: args.kind,
        prompt: args.prompt,
        createdBy: args.createdBy,
        status: StudioCodegenStatus.PENDING,
      },
    });
  }

  async listJobs(tenantId: string, appId?: string) {
    if (!tenantId || tenantId === '*') {
      throw new ForbiddenException('tenantId "*" is forbidden');
    }
    return this.prisma.studioCodegenJob.findMany({
      where: {
        tenantId,
        ...(appId ? { appId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async findJob(tenantId: string, id: string) {
    if (!tenantId || tenantId === '*') {
      throw new ForbiddenException('tenantId "*" is forbidden');
    }
    const job = await this.prisma.studioCodegenJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException(`job ${id} not found`);
    if (job.tenantId !== tenantId) {
      throw new ForbiddenException('job belongs to a different tenant');
    }
    return job;
  }

  /**
   * The codegen runner.
   *
   * Phase 6.1 ships the deterministic stub: the same prompt + same
   * template produce the same well-typed output via a deterministic
   * schema-driven renderer (see `renderStub`). When Phase 6.5 wires
   * the LLM Registry the LLM call replaces the stub at exactly this
   * method (open/closed).
   */
  /**
   * Map a StudioCodegenKind (job) to its StudioPromptKind (template).
   * The two Prisma enums intentionally carry different literal strings
   * (PROMPT_TO_APP vs PromptToApp) — this mapping is the single
   * canonical bridge between them.
   */
  private static readonly CODEGEN_TO_PROMPT: Record<StudioCodegenKind, StudioPromptKind> = {
    [StudioCodegenKind.PROMPT_TO_APP]: StudioPromptKind.PromptToApp,
    [StudioCodegenKind.PROMPT_TO_PAGE]: StudioPromptKind.PromptToPage,
    [StudioCodegenKind.PROMPT_TO_PROCESS]: StudioPromptKind.PromptToProcess,
    [StudioCodegenKind.PROMPT_TO_DATA_MODEL]: StudioPromptKind.PromptToDataModel,
  };

  async runJob(tenantId: string, id: string) {
    const job = await this.findJob(tenantId, id);
    const template = OOB_PROMPT_TEMPLATES.find(
      (t) => t.kind === StudioCodegenService.CODEGEN_TO_PROMPT[job.kind],
    );
    if (!template) {
      await this.markFailed(id, `no template registered for kind ${job.kind}`);
      throw new BadRequestException(`no template for kind ${job.kind}`);
    }
    await this.prisma.studioCodegenJob.update({
      where: { id },
      data: { status: StudioCodegenStatus.RUNNING, startedAt: new Date() },
    });
    const output = this.renderStub(job.kind, job.prompt);
    const validation = this.validateAgainstSchema(template.outputSchema, output);
    if (!validation.ok) {
      await this.prisma.studioCodegenJob.update({
        where: { id },
        data: {
          status: StudioCodegenStatus.REJECTED,
          finishedAt: new Date(),
          output: output as Prisma.InputJsonValue,
          validation: validation as Prisma.InputJsonValue,
        },
      });
      return;
    }
    await this.prisma.studioCodegenJob.update({
      where: { id },
      data: {
        status: StudioCodegenStatus.SUCCEEDED,
        finishedAt: new Date(),
        output: output as Prisma.InputJsonValue,
        validation: validation as Prisma.InputJsonValue,
      },
    });
  }

  private async markFailed(id: string, message: string) {
    await this.prisma.studioCodegenJob.update({
      where: { id },
      data: {
        status: StudioCodegenStatus.FAILED,
        finishedAt: new Date(),
        errorMessage: message,
      },
    });
  }

  /**
   * Deterministic stub that produces a well-typed manifest from the
   * prompt. Replaced by the LLM-backed implementation once Phase 6.5
   * wires the LLM Registry.
   */
  private renderStub(
    kind: StudioCodegenKind,
    prompt: string,
  ): Record<string, unknown> {
    const slugify = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'untitled';

    switch (kind) {
      case StudioCodegenKind.PROMPT_TO_APP:
        return {
          displayName: prompt.split('\n')[0]?.trim() || 'Untitled App',
          pages: [
            {
              slug: slugify(prompt),
              displayName: 'List',
              kind: 'LIST',
            },
          ],
          processes: [],
          dataModels: [],
        };
      case StudioCodegenKind.PROMPT_TO_PAGE:
        return {
          blocks: [{ type: 'panel', props: { title: prompt } }],
          dataBindings: [],
        };
      case StudioCodegenKind.PROMPT_TO_PROCESS:
        return {
          steps: [
            { name: 'start', type: 'action', next: 'end' },
            { name: 'end', type: 'action', next: null },
          ],
          triggers: [],
        };
      case StudioCodegenKind.PROMPT_TO_DATA_MODEL:
        return {
          slug: slugify(prompt),
          displayName: prompt.split('\n')[0]?.trim() || 'Untitled',
          fields: [
            { name: 'id', type: 'string', required: true },
            { name: 'name', type: 'string', required: true },
            { name: 'createdAt', type: 'date', required: false },
          ],
        };
      default:
        return {};
    }
  }

  private validateAgainstSchema(
    schema: Record<string, unknown>,
    output: Record<string, unknown>,
  ): { ok: boolean; missing: string[]; extra: string[] } {
    const required = Object.entries(schema)
      .filter(([, def]) => (def as { required?: boolean }).required)
      .map(([k]) => k);
    const missing = required.filter((k) => !(k in output));
    const extra = Object.keys(output).filter((k) => !(k in schema));
    return { ok: missing.length === 0, missing, extra };
  }
}
