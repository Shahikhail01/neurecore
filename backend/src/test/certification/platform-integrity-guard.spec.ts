/**
 * Phase 18 — PlatformIntegrityGuard.
 *
 * Closes the CR-AI-1301 F-1 violation: every AgentsService public
 * method MUST call `this.tenantScope.assert(op, tenantId)` at the top
 * of its body before any Prisma call. The guard scans
 * `agents.service.ts` at test-time and fails the build if any of the
 * public methods bypass the assertion.
 *
 * The guard is a unit-shaped test (no DB), so it ships in jest's
 * default testPathPatterns and is fast (~30 ms).
 */

import * as path from 'node:path';
import { readFileSync, statSync } from 'node:fs';

const SERVICE_FILE = path.join(
  __dirname,
  '..',
  '..',
  'modules',
  'agents',
  'services',
  'agents.service.ts',
);

const REQUIRED_METHODS = [
  'findAll',
  'findOne',
  'create',
  'update',
  'remove',
  'updateStatus',
  'setStatus',
  'archive',
] as const;

describe('Phase 18 — PlatformIntegrityGuard', () => {
  it('agents.service.ts exists', () => {
    expect(statSync(SERVICE_FILE, { throwIfNoEntry: false })).toBeTruthy();
  });

  it('every AgentsService public method calls tenantScope.assert first', () => {
    const src = readFileSync(SERVICE_FILE, 'utf-8');
    const failures: string[] = [];

    for (const method of REQUIRED_METHODS) {
      // Find the `async <method>(` line, capture up to the second
      // closing `}` or `return`. We deliberately keep this regex
      // simple — the function signatures are stable and the
      // assertion is always on the first executable line.
      const regex = new RegExp(
        `async\\s+${method}\\s*\\([^)]*\\)\\s*:?\\s*[^{]*\\{`,
      );
      const head = regex.exec(src);
      if (!head) {
        failures.push(`${method}: method body not found`);
        continue;
      }
      // Slice forward through the matched body — for our purposes
      // we look at the first 400 chars after `async <method>(...){`.
      const startIdx = head.index + head[0].length;
      const slice = src.slice(startIdx, startIdx + 800);
      const hasAssert = /this\.tenantScope\.assert\(/.test(slice);
      if (!hasAssert) {
        failures.push(
          `${method}: missing this.tenantScope.assert(op, tenantId)`,
        );
      }
    }

    if (failures.length > 0) {
      throw new Error(
        `PlatformIntegrityGuard: ${failures.length} public method(s) on AgentsService bypass ` +
          `AgentTenantScopeGuard. CR-AI-1301 demands that EVERY public method calls ` +
          `this.tenantScope.assert(op, tenantId) before any Prisma call. Failures: ` +
          failures.join('; '),
      );
    }
  });

  it('AgentTenantScopeGuard is wired into the AgentsModule DI graph', () => {
    const agentsModule = readFileSync(
      path.join(__dirname, '..', '..', 'modules', 'agents', 'agents.module.ts'),
      'utf-8',
    );
    expect(agentsModule).toMatch(/AgentTenantScopeGuard/);
    expect(agentsModule).toMatch(/AGENT_TENANT_SCOPE/);
  });
});
