/**
 * Enterprise Cognition — architecture tests (Phase 5). Fail on boundary
 * violations: no direct Prisma (except planning-memory store), no capability
 * repositories/services, no capability execution, no runtime mutation bypass,
 * no self-modifying/autonomous behavior.
 */

import * as fs from 'fs';
import * as path from 'path';

const MOD = path.resolve(__dirname, '..'); // .../backend/src/modules
const EC = path.join(MOD, 'enterprise-cognition');

const read = (p: string) => fs.readFileSync(p, 'utf8');
function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts')) out.push(full);
  }
  return out;
}

describe('Enterprise Cognition — architecture', () => {
  const files = walk(EC);

  it('only the planning-memory store touches Prisma', () => {
    const prismaImporters = files.filter((f) => /PrismaService/.test(read(f)));
    for (const f of prismaImporters) {
      expect(f).toMatch(/planning-memory\//);
    }
  });

  it('does not import capability repositories or capability services', () => {
    for (const f of files) {
      const src = read(f);
      expect(src).not.toMatch(/repositories\/prisma-/);
      expect(src).not.toMatch(/modules\/(projects|customers|finance|orchestration|governance)\/.*\.service/);
    }
  });

  it('consumes Context Plane + AIEmployeeCore + Event Fabric via their ports only', () => {
    const svc = read(path.join(EC, 'enterprise-cognition.service.ts'));
    expect(svc).toMatch(/CONTEXT_PLANE/);
    expect(svc).toMatch(/ai-employee-core\/ai-employee-core\.tokens/);
    expect(svc).toMatch(/EVENT_TRANSPORT/);
    // Must NOT import the concrete runtime/context service classes (the
    // I-prefixed port interfaces are allowed).
    expect(svc).not.toMatch(/\bWorkRuntimeService\b/);
    expect(svc).not.toMatch(/(?<!I)OrganizationalContextPlane\b/);
  });

  it('never executes capabilities directly — handoff only via AIEmployeeCore.start', () => {
    for (const f of files) {
      const src = read(f);
      // No tool execution, no direct capability command calls.
      expect(src).not.toMatch(/\.transitionStatus\(|\.updateStatus\(|\.create\(.*tenantId.*\)\s*;?\s*\/\/ *execute/);
    }
    // The only runtime interaction is core.start (handoff that also executes).
    const svc = read(path.join(EC, 'enterprise-cognition.service.ts'));
    expect(svc).toMatch(/this\.core\.start\(/);
    expect(svc).not.toMatch(/runtime\.createRun\(/);
  });

  it('does not implement autonomous/self-modifying behavior', () => {
    for (const f of files) {
      const src = read(f);
      expect(src).not.toMatch(/self-?modif|autonomous (loop|schedul)|eval\(|new Function\(|model\.train|updateWeights/i);
    }
  });

  it('confidence is categorical (no percentage-based confidence)', () => {
    for (const f of files) {
      const src = read(f);
      // Guard against `confidence: 0.87` style numeric confidence.
      expect(src).not.toMatch(/confidence:\s*0?\.\d+/);
      expect(src).not.toMatch(/confidence:\s*\d+\s*%/);
    }
  });

  it('every recommendation type carries evidence + confidence (explainability)', () => {
    const contracts = read(path.join(EC, 'contracts/enterprise-cognition.interface.ts'));
    const recBlock = contracts.slice(
      contracts.indexOf('interface EnterpriseRecommendation'),
      contracts.indexOf('interface SpecialistAgent'),
    );
    expect(recBlock).toMatch(/evidence:\s*Evidence\[\]/);
    expect(recBlock).toMatch(/confidence:\s*Confidence/);
    expect(recBlock).toMatch(/reasoning:/);
    expect(recBlock).toMatch(/alternatives:/);
  });
});
