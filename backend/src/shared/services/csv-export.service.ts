import { Injectable } from '@nestjs/common';

/**
 * CsvExportService
 * SRP: converts raw data rows to RFC 4180-compliant CSV strings.
 * Stateless — no Prisma dependency; callers supply the data.
 */
@Injectable()
export class CsvExportService {
  /**
   * Convert an array of flat objects to a CSV string.
   * Headers are derived from the first row's keys.
   */
  toCsv(rows: Record<string, unknown>[]): string {
    if (!rows.length) return '';
    const headers = Object.keys(rows[0]);
    const lines = [
      headers.map(this.escape).join(','),
      ...rows.map((row) =>
        headers.map((h) => this.escape(String(row[h] ?? ''))).join(','),
      ),
    ];
    return lines.join('\r\n');
  }

  private escape(value: string): string {
    // RFC 4180: wrap in double-quotes if value contains comma, double-quote, or newline
    if (/[",\r\n]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
