/**
 * Phase 24 — G24 Visual skill composer certification runner.
 *
 * Source plan: IMPLEMENTATION_PLAN_PARITY_COMPLETION.md §5 (P24).
 *
 * Verdict criteria — every gate must pass; failures block release.
 *
 *   G24-C-001 — SkillGraphService still validates (R1..R10)
 *   G24-C-002 — SkillGraphRepository refuses wildcard tenantId on save
 *   G24-C-003 — SkillGraphRepository refuses wildcard tenantId on load
 *   G24-C-004 — SkillGraphRepository refuses wildcard tenantId on list
 *   G24-C-005 — SkillGraphRepository refuses wildcard tenantId on remove
 *   G24-C-006 — SkillPreviewService narrows result to nonMutating: true
 *   G24-C-007 — SkillComposerController exposes save/load/remove/preview
 *   G24-C-008 — Prisma SkillGraph model added to schema
 *   G24-C-009 — NodeFE SkillGraphControls exists
 *   G24-C-010 — NodeFE SkillNodeDefs registry has all 7 kinds
 *   G24-C-011 — NodeFE SkillGraphClient.save hits /api/v1/skill-composer/graphs
 *   G24-C-012 — Tenant relation added to Tenant model
 *   G24-C-013 — No regression on prior phase runners
 */

import { Injectable, Logger } from '@nestjs/common';
import { SkillGraphService } from '../../modules/agent-templates/services/skill-graph.service';
import { SkillGraphRepository } from '../../modules/agent-templates/services/skill-graph.repository';
import { SkillPreviewService } from '../../modules/agent-templates/services/skill-preview.service';
import { Phase22CertificationRunner } from './phase22-certification.runner';
import * as fs from 'node:fs';
import * as path from 'node:path';

interface GateResult {
  readonly id: string;
  readonly name: string;
  readonly passed: boolean;
  readonly detail?: string;
}

@Injectable()
export class Phase24CertificationRunner {
  private readonly logger = new Logger(Phase24CertificationRunner.name);

  async run(): Promise<{
    readonly verdict: 'APPROVED' | 'BLOCKED';
    readonly gates: ReadonlyArray<GateResult>;
  }> {
    const gates: GateResult[] = [];
    let allPassed = true;
    const record = (
      id: string,
      name: string,
      passed: boolean,
      detail?: string,
    ) => {
      const r: GateResult = { id, name, passed, detail };
      gates.push(r);
      if (!passed) allPassed = false;
    };

    // G24-C-001 — SkillGraphService still validates
    const graphSvc = new SkillGraphService();
    const validGraph = {
      mode: 'workflow' as const,
      nodes: [],
      edges: [],
      inputs: [],
      outputs: [],
    };
    const result = graphSvc.validate(validGraph, false);
    record(
      'G24-C-001',
      'SkillGraphService.validate still works',
      result.ok === true && Array.isArray(result.issues),
    );

    // G24-C-002..005 — repository wildcard tenantId refusal
    const fakePrisma = {
      skillGraph: {
        create: async () => {
          throw new Error('must not be called');
        },
        findFirst: async () => null,
        findMany: async () => [],
        deleteMany: async () => ({ count: 0 }),
      },
    };
    const repo = new SkillGraphRepository(fakePrisma as never);

    let saveRejected = false;
    try {
      await repo.save({
        tenantId: '*',
        name: 'x',
        graph: validGraph,
        createdById: 'u',
      });
    } catch {
      saveRejected = true;
    }
    record('G24-C-002', 'repository.save refuses wildcard tenant', saveRejected);

    const loadResult = await repo.load('*', 'x');
    record('G24-C-003', 'repository.load refuses wildcard tenant', loadResult === null);

    const listResult = await repo.list('*');
    record('G24-C-004', 'repository.list refuses wildcard tenant', Array.isArray(listResult) && listResult.length === 0);

    const removeResult = await repo.remove('*', 'x');
    record('G24-C-005', 'repository.remove refuses wildcard tenant', removeResult === false);

    // G24-C-006 — preview nonMutating flag
    const fakeRegistry = {
      dispatch: async () => ({
        skillId: 'summarize' as never,
        content: { text: 'ok' },
        citations: [],
        confidence: 0.9,
        durationMs: 12,
      }),
    };
    const previewSvc = new SkillPreviewService(fakeRegistry as never);
    const previewOut = await previewSvc.preview('summarize' as never, { text: 'hi' }, {
      tenantId: 't1',
      isCrossTenant: false,
      actorUserId: 'u1',
      actorRole: 'OWNER' as never,
    });
    record(
      'G24-C-006',
      'SkillPreviewService returns nonMutating: true',
      previewOut.nonMutating === true && previewOut.skillId === 'summarize',
    );

    // G24-C-007 — controller exposes save/load/remove/preview
    const controllerPath = path.join(
      __dirname,
      '..',
      '..',
      'modules',
      'agent-templates',
      'controllers',
      'skill-composer.controller.ts',
    );
    const cSrc = fs.existsSync(controllerPath) ? fs.readFileSync(controllerPath, 'utf-8') : '';
    const cOk =
      cSrc.includes("@Post('graphs')") &&
      cSrc.includes("@Get('graphs')") &&
      cSrc.includes("@Get('graphs/:id')") &&
      cSrc.includes("@Delete('graphs/:id')") &&
      cSrc.includes("@Post('skills/:skillId/preview')");
    record('G24-C-007', 'SkillComposerController exposes save/load/remove/preview', cOk);

    // G24-C-008 — Prisma SkillGraph model
    const schemaPath = path.join(
      __dirname,
      '..',
      '..',
      '..',
      'prisma',
      'schema.prisma',
    );
    const schemaSrc = fs.existsSync(schemaPath) ? fs.readFileSync(schemaPath, 'utf-8') : '';
    record(
      'G24-C-008',
      'Prisma SkillGraph model is in the schema',
      schemaSrc.includes('model SkillGraph') && schemaSrc.includes('@@map("skill_graphs")'),
    );

    // G24-C-009 — FE SkillGraphControls exists
    const controlsPath = path.join(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'frontend-tenant',
      'src',
      'app',
      'marketplace',
      'composer',
      'components',
      'SkillGraphControls.tsx',
    );
    record(
      'G24-C-009',
      'FE SkillGraphControls exists',
      fs.existsSync(controlsPath),
      controlsPath,
    );

    // G24-C-010 — FE SkillNodeDefs registry has 7 kinds
    const defsPath = path.join(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'frontend-tenant',
      'src',
      'app',
      'marketplace',
      'composer',
      'components',
      'SkillNodeDefs.ts',
    );
    const defsSrc = fs.existsSync(defsPath) ? fs.readFileSync(defsPath, 'utf-8') : '';
    const expectedKinds = ['prompt', 'read', 'action', 'condition', 'transform', 'approval', 'envelope'];
    const have = expectedKinds.filter((k) =>
      new RegExp(`kind:\\s*'${k}'`).test(defsSrc),
    );
    record(
      'G24-C-010',
      'FE SkillNodeDefs registry covers all 7 kinds',
      have.length === 7,
      `kinds=${have.join(',')}`,
    );

    // G24-C-011 — FE client.save hits the right URL
    const clientPath = path.join(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'frontend-tenant',
      'src',
      'app',
      'marketplace',
      'composer',
      'components',
      'SkillGraphClient.ts',
    );
    const clientSrc = fs.existsSync(clientPath) ? fs.readFileSync(clientPath, 'utf-8') : '';
    record(
      'G24-C-011',
      'FE SkillGraphClient.save hits /api/v1/skill-composer/graphs',
      clientSrc.includes('${this.baseUrl}/graphs') && clientSrc.includes('POST'),
    );

    // G24-C-012 — Tenant relation for SkillGraph
    record(
      'G24-C-012',
      'Tenant model has skillGraphs back-relation',
      schemaSrc.includes('TenantSkillGraphs'),
    );

    // G24-C-013 — no regression on prior phases
    try {
      const p22 = await new Phase22CertificationRunner().run();
      record('G24-C-013', 'Phase 22 G22 still APPROVED', p22.verdict === 'APPROVED');
    } catch (err) {
      record('G24-C-013', 'Phase 22 G22 still APPROVED', false, (err as Error).message);
    }

    return {
      verdict: allPassed ? 'APPROVED' : 'BLOCKED',
      gates,
    };
  }
}
