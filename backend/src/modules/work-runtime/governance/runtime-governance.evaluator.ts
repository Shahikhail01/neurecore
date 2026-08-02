/**
 * RuntimeGovernanceEvaluator — per-step ALLOW / DENY / REQUIRE_APPROVAL
 * (ADR-003 §2.3, ADR-006/009). Delegates rule evaluation to the governance
 * capability (IGovernanceEvaluator); does NOT duplicate governance rules.
 *
 * Decision order (fail-safe): governance-blocked → DENY; below required
 * authority → DENY; approval-sensitive tool OR governance requiresApproval →
 * REQUIRE_APPROVAL; else ALLOW.
 */

import { Inject, Injectable } from '@nestjs/common';
import {
  GOVERNANCE_EVALUATOR,
  type GovernanceEvaluation,
  type IGovernanceEvaluator,
} from '../../governance/interfaces/governance-evaluator.interface';
import type {
  IRuntimeGovernanceEvaluator,
  RuntimeGovernanceDecision,
  RuntimeTool,
} from '../contracts/work-runtime.interface';

@Injectable()
export class RuntimeGovernanceEvaluator implements IRuntimeGovernanceEvaluator {
  private static readonly POLICY_VERSION = '1.0.0';
  private static readonly TOOL_REGISTRATIONS_VERSION = '1.0.0';

  constructor(
    @Inject(GOVERNANCE_EVALUATOR)
    private readonly governance: IGovernanceEvaluator,
  ) {}

  async evaluateStep(params: {
    tenantId: string;
    actorId: string;
    effectiveAuthority: number;
    governanceBlocked: boolean;
    tool: RuntimeTool;
    input: Record<string, unknown>;
  }): Promise<RuntimeGovernanceDecision> {
    const base = {
      actorId: params.actorId,
      scope: {
        tenantId: params.tenantId,
        capability: params.tool.capability,
        toolName: params.tool.name,
      },
      decidedAt: new Date().toISOString(),
      policyVersion: RuntimeGovernanceEvaluator.POLICY_VERSION,
      toolRegistrationsVersion:
        RuntimeGovernanceEvaluator.TOOL_REGISTRATIONS_VERSION,
    };

    if (params.governanceBlocked) {
      return {
        ...base,
        outcome: 'DENY',
        reason: 'governance policy blocked actor',
        policySource: 'governance:blocked',
      };
    }

    if (params.effectiveAuthority < params.tool.requiredAuthority) {
      return {
        ...base,
        outcome: 'DENY',
        reason: `effective authority ${params.effectiveAuthority} < required ${params.tool.requiredAuthority}`,
        policySource: `work-runtime:${params.tool.name}:authority`,
      };
    }

    // Delegate to governance rules (capability-owned).
    let evalResult: GovernanceEvaluation;
    try {
      evalResult = await this.governance.evaluate(params.tenantId, {
        'actor.id': params.actorId,
        'tool.name': params.tool.name,
        'tool.capability': params.tool.capability,
        'tool.effect': params.tool.effect,
        'actor.authority': params.effectiveAuthority,
      });
    } catch {
      // Fail safe: unknown governance result → require approval for any write,
      // deny nothing silently, allow reads.
      if (params.tool.effect === 'READ') {
        return {
          ...base,
          outcome: 'ALLOW',
          reason: 'read allowed; governance eval unavailable',
          policySource: 'work-runtime:failsafe-read',
        };
      }
      return {
        ...base,
        outcome: 'REQUIRE_APPROVAL',
        reason: 'governance eval unavailable; write requires approval',
        policySource: 'work-runtime:failsafe-write',
      };
    }

    if (!evalResult.allowed) {
      return {
        ...base,
        outcome: 'DENY',
        reason: `governance denied: ${evalResult.triggeredRules.join(',') || 'policy'}`,
        policySource: 'governance:rule',
      };
    }

    // Approval-sensitive tools ALWAYS require approval; or governance may.
    if (params.tool.approvalSensitive || evalResult.requiresApproval) {
      return {
        ...base,
        outcome: 'REQUIRE_APPROVAL',
        reason: params.tool.approvalSensitive
          ? 'tool is approval-sensitive (external/irreversible)'
          : 'governance requires approval',
        policySource: params.tool.approvalSensitive
          ? `work-runtime:${params.tool.name}:approval-sensitive`
          : 'governance:requires-approval',
      };
    }

    return {
      ...base,
      outcome: 'ALLOW',
      reason: 'authorized',
      policySource: 'work-runtime:allow',
    };
  }
}
