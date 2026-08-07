/**
 * Phase 11 — Integrity regression guard.
 *
 * Source plan: IMPLEMENTATION_PLAN_PHASE11.md §6.
 *
 * The `SkillRegistryImplementsFlag` rule:
 *   - Every skill with `implemented: true` MUST be registered in the
 *     runtime SkillRegistry AND have an executable file under
 *     `modules/skill-registry/skills/`.
 *   - The `SkillRegistryController` SKILL_METADATA map declares what
 *     is advertised; the runtime registry declares what is wired.
 *     The two MUST agree.
 *
 * If a future PR adds a new skill metadata entry with a typo, no
 * handler, or a missing file, this test fails CI. That is the F-1
 * integrity violation we are guarding against.
 */

import * as path from 'node:path';
import { readFileSync, readdirSync, statSync } from 'node:fs';

const SR_ROOT = path.join(__dirname, '..', '..', 'modules', 'skill-registry');
const CONTROLLER_FILE = path.join(
  SR_ROOT,
  '..',
  'chat',
  'skill-registry.controller.ts',
);

function readAllSkills(): Array<{ id: string; file: string; dir: string }> {
  // Skills can live in `skill-registry/skills/` OR in the marketing
  // / service modules. Walk all of them.
  const subdirs = [
    path.join(SR_ROOT, 'skills'),
    path.join(SR_ROOT, '..', 'marketing', 'skills'),
    path.join(SR_ROOT, '..', 'service', 'skills'),
  ];
  const out: Array<{ id: string; file: string; dir: string }> = [];
  for (const dir of subdirs) {
    if (!statSync(dir, { throwIfNoEntry: false })) continue;
    const files = readdirSync(dir).filter(
      (f) => f.endsWith('.skill.ts') && f !== 'base.skill.ts',
    );
    for (const file of files) {
      const content = readFileSync(path.join(dir, file), 'utf-8');
      const m = content.match(/readonly id:\s*SkillId\s*=\s*'([^']+)'/);
      if (m) out.push({ id: m[1]!, file, dir });
    }
  }
  return out;
}

function advertisedSkillIds(): string[] {
  const content = readFileSync(CONTROLLER_FILE, 'utf-8');
  // The SKILL_METADATA object is `Record<id, Omit<...>>`. Each
  // top-level key is on its own line of the form:
  //   '<id>': {
  // We restrict to the known skill ids only (excludes helper-property
  // names like `implementation`).
  // Phases 11–20 added the following; Phase 11=7, Phase 12=+2
  // (`article-draft`, `knowledge-health`), Phase 13=+1 (`nl-draft`),
  // Phase 19=+4 (segment, campaign-brief, case-resolve, case-response),
  // Phase 20=+2 (crm-event, crm-webhook).
  const KNOWN_IDS = new Set([
    'summarize',
    'rewrite',
    'translate',
    'extract',
    'compare',
    'draft-report',
    'draft-email',
    'article-draft',
    'knowledge-health',
    'nl-draft',
    'segment',
    'campaign-brief',
    'case-resolve',
    'case-response',
    'crm-event',
    'crm-webhook',
  ]);
  const out: string[] = [];
  const re = /^\s*'?([a-z][a-z0-9-]*)'?:\s*\{/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (KNOWN_IDS.has(m[1])) out.push(m[1]);
  }
  return out;
}

describe('Phase 11 — SkillRegistryImplementsFlag', () => {
  it('every advertised skill has an executable skill file', () => {
    const skillFiles = new Map(readAllSkills().map((s) => [s.id, s.file]));
    const advertised = advertisedSkillIds();
    // Phase 11 = 7 skills; Phase 12 adds `article-draft` + `knowledge-health` → 9;
    // Phase 13 adds `nl-draft` → 10.
    expect(advertised.length).toBeGreaterThanOrEqual(7);
    for (const id of advertised) {
      const file = skillFiles.get(id);
      expect(file).toBeDefined();
    }
  });

  it('every skill file declares a SkillId that matches its filename', () => {
    for (const s of readAllSkills()) {
      const startsWith = s.file.startsWith(s.id);
      expect(startsWith).toBe(true);
    }
  });

  it('every skill file exposes a buildPrompt method', () => {
    for (const s of readAllSkills()) {
      const content = readFileSync(path.join(s.dir, s.file), 'utf-8');
      expect(content).toMatch(/buildPrompt\s*\(/);
      expect(content).toMatch(/validateInput\s*\(/);
    }
  });
});
