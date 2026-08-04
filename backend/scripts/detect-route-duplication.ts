#!/usr/bin/env npx ts-node --project tsconfig.json

/**
 * Phase 0 — Route-prefix duplication detector.
 *
 * Scans all backend NestJS controllers and emits a YAML report of
 * duplicate `@Controller({ path, version })` prefixes. In NestJS a
 * duplicate route prefix under the same API version is a guaranteed
 * route collision and MUST be resolved before P-1 signs off.
 *
 * SOLID notes:
 *   • Open/Closed: new controllers are picked up automatically.
 *   • Single responsibility: detects, does not fix.
 *
 * Exit codes:
 *   0 — no duplicates found
 *   1 — duplicates found (returns report)
 *   2 — IO / parse error
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

interface ControllerRoute {
  file: string;
  className: string;
  path: string;
  version: string | null;
  fullRoute: string;
}

interface RouteHandler {
  file: string;
  className: string;
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  fullRoute: string; // METHOD + path
  controllerPath: string;
  version: string | null;
}

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const BACKEND_SRC = path.resolve(REPO_ROOT, 'neurecore/backend/src');

interface CliArgs {
  outPath: string;
  failOnDup: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  let outPath =
    'neurecore/memory-bank-arc/comms/route-duplication-report.yaml';
  let failOnDup = false;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out' || a === '-o') outPath = argv[++i];
    else if (a === '--fail') failOnDup = true;
    else if (a === '--help' || a === '-h') {
      console.log('Usage: detect-route-duplication.ts [--out path] [--fail]');
      process.exit(0);
    }
  }
  return { outPath, failOnDup };
}

function listControllerFiles(root: string): string[] {
  const out: string[] = [];
  const stack: string[] = [root];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (
          e.name === 'node_modules' ||
          e.name === 'dist' ||
          e.name === '__tests__'
        ) {
          continue;
        }
        stack.push(full);
      } else if (
        e.isFile() &&
        e.name.endsWith('.controller.ts') &&
        !e.name.endsWith('.spec.ts')
      ) {
        out.push(full);
      }
    }
  }
  return out;
}

function extractControllerMeta(
  file: string,
  contents: string,
): { controllers: ControllerRoute[]; handlers: RouteHandler[] } {
  const lines = contents.split(/\r?\n/);
  const controllers: ControllerRoute[] = [];
  const handlers: RouteHandler[] = [];
  // Active binding: (className, decorator) currently in scope.
  let active: { className: string; decorator: { path: string; version: string | null } } | null = null;

  const flush = (): void => {
    if (active) {
      controllers.push({
        file,
        className: active.className,
        path: active.decorator.path,
        version: active.decorator.version,
        fullRoute:
          (active.decorator.version ?? 'default') +
          '::' +
          (active.decorator.path || '<root>'),
      });
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // @Controller({ path, version }) or @Controller('path')
    // Skip lines that are comments (// or *).
    const lineIsComment = line.trim().startsWith('//') || line.trim().startsWith('*') || line.trim().startsWith('/*');
    const m = !lineIsComment
      ? line.match(/@Controller\s*\(\s*(?:\{([^}]*)\}|'([^']+)')?\s*\)/)
      : null;
    if (m) {
      // The decorator closes one controller and starts another.
      flush();
      active = null;
      let p = '';
      let v: string | null = null;
      if (m[1]) {
        const pMatch = m[1].match(/path\s*:\s*'([^']+)'/);
        const vMatch = m[1].match(/version\s*:\s*'([^']+)'/);
        if (pMatch) p = pMatch[1];
        if (vMatch) v = vMatch[1];
      } else if (m[2]) {
        p = m[2];
      }
      lastDecorator = { path: p, version: v };
      continue;
    }

    const cls = line.match(/export\s+class\s+([A-Za-z0-9_]+)/);
    if (cls) {
      // Attach the most recently seen decorator (if any) to this class.
      active = {
        className: cls[1],
        decorator: lastDecorator ?? { path: '', version: null },
      };
      lastDecorator = null;
      continue;
    }

    // Route handler: @Get('path') etc. Method-only form like @Get() is allowed
    // and treated as the controller's bare index path. Comments and string
    // literals (containing the same words) are skipped.
    const trimmed = line.trim();
    const isComment = trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*');
    const handlerMatch = !isComment
      ? line.match(/@(Get|Post|Patch|Put|Delete)\s*\(\s*(?:'([^']+)')?\s*\)/)
      : null;
    if (handlerMatch && active) {
      const method = handlerMatch[1].toUpperCase() as RouteHandler['method'];
      const sub = handlerMatch[2] ?? '';
      const fullPath = (active.decorator.path
        ? active.decorator.path + (sub ? '/' + sub : '')
        : sub
      ).replace(/\/$/, '');
      handlers.push({
        file,
        className: active.className,
        method,
        path: fullPath,
        controllerPath: active.decorator.path,
        version: active.decorator.version,
        fullRoute: `${method} ${active.decorator.version ?? 'default'}::/${fullPath}`,
      });
    }
  }
  flush();
  return { controllers, handlers };
}

// Module-level slot used to pass the most-recently-matched decorator between
// the @Controller scan and the class scan. (Closure state — not part of the
// public API.)
let lastDecorator: { path: string; version: string | null } | null = null;

function yamlEscape(s: string): string {
  if (s === '') return '""';
  return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

function emitReport(
  duplicates: Map<string, ControllerRoute[]>,
  handlerCollisions: Map<string, RouteHandler[]>,
  totalRoutes: number,
  totalControllers: number,
  totalHandlers: number,
): string {
  const lines: string[] = [];
  lines.push('# NeureCore — Backend Route Duplication Report');
  lines.push('# Generated by backend/scripts/detect-route-duplication.ts');
  lines.push('# DO NOT EDIT BY HAND.');
  lines.push(`schemaVersion: "2.0"`);
  lines.push(`generatedAt: "${new Date().toISOString()}"`);
  lines.push(`totalControllers: ${totalControllers}`);
  lines.push(`totalUniquePrefixes: ${totalRoutes}`);
  lines.push(`totalHandlers: ${totalHandlers}`);
  lines.push(`duplicatePrefixCount: ${duplicates.size}`);
  lines.push(`handlerCollisionCount: ${handlerCollisions.size}`);
  lines.push(`# Severity:`);
  lines.push(`#   COLLISION = same METHOD + same path registered by 2+ controllers (runtime bug)`);
  lines.push(`#   SHADOW    = same controller prefix but disjoint sub-paths (often legitimate SRP split)`);
  lines.push(`handlerCollisions:`);
  const sortedKeys = Array.from(handlerCollisions.keys()).sort();
  for (const k of sortedKeys) {
    const group = handlerCollisions.get(k)!;
    lines.push(`  - route: ${yamlEscape(k)}`);
    lines.push(`    severity: COLLISION`);
    lines.push(`    count: ${group.length}`);
    lines.push(`    handlers:`);
    for (const h of group) {
      lines.push(`      - method: ${h.method}`);
      lines.push(`        class: ${yamlEscape(h.className)}`);
      lines.push(`        file: ${yamlEscape(path.relative(REPO_ROOT, h.file))}`);
    }
  }
  lines.push(`prefixShadows:`);
  const sortedPrefixes = Array.from(duplicates.keys()).sort();
  for (const k of sortedPrefixes) {
    const group = duplicates.get(k)!;
    lines.push(`  - route: ${yamlEscape(k)}`);
    lines.push(`    severity: SHADOW`);
    lines.push(`    count: ${group.length}`);
    lines.push(`    controllers:`);
    for (const c of group) {
      lines.push(`      - class: ${yamlEscape(c.className)}`);
      lines.push(`        file: ${yamlEscape(path.relative(REPO_ROOT, c.file))}`);
    }
  }
  return lines.join('\n') + '\n';
}

function main(): void {
  const args = parseArgs(process.argv);

  if (!fs.existsSync(BACKEND_SRC)) {
    console.error(`missing backend src: ${BACKEND_SRC}`);
    process.exit(2);
  }

  const files = listControllerFiles(BACKEND_SRC);
  const allControllers: ControllerRoute[] = [];
  const allHandlers: RouteHandler[] = [];
  for (const f of files) {
    const txt = fs.readFileSync(f, 'utf8');
    const meta = extractControllerMeta(f, txt);
    allControllers.push(...meta.controllers);
    allHandlers.push(...meta.handlers);
  }

  // 1) Prefix-level shadow: same controller prefix shared by 2+ controllers.
  const byPrefix = new Map<string, ControllerRoute[]>();
  for (const r of allControllers) {
    if (!byPrefix.has(r.fullRoute)) byPrefix.set(r.fullRoute, []);
    byPrefix.get(r.fullRoute)!.push(r);
  }
  const prefixShadows = new Map<string, ControllerRoute[]>();
  for (const [k, group] of byPrefix) {
    if (group.length > 1) prefixShadows.set(k, group);
  }

  // 2) Handler-level collision: same METHOD + same path registered by 2+ handlers.
  const byHandler = new Map<string, RouteHandler[]>();
  for (const h of allHandlers) {
    if (!byHandler.has(h.fullRoute)) byHandler.set(h.fullRoute, []);
    byHandler.get(h.fullRoute)!.push(h);
  }
  const handlerCollisions = new Map<string, RouteHandler[]>();
  for (const [k, group] of byHandler) {
    if (group.length > 1) handlerCollisions.set(k, group);
  }

  const report = emitReport(
    prefixShadows,
    handlerCollisions,
    byPrefix.size,
    allControllers.length,
    allHandlers.length,
  );
  const outAbs = path.resolve(REPO_ROOT, args.outPath);
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  fs.writeFileSync(outAbs, report, 'utf8');

  console.log(`controllers scanned : ${allControllers.length}`);
  console.log(`unique prefixes     : ${byPrefix.size}`);
  console.log(`handlers scanned    : ${allHandlers.length}`);
  console.log(`prefix shadows      : ${prefixShadows.size}  (same prefix, disjoint sub-paths — usually OK)`);
  console.log(`handler collisions  : ${handlerCollisions.size}  (same METHOD+path — runtime bug, MUST fix)`);
  if (handlerCollisions.size > 0) {
    console.log('');
    console.log('Handler-level collisions (severity: COLLISION):');
    for (const [k, group] of handlerCollisions) {
      console.log(`  ${k}`);
      for (const h of group) {
        console.log(
          `    - ${h.method.padEnd(6)} ${h.className.padEnd(30)} ${path.relative(REPO_ROOT, h.file)}`,
        );
      }
    }
  }
  console.log('');
  console.log(`report: ${path.relative(REPO_ROOT, outAbs)}`);

  // Strict mode fails on either real collisions OR prefix shadows. Default
  // mode fails only on real handler-level collisions.
  if (args.failOnDup) {
    if (handlerCollisions.size > 0 || prefixShadows.size > 0) {
      process.exit(1);
    }
  } else if (handlerCollisions.size > 0) {
    process.exit(1);
  }
}

main();
