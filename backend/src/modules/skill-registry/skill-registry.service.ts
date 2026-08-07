/**
 * Phase 11 — SkillRegistry.
 *
 * Source plan: IMPLEMENTATION_PLAN_PHASE11.md §5.
 *
 * Owns ONLY the registry surface (list / get / dispatch).
 * Implementations live in skill-registry/skills/*.skill.ts.
 *
 * SRP:
 *   - Validates inputs (declared by each skill's input schema).
 *   - Routes to the matching skill's `execute()`.
 *   - Aggregates validation, dispatch, telemetry, citations.
 *
 * DIP:
 *   - Skill implementations are injected via the multi-provider
 *     `Map<SkillId, ISkill>` so the executor is registered separately
 *     from the skill code.
 *
 * INTEGRITY RULE (P−1 derived):
 *   - The `SkillRegistryImplementsFlag` regression guard in
 *     src/test/certification/architecture.spec.ts verifies that
 *     every skill with `implemented: true` has a real handler here.
 *     Falsely-declared implementations fail CI.
 */

import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { TenantContext } from '../../common/context/tenant-context';
import { SkillExecutor } from './skill-executor.service';
import type { ISkill, SkillId } from './interfaces/skill.interface';
import { SourceRef } from './interfaces/skill.types';

export class SkillNotFoundError extends Error {
  constructor(readonly id: string) {
    super(`skill ${id} is not registered`);
    this.name = 'SkillNotFoundError';
  }
}

export class SkillInputInvalidError extends Error {
  constructor(
    readonly skillId: string,
    readonly issues: ReadonlyArray<string>,
  ) {
    super(`skill ${skillId} input invalid: ${issues.join('; ')}`);
    this.name = 'SkillInputInvalidError';
  }
}

@Injectable()
export class SkillRegistry {
  private readonly logger = new Logger(SkillRegistry.name);
  private readonly skills = new Map<SkillId, ISkill<unknown, unknown>>();

  /**
   * Register a skill. Called from the module constructor with the
   * hard-coded skill set. User-defined skills (Phase 6 surface)
   * register through a different codepath that does not pass
   * through here.
   */
  register(skill: ISkill<unknown, unknown>): void {
    this.skills.set(skill.id, skill);
    this.logger.log(`registered skill ${skill.id} (${skill.displayName})`);
  }

  /** Snapshot — used by the FE skill catalog endpoint. */
  list(): ReadonlyArray<ISkill<unknown, unknown>> {
    return Array.from(this.skills.values());
  }

  /** Read by id — throws SkillNotFoundError when missing. */
  get(id: SkillId): ISkill<unknown, unknown> {
    const skill = this.skills.get(id);
    if (!skill) throw new SkillNotFoundError(id);
    return skill;
  }

  /**
   * Validate-and-dispatch.
   *
   * Step 1: validate input via the skill's Zod-like guard.
   * Step 2: tenant context check (delegates to the executor).
   * Step 3: delegate to `SkillExecutor.invokeSkill` which composes the
   *         prompt, invokes the model, parses, attaches citations.
   * Step 4: return the result.
   *
   * Throws SkillNotFoundError / SkillInputInvalidError /
   * SkillAuthorizationError (re-exported via SkillExecutor).
   */
  async dispatch<I, O>(
    id: SkillId,
    input: unknown,
    ctx: TenantContext,
  ): Promise<{ skillId: SkillId; content: O; citations: ReadonlyArray<unknown>; confidence: number; durationMs: number }> {
    const skill = this.get(id);
    if (!skill.validateInput(input)) {
      throw new SkillInputInvalidError(id, [
        `input failed ${id} schema validation`,
      ]);
    }
    // Build the typed prompt and hand it to the executor.
    const built = skill.buildPrompt(input as I, ctx);
    const result = await this.executor.invokeSkill<O>(
      built.prompt,
      ctx,
      built.options,
    );
    return {
      skillId: result.skillId as SkillId,
      content: result.content,
      citations: result.citations,
      confidence: result.confidence,
      durationMs: result.durationMs,
    };
  }

  /** Executor dependency injected via constructor parameter. */
  constructor(private readonly executor: SkillExecutor) {}

  /**
   * Re-export for callers that want to compute skill citations
   * directly (e.g. a chat dispatcher building a fallback reply).
   */
  normalizeSourceRef(source: SourceRef): SourceRef {
    return source;
  }
}
