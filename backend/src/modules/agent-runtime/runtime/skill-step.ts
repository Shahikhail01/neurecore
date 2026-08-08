/**
 * Phase 23 — SkillStep implementation.
 *
 * Wraps `SkillRegistry.dispatch` into a narrow step so executors
 * depend on `ISkillStep`, not the full skill surface.
 *
 * SOLID — DIP / ISP:
 *   - Injects SkillRegistry + AiGatewayService only.
 *   - Exposes a single `invoke()` method.
 */

import { Injectable, Logger } from '@nestjs/common';
import type { TenantContext } from '../../../common/context/tenant-context';
import {
  SkillRegistry,
  SkillInputInvalidError,
  SkillNotFoundError,
} from '../../skill-registry/skill-registry.service';
import { AgentSkillAuthorizationError } from '../errors';
import type {
  ISkillStep,
  SkillStepResult,
} from '../interfaces/agent-step.interface';

@Injectable()
export class SkillStep implements ISkillStep {
  private readonly logger = new Logger(SkillStep.name);

  constructor(private readonly registry: SkillRegistry) {}

  async invoke(
    skillKey: string,
    input: unknown,
    ctx: TenantContext,
  ): Promise<SkillStepResult> {
    if (!ctx?.tenantId) {
      throw new AgentSkillAuthorizationError(skillKey, 'MISSING_TENANT');
    }
    try {
      const out = await this.registry.dispatch<
        unknown,
        { text?: string; content?: unknown }
      >(skillKey as never, input, ctx);
      const text =
        typeof out.content === 'string'
          ? out.content
          : ((out.content as { text?: string })?.text ??
            JSON.stringify(out.content ?? ''));
      this.logger.debug(
        `SkillStep ${skillKey} → confidence=${out.confidence.toFixed(2)} duration=${out.durationMs}ms`,
      );
      return {
        output: text,
        confidence: out.confidence,
        citationsCount: out.citations.length,
        durationMs: out.durationMs,
      };
    } catch (err: unknown) {
      if (
        err instanceof SkillInputInvalidError ||
        err instanceof SkillNotFoundError
      ) {
        throw err;
      }
      throw err;
    }
  }
}
