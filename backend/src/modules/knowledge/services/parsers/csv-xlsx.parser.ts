/**
 * CSV / XLSX parser — uses the optional `xlsx` (SheetJS) package.
 *
 * Package: `xlsx` (Apache-2.0). When not installed the parser abstains
 * with a typed `ParserUnavailableError`. CSV without `xlsx` falls back
 * to a minimal regex-based row split.
 */
import { Injectable, Logger } from '@nestjs/common';
import {
  IFileParser,
  ParsedDocument,
  ParserFormatError,
  ParserUnavailableError,
  ParserWarning,
} from './parser.interface';

interface XlsxModule {
  read: (
    data: Buffer,
    opts: { type: 'buffer' },
  ) => {
    SheetNames: string[];
    Sheets: Record<string, unknown>;
  };
  utils: {
    sheet_to_csv: (sheet: unknown, opts?: Record<string, unknown>) => string;
  };
}

let xlsxModule: XlsxModule | null | undefined;
let loadAttempted = false;

function loadXlsx(): XlsxModule | null | undefined {
  if (loadAttempted) return xlsxModule;
  loadAttempted = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    xlsxModule = require('xlsx') as XlsxModule;
  } catch {
    xlsxModule = null;
  }
  return xlsxModule;
}

function parseCsvFallback(
  buffer: Buffer,
  maxRows: number,
): { text: string; truncated: boolean } {
  const raw = buffer.toString('utf8');
  const lines = raw.split(/\r?\n/);
  const truncated = lines.length > maxRows;
  const kept = lines.slice(0, maxRows);
  return { text: kept.join('\n'), truncated };
}

@Injectable()
export class CsvXlsxParser implements IFileParser {
  public readonly mime =
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  public readonly name = 'csv-xlsx';
  private readonly logger = new Logger(CsvXlsxParser.name);

  constructor(private readonly maxRows = 50_000) {}

  isAvailable(): boolean {
    return loadXlsx() !== null;
  }

  async parse(buffer: Buffer, mime: string): Promise<ParsedDocument> {
    return Promise.resolve(this.parseSync(buffer, mime));
  }

  private parseSync(buffer: Buffer, mime: string): ParsedDocument {
    const lower = mime.toLowerCase();
    const isCsv = lower === 'text/csv' || lower === 'application/csv';
    const isXlsx = lower.includes('spreadsheetml');
    if (!isCsv && !isXlsx) {
      throw new ParserFormatError(this.name, `unexpected mime ${mime}`);
    }
    if (!buffer || buffer.length === 0) {
      throw new ParserFormatError(this.name, 'empty buffer');
    }

    if (isCsv) {
      const { text, truncated } = parseCsvFallback(buffer, this.maxRows);
      const warnings: ParserWarning[] = truncated
        ? [
            {
              code: 'TRUNCATED_ROWS',
              severity: 'warn',
              message: `CSV exceeded maxRows=${this.maxRows}; truncated.`,
            },
          ]
        : [];
      return {
        text,
        metadata: {
          charCount: text.length,
          tokenEstimate: Math.ceil(text.length / 4),
          extra: { rowCap: this.maxRows, truncated },
        },
        warnings,
      };
    }

    const mod = loadXlsx();
    if (!mod) {
      throw new ParserUnavailableError(
        this.name,
        'package "xlsx" not installed; install with `pnpm add xlsx`',
      );
    }
    let workbook: ReturnType<XlsxModule['read']>;
    try {
      workbook = mod.read(buffer, { type: 'buffer' });
    } catch (err) {
      this.logger.warn(`xlsx read failed: ${(err as Error).message}`);
      throw new ParserFormatError(this.name, (err as Error).message);
    }
    const sheets: string[] = [];
    let combined = '';
    let totalRows = 0;
    const truncatedSheets: string[] = [];
    for (const name of workbook.SheetNames) {
      const csv = mod.utils.sheet_to_csv(workbook.Sheets[name]);
      const lines = csv.split(/\r?\n/);
      totalRows += lines.length;
      if (lines.length > this.maxRows) {
        truncatedSheets.push(name);
        combined += `[Sheet: ${name}]\n${lines.slice(0, this.maxRows).join('\n')}\n\n`;
      } else {
        combined += `[Sheet: ${name}]\n${csv}\n\n`;
      }
      sheets.push(name);
    }
    const warnings: ParserWarning[] = truncatedSheets.map((name) => ({
      code: 'TRUNCATED_ROWS',
      severity: 'warn',
      message: `Sheet "${name}" exceeded maxRows=${this.maxRows}; truncated.`,
    }));
    return {
      text: combined,
      metadata: {
        charCount: combined.length,
        tokenEstimate: Math.ceil(combined.length / 4),
        extra: { sheets, totalRows },
      },
      warnings,
    };
  }
}
