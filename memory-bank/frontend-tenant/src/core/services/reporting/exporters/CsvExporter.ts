// ─── CsvExporter.ts ──────────────────────────────────────────────────────────
// SRP: Converts a Report to a CSV Blob only.
// OCP: New export formats are new IReportExporter implementations.

import type { IReportExporter, Report, ReportField } from '@/core/services/reporting/interfaces/IReportBuilder';

function escapeCsvField(value: unknown): string {
  if (value == null) return '';
  const str = String(value);
  // Wrap in quotes if contains comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function applyFormatter(field: ReportField, row: Record<string, unknown>): string {
  const raw = row[field.key];
  if (field.formatter) return field.formatter(raw);
  return escapeCsvField(raw);
}

export class CsvExporter implements IReportExporter {
  readonly format = 'csv' as const;

  export(report: Report): Blob {
    const { fields, data } = report;

    // Header row
    const header = fields.map((f) => escapeCsvField(f.label)).join(',');

    // Data rows
    const rows = data.map((row) =>
      fields.map((f) => applyFormatter(f, row)).join(','),
    );

    const csv = [header, ...rows].join('\n');
    return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  }
}

export const csvExporter = new CsvExporter();
