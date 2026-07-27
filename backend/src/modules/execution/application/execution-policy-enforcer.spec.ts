import {
  ExecutionPolicyEnforcer,
  RuntimeToolCall,
} from './execution-policy-enforcer';
import { ExecutionPolicy } from '../domain/execution-policy';

function buildPolicy(
  overrides: Partial<ExecutionPolicy> = {},
): ExecutionPolicy {
  return {
    taskId: 'task-1',
    policyVersion: '1.0.0',
    autonomyLevel: 2,
    allowedTools: ['reports.read', 'inbox.read', 'crm.update'],
    deniedTools: ['shell', 'file.write'],
    maxToolCalls: 5,
    maxTokens: 10000,
    maxCost: 1000,
    timeoutMs: 60000,
    requiresHumanApproval: true,
    externalSideEffectApproval: true,
    inputSources: ['inbox', 'crm'],
    promptVersion: '1.0',
    graphVersion: '1.0',
    modelVersion: '1.0',
    toolVersion: '1.0',
    redactionPolicy: 'STANDARD',
    sideEffectAllowList: ['crm.update'],
    ...overrides,
  };
}

describe('ExecutionPolicyEnforcer (Phase 8 — §10.1 tool allowlists / side-effect approval)', () => {
  let enforcer: ExecutionPolicyEnforcer;

  beforeEach(() => {
    enforcer = new ExecutionPolicyEnforcer();
  });

  describe('validate()', () => {
    it('accepts a valid policy', () => {
      expect(() => enforcer.validate(buildPolicy())).not.toThrow();
    });

    it('rejects an out-of-range autonomy level (0)', () => {
      expect(() =>
        enforcer.validate(buildPolicy({ autonomyLevel: 0 })),
      ).toThrow('POLICY_DENIAL_AUTONOMY_LEVEL');
    });

    it('rejects an out-of-range autonomy level (4)', () => {
      expect(() =>
        enforcer.validate(buildPolicy({ autonomyLevel: 4 })),
      ).toThrow('POLICY_DENIAL_AUTONOMY_LEVEL');
    });

    it('rejects an invalid budget', () => {
      expect(() => enforcer.validate(buildPolicy({ maxTokens: 0 }))).toThrow(
        'INVALID_EXECUTION_POLICY',
      );
    });
  });

  describe('assertToolAllowed()', () => {
    it('permits a tool that is in the allowlist and not in the denylist', () => {
      const call: RuntimeToolCall = {
        name: 'reports.read',
        arguments: {},
        sideEffect: false,
      };
      expect(() =>
        enforcer.assertToolAllowed(buildPolicy(), call, 1),
      ).not.toThrow();
    });

    it('blocks a tool that is not in the allowlist', () => {
      const call: RuntimeToolCall = {
        name: 'unknown.tool',
        arguments: {},
        sideEffect: false,
      };
      expect(() => enforcer.assertToolAllowed(buildPolicy(), call, 1)).toThrow(
        'POLICY_DENIAL_TOOL',
      );
    });

    it('blocks a tool in the denylist even if it appears in the allowlist', () => {
      const call: RuntimeToolCall = {
        name: 'file.write',
        arguments: {},
        sideEffect: false,
      };
      expect(() => enforcer.assertToolAllowed(buildPolicy(), call, 1)).toThrow(
        'POLICY_DENIAL_TOOL',
      );
    });

    it('blocks side-effecting tools when autonomy is below L3', () => {
      const call: RuntimeToolCall = {
        name: 'crm.update',
        arguments: {},
        sideEffect: true,
        approvedByActorId: 'user-1',
      };
      expect(() =>
        enforcer.assertToolAllowed(buildPolicy({ autonomyLevel: 2 }), call, 1),
      ).toThrow('POLICY_DENIAL_SIDE_EFFECT_APPROVAL');
    });

    it('blocks side-effecting tools without an explicit approver', () => {
      const call: RuntimeToolCall = {
        name: 'crm.update',
        arguments: {},
        sideEffect: true,
      };
      expect(() =>
        enforcer.assertToolAllowed(buildPolicy({ autonomyLevel: 3 }), call, 1),
      ).toThrow('POLICY_DENIAL_SIDE_EFFECT_APPROVAL');
    });

    it('permits side-effecting tools when autonomy is L3, approval set, and tool allowlisted', () => {
      const call: RuntimeToolCall = {
        name: 'crm.update',
        arguments: {},
        sideEffect: true,
        approvedByActorId: 'user-1',
      };
      expect(() =>
        enforcer.assertToolAllowed(buildPolicy({ autonomyLevel: 3 }), call, 1),
      ).not.toThrow();
    });

    it('blocks side-effecting tools that are not in the side-effect allow list', () => {
      const call: RuntimeToolCall = {
        name: 'reports.read',
        arguments: {},
        sideEffect: true,
        approvedByActorId: 'user-1',
      };
      expect(() =>
        enforcer.assertToolAllowed(buildPolicy({ autonomyLevel: 3 }), call, 1),
      ).toThrow('POLICY_DENIAL_SIDE_EFFECT_APPROVAL');
    });

    it('exhausts the budget once the call count reaches maxToolCalls', () => {
      const call: RuntimeToolCall = {
        name: 'reports.read',
        arguments: {},
        sideEffect: false,
      };
      expect(() => enforcer.assertToolAllowed(buildPolicy(), call, 5)).toThrow(
        'BUDGET_EXHAUSTION_TOOL_CALLS',
      );
    });
  });

  describe('assertBudget()', () => {
    it('accepts usage below the cap', () => {
      expect(() => enforcer.assertBudget(buildPolicy(), 100, 50)).not.toThrow();
    });

    it('rejects when token usage exceeds the cap', () => {
      expect(() => enforcer.assertBudget(buildPolicy(), 20000, 50)).toThrow(
        'BUDGET_EXHAUSTION',
      );
    });

    it('rejects when cost exceeds the cap', () => {
      expect(() => enforcer.assertBudget(buildPolicy(), 100, 5000)).toThrow(
        'BUDGET_EXHAUSTION',
      );
    });
  });
});
