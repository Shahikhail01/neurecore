/**
 * Phase 29 — Report sink contract (CR-AI-1304).
 *
 * Source plan: IMPLEMENTATION-PLAN-PARITY-COMPLETION.md §10 (P29).
 *
 * SOLID
 *   ISP — one method. Publishing is deliberately separated from
 *         evaluation so a rule can never write a file.
 *   OCP — a new destination (JSON file, console, dashboard, S3) is a
 *         new sink implementation; the runner is untouched.
 */

import type { A11yAuditReport } from './IA11yRule';

export interface IA11yReportSink {
  publish(report: A11yAuditReport): Promise<void>;
}
