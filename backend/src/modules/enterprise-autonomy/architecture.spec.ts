/**
 * Enterprise Autonomy — architecture tests (Phase 6).
 * Fail on boundary violations: no direct capability Prisma (outside repository),
 * no capability service imports, no capability execution, no runtime bypass,
 * no autonomous self-modification/approvals/governance, no percentages.
 */

import * as fs from 'fs';
import * as path from 'path';

const MOD = path.resolve(__dirname, '..');
const EA = path.join(MOD, 'enterprise-autonomy');

const read = (p: string) => fs.readFileSync(p, 'utf8');
function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts')) out.push(full);
  }
  return out;
}

describe('Enterprise Autonomy — architecture', () => {
  const files = walk(EA);

  it('only the repository touches Prisma', () => {
    const prismaImporters = files.filter((f) => /PrismaService/.test(read(f)));
    for (const f of prismaImporters) {
      expect(f).toMatch(/repository\/autonomy\.repository\.ts$/);
    }
  });

  it('does not import capability repositories or capability services', () => {
    for (const f of files) {
      const src = read(f);
      expect(src).not.toMatch(/repositories\/prisma-/);
      expect(src).not.toMatch(
        /modules\/(projects|customers|finance|orchestration|governance)\/.*\.service/,
      );
    }
  });

  it('consumes Context Plane + AIEmployeeCore + Event Fabric via ports only', () => {
    // Watchers/health use Context Plane (the ONLY org-state source).
    const watchers = read(path.join(EA, 'watchers/watchers.service.ts'));
    expect(watchers).toMatch(/context-plane\/contracts\/context-plane\.interface/);
    // Orchestrator uses AIEmployeeCore + Event Fabric via their ports.
    const svc = read(path.join(EA, 'enterprise-autonomy.service.ts'));
    expect(svc).toMatch(/ai-employee-core\/ai-employee-core\.tokens/);
    expect(svc).toMatch(/enterprise-events\/contracts\/enterprise-event-transport\.interface/);
    expect(svc).not.toMatch(/WorkRuntimeService/);
  });

  it('never executes capabilities directly — mutation only via AIEmployeeCore.start', () => {
    for (const f of files) {
      const src = read(f);
      expect(src).not.toMatch(/\.transitionStatus\(|\.updateStatus\(|\.record\(/);
    }
    const svc = read(path.join(EA, 'enterprise-autonomy.service.ts'));
    expect(svc).toMatch(/this\.core\.start\(/);
    expect(svc).not.toMatch(/runtime\.createRun\(/);
  });

  it('does not implement autonomous/self-modifying behavior', () => {
    for (const f of files) {
      const src = read(f);
      const normalized = src.replace(/enterprise-autonomy/g, '');
      expect(normalized).not.toMatch(/model\.train|updateWeights|prompt rewrit|policy rewrit|dynamic tool regist|recursive .*plan/i);
      // "autonomous" in our file names/paths is fine — look for autonomous ACTIONS
      // that bypass governance or run independently.
      expect(normalized).not.toMatch(/autonomous.*(loop|execut|approv[^a-z])/i);
    }
  });

  it('governor never returns an outcome granting autonomous approval', () => {
    const gov = read(path.join(EA, 'employees/autonomy-managers.service.ts'));
    const outcomes = gov.match(/outcome:\s*'([^']+)'/g) ?? [];
    for (const o of outcomes) {
      expect(o).not.toContain('AUTO');
    }
  });

  it('health grades are categorical (EXCELLENT/GOOD/FAIR/POOR/CRITICAL), not percentage-based', () => {
    const health = read(path.join(EA, 'watchers/watchers.service.ts'));
    expect(health).toMatch(/EXCELLENT|GOOD|FAIR|POOR|CRITICAL/);
    expect(health).not.toMatch(/health.*%\s*[0-9]/);
  });

  it('watchers consume Context Plane only (no capability Prisma or capability service calls)', () => {
    const watchers = read(path.join(EA, 'watchers/watchers.service.ts'));
    expect(watchers).toMatch(/CONTEXT_PLANE/);
    expect(watchers).not.toMatch(/PrismaService/);
    expect(watchers).not.toMatch(/ProjectsService|CustomersService|TasksService/);
  });
});
