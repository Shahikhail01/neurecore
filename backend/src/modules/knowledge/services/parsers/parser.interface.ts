/**
 * File parser contracts for the knowledge ingestion pipeline (P2).
 *
 * Every parser implements {@link IFileParser} and produces a {@link ParsedDocument}.
 * Parsers that depend on optional npm packages wrap their `require()` in a
 * try/catch and throw a {@link ParserUnavailableError} with a clear message
 * if the package is not installed — the ingestion service maps this to a
 * `PARSER_UNAVAILABLE` status without crashing the file.
 *
 * SECURITY: parsers run AFTER malware scan and MIME/signature validation,
 * so a malicious document cannot reach a parser. The parser must still
 * enforce per-document limits (pages, rows, nesting).
 */

export type ParserSeverity = 'info' | 'warn' | 'error';

export interface ParserWarning {
  /** Stable code, e.g. `TRUNCATED`, `OCR_LOW_CONFIDENCE`. */
  readonly code: string;
  readonly severity: ParserSeverity;
  readonly message: string;
}

export interface ParsedDocumentMetadata {
  /** Detected page count, when the format supports it. */
  readonly pageCount?: number;
  /** Total character count of `text`. */
  readonly charCount: number;
  /** Approximate token count (chars / 4). */
  readonly tokenEstimate: number;
  /** Format-specific structured hints (email headers, csv headers, …). */
  readonly extra?: Readonly<Record<string, unknown>>;
}

export interface ParsedDocument {
  /** Extracted plain text. May be empty when the parser abstains (e.g. OCR). */
  readonly text: string;
  readonly metadata: ParsedDocumentMetadata;
  readonly warnings: ParserWarning[];
}

export interface IFileParser {
  /** Canonical lower-case mime identifier (e.g. `application/pdf`). */
  readonly mime: string;
  /** Short stable name (e.g. `pdf`, `docx`). */
  readonly name: string;
  /** Whether the parser's underlying dependency is loaded and usable. */
  isAvailable(): boolean;
  parse(buffer: Buffer, mime: string): Promise<ParsedDocument>;
}

/**
 * Thrown when a parser is required but its dependency is not installed.
 * The ingestion service catches this and records a typed failure status.
 */
export class ParserUnavailableError extends Error {
  public readonly code = 'PARSER_UNAVAILABLE' as const;
  constructor(
    public readonly parserName: string,
    public readonly reason: string,
  ) {
    super(`Parser "${parserName}" unavailable: ${reason}`);
    this.name = 'ParserUnavailableError';
  }
}

/**
 * Thrown when a parser is structurally unable to parse the supplied buffer
 * (corrupted file, unsupported variant, exceeded limits).
 */
export class ParserFormatError extends Error {
  public readonly code = 'PARSER_FORMAT_ERROR' as const;
  constructor(
    public readonly parserName: string,
    public readonly reason: string,
  ) {
    super(`Parser "${parserName}" format error: ${reason}`);
    this.name = 'ParserFormatError';
  }
}
