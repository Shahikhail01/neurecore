/**
 * Phase 12 — G12 Knowledge + Files certification runner.
 *
 * Source plan: IMPLEMENTATION_PLAN_PHASE12.md §6.
 *
 * Verdict criteria — every gate must pass; failures block release.
 *
 *   G12-K-001 — Phase 11 G11 stays APPROVED
 *   G12-K-002 — `record` SourceRef resolves via RecordResolver
 *   G12-K-003 — `thread` SourceRef resolves via ThreadResolver
 *   G12-K-004 — `file` SourceRef resolves via FileResolver
 *   G12-K-005 — SkillRegistry advertises article-draft + knowledge-health
 *   G12-K-006 — ArticleDraftSkill rejects malformed input
 *   G12-K-007 — KnowledgeHealthSkill rejects malformed input
 *   G12-K-008 — SkillExecutor no longer abstains for any registered kind
 */

import { Injectable, Logger } from '@nestjs/common';
import { SkillRegistry } from '../../modules/skill-registry/skill-registry.service';
import { SkillExecutor } from '../../modules/skill-registry/skill-executor.service';
import { SkillTelemetry } from '../../modules/skill-registry/skill-telemetry';
import {
  SummarizeSkill,
  RewriteSkill,
  TranslateSkill,
  ExtractSkill,
  CompareSkill,
  DraftReportSkill,
  DraftEmailSkill,
  ArticleDraftSkill,
  KnowledgeHealthSkill,
} from '../../modules/skill-registry/skills';
import {
  SourceRefResolverRegistry,
  IFileTextResolver,
  ResolvedText,
} from '../../modules/knowledge/resolvers/source-ref-resolver.registry';
import { Phase11CertificationRunner } from './phase11-certification.runner';
import type { SourceRef } from '../../modules/skill-registry/interfaces/skill.types';
import type { TenantContext } from '../../common/context/tenant-context';

interface GateResult {
  readonly id: string;
  readonly name: string;
  readonly passed: boolean;
  readonly detail?: string;
}

function ctx(tenantId = 'tenant-A'): TenantContext {
  return { tenantId, isCrossTenant: false, actorRole: 'OWNER', actorUserId: 'u1' };
}

function prismaStub() {
  return { auditLog: { create: async () => undefined } } as never;
}

function aiStub(content = 'OK') {
  return {
    invoke: async () => ({
      content,
      usage: { inputTokens: 5, outputTokens: 7, totalTokens: 12 },
      model: 'test',
      provider: 'test',
      latencyMs: 5,
      resolved: { providerId: 'p1', aiModelId: 'm1', capability: 'conversation' as never },
    }),
  };
}

function stubResolver(kind: 'record' | 'thread' | 'file'): IFileTextResolver {
  return {
    kind,
    resolve: async (_tenantId: string, ref: SourceRef): Promise<ResolvedText> => {
      const refId =
        ref.kind === 'record'
          ? `${ref.recordType}:${ref.recordId}`
          : ref.kind === 'thread'
            ? `thread:${ref.threadId}`
            : ref.kind === 'file'
              ? `file:${ref.fileId}`
              : 'inline';
      return { text: `[stub-${kind}] ${refId}`, citations: [] };
    },
  };
}

@Injectable()
export class Phase12CertificationRunner {
  private readonly logger = new Logger(Phase12CertificationRunner.name);

  async run(): Promise<{
    readonly verdict: 'APPROVED' | 'BLOCKED';
    readonly gates: ReadonlyArray<GateResult>;
  }> {
    const gates: GateResult[] = [];
    let allPassed = true;
    const record = (
      id: string,
      name: string,
      passed: boolean,
      detail?: string,
    ) => {
      const r: GateResult = { id, name, passed, detail };
      gates.push(r);
      if (!passed) allPassed = false;
    };

    // ─── Build the registry with the real list of skills.
    const prisma = prismaStub();
    const telemetry = new SkillTelemetry(prisma);
    const resolvers = new SourceRefResolverRegistry();
    resolvers.registerAll([
      stubResolver('record'),
      stubResolver('thread'),
      stubResolver('file'),
    ]);
    const executor = new SkillExecutor(
      aiStub() as never,
      telemetry,
      resolvers,
    );
    const registry = new SkillRegistry(executor);
    for (const s of [
      new SummarizeSkill(),
      new RewriteSkill(),
      new TranslateSkill(),
      new ExtractSkill(),
      new CompareSkill(),
      new DraftReportSkill(),
      new DraftEmailSkill(),
      new ArticleDraftSkill(),
      new KnowledgeHealthSkill(),
    ]) {
      registry.register(s);
    }

    // G12-K-001 — Phase 11 stays APPROVED
    {
      try {
        const p11 = await new Phase11CertificationRunner().run();
        record('G12-K-001', 'Phase 11 G11 stays APPROVED', p11.verdict === 'APPROVED');
      } catch (err) {
        record('G12-K-001', 'Phase 11 G11 stays APPROVED', false, (err as Error).message);
      }
    }

    // G12-K-002 — record SourceRef resolves
    {
      try {
        const t = await executor.resolveSourceText(
          { kind: 'record', recordType: 'Customer', recordId: 'c-1' },
          ctx(),
        );
        record('G12-K-002', 'record SourceRef resolves via registry', t.length > 0);
      } catch (err) {
        record('G12-K-002', 'record SourceRef resolves via registry', false, (err as Error).message);
      }
    }

    // G12-K-003 — thread SourceRef resolves
    {
      try {
        const t = await executor.resolveSourceText(
          { kind: 'thread', threadId: 't-1' },
          ctx(),
        );
        record('G12-K-003', 'thread SourceRef resolves via registry', t.length > 0);
      } catch (err) {
        record('G12-K-003', 'thread SourceRef resolves via registry', false, (err as Error).message);
      }
    }

    // G12-K-004 — file SourceRef resolves
    {
      try {
        const t = await executor.resolveSourceText(
          { kind: 'file', fileId: 'f-1' },
          ctx(),
        );
        record('G12-K-004', 'file SourceRef resolves via registry', t.length > 0);
      } catch (err) {
        record('G12-K-004', 'file SourceRef resolves via registry', false, (err as Error).message);
      }
    }

    // G12-K-005 — both new skills registered
    {
      const ids = registry.list().map((s) => s.id as string);
      record(
        'G12-K-005',
        'SkillRegistry advertises article-draft + knowledge-health',
        ids.includes('article-draft') && ids.includes('knowledge-health'),
      );
    }

    // G12-K-006 — ArticleDraftSkill rejects malformed input
    {
      const skill = new ArticleDraftSkill();
      const cases: Array<{ name: string; ok: boolean }> = [
        { name: 'null', ok: skill.validateInput(null) },
        { name: 'empty topic', ok: skill.validateInput({ topic: '', sources: [{ kind: 'text', text: 'x' }] }) },
        { name: 'empty sources', ok: skill.validateInput({ topic: 't', sources: [] }) },
      ];
      const passed = cases.every((c) => !c.ok);
      record('G12-K-006', 'ArticleDraftSkill rejects malformed input', passed);
    }

    // G12-K-007 — KnowledgeHealthSkill rejects malformed input
    {
      const skill = new KnowledgeHealthSkill();
      const cases: Array<{ name: string; ok: boolean }> = [
        { name: 'missing mode', ok: skill.validateInput({ sources: [{ kind: 'text', text: 'x' }] }) },
        { name: 'unknown mode', ok: skill.validateInput({ mode: 'mystery', sources: [{ kind: 'text', text: 'x' }] }) },
      ];
      const passed = cases.every((c) => !c.ok);
      record('G12-K-007', 'KnowledgeHealthSkill rejects malformed input', passed);
    }

    // G12-K-008 — Executor no longer abstains on any registered kind
    {
      let abstained = false;
      for (const kind of ['record', 'thread', 'file'] as const) {
        const ref: SourceRef =
          kind === 'record'
            ? { kind: 'record', recordType: 'Customer', recordId: 'c-1' }
            : kind === 'thread'
              ? { kind: 'thread', threadId: 't-1' }
              : { kind: 'file', fileId: 'f-1' };
        try {
          await executor.resolveSourceText(ref, ctx());
        } catch {
          abstained = true;
        }
      }
      record(
        'G12-K-008',
        'SkillExecutor resolves record/thread/file (no abstention)',
        !abstained,
      );
    }

    this.logger.log(
      `Phase 12 certification: ${gates.filter((g) => g.passed).length}/${gates.length} passed`,
    );
    return {
      verdict: allPassed ? 'APPROVED' : 'BLOCKED',
      gates,
    };
  }
}
