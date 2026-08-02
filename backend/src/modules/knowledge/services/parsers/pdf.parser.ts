/**
 * PDF parser — uses the optional `pdf-parse` package, with a clear typed
 * fallback when the package is not installed.
 *
 * Package: `pdf-parse` (LGPL). When not present, the parser reports
 * `PARSER_UNAVAILABLE` and the ingestion service marks the file as
 * failed without crashing.
 *
 * SECURITY: this parser runs AFTER the quarantine/malware pipeline.
 * It enforces a per-document page cap (`maxPages`) to bound CPU and
 * memory.
 */
import { Injectable, Logger } from '@nestjs/common';
import {
  IFileParser,
  ParsedDocument,
  ParserFormatError,
  ParserUnavailableError,
  ParserWarning,
} from './parser.interface';

type PdfParseFn = (
  buffer: Buffer,
  options?: Record<string, unknown>,
) => Promise<{
  text: string;
  numpages: number;
  info?: Record<string, unknown>;
}>;

let pdfParseModule: { default?: PdfParseFn; pdf?: PdfParseFn } | null = null;
let loadAttempted = false;

function loadPdfParse(): { default?: PdfParseFn; pdf?: PdfParseFn } | null {
  if (loadAttempted) return pdfParseModule;
  loadAttempted = true;
  try {
    // Use require so missing package throws a runtime error we can catch.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    pdfParseModule = require('pdf-parse') as {
      default?: PdfParseFn;
      pdf?: PdfParseFn;
    };
  } catch {
    pdfParseModule = null;
  }
  return pdfParseModule;
}

@Injectable()
export class PdfParser implements IFileParser {
  public readonly mime = 'application/pdf';
  public readonly name = 'pdf';
  private readonly logger = new Logger(PdfParser.name);

  constructor(private readonly maxPages = 500) {}

  isAvailable(): boolean {
    return loadPdfParse() !== null;
  }

  async parse(buffer: Buffer, mime: string): Promise<ParsedDocument> {
    if (mime.toLowerCase() !== 'application/pdf') {
      throw new ParserFormatError(this.name, `unexpected mime ${mime}`);
    }
    if (!buffer || buffer.length === 0) {
      throw new ParserFormatError(this.name, 'empty buffer');
    }
    const mod = loadPdfParse();
    if (!mod) {
      throw new ParserUnavailableError(
        this.name,
        'package "pdf-parse" not installed; install with `pnpm add pdf-parse`',
      );
    }
    const fn = mod.default ?? mod.pdf;
    if (typeof fn !== 'function') {
      throw new ParserUnavailableError(
        this.name,
        'pdf-parse export is not callable',
      );
    }
    let parsed: {
      text: string;
      numpages: number;
      info?: Record<string, unknown>;
    };
    try {
      parsed = await fn(buffer, { max: this.maxPages });
    } catch (err) {
      this.logger.warn(`pdf-parse failed: ${(err as Error).message}`);
      throw new ParserFormatError(this.name, (err as Error).message);
    }
    const warnings: ParserWarning[] = [];
    if (parsed.numpages > this.maxPages) {
      warnings.push({
        code: 'TRUNCATED_PAGES',
        severity: 'warn',
        message: `Document exceeded maxPages=${this.maxPages}; truncated.`,
      });
    }
    const text = parsed.text ?? '';
    return {
      text,
      metadata: {
        pageCount: parsed.numpages,
        charCount: text.length,
        tokenEstimate: Math.ceil(text.length / 4),
        extra: parsed.info ? { info: parsed.info } : undefined,
      },
      warnings,
    };
  }
}
