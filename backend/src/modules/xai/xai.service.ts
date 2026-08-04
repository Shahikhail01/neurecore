/**
 * XAI — Agent Envelope Explanations.
 *
 * Source plan: §5.4.17 (Explainable AI).
 *
 * Solid:
 *   • SRP — only the explanation writer + reader. Agent execution is
 *     composed from Phase 4.2.
 *   • OCP — adding a new feature-importance model = new entry in
 *     XAI_MODEL_REGISTRY.
 *   • Append-only: AgentEnvelopeExplanation is insert-only at the service
 *     layer.
 */

import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';

/**
 * OOB_XAI_MODEL_REGISTRY — single canonical list. The Phase 7.1 stub
 * uses the `simple-hash-importance` model. Phase 7.5 wires the real
 * SHAP / LIME adapter.
 */
export const OOB_XAI_MODEL_REGISTRY: ReadonlyArray<{
  id: string;
  description: string;
}> = [
  { id: 'simple-hash-importance', description: 'Deterministic placeholder — uniform importance per feature.' },
  { id: 'shap-linear', description: 'SHAP linear explainer (Phase 7.5).' },
];

export interface XaiFactors {
  factor: string;
  value: number;
  weight: number;
}

@Injectable()
export class XaiService {
  private readonly logger = new Logger(XaiService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persist the explanation for an agent execution. The explanation is
   * written once and never updated; subsequent calls return the
   * existing row (idempotent).
   */
  async record(args: {
    tenantId: string;
    executionId: string;
    reason: string;
    factors: XaiFactors[];
    decisionTrace?: Record<string, unknown>;
    featureImportances?: Record<string, number>;
    modelId?: string;
  }) {
    if (!args.tenantId || args.tenantId === '*') {
      throw new ForbiddenException('tenantId "*" is forbidden');
    }
    const existing = await this.prisma.agentEnvelopeExplanation.findFirst({
      where: { tenantId: args.tenantId, executionId: args.executionId },
    });
    if (existing) return existing;
    return this.prisma.agentEnvelopeExplanation.create({
      data: {
        tenantId: args.tenantId,
        executionId: args.executionId,
        reason: args.reason,
        factors: args.factors as unknown as Prisma.InputJsonValue,
        decisionTrace: (args.decisionTrace ?? {}) as Prisma.InputJsonValue,
        featureImportances: (args.featureImportances ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async findForExecution(tenantId: string, executionId: string) {
    if (!tenantId || tenantId === '*') {
      throw new ForbiddenException('tenantId "*" is forbidden');
    }
    return this.prisma.agentEnvelopeExplanation.findFirst({
      where: { tenantId, executionId },
    });
  }

  /**
   * Compute the deterministic "why this action" panel for a
   * pending action. Used by the chat / agent UI to render the panel
   * before the user approves.
   */
  async whyPanel(args: {
    tenantId: string;
    executionId?: string;
    intent: string;
    factors: Array<{ factor: string; value: number }>;
  }) {
    if (!args.tenantId || args.tenantId === '*') {
      throw new ForbiddenException('tenantId "*" is forbidden');
    }
    // Stub importance: weight = value / sum(values); uniform when sum=0.
    const sum = args.factors.reduce((a, f) => a + Math.abs(f.value), 0) || 1;
    return {
      tenantId: args.tenantId,
      intent: args.intent,
      factors: args.factors.map((f) => ({
        factor: f.factor,
        value: f.value,
        weight: Number((f.value / sum).toFixed(4)),
      })),
      narrative: `Action "${args.intent}" was selected because ${args.factors.length} factor(s) contributed.`,
      modelId: 'simple-hash-importance',
    };
  }
}
