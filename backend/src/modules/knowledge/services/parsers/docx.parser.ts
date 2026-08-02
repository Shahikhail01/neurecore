/**
 * DOCX parser — uses the optional `mammoth` package.
 *
 * Package: `mammoth` (BSD-2-Clause). Converts `.docx` to plain text by
 * extracting the underlying XML. When `mammoth` is not installed the
 * parser abstains with a typed `ParserUnavailableError`.
 */
import { Injectable, Logger } from '@nestjs/common';
import {
  IFileParser,
  ParsedDocument,
  ParserFormatError,
  ParserUnavailableError,
  ParserWarning,
} from './parser.interface';

interface MammothResult {
  value: string;
  messages: Array<{ type: string; message: string }>;
}

let mammothModule:
  | {
      extractRawText: (input: { buffer: Buffer }) => Promise<MammothResult>;
    }
  | null
  | undefined;
let loadAttempted = false;

function loadMammoth(): typeof mammothModule {
  if (loadAttempted) return mammothModule;
  loadAttempted = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mammothModule = require('mammoth') as typeof mammothModule;
  } catch {
    mammothModule = null;
  }
  return mammothModule;
}

@Injectable()
export class DocxParser implements IFileParser {
  public readonly mime =
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  public readonly name = 'docx';
  private readonly logger = new Logger(DocxParser.name);

  isAvailable(): boolean {
    return loadMammoth() !== null;
  }

  async parse(buffer: Buffer, mime: string): Promise<ParsedDocument> {
    if (!mime.toLowerCase().includes('wordprocessingml')) {
      throw new ParserFormatError(this.name, `unexpected mime ${mime}`);
    }
    if (!buffer || buffer.length === 0) {
      throw new ParserFormatError(this.name, 'empty buffer');
    }
    const mod = loadMammoth();
    if (!mod) {
      throw new ParserUnavailableError(
        this.name,
        'package "mammoth" not installed; install with `pnpm add mammoth`',
      );
    }
    let result: MammothResult;
    try {
      result = await mod.extractRawText({ buffer });
    } catch (err) {
      this.logger.warn(`mammoth failed: ${(err as Error).message}`);
      throw new ParserFormatError(this.name, (err as Error).message);
    }
    const text = result.value ?? '';
    const warnings: ParserWarning[] = result.messages.map((m) => ({
      code: m.type?.toUpperCase?.() ?? 'MAMMOTH_MSG',
      severity: m.type === 'error' ? 'error' : 'warn',
      message: m.message,
    }));
    return {
      text,
      metadata: {
        charCount: text.length,
        tokenEstimate: Math.ceil(text.length / 4),
      },
      warnings,
    };
  }
}
