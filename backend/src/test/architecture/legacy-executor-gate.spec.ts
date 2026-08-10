/**
 * Phase 0 — Legacy Executor Gate
 *
 * Prevents new direct imports and calls of AgentExecutorService.executeTask()
 * outside the approved paths. New execution paths MUST use AIEmployeeCore.
 *
 * Approved paths (existing callers grandfathered in):
 *   - Its own implementation file (agent-executor.service.ts)
 *   - The agents controller (agents.controller.ts)
 *   - The agents module wiring (agents.module.ts)
 *   - The streaming agent controller (agent-streaming.controller.ts)
 *   - Architecture test files (this file)
 *
 * When the compatibility adapter is implemented in Phase 8, its exact path
 * may be added to the allowed set. Whole directories are never allowlisted.
 */

import * as fs from 'fs';
import * as path from 'path';

const SRC = path.resolve(__dirname, '../..'); // .../backend/src

/** Recursively collect all .ts files, skipping dist, node_modules, .jest-cache */
function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.jest-cache', '__tests__'].includes(entry.name)) continue;
      walk(full, out);
    } else if (entry.name.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

/** Normalize a file path relative to SRC for display and matching. */
function rel(p: string): string {
  return path.relative(SRC, p);
}

/** The set of files grandfathered to import AgentExecutorService. */
const ALLOWED_IMPORTERS = new Set([
  // The implementation itself
  'modules/agents/services/agent-executor.service.ts',
  // Existing REST controller
  'modules/agents/agents.controller.ts',
  // Module wiring / DI registration
  'modules/agents/agents.module.ts',
  // Existing streaming controller
  'modules/agents/streaming/agent-streaming.controller.ts',
  // Add the exact compatibility-adapter path here only when it exists.
]);

describe('Architecture: Legacy AgentExecutorService.executeTask() gate', () => {
  const allFiles = walk(SRC);
  const sourceFiles = allFiles.filter(
    (f) => !f.endsWith('.spec.ts') && !f.endsWith('.test.ts'),
  );

  it('no NEW file imports AgentExecutorService outside the approved set', () => {
    const importers: string[] = [];

    for (const f of sourceFiles) {
      const r = rel(f);
      if (ALLOWED_IMPORTERS.has(r)) continue;

      const content = fs.readFileSync(f, 'utf8');
      // Match any import of AgentExecutorService (named, default, re-export, etc.)
      if (
        /AgentExecutorService/.test(content) &&
        /import\b/.test(content)
      ) {
        importers.push(r);
      }
    }

    if (importers.length > 0) {
      console.error(
        'NEW AgentExecutorService importers detected (must use AIEmployeeCore instead):',
      );
      importers.forEach((i) => console.error('  -', i));
    }
    expect(importers).toEqual([]);
  });

  it('no file outside the agents module calls .executeTask() on AgentExecutorService', () => {
    const violators: string[] = [];

    for (const f of sourceFiles) {
      const r = rel(f);
      if (ALLOWED_IMPORTERS.has(r)) continue;
      // Allow this architecture test itself
      if (r.includes('test/architecture/')) continue;

      const content = fs.readFileSync(f, 'utf8');
      if (/\bexecuteTask\s*\(/.test(content)) {
        // Check that AgentExecutorService is actually referenced here
        // (avoid flagging unrelated executeTask methods)
        if (/AgentExecutorService/.test(content)) {
          violators.push(r);
        }
      }
    }

    if (violators.length > 0) {
      console.error(
        'Files calling AgentExecutorService.executeTask() outside approved paths:',
      );
      violators.forEach((v) => console.error('  -', v));
    }
    expect(violators).toEqual([]);
  });

  it('AgentExecutorService is only imported from its own module directory or approved adapters', () => {
    const violators: string[] = [];

    for (const f of sourceFiles) {
      const r = rel(f);
      if (ALLOWED_IMPORTERS.has(r)) continue;
      if (r.includes('test/architecture/')) continue;
      // Allow test files that must mock/inspect the legacy service
      if (f.endsWith('.spec.ts')) continue;

      const content = fs.readFileSync(f, 'utf8');
      // Check for import statements specifically importing from agent-executor.service
      if (
        /from\s+['"].*agent-executor\.service['"]/.test(content) ||
        /require\s*\(.*agent-executor\.service/.test(content)
      ) {
        violators.push(r);
      }
    }

    if (violators.length > 0) {
      console.error(
        'Files importing from agent-executor.service.ts outside approved paths:',
      );
      violators.forEach((v) => console.error('  -', v));
    }
    expect(violators).toEqual([]);
  });
});
