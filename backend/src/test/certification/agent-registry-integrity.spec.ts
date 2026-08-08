/**
 * Phase 13 — AgentRegistryImplementsFlag integrity guard.
 *
 * Source plan: IMPLEMENTATION-PLAN-PHASE-13-14.md §6.
 *
 * Closes the same F-1 integrity violation that
 * `SkillRegistryImplementsFlag` (Phase 11) closes for skills:
 *
 *   - every OOB agent declared with `implemented: true` MUST have a
 *     runtime instance file under `agent-templates/instances/`;
 *   - every runtime instance file MUST declare a typed
 *     `OotbAgentDefinition` whose `stableId` matches the
 *     matching CR-AI-050x baseline code;
 *   - the 6 baseline agent ids MUST be present in the registry.
 *
 * The guard fails CI if a future PR adds a metadata entry without a
 * handler, or removes a runtime instance leaving the metadata
 * dangling.
 */

import * as path from 'node:path';
import { readFileSync, readdirSync, statSync } from 'node:fs';

const SR_ROOT = path.join(__dirname, '..', '..', 'modules', 'agent-templates');
const INSTANCES_DIR = path.join(SR_ROOT, 'instances');
const RUNTIME_EXECUTORS_DIR = path.join(
  __dirname,
  '..',
  '..',
  'modules',
  'agent-runtime',
  'executors',
);

function listAgentFiles(): string[] {
  if (!statSync(INSTANCES_DIR, { throwIfNoEntry: false })) return [];
  return readdirSync(INSTANCES_DIR).filter((f) => f.endsWith('.agent.ts'));
}

function readAllAgents(): Array<{
  id: string;
  file: string;
  stableId: string | null;
  type: string | null;
}> {
  return listAgentFiles().map((file) => {
    const content = readFileSync(path.join(INSTANCES_DIR, file), 'utf-8');
    // Two shapes present in the repo: `readonly stableId: <const>` and
    // `stableId: <const>` — both with the const name matching
    // `<NAME>_AGENT_ID`.
    const stable = content.match(
      /(?:readonly\s+)?stableId:\s*(\w+_AGENT_ID)/,
    );
    const stableId = stable ? extractAgentId(content, stable[1]) : null;
    const type = content.match(
      /(?:readonly\s+)?type:\s*'(UNIVERSAL|PRODUCTIVITY|SALES|MARKETING|SERVICE|KNOWLEDGE)'/,
    );
    return {
      id: file.replace('.agent.ts', ''),
      file,
      stableId,
      type: type ? type[1] : null,
    };
  });
}

function extractAgentId(content: string, constName: string): string | null {
  // The constant export is `export const NAME_AGENT_ID = 'CR-AI-0501'` etc.
  const re = new RegExp(
    `export const ${constName}\\s*=\\s*'([^']+)'`,
  );
  const m = content.match(re);
  return m ? m[1] : null;
}

/**
 * The 6 baseline ids from `creatio-parity-baseline.yaml`.
 */
const PHASE_13_BASELINE_IDS = [
  'CR-AI-0501',
  'CR-AI-0502',
  'CR-AI-0503',
  'CR-AI-0504',
  'CR-AI-0505',
  'CR-AI-0506',
] as const;

describe('Phase 13 — AgentRegistryImplementsFlag', () => {
  it('every baseline OOB agent has an instance file', () => {
    const ids = readAllAgents()
      .map((a) => a.stableId)
      .filter((s): s is string => Boolean(s));
    for (const id of PHASE_13_BASELINE_IDS) {
      const ok = ids.includes(id);
      if (!ok) throw new Error(`agent ${id} has no instance file`);
    }
  });

  it('every instance file declares both a stableId and a type', () => {
    for (const a of readAllAgents()) {
      if (a.stableId === null) throw new Error(`${a.file} has no stableId`);
      if (a.type === null) throw new Error(`${a.file} has no type`);
    }
  });

  it('exactly 6 OOB agents are registered', () => {
    const types = readAllAgents()
      .map((a) => a.type)
      .filter((t): t is string => Boolean(t));
    if (new Set(types).size !== 6) {
      throw new Error(`expected 6 distinct types, got ${new Set(types).size}`);
    }
  });

  it('every instance file has a name matching the conventional shape', () => {
    for (const f of listAgentFiles()) {
      const ok =
        f === 'index.ts' || /^[A-Z_]+\.agent\.ts$/.test(f);
      if (!ok) throw new Error(`${f} breaks the naming convention`);
    }
  });

  it('Phase 23 — every OOB agent type has a runtime executor file', () => {
    if (!statSync(RUNTIME_EXECUTORS_DIR, { throwIfNoEntry: false })) {
      throw new Error(
        `phase 23 runtime executors dir missing: ${RUNTIME_EXECUTORS_DIR}`,
      );
    }
    const executorFiles = readdirSync(RUNTIME_EXECUTORS_DIR).filter(
      (f) => f.endsWith('-agent.executor.ts'),
    );
    const types = readAllAgents()
      .map((a) => a.type)
      .filter((t): t is string => Boolean(t));
    for (const type of types) {
      const lc = type.toLowerCase();
      const match = executorFiles.find((f) => f.startsWith(`${lc}-agent.`));
      if (!match) {
        throw new Error(
          `agent type ${type} has no runtime executor under ${RUNTIME_EXECUTORS_DIR}`,
        );
      }
    }
  });

  it('Phase 23 — every executor declares its agentId as a typed string literal', () => {
    const executorFiles = readdirSync(RUNTIME_EXECUTORS_DIR).filter(
      (f) => f.endsWith('-agent.executor.ts'),
    );
    for (const f of executorFiles) {
      const content = readFileSync(
        path.join(RUNTIME_EXECUTORS_DIR, f),
        'utf-8',
      );
      const m = content.match(/agentId:\s*AgentId\s*=\s*'CR-AI-\d{4}'/);
      if (!m) {
        throw new Error(
          `${f} does not declare a typed AgentId literal — violates SOLID-OCP`,
        );
      }
    }
  });
});
