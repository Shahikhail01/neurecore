/**
 * Phase 24 — SkillPreviewService (CR-AI-0602 preview endpoint).
 *
 * Source plan: IMPLEMENTATION_PLAN_PARITY_COMPLETION.md §5 (P24).
 *
 * SOLID — SRP: this service owns ONLY the act of running a
 * non-mutating preview against the canonical skill registry. It
 * never persists graph state, never writes to chat history, never
 * mutates anything the operator hasn't explicitly approved.
 *
 * DIP: depends on `SkillRegistryService` (already injected).
 *
 * The preview is a thin orchestration layer; the registry still
 * validates input, applies tenant scope, runs the model, and emits
 * telemetry. This service only narrows the contract to a
 * preview-only response.
 */

import { Injectable } from '@nestjs/common';
import { SkillRegistry } from '../../skill-registry/skill-registry.service';
import type { SkillId } from '../../skill-registry/interfaces/skill.interface';
import type { TenantContext } from '@/common/context/tenant-context';

export const SKILL_PREVIEW_SERVICE = Symbol('SKILL_PREVIEW_SERVICE');

export interface SkillPreviewResult {
  readonly skillId: SkillId;
  readonly content: unknown;
  readonly citations: ReadonlyArray<unknown>;
  readonly confidence: number;
  readonly durationMs: number;
  readonly nonMutating: true;
}

export interface ISkillPreviewService {
  preview(
    skillId: SkillId,
    input: unknown,
    ctx: TenantContext,
  ): Promise<SkillPreviewResult>;
}

@Injectable()
export class SkillPreviewService implements ISkillPreviewService {
  constructor(private readonly registry: SkillRegistry) {}

  async preview(
    skillId: SkillId,
    input: unknown,
    ctx: TenantContext,
  ): Promise<SkillPreviewResult> {
    const result = await this.registry.dispatch(skillId, input, ctx);
    return {
      skillId: result.skillId,
      content: result.content,
      citations: result.citations,
      confidence: result.confidence,
      durationMs: result.durationMs,
      nonMutating: true,
    };
  }
}
