// ─── JsonExporter.ts ─────────────────────────────────────────────────────────
// SRP: Converts a Report to a formatted JSON Blob.
// OCP: Added as a new strategy without changing existing exporters.

import type { IReportExporter, Report } from '@/core/services/reporting/interfaces/IReportBuilder';

export class JsonExporter implements IReportExporter {
  readonly format = 'json' as const;

  export(report: Report): Blob {
    const output = {
      title: report.title,
      entity: report.entity,
      generatedAt: report.metadata.generatedAt,
      fields: report.fields.map((f) => ({ key: f.key, label: f.label })),
      data: report.data,
      metadata: report.metadata,
    };
    return new Blob([JSON.stringify(output, null, 2)], {
      type: 'application/json',
    });
  }
}

export const jsonExporter = new JsonExporter();
