// src/modules/phase8/observability/golden-path-alerts.spec.ts
import { Registry } from 'prom-client';
import {
  GOLDEN_PATH_ALERTS,
  GOLDEN_PATH_ALERT_IDS,
} from './golden-path-alerts';
import { buildGoldenPathMetrics } from './golden-path-metrics';
import * as fs from 'fs';
import * as path from 'path';

describe('GoldenPathAlertRule catalog (Phase 8 — §10.6 gate G8 alert coverage)', () => {
  it('catalog is non-empty', () => {
    expect(GOLDEN_PATH_ALERTS.length).toBeGreaterThan(0);
  });

  it('every alert has a unique id', () => {
    const ids = new Set<string>();
    for (const rule of GOLDEN_PATH_ALERTS) {
      expect(ids.has(rule.id)).toBe(false);
      ids.add(rule.id);
    }
  });

  it('every alert has a non-empty description + runbook', () => {
    for (const rule of GOLDEN_PATH_ALERTS) {
      expect(rule.description.length).toBeGreaterThan(10);
      expect(rule.runbookFile.length).toBeGreaterThan(0);
      expect(rule.expression.length).toBeGreaterThan(0);
      expect(['page', 'warn', 'info']).toContain(rule.severity);
    }
  });

  it('every alert runbook exists on disk', () => {
    // __dirname = src/modules/phase8/observability → repo-root/backend
    const runbooksDir = path.join(__dirname, '../../../docs/runbooks');
    for (const rule of GOLDEN_PATH_ALERTS) {
      const runbookPath = path.join(runbooksDir, rule.runbookFile);
      expect(fs.existsSync(runbookPath)).toBe(true);
    }
  });

  it('covers the G8 criteria (stuck, backlog, failures, dead letter, session, socket)', () => {
    const expectedIds = [
      'outbox-backlog-critical',
      'outbox-poison-event',
      'execution-stuck',
      'provider-outage',
      'session-refresh-failure',
      'socket-error-burst',
    ];
    for (const id of expectedIds) {
      expect(GOLDEN_PATH_ALERT_IDS).toContain(id);
    }
  });

  it('every metric referenced by an expression is declared in the golden-path catalog', () => {
    const referenced = new Set<string>();
    const metricCandidate =
      /\b([a-z][a-z0-9_]*_(?:total|seconds|size|rate))\b/g;
    for (const rule of GOLDEN_PATH_ALERTS) {
      const matches = rule.expression.match(metricCandidate) ?? [];
      for (const m of matches) {
        referenced.add(m);
      }
    }
    const instance = buildGoldenPathMetrics(new Registry());
    const declared = new Set<string>();
    for (const k of Object.keys(instance)) {
      const v = (instance as unknown as Record<string, unknown>)[k];
      if (v && typeof v === 'object') {
        const name = (v as { name?: string }).name;
        if (name) declared.add(name);
      }
    }
    expect(referenced.size).toBeGreaterThan(0);
    for (const m of referenced) {
      expect(declared.has(m)).toBe(true);
    }
  });
});
