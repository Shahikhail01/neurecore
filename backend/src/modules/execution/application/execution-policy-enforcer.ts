import { Injectable } from '@nestjs/common';
import type { ExecutionPolicy } from '../domain/execution-policy';

export interface RuntimeToolCall {
  name: string;
  arguments: Record<string, unknown>;
  sideEffect: boolean;
  approvedByActorId?: string;
}

type PolicyLike = ExecutionPolicy | Record<string, unknown>;

function asPolicy(p: PolicyLike): ExecutionPolicy {
  return p as ExecutionPolicy;
}

@Injectable()
export class ExecutionPolicyEnforcer {
  validate(policy: PolicyLike): void {
    const p = asPolicy(policy);
    if (p.autonomyLevel < 1 || p.autonomyLevel > 3)
      throw new Error('POLICY_DENIAL_AUTONOMY_LEVEL');
    if (
      p.maxToolCalls < 0 ||
      p.maxTokens <= 0 ||
      p.maxCost < 0 ||
      p.timeoutMs <= 0
    )
      throw new Error('INVALID_EXECUTION_POLICY');
  }

  assertToolAllowed(
    policy: PolicyLike,
    call: RuntimeToolCall,
    toolCallCount: number,
  ): void {
    const p = asPolicy(policy);
    if (toolCallCount >= p.maxToolCalls)
      throw new Error('BUDGET_EXHAUSTION_TOOL_CALLS');
    if (
      !p.allowedTools.includes(call.name) ||
      p.deniedTools.includes(call.name)
    )
      throw new Error('POLICY_DENIAL_TOOL');
    if (
      call.sideEffect &&
      (!p.externalSideEffectApproval ||
        p.autonomyLevel < 3 ||
        !call.approvedByActorId ||
        !p.sideEffectAllowList.includes(call.name))
    )
      throw new Error('POLICY_DENIAL_SIDE_EFFECT_APPROVAL');
  }

  assertBudget(
    policy: PolicyLike,
    tokensUsed: number,
    costCents: number,
  ): void {
    const p = asPolicy(policy);
    if (tokensUsed > p.maxTokens || costCents > p.maxCost)
      throw new Error('BUDGET_EXHAUSTION');
  }
}
