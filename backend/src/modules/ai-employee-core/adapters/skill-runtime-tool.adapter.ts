import type { RuntimeTool, RuntimeToolResult, ToolContext, ToolEffect } from '../../work-runtime/contracts/work-runtime.interface';
import type { SkillId } from '../../skill-registry/interfaces/skill.interface';
import type { SkillRegistry } from '../../skill-registry/skill-registry.service';
import type { TenantContext } from '../../../common/context/tenant-context';
import type { UserRole } from '@prisma/client';
import { Logger } from '@nestjs/common';

/**
 * Abstract base for adapting a read-only Skill Registry skill into a
 * {@link RuntimeTool}. Each subclass provides the typed `validateInput()`
 * guard; the base handles dispatch, result wrapping, and metadata.
 *
 * SOLID:
 *  - SRP: adapts one skill to one tool contract
 *  - OCP: new skills become new subclasses without core changes
 *  - DIP: depends on SkillRegistry (abstraction), not a concrete skill
 */
export abstract class SkillRuntimeToolAdapter implements RuntimeTool {
  readonly effect: ToolEffect = 'READ';
  readonly requiredAuthority = 10;
  readonly approvalSensitive = false;
  readonly timeoutMs = 30_000;
  readonly maxRetries = 1;

  protected readonly logger: Logger;

  constructor(
    public readonly name: string,
    public readonly capability: string,
    public readonly description: string,
    protected readonly skillId: SkillId,
    protected readonly registry: SkillRegistry,
  ) {
    this.logger = new Logger(name);
  }

  /** Subclasses must validate skill-specific input shape. */
  abstract validateInput(input: Record<string, unknown>): void;

  async execute(
    input: Record<string, unknown>,
    ctx: ToolContext,
  ): Promise<RuntimeToolResult> {
    const skillCtx: TenantContext = {
      tenantId: ctx.tenantId,
      isCrossTenant: false,
      actorRole: 'OWNER' as UserRole,
      actorUserId: ctx.actorId,
    };

    try {
      const result = await this.registry.dispatch(this.skillId, input, skillCtx);

      return {
        ok: true,
        data: {
          content: result.content,
          citations: result.citations as Record<string, unknown>[],
          confidence: result.confidence,
          limits: (result as Record<string, unknown>).limits ?? [],
          durationMs: result.durationMs,
          skillId: result.skillId,
        },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Skill tool ${this.name} failed: ${message}`,
      );
      return {
        ok: false,
        errorCode: 'SKILL_EXECUTION_FAILED',
        errorMessage: message,
        retryable: false,
      };
    }
  }
}
