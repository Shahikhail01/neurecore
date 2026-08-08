/**
 * Phase 29 — In-memory report sink (CR-AI-1304).
 *
 * Retains the last published report so the G29 gate (and any unit
 * test) can assert on the runner's output without touching disk.
 *
 * SOLID
 *   SRP — owns ONLY retention of the last report.
 *   LSP — a drop-in substitute for the JSON sink.
 */

import { Injectable } from '@nestjs/common';
import type { A11yAuditReport } from '../interfaces/IA11yRule';
import type { IA11yReportSink } from '../interfaces/IA11yReportSink';

@Injectable()
export class InMemoryA11yReportSink implements IA11yReportSink {
  private last: A11yAuditReport | null = null;

  publish(report: A11yAuditReport): Promise<void> {
    this.last = report;
    return Promise.resolve();
  }

  lastReport(): A11yAuditReport | null {
    return this.last;
  }
}
