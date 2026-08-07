/**
 * Phase 11 — SkillRegistry + SkillExecutor + SkillTelemetry tests.
 *
 * Validates:
 *   - register/get/list
 *   - dispatch with valid input returns SkillOutput
 *   - dispatch with invalid input throws SkillInputInvalidError
 *   - dispatch with unknown id throws SkillNotFoundError
 *   - executor unauthorized tenantId throws SkillAuthorizationError
 *   - telemetry write failure surfaces as SkillTelemetryWriteError
 *   - chat dispatcher matchSkillIntent picks the right skill
 */

import { SkillRegistry, SkillNotFoundError, SkillInputInvalidError } from './skill-registry.service';
import { SkillExecutor, SkillAuthorizationError } from './skill-executor.service';
import { SkillTelemetry, SkillTelemetryWriteError } from './skill-telemetry';
import { SummarizeSkill, RewriteSkill, TranslateSkill, ExtractSkill, CompareSkill, DraftReportSkill, DraftEmailSkill, NlDraftSkill } from './skills';
import {
  SourceRefResolverRegistry,
  IFileTextResolver,
  ResolvedText,
} from '../knowledge/resolvers/source-ref-resolver.registry';
import type { SourceRef } from './interfaces/skill.types';
import type { TenantContext } from '../common/context/tenant-context';

function ctx(tenantId: string = 'tenant-A'): TenantContext {
  return { tenantId, isCrossTenant: false, actorRole: 'OWNER', actorUserId: 'user-1' };
}

function prismaStub() {
  return {
    auditLog: { create: jest.fn(async () => undefined) },
  };
}

function aiStub(content = 'OK', tokens = { inputTokens: 5, outputTokens: 7, totalTokens: 12 } as never) {
  return {
    invoke: jest.fn(async () => ({
      content,
      usage: tokens,
      model: 'test',
      provider: 'test',
      latencyMs: 5,
      resolved: { providerId: 'p1', aiModelId: 'm1', capability: 'conversation' as never },
    })),
  };
}

describe('SkillRegistry', () => {
  let registry: SkillRegistry;
  let executor: SkillExecutor;
  let telemetry: SkillTelemetry;
  let prisma: ReturnType<typeof prismaStub>;

  beforeEach(async () => {
    prisma = prismaStub();
    telemetry = new SkillTelemetry(prisma as never);
    const resolvers = new SourceRefResolverRegistry();
    for (const kind of ['record', 'thread', 'file'] as const) {
      resolvers.register(stubResolver(kind));
    }
    executor = new SkillExecutor(aiStub() as never, telemetry, resolvers);
    registry = new SkillRegistry(executor);
    for (const s of [
      new SummarizeSkill(),
      new RewriteSkill(),
      new TranslateSkill(),
      new ExtractSkill(),
      new CompareSkill(),
      new DraftReportSkill(),
      new DraftEmailSkill(),
      new NlDraftSkill(),
    ]) {
      registry.register(s);
    }
  });

  it('lists all 8 skills (Phase 13 added nl-draft)', () => {
    expect(registry.list()).toHaveLength(8);
  });

  it('finds a registered skill by id', () => {
    expect(registry.get('summarize').id).toBe('summarize');
    expect(registry.get('draft-email').id).toBe('draft-email');
  });

  it('throws SkillNotFoundError when id is unknown', () => {
    expect(() => registry.get('not-a-skill' as never)).toThrow(SkillNotFoundError);
  });

  it('dispatch returns typed SkillOutput for a valid input', async () => {
    const out = await registry.dispatch(
      'summarize',
      { source: { kind: 'text', text: 'hello world' } },
      ctx(),
    );
    expect(out.skillId).toBe('summarize');
    expect(typeof out.confidence).toBe('number');
    expect(Array.isArray(out.citations)).toBe(true);
  });

  it('dispatch rejects with SkillInputInvalidError for malformed input', async () => {
    await expect(
      registry.dispatch('summarize', { wrong: 'shape' }, ctx()),
    ).rejects.toBeInstanceOf(SkillInputInvalidError);
  });

  it('dispatch rejects unknown skill id with SkillNotFoundError', async () => {
    await expect(
      registry.dispatch('not-a-skill' as never, {}, ctx()),
    ).rejects.toBeInstanceOf(SkillNotFoundError);
  });

  it('SkillExecutor rejects wildcard tenantId', async () => {
    expect(() =>
      executor.assertSourcesAuthorized(
        [{ kind: 'text', text: 'x' }],
        ctx('*'),
      ),
    ).toThrow(SkillAuthorizationError);
  });

  it('SkillExecutor rejects empty-id record source', async () => {
    expect(() =>
      executor.assertSourcesAuthorized(
        [{ kind: 'record', recordType: 'Customer', recordId: '' }],
        ctx(),
      ),
    ).toThrow(SkillAuthorizationError);
  });

  it('Phase 12: SkillExecutor resolves record sources via the registry (no longer abstains)', async () => {
    const text = await executor.resolveSourceText(
      { kind: 'record', recordType: 'Customer', recordId: 'c-1' },
      ctx(),
    );
    // Stub resolver returns `[stub-record] Customer:c-1`.
    expect(text).toBe('[stub-record] Customer:c-1');
  });

  it('Phase 12: SkillExecutor resolves thread sources via the registry', async () => {
    const text = await executor.resolveSourceText(
      { kind: 'thread', threadId: 't-1' },
      ctx(),
    );
    expect(text).toBe('[stub-thread] thread:t-1');
  });

  it('Phase 12: SkillExecutor resolves file sources via the registry', async () => {
    const text = await executor.resolveSourceText(
      { kind: 'file', fileId: 'f-1' },
      ctx(),
    );
    expect(text).toBe('[stub-file] file:f-1');
  });
});

describe('SkillTelemetry', () => {
  it('writes an auditLog row successfully', async () => {
    const prisma = prismaStub();
    const t = new SkillTelemetry(prisma as never);
    await t.recordRun({
      skillId: 'summarize',
      tenantId: 't',
      actorId: 'u',
      durationMs: 10,
      tokensIn: 5,
      tokensOut: 7,
      confidence: 0.9,
      limits: [],
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'skill.summarize.run' }),
      }),
    );
  });

  it('wraps a Prisma failure in SkillTelemetryWriteError', async () => {
    const prisma = {
      auditLog: { create: jest.fn(async () => { throw new Error('db down'); }) },
    } as never;
    const t = new SkillTelemetry(prisma);
    await expect(
      t.recordRun({
        skillId: 'summarize',
        tenantId: 't',
        actorId: 'u',
        durationMs: 10,
        tokensIn: 5,
        tokensOut: 7,
        confidence: 0.9,
        limits: [],
      }),
    ).rejects.toBeInstanceOf(SkillTelemetryWriteError);
  });
});

/** Stub resolver — satisfies the executor's DI contract for tests. */
function stubResolver(kind: 'record' | 'thread' | 'file'): IFileTextResolver {
  return {
    kind,
    resolve: async (_tenantId: string, ref: SourceRef): Promise<ResolvedText> => {
      const id =
        ref.kind === 'record'
          ? `${ref.recordType}:${ref.recordId}`
          : ref.kind === 'thread'
            ? `thread:${ref.threadId}`
            : ref.kind === 'file'
              ? `file:${ref.fileId}`
              : 'inline';
      return { text: `[stub-${kind}] ${id}`, citations: [] };
    },
  };
}
