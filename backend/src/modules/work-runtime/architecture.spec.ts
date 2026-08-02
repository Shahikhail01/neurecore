/**
 * Work Runtime — architecture tests (Phase 4 §17). Fail on ADR-003/004 boundary
 * violations.
 */

import * as fs from 'fs';
import * as path from 'path';

const MOD = path.resolve(__dirname, '..'); // .../backend/src/modules
const WR = path.join(MOD, 'work-runtime');

function read(p: string): string {
  return fs.readFileSync(p, 'utf8');
}
function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts'))
      out.push(full);
  }
  return out;
}

describe('Work Runtime — architecture', () => {
  const files = walk(WR);

  it('orchestration + planner layers do NOT import PrismaService', () => {
    const nonRepo = files.filter((f) =>
      /\/(runtime|planner|governance|executor|registry|tools|consumers)\//.test(
        f,
      ),
    );
    for (const f of nonRepo) {
      expect(read(f)).not.toMatch(/PrismaService/);
    }
  });

  it('only the repository imports Prisma', () => {
    const prismaImporters = files.filter((f) => /PrismaService/.test(read(f)));
    for (const f of prismaImporters) {
      expect(f).toMatch(/\/(repository|persistence)\//);
    }
  });

  it('runtime does not import capability private repositories', () => {
    for (const f of files) {
      expect(read(f)).not.toMatch(/repositories\/prisma-/);
    }
  });

  it('the planner cannot execute tools (no ToolExecutor / capability service imports)', () => {
    const planner = read(path.join(WR, 'planner/work-planner.service.ts'));
    expect(planner).not.toMatch(/ToolExecutor/);
    expect(planner).not.toMatch(
      /ProjectsService|TasksService|CustomersService|ProjectMemoryService/,
    );
  });

  it('governance evaluator delegates to the governance port (no duplicated rules engine)', () => {
    const gov = read(
      path.join(WR, 'governance/runtime-governance.evaluator.ts'),
    );
    expect(gov).toMatch(/GOVERNANCE_EVALUATOR/);
    // Must not re-implement rule storage/evaluation.
    expect(gov).not.toMatch(/prisma|governanceRule/i);
  });

  it('no hardcoded authority default >= 40 in the runtime', () => {
    for (const f of files) {
      const src = read(f)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      const matches = [...src.matchAll(/authority[A-Za-z]*:\s*(\d+)/gi)];
      for (const m of matches) {
        // requiredAuthority thresholds on tools are allowed (they gate UP);
        // this guards against a *default granted authority*. Tool thresholds
        // live in the tools provider; exclude that file.
        if (/tools\/runtime-tools\.provider\.ts$/.test(f)) continue;
        expect(Number(m[1])).toBeLessThan(40);
      }
    }
  });

  it('planner output cannot supply approval (approval decided by runtime/governance)', () => {
    // The WorkPlanStep contract has no "approved"/"approval" field.
    const contracts = read(
      path.join(WR, 'contracts/work-runtime.interface.ts'),
    );
    const planStepBlock = contracts.slice(
      contracts.indexOf('interface WorkPlanStep'),
      contracts.indexOf('interface WorkPlan {'),
    );
    expect(planStepBlock).not.toMatch(/approv/i);
  });

  it('does not implement Phase 5 cognitive/autonomous behavior', () => {
    for (const f of files) {
      const src = read(f);
      expect(src).not.toMatch(
        /from '.*modules\/(enterprise-understanding|enterprise-recommendation|enterprise-decision)/,
      );
      expect(src).not.toMatch(
        /self-?modif|autonomous loop|cross-run memory|learn from previous run/i,
      );
    }
  });

  it('unknown tools are rejected (registry + runtime guard present)', () => {
    const registry = read(path.join(WR, 'registry/tool-registry.service.ts'));
    expect(registry).toMatch(/Duplicate tool identifier/);
    const runtime = read(path.join(WR, 'runtime/work-runtime.service.ts'));
    expect(runtime).toMatch(/UNKNOWN_TOOL/);
  });
});
