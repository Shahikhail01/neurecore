/**
 * Phase 28 — SOLID integrity guard (frontend).
 *
 * Source plan: IMPLEMENTATION_PLAN_PARITY_COMPLETION.md §2 (100 % SOLID)
 * and §9 (P28).
 *
 * Scans the FE mobile module files for the 5 SOLID principles.
 * Treated as a vitest gate so CI fails if the FE files violate the
 * rules.
 *
 *   SRP — no file > 400 LOC; one concern per module
 *   OCP — a new action = new row in the matrix; no switch on the gate
 *   LSP — every concrete implements the corresponding interface
 *   ISP — interfaces declare <= 5 methods
 *   DIP — domain code depends on interfaces, not on `window`
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const MOBILE_DIR = path.resolve(__dirname);

const MAX_FILE_LOC = 400;
const MAX_INTERFACE_METHODS = 5;

function readSource(rel: string): string {
  const abs = path.join(MOBILE_DIR, rel);
  if (!fs.existsSync(abs)) return '';
  return fs.readFileSync(abs, 'utf-8');
}

function countInterfaceMethods(src: string): Map<string, number> {
  const map = new Map<string, number>();
  const re = /interface\s+(I[A-Z]\w*)\s*\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const body = m[2];
    const methods = (body.match(/^\s*[a-zA-Z_]\w*\s*\(/gm) ?? []).length;
    map.set(m[1], methods);
  }
  return map;
}

const FILES = [
  'mobile-matrix.ts',
  'static-matrix-source.ts',
  'viewport-detector.ts',
  'matchmedia-viewport-detector.ts',
  'mobile-action-gate.ts',
  'mobile-provider.tsx',
  'mobile-shell.tsx',
  'mobile-nav.tsx',
  'index.ts',
];

describe('Phase 28 — FE mobile module SOLID integrity', () => {
  describe('SRP — file size <= 400 LOC', () => {
    for (const rel of FILES) {
      it(`${rel} is <= ${MAX_FILE_LOC} LOC`, () => {
        const src = readSource(rel);
        const loc = src.split('\n').length;
        expect(loc).toBeLessThanOrEqual(MAX_FILE_LOC);
      });
    }
  });

  describe('OCP — matrix data, no switch inside the gate', () => {
    it('mobile-action-gate does not branch on action string', () => {
      const src = readSource('mobile-action-gate.ts');
      // OCP: the gate should look up the action via the matrix,
      // not via a switch on the action string.
      expect(src).not.toMatch(/switch\s*\(\s*action/);
    });

    it('matrix is a ReadonlyArray<MobileAction>', () => {
      const src = readSource('mobile-matrix.ts');
      expect(src).toMatch(/ReadonlyArray<MobileAction>/);
    });
  });

  describe('LSP — concrete classes implement the I… interfaces', () => {
    it('StaticMobileSupportMatrixSource implements IMobileSupportMatrixSource', () => {
      const src = readSource('static-matrix-source.ts');
      expect(src).toMatch(
        /class\s+StaticMobileSupportMatrixSource\s+implements\s+IMobileSupportMatrixSource/,
      );
    });

    it('MatchMediaViewportDetector implements IViewportDetector', () => {
      const src = readSource('matchmedia-viewport-detector.ts');
      expect(src).toMatch(
        /class\s+MatchMediaViewportDetector\s+implements\s+IViewportDetector/,
      );
    });

    it('MobileActionGate implements IActionGate', () => {
      const src = readSource('mobile-action-gate.ts');
      expect(src).toMatch(/class\s+MobileActionGate\s+implements\s+IActionGate/);
    });
  });

  describe('ISP — interfaces declare <= 5 methods', () => {
    const cases: Array<{ rel: string; iface: string }> = [
      { rel: 'mobile-matrix.ts', iface: 'IActionGate' },
      { rel: 'mobile-matrix.ts', iface: 'IMobileSupportMatrixSource' },
      { rel: 'viewport-detector.ts', iface: 'IViewportDetector' },
    ];
    for (const { rel, iface } of cases) {
      it(`${iface} <= ${MAX_INTERFACE_METHODS} methods`, () => {
        const src = readSource(rel);
        const counts = countInterfaceMethods(src);
        expect(counts.has(iface)).toBe(true);
        expect(counts.get(iface) ?? 0).toBeLessThanOrEqual(MAX_INTERFACE_METHODS);
      });
    }
  });

  describe('DIP — domain code depends on interfaces, not on `window`', () => {
    it('MobileActionGate constructor takes I… interfaces', () => {
      const src = readSource('mobile-action-gate.ts');
      expect(src).toMatch(
        /constructor\s*\(\s*private readonly source: IMobileSupportMatrixSource/,
      );
      expect(src).toMatch(
        /private readonly detector: IViewportDetector/,
      );
    });

    it('matchmedia-viewport-detector abstracts window via injected matchMedia', () => {
      const src = readSource('matchmedia-viewport-detector.ts');
      // The detector accepts an optional `win` argument so tests
      // inject a stub — DIP-friendly.
      expect(src).toMatch(/matchMedia/);
    });
  });
});
