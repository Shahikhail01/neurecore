/**
 * Phase 13 — G13 Agents certification runner.
 *
 * Source plan: IMPLEMENTATION-PLAN-PHASE-13-14.md §6.
 *
 * Verdict criteria — every gate must pass; failures block release.
 *
 *   G13-A-001 — AgentRegistry registers 6 OOB agents at boot
 *   G13-A-002 — every advertised agent has the typed IAgentDefinition shape
 *   G13-A-003 — Phase 12 G12 still APPROVED
 *   G13-A-004 — Phase 11 G11 still APPROVED
 *   G13-A-005 — NlDraftSkill rejects empty NL
 *   G13-A-006 — NlDraftSkill rejects unknown mode
 *   G13-A-007 — NlDraftSkill accepts chat + workflow
 *   G13-A-008 — NlDraftSkill parse always produces refusedActivation: true
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  AgentRegistry,
  PHASE_13_OOB_AGENT_IDS,
} from '../../modules/agent-templates/agents.registry';
import {
  NlDraftSkill,
} from '../../modules/skill-registry/skills';
import { Phase11CertificationRunner } from './phase11-certification.runner';
import { Phase12CertificationRunner } from './phase12-certification.runner';

interface GateResult {
  readonly id: string;
  readonly name: string;
  readonly passed: boolean;
  readonly detail?: string;
}

@Injectable()
export class Phase13CertificationRunner {
  private readonly logger = new Logger(Phase13CertificationRunner.name);

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

    // ─── Build the AgentRegistry synchronously (no Nest lifecycle).
    const registry = new AgentRegistry();
    registry.registerAll();
    const agents = registry.list();

    // G13-A-001 — 6 OOB agents at boot
    {
      const ok = agents.length === 6 && PHASE_13_OOB_AGENT_IDS.length === 6;
      record('G13-A-001', 'AgentRegistry registers 6 OOB agents at boot', ok);
    }

    // G13-A-002 — every agent has a typed IAgentDefinition shape
    {
      const failures: string[] = [];
      for (const a of agents) {
        if (!a.id) failures.push(`${a.stableId} missing id`);
        if (!a.displayName) failures.push(`${a.stableId} missing displayName`);
        if (!a.description) failures.push(`${a.stableId} missing description`);
        if (!Array.isArray(a.skillKeys)) {
          failures.push(`${a.stableId} missing skillKeys[]`);
        }
        if (!Array.isArray(a.channels)) {
          failures.push(`${a.stableId} missing channels[]`);
        }
        if (a.implemented !== true) {
          failures.push(`${a.stableId} not implemented`);
        }
      }
      record(
        'G13-A-002',
        'every advertised agent has the typed IAgentDefinition shape',
        failures.length === 0,
        failures.length === 0 ? undefined : failures.join('; '),
      );
    }

    // G13-A-003 — Phase 12 G12 still APPROVED
    {
      try {
        const p12 = await new Phase12CertificationRunner().run();
        record('G13-A-003', 'Phase 12 G12 still APPROVED', p12.verdict === 'APPROVED');
      } catch (err) {
        record('G13-A-003', 'Phase 12 G12 still APPROVED', false, (err as Error).message);
      }
    }

    // G13-A-004 — Phase 11 G11 still APPROVED
    {
      try {
        const p11 = await new Phase11CertificationRunner().run();
        record('G13-A-004', 'Phase 11 G11 still APPROVED', p11.verdict === 'APPROVED');
      } catch (err) {
        record('G13-A-004', 'Phase 11 G11 still APPROVED', false, (err as Error).message);
      }
    }

    // G13-A-005 / 006 / 007 — NlDraftSkill input validation
    {
      const skill = new NlDraftSkill();
      // each case: `shouldAccept` says whether the input is supposed to pass
      const cases: Array<{ name: string; input: unknown; shouldAccept: boolean }> = [
        {
          name: 'empty NL rejected',
          input: { naturalLanguage: '', targetMode: 'chat' },
          shouldAccept: false,
        },
        {
          name: 'unknown mode rejected',
          input: { naturalLanguage: 'x', targetMode: 'dream' },
          shouldAccept: false,
        },
        {
          name: 'chat accepted',
          input: { naturalLanguage: 'do something', targetMode: 'chat' },
          shouldAccept: true,
        },
        {
          name: 'workflow accepted',
          input: { naturalLanguage: 'do something', targetMode: 'workflow' },
          shouldAccept: true,
        },
      ];
      const failures: string[] = [];
      for (const c of cases) {
        const accepted = skill.validateInput(c.input as never);
        if (accepted !== c.shouldAccept) {
          failures.push(`${c.name} expected=${c.shouldAccept} got=${accepted}`);
        }
      }
      record(
        'G13-A-005',
        'NlDraftSkill input validation',
        failures.length === 0,
        failures.length === 0 ? undefined : failures.join('; '),
      );
    }

    // G13-A-008 — NlDraftSkill parse always produces refusedActivation: true
    {
      const skill = new NlDraftSkill();
      const { prompt } = skill.buildPrompt(
        { naturalLanguage: 'build a workflow', targetMode: 'workflow' },
        {
          tenantId: 't',
          isCrossTenant: false,
          actorRole: 'OWNER',
          actorUserId: 'u1',
        },
      );
      const parsed = prompt.parse(
        '{"content": {"draftGraph": {"nodes": [], "edges": [], "inputs": [], "outputs": []}, "explainedIntents": []}, "limits": []}',
      ) as { content: { refusedActivation: boolean } };
      record(
        'G13-A-008',
        'NlDraftSkill parse always produces refusedActivation=true',
        parsed.content.refusedActivation === true,
      );
    }

    this.logger.log(
      `Phase 13 certification: ${gates.filter((g) => g.passed).length}/${gates.length} passed`,
    );
    return {
      verdict: allPassed ? 'APPROVED' : 'BLOCKED',
      gates,
    };
  }
}
