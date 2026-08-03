/**
 * NeureCore Harness - Phase 5 Tools Conformance
 *
 * Document ID: NC-HARNESS-PHASE5-TOOLS-CONFORMANCE-001
 */

import { randomUUID } from 'crypto';
import {
  InMemoryToolCatalog,
  InMemorySideEffectLedger,
  validateToolParameters,
  decideRetry,
  decideToolInvocation,
  fingerprintInput,
  computeToolChecksum,
  type ToolContract,
  type ToolParameter,
  type SideEffectEntry,
  type ToolFailureClass,
} from './index';
import type { AuthorizationContext } from '../../contracts';

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';

const ctx = (
  overrides: Partial<AuthorizationContext> = {},
): AuthorizationContext => ({
  actorId: 'a',
  actorType: 'HUMAN',
  actorRoles: ['DOMAIN_OWNER'],
  tenantId: TENANT_A,
  correlationId: 'c',
  permissions: [],
  ...overrides,
});

const makeTool = (overrides: Partial<ToolContract> = {}): ToolContract => ({
  toolId: 't.read',
  version: '1.0.0',
  name: 't.read',
  capability: 'data',
  description: 'read',
  effect: 'READ',
  requiredAuthority: 5,
  approvalSensitive: false,
  timeoutMs: 5_000,
  maxRetries: 2,
  retryability: 'IDEMPOTENT',
  sideEffectClasses: ['NONE'],
  requiredPermissions: [],
  mutatesBusinessState: false,
  compensation: { kind: 'NONE' },
  produceSideEffectLedger: false,
  status: 'ACTIVE',
  tags: [],
  ...overrides,
});

const makeParams = (
  tool: ToolContract,
  overrides: Partial<ToolParameter> = {},
): ToolParameter => ({
  toolId: tool.toolId,
  version: tool.version,
  inputSchema: { type: 'object' },
  requiredParameters: [],
  forbiddenParameters: [],
  ...overrides,
});

describe('Phase 5 — Tools Conformance', () => {
  describe('Tool catalog', () => {
    test('register() enforces toolId/version alignment', () => {
      const c = new InMemoryToolCatalog();
      const t = makeTool({ toolId: 'X' });
      const p = makeParams(t, { toolId: 'Y' });
      expect(() => c.register(t, p, ctx())).toThrow(/toolId/);
    });

    test('register() requires tenantId', () => {
      const c = new InMemoryToolCatalog();
      expect(() =>
        c.register(makeTool(), makeParams(makeTool()), ctx({ tenantId: '' })),
      ).toThrow(/tenantId/);
    });

    test('listMutating() excludes READ tools', () => {
      const c = new InMemoryToolCatalog();
      const read = makeTool({ toolId: 't.read' });
      const write = makeTool({
        toolId: 't.write',
        effect: 'INTERNAL_WRITE',
        sideEffectClasses: ['DB_WRITE'],
      });
      c.register(read, makeParams(read), ctx());
      c.register(write, makeParams(write), ctx());
      expect(
        c
          .listMutating()
          .map((t) => t.toolId)
          .sort(),
      ).toEqual(['t.write']);
    });

    test('deprecate() flips status', () => {
      const c = new InMemoryToolCatalog();
      c.register(makeTool(), makeParams(makeTool()), ctx());
      c.deprecate('t.read', '1.0.0');
      expect(c.get('t.read', '1.0.0')?.status).toBe('DEPRECATED');
    });
  });

  describe('Parameter validation', () => {
    const tool = makeTool({
      toolId: 't.write',
      effect: 'INTERNAL_WRITE',
      sideEffectClasses: ['DB_WRITE'],
    });
    const params = makeParams(tool, {
      requiredParameters: ['name'],
      forbiddenParameters: ['tenantId'],
    });

    test('missing required param is REJECTED', () => {
      const v = validateToolParameters(tool, params, { other: 1 });
      expect(v.ok).toBe(false);
    });

    test('forbidden param is REJECTED', () => {
      const v = validateToolParameters(tool, params, {
        name: 'x',
        tenantId: 'y',
      });
      expect(v.ok).toBe(false);
    });

    test('valid params are ACCEPTED', () => {
      const v = validateToolParameters(tool, params, { name: 'x' });
      expect(v.ok).toBe(true);
    });

    test('inconsistent contract: READ + mutates is REJECTED', () => {
      const t = makeTool({ mutatesBusinessState: true });
      const v = validateToolParameters(t, makeParams(t), {});
      expect(v.ok).toBe(false);
    });
  });

  describe('Tool invocation decision', () => {
    const tool = makeTool({
      toolId: 't.email',
      effect: 'EXTERNAL_WRITE',
      requiredAuthority: 50,
      approvalSensitive: true,
      sideEffectClasses: ['EMAIL'],
    });
    const params = makeParams(tool);

    test('governanceBlocked -> DENY', () => {
      const d = decideToolInvocation({
        contract: tool,
        effectiveAuthority: 99,
        governanceBlocked: true,
        input: {},
        parameters: params,
      });
      expect(d.kind).toBe('DENY');
    });

    test('low authority -> DENY', () => {
      const d = decideToolInvocation({
        contract: tool,
        effectiveAuthority: 1,
        governanceBlocked: false,
        input: {},
        parameters: params,
      });
      expect(d.kind).toBe('DENY');
    });

    test('approvalSensitive -> REQUIRE_APPROVAL', () => {
      const d = decideToolInvocation({
        contract: tool,
        effectiveAuthority: 99,
        governanceBlocked: false,
        input: {},
        parameters: params,
      });
      expect(d.kind).toBe('REQUIRE_APPROVAL');
    });
  });

  describe('Retry policy', () => {
    const failures: ToolFailureClass[] = [
      'TRANSIENT',
      'RATE_LIMITED',
      'INFRASTRUCTURE',
      'PERMANENT',
      'AUTHORIZATION',
      'UNKNOWN',
    ];

    const retriable: ReadonlySet<ToolFailureClass> = new Set<ToolFailureClass>([
      'TRANSIENT',
      'RATE_LIMITED',
      'INFRASTRUCTURE',
    ]);

    test.each(failures)('failure=%s returns a deterministic decision', (f) => {
      const t = makeTool({ retryability: 'IDEMPOTENT' });
      const d = decideRetry(t, 1, f);
      if (retriable.has(f)) {
        expect(d.shouldRetry).toBe(true);
      } else {
        expect(d.shouldRetry).toBe(false);
      }
    });

    test('NEVER-retryable always refuses', () => {
      const t = makeTool({ retryability: 'NEVER' });
      for (const f of failures) {
        expect(decideRetry(t, 1, f).shouldRetry).toBe(false);
      }
    });
  });

  describe('Side-effect ledger', () => {
    const makeEntry = (
      overrides: Partial<SideEffectEntry> = {},
    ): SideEffectEntry => ({
      entryId: randomUUID(),
      toolId: 't.write',
      toolVersion: '1.0.0',
      runId: randomUUID(),
      tenantId: TENANT_A,
      actorId: 'a',
      actorType: 'AI_AGENT',
      idempotencyKey: 'k1',
      effect: 'INTERNAL_WRITE',
      classes: ['DB_WRITE'],
      resources: [],
      createdAt: new Date().toISOString(),
      inputFingerprint: 'sha256:' + 'a'.repeat(64),
      schemaVersion: '1.0.0',
      ...overrides,
    });

    test('append is idempotent on (tool, version, tenant, key)', () => {
      const l = new InMemorySideEffectLedger();
      const a = makeEntry();
      l.append(a, ctx());
      const before = l.listByRun(a.runId).length;
      l.append({ ...a, entryId: randomUUID() }, ctx());
      expect(l.listByRun(a.runId).length).toBe(before);
    });

    test('findByIdempotencyKey returns the existing entry', () => {
      const l = new InMemorySideEffectLedger();
      const a = makeEntry();
      l.append(a, ctx());
      const found = l.findByIdempotencyKey('t.write', '1.0.0', TENANT_A, 'k1');
      expect(found?.entryId).toBe(a.entryId);
    });

    test('append() cross-tenant is REJECTED', () => {
      const l = new InMemorySideEffectLedger();
      expect(() => l.append(makeEntry({ tenantId: TENANT_B }), ctx())).toThrow(
        /cross-tenant/,
      );
    });
  });

  describe('Fingerprint / checksum', () => {
    test('fingerprintInput is deterministic', () => {
      const a = fingerprintInput({ x: 1, y: 'a' });
      const b = fingerprintInput({ y: 'a', x: 1 });
      expect(a).toBe(b);
    });

    test('tool checksum is deterministic', () => {
      const t = makeTool();
      expect(computeToolChecksum(t)).toBe(computeToolChecksum(t));
    });
  });
});
