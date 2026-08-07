/**
 * Phase 21 — Llm integrity guard.
 *
 * F-1 regression spec: the LLM runner is opt-in ONLY. By default
 * OFF, no provider is mutated. This guard scans the 5 prediction
 * providers and asserts that none of them imports or instantiates
 * the LlmModelRunner class. A future PR that mutates a provider
 * to use the LLM runner MUST add the provider's id to the
 * ALLOWED_LLM_OPT_IN list and explicitly flip the flag.
 */

import * as path from 'node:path';
import { readFileSync, readdirSync, statSync } from 'node:fs';

const PROVIDERS_DIR = path.join(
  __dirname,
  '..',
  '..',
  'modules',
  'analytics',
  'providers',
);

const ALLOWED_LLM_OPT_IN: string[] = [];

function listProviders(): string[] {
  if (!statSync(PROVIDERS_DIR, { throwIfNoEntry: false })) return [];
  return readdirSync(PROVIDERS_DIR).filter((f) => f.endsWith('.provider.ts'));
}

describe('Phase 21 — Llm integrity guard', () => {
  it('no prediction provider instantiates LlmModelRunner outside the ALLOWED_LLM_OPT_IN list', () => {
    const offenders: string[] = [];
    for (const p of listProviders()) {
      const content = readFileSync(path.join(PROVIDERS_DIR, p), 'utf-8');
      if (/new\s+LlmModelRunner\(/.test(content)) {
        if (!ALLOWED_LLM_OPT_IN.includes(p)) {
          offenders.push(p);
        }
      }
      if (/LlmFeatureFlagService/.test(content)) {
        if (!ALLOWED_LLM_OPT_IN.includes(p)) {
          offenders.push(p + ' (uses LlmFeatureFlagService)');
        }
      }
    }
    if (offenders.length > 0) {
      throw new Error(
        `Llm integrity guard: the following provider(s) opt into the LLM runner without being on the ALLOWED_LLM_OPT_IN allow-list: ` +
          offenders.join(', ') +
          '. Add the provider id to ALLOWED_LLM_OPT_IN in phase21-llm-integrity.spec.ts.',
      );
    }
  });

  it('no skill uses the LlmModelRunner at boot', () => {
    const skillsDir = path.join(
      __dirname,
      '..',
      '..',
      'modules',
      'skill-registry',
      'skills',
    );
    if (!statSync(skillsDir, { throwIfNoEntry: false })) return;
    const offenders: string[] = [];
    for (const f of readdirSync(skillsDir).filter((x) => x.endsWith('.skill.ts'))) {
      const content = readFileSync(path.join(skillsDir, f), 'utf-8');
      if (/new\s+LlmModelRunner\(/.test(content) || /import.*LlmModelRunner/.test(content)) {
        offenders.push(f);
      }
    }
    if (offenders.length > 0) {
      throw new Error(
        `Llm integrity guard: skill(s) import LlmModelRunner: ${offenders.join(', ')}. ` +
          'Skills run inside SkillExecutor which goes through the executor runner; skills must NOT bring their own LLM handle — add it to SkillExecutor instead.',
      );
    }
  });
});
