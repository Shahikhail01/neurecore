/**
 * NeureCore Harness - Phase 5 Agents Conformance
 *
 * Document ID: NC-HARNESS-PHASE5-AGENTS-CONFORMANCE-001
 *
 * Pure conformance tests for the agent role/ToR matrix, autonomy budget,
 * memory isolation, and handoff validation primitives.
 */

import { randomUUID } from 'crypto';
import {
  InMemoryAgentRoleRegistry,
  InMemoryAgentMemoryStore,
  AutonomyBudgetTracker,
  checkRoleBoundary,
  validateHandoff,
  computeRoleChecksum,
  AgentRoleSchema,
  type AgentRole,
  type AgentMemoryRecord,
  type AgentHandoff,
} from './index';
import type { AuthorizationContext } from '../../contracts';

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';

const ctx = (
  overrides: Partial<AuthorizationContext> = {},
): AuthorizationContext => ({
  actorId: 'actor-1',
  actorType: 'HUMAN',
  actorRoles: ['DOMAIN_OWNER', 'EVALUATOR', 'QA_LEAD'],
  tenantId: TENANT_A,
  correlationId: 'corr-1',
  permissions: [],
  ...overrides,
});

const makeRole = (overrides: Partial<AgentRole> = {}): AgentRole => ({
  roleId: 'role.test',
  version: '1.0.0',
  kind: 'CHAT_AGENT',
  name: 'Test',
  description: 'test role',
  owner: 'team-a',
  capabilitySurface: ['chat'],
  capabilities: [
    {
      capability: 'chat',
      toolsAllowed: ['chat.reply'],
      toolsDenied: [],
      maxEffect: 'INTERNAL_WRITE',
    },
  ],
  autonomy: {
    maxToolCallsPerRun: 5,
    maxRunDurationMs: 30_000,
    maxCostUsdPerRun: 0.5,
    maxPlanSteps: 5,
    maxDelegationsPerRun: 0,
    longHorizonStepThreshold: 3,
  },
  approvalGatedTools: [],
  mayDelegate: false,
  mayEscalate: true,
  writesToMemory: false,
  readsOtherRolesMemory: false,
  status: 'ACTIVE',
  tags: [],
  ...overrides,
});

describe('Phase 5 — Agent Conformance', () => {
  describe('Role registry', () => {
    test('register() requires tenantId', () => {
      const r = new InMemoryAgentRoleRegistry();
      expect(() => r.register(makeRole(), { ...ctx(), tenantId: '' })).toThrow(
        /tenantId/,
      );
    });

    test('duplicate roleId@version is REJECTED', () => {
      const r = new InMemoryAgentRoleRegistry();
      r.register(makeRole(), ctx());
      expect(() => r.register(makeRole(), ctx())).toThrow(/already registered/);
    });

    test('getActive() returns the latest ACTIVE version', () => {
      const r = new InMemoryAgentRoleRegistry();
      r.register(makeRole({ version: '1.0.0' }), ctx());
      r.register(makeRole({ version: '1.1.0' }), ctx());
      const active = r.getActive('role.test');
      expect(active?.version).toBe('1.1.0');
    });

    test('deprecate() flips status to DEPRECATED', () => {
      const r = new InMemoryAgentRoleRegistry();
      r.register(makeRole(), ctx());
      r.deprecate('role.test', '1.0.0');
      expect(r.get('role.test', '1.0.0')?.status).toBe('DEPRECATED');
      expect(r.getActive('role.test')).toBeNull();
    });

    test('schema validation: missing field is REJECTED', () => {
      const r = new InMemoryAgentRoleRegistry();
      const invalid = {
        ...makeRole(),
        roleId: undefined,
      } as unknown as AgentRole;
      expect(() => r.register(invalid, ctx())).toThrow();
    });
  });

  describe('Role boundary', () => {
    const role = makeRole();

    test('ALLOW when capability + tool + effect all match', () => {
      const d = checkRoleBoundary(role, 'chat', 'chat.reply', 'INTERNAL_WRITE');
      expect(d.kind).toBe('ALLOW');
    });

    test('DENY when capability is not in surface', () => {
      const d = checkRoleBoundary(
        role,
        'projects',
        'projects.create',
        'INTERNAL_WRITE',
      );
      expect(d.kind).toBe('DENY');
    });

    test('DENY when tool is in deny list', () => {
      const r = makeRole({
        capabilities: [
          {
            capability: 'chat',
            toolsAllowed: [],
            toolsDenied: ['chat.reply'],
            maxEffect: 'INTERNAL_WRITE',
          },
        ],
      });
      const d = checkRoleBoundary(r, 'chat', 'chat.reply', 'INTERNAL_WRITE');
      expect(d.kind).toBe('DENY');
    });

    test('DENY when effect tier exceeds role maxEffect', () => {
      const r = makeRole({
        capabilities: [
          {
            capability: 'chat',
            toolsAllowed: ['chat.reply'],
            toolsDenied: [],
            maxEffect: 'READ',
          },
        ],
      });
      const d = checkRoleBoundary(r, 'chat', 'chat.reply', 'INTERNAL_WRITE');
      expect(d.kind).toBe('DENY');
    });

    test('REQUIRE_APPROVAL when tool is in approvalGatedTools', () => {
      const r = makeRole({ approvalGatedTools: ['chat.reply'] });
      const d = checkRoleBoundary(r, 'chat', 'chat.reply', 'INTERNAL_WRITE');
      expect(d.kind).toBe('REQUIRE_APPROVAL');
    });
  });

  describe('Autonomy budget tracker', () => {
    test('beginRun / endRun lifecycle', () => {
      const reg = new InMemoryAgentRoleRegistry();
      reg.register(makeRole(), ctx());
      const t = new AutonomyBudgetTracker(reg);
      t.beginRun('role.test', '1.0.0', 'run-1');
      expect(t.endRun('run-1')).not.toBeNull();
      expect(t.endRun('run-1')).toBeNull();
    });

    test('check() returns TOOL_CALLS_EXCEEDED when observed > limit', () => {
      const reg = new InMemoryAgentRoleRegistry();
      reg.register(makeRole(), ctx());
      const t = new AutonomyBudgetTracker(reg);
      const role = reg.getActive('role.test')!;
      const v = t.check(role, 'r1', { toolCalls: 999 });
      expect(v.find((x) => x.kind === 'TOOL_CALLS_EXCEEDED')).toBeDefined();
    });

    test('cycle detection flags repeating 2-tool sequences', () => {
      const reg = new InMemoryAgentRoleRegistry();
      reg.register(makeRole(), ctx());
      const t = new AutonomyBudgetTracker(reg);
      t.beginRun('role.test', '1.0.0', 'r1');
      expect(t.detectCycle('r1', ['a', 'b'])).toBe(false);
      expect(t.detectCycle('r1', ['a', 'b', 'c'])).toBe(false);
      expect(t.detectCycle('r1', ['a', 'b', 'c', 'a', 'b'])).toBe(true);
    });
  });

  describe('Memory store', () => {
    const makeMem = (
      overrides: Partial<AgentMemoryRecord> = {},
    ): AgentMemoryRecord => ({
      memoryId: randomUUID(),
      roleId: 'role.test',
      tenantId: TENANT_A,
      runId: randomUUID(),
      actorId: 'a',
      kind: 'EPISODIC',
      summary: 's',
      tags: [],
      createdAt: new Date().toISOString(),
      tenantScope: TENANT_A,
      retentionClass: 'MEDIUM_TERM',
      ...overrides,
    });

    test('write() requires tenantId match', () => {
      const m = new InMemoryAgentMemoryStore();
      expect(() => m.write(makeMem({ tenantId: TENANT_B }), ctx())).toThrow(
        /cross-tenant/,
      );
    });

    test('write() is immutable: duplicate id throws', () => {
      const m = new InMemoryAgentMemoryStore();
      const rec = makeMem();
      m.write(rec, ctx());
      expect(() => m.write(rec, ctx())).toThrow(/immutable/);
    });

    test('read() returns only the same role / same tenant entries', () => {
      const m = new InMemoryAgentMemoryStore();
      const recA = makeMem({ roleId: 'role.test' });
      m.write(recA, ctx());
      const other = m.read('role.other', TENANT_A, ctx());
      expect(other.length).toBe(0);
    });
  });

  describe('Handoff validation', () => {
    const fromRole = makeRole({
      roleId: 'role.orch',
      mayDelegate: true,
      capabilitySurface: ['chat', 'projects'],
    });
    const toRole = makeRole({
      roleId: 'role.work',
      mayDelegate: false,
      capabilitySurface: ['projects'],
    });

    const makeHandoff = (
      overrides: Partial<AgentHandoff> = {},
    ): AgentHandoff => ({
      handoffId: randomUUID(),
      fromRoleId: fromRole.roleId,
      toRoleId: toRole.roleId,
      tenantId: TENANT_A,
      runId: randomUUID(),
      reason: 'r',
      context: {},
      createdAt: new Date().toISOString(),
      ...overrides,
    });

    test('cross-tenant handoff is REJECTED', () => {
      const v = validateHandoff(
        makeHandoff({ tenantId: TENANT_B }),
        fromRole,
        toRole,
        ctx(),
      );
      expect(v.ok).toBe(false);
    });

    test('source role without mayDelegate is REJECTED', () => {
      const noDelegate = makeRole({ mayDelegate: false });
      const v = validateHandoff(makeHandoff(), noDelegate, toRole, ctx());
      expect(v.ok).toBe(false);
    });

    test('target role that is DEPRECATED is REJECTED', () => {
      const v = validateHandoff(
        makeHandoff(),
        fromRole,
        { ...toRole, status: 'DEPRECATED' },
        ctx(),
      );
      expect(v.ok).toBe(false);
    });

    test('no overlapping capability surface is REJECTED', () => {
      const v = validateHandoff(
        makeHandoff(),
        fromRole,
        makeRole({
          roleId: 'role.email',
          capabilitySurface: ['email'],
        }),
        ctx(),
      );
      expect(v.ok).toBe(false);
    });
  });

  describe('Checksum / provenance', () => {
    test('role checksum is sha256 of canonical JSON', () => {
      const c = computeRoleChecksum(makeRole());
      expect(c).toMatch(/^sha256:[a-f0-9]{64}$/);
    });

    test('schema parse round-trips', () => {
      const r = makeRole();
      const parsed = AgentRoleSchema.parse(r);
      expect(parsed.roleId).toBe(r.roleId);
    });
  });
});
