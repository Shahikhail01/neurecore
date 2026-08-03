/**
 * NeureCore Harness - Phase 5 Policy Conformance
 *
 * Document ID: NC-HARNESS-PHASE5-POLICY-CONFORMANCE-001
 */

import {
  decidePolicy,
  InMemoryPolicyRegistry,
  type PolicyInput,
} from './index';
import type { AgentRole } from '../agents';
import type { ToolContract, ToolParameter } from '../tools';
import type { AuthorizationContext } from '../../contracts';

const TENANT_A = '11111111-1111-1111-1111-111111111111';

const ctx = (): AuthorizationContext => ({
  actorId: 'a',
  actorType: 'HUMAN',
  actorRoles: ['DOMAIN_OWNER'],
  tenantId: TENANT_A,
  correlationId: 'c',
  permissions: [],
});

const role: AgentRole = {
  roleId: 'r.x',
  version: '1.0.0',
  kind: 'CHAT_AGENT',
  name: 'X',
  description: 'd',
  owner: 'o',
  capabilitySurface: ['chat'],
  capabilities: [
    {
      capability: 'chat',
      toolsAllowed: ['t.chat'],
      toolsDenied: [],
      maxEffect: 'INTERNAL_WRITE',
    },
  ],
  autonomy: {
    maxToolCallsPerRun: 5,
    maxRunDurationMs: 1000,
    maxCostUsdPerRun: 1,
    maxPlanSteps: 5,
    maxDelegationsPerRun: 0,
    longHorizonStepThreshold: 3,
  },
  approvalGatedTools: [],
  mayDelegate: false,
  mayEscalate: false,
  writesToMemory: false,
  readsOtherRolesMemory: false,
  status: 'ACTIVE',
  tags: [],
};

const tool: ToolContract = {
  toolId: 't.chat',
  version: '1.0.0',
  name: 't.chat',
  capability: 'chat',
  description: 'd',
  effect: 'INTERNAL_WRITE',
  requiredAuthority: 10,
  approvalSensitive: false,
  timeoutMs: 1000,
  maxRetries: 1,
  retryability: 'IDEMPOTENT',
  sideEffectClasses: ['DB_WRITE'],
  requiredPermissions: [],
  mutatesBusinessState: false,
  compensation: { kind: 'NONE' },
  produceSideEffectLedger: true,
  status: 'ACTIVE',
  tags: [],
};

const params: ToolParameter = {
  toolId: 't.chat',
  version: '1.0.0',
  inputSchema: {},
  requiredParameters: [],
  forbiddenParameters: [],
};

const baseInput: PolicyInput = {
  policyId: 'p1',
  version: '1.0.0',
  role,
  tool,
  toolParameters: params,
  effectiveAuthority: 50,
  governanceBlocked: false,
  input: {},
};

describe('Phase 5 — Policy Conformance', () => {
  test('happy path -> ALLOW', () => {
    const d = decidePolicy(baseInput);
    expect(d.verdict).toBe('ALLOW');
  });

  test('governanceBlocked -> DENY', () => {
    const d = decidePolicy({ ...baseInput, governanceBlocked: true });
    expect(d.verdict).toBe('DENY');
  });

  test('low authority -> DENY', () => {
    const d = decidePolicy({ ...baseInput, effectiveAuthority: 1 });
    expect(d.verdict).toBe('DENY');
  });

  test('role denial overrides tool allow -> DENY', () => {
    // A tool whose `name` is NOT in the role's allow list should be denied
    // at the role boundary regardless of the tool-layer decision.
    const d = decidePolicy({
      ...baseInput,
      tool: { ...tool, name: 't.other', toolId: 't.other' },
    });
    expect(d.verdict).toBe('DENY');
  });

  test('workflow invalid transition -> DENY', () => {
    const d = decidePolicy({
      ...baseInput,
      workflowState: { from: 'COMPLETED', to: 'RUNNING' },
    });
    expect(d.verdict).toBe('DENY');
    expect(d.workflowDecision?.ok).toBe(false);
  });

  test('step invalid transition -> DENY', () => {
    const d = decidePolicy({
      ...baseInput,
      stepState: { from: 'SUCCEEDED', to: 'RUNNING' },
    });
    expect(d.verdict).toBe('DENY');
    expect(d.stepDecision?.ok).toBe(false);
  });

  test('tool approvalSensitive -> REQUIRE_APPROVAL', () => {
    const d = decidePolicy({
      ...baseInput,
      tool: { ...tool, approvalSensitive: true },
    });
    expect(d.verdict).toBe('REQUIRE_APPROVAL');
  });

  test('policy registry is versioned and tenant-scoped', () => {
    const r = new InMemoryPolicyRegistry();
    expect(() =>
      r.register(
        {
          policyId: 'p1',
          version: '1.0.0',
          owner: 'o',
          description: 'd',
          createdAt: new Date().toISOString(),
          status: 'ACTIVE',
        },
        { ...ctx(), tenantId: '' },
      ),
    ).toThrow(/tenantId/);
    r.register(
      {
        policyId: 'p1',
        version: '1.0.0',
        owner: 'o',
        description: 'd',
        createdAt: new Date().toISOString(),
        status: 'ACTIVE',
      },
      ctx(),
    );
    expect(r.getActive('p1')?.version).toBe('1.0.0');
  });

  test('decision includes a timestamp', () => {
    const d = decidePolicy(baseInput);
    expect(new Date(d.decidedAt).getTime()).not.toBeNaN();
  });

  test('unique run IDs are not required (decisions are pure)', () => {
    const d1 = decidePolicy(baseInput);
    const d2 = decidePolicy({ ...baseInput, role: { ...role, roleId: 'r.y' } });
    expect(d1.verdict).toBe('ALLOW');
    expect(d2.verdict).toBe('ALLOW');
  });
});
