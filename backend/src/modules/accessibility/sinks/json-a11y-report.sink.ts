/**
 * Phase 29 — JSON report sink (CR-AI-1304).
 *
 * Writes the machine-readable audit report next to the other
 * certification artefacts so CI and the operator dashboard consume a
 * single, stable file — exactly like `g9-machine-readable.json`.
 *
 * SOLID
 *   SRP — owns ONLY serialization + file write.
 *   LSP — implements `IA11yReportSink`; the console sink and any
 *         future dashboard sink substitute it without runner changes.
 */

import { Injectable, Logger } from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import type { A11yAuditReport } from '../interfaces/IA11yRule';
import type { IA11yReportSink } from '../interfaces/IA11yReportSink';

@Injectable()
export class JsonA11yReportSink implements IA11yReportSink {
  private readonly logger = new Logger(JsonA11yReportSink.name);

  constructor(private readonly outputFile: string) {}

  async publish(report: A11yAuditReport): Promise<void> {
    await mkdir(path.dirname(this.outputFile), { recursive: true });
    await writeFile(
      this.outputFile,
      `${JSON.stringify(report, null, 2)}\n`,
      'utf-8',
    );
    this.logger.log(`a11y report written to ${this.outputFile}`);
  }
}
