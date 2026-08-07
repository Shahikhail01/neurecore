/**
 * Phase 11 — BaseSkill.
 *
 * Shared validation + execution plumbing for the seven Phase-11 skills.
 *
 * SRP: this base class owns ONLY the registry-binding glue. Each
 * concrete skill defines its own validateInput + buildPrompt.
 * No LLM calls, no persistence, no tenant-policy — those live in
 * other modules.
 *
 * DIP:
 *   - Concrete skills depend on the `SkillExecutor` indirectly via the
 *     `SkillRegistry` they are registered into. They build a `SkillPrompt`
 *     envelope; the executor calls the model.
 */

import type { ISkill, SkillExecutionContext } from '../interfaces/skill.interface';
import type { SkillPrompt } from '../skill-prompt';
import type { SkillOutput } from '../interfaces/skill.types';
import type { ExecutorOptions } from '../skill-executor.service';
import type { SkillId } from '../interfaces/skill.interface';

/**
 * Returns the validated parse pipeline. Concrete skills override
 * `validateInput` + `buildPrompt`; `execute` defaults to a no-op
 * pass-through because the registry dispatches through the executor.
 */
export abstract class BaseSkill<I, O> implements ISkill<I, O> {
  abstract readonly id: SkillId;
  abstract readonly displayName: string;
  abstract readonly shortDescription: string;

  abstract validateInput(input: unknown): input is I;
  abstract buildPrompt(
    input: I,
    ctx: SkillExecutionContext,
  ): { prompt: SkillPrompt<O>; options?: ExecutorOptions };

  /**
   * Direct execution path. The registry's dispatch() will use the
   * SkillExecutor instead — this method exists for unit tests and
   * for skills that want to bypass the standard executor pipeline.
   */
  async execute(input: I, ctx: SkillExecutionContext): Promise<SkillOutput<O>> {
    // The default is "delegate to the registry's executor" but the
    // concrete skill module wires that — here we just build the
    // prompt and throw so we fail loud if a caller accidentally hits
    // this path without the executor wiring.
    void input;
    void ctx;
    throw new Error(
      `${this.id}: BaseSkill.execute is unreachable — register the skill and call SkillRegistry.dispatch instead.`,
    );
  }
}
