/**
 * PPTX parser — uses the optional `pptx-parser` package.
 *
 * Package: `pptx-parser` (MIT). When not installed the parser abstains
 * with a typed `ParserUnavailableError`. PPT (legacy binary) is NOT
 * supported and is rejected at MIME-validation upstream.
 */
import { Injectable, Logger } from '@nestjs/common';
import {
  IFileParser,
  ParsedDocument,
  ParserFormatError,
  ParserUnavailableError,
  ParserWarning,
} from './parser.interface';

interface PptxSlide {
  text?: string;
  notes?: string;
}
interface PptxModule {
  parse: (data: ArrayBuffer) => Promise<PptxSlide[]>;
}

let pptxModule: PptxModule | null | undefined;
let loadAttempted = false;

function loadPptx(): PptxModule | null | undefined {
  if (loadAttempted) return pptxModule;
  loadAttempted = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    pptxModule = require('pptx-parser') as PptxModule;
  } catch {
    pptxModule = null;
  }
  return pptxModule;
}

@Injectable()
export class PptxParser implements IFileParser {
  public readonly mime =
    'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  public readonly name = 'pptx';
  private readonly logger = new Logger(PptxParser.name);

  constructor(private readonly maxSlides = 500) {}

  isAvailable(): boolean {
    return loadPptx() !== null;
  }

  async parse(buffer: Buffer, mime: string): Promise<ParsedDocument> {
    if (!mime.toLowerCase().includes('presentationml')) {
      throw new ParserFormatError(this.name, `unexpected mime ${mime}`);
    }
    if (!buffer || buffer.length === 0) {
      throw new ParserFormatError(this.name, 'empty buffer');
    }
    const mod = loadPptx();
    if (!mod) {
      throw new ParserUnavailableError(
        this.name,
        'package "pptx-parser" not installed; install with `pnpm add pptx-parser`',
      );
    }
    const ab = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ) as ArrayBuffer;
    let slides: PptxSlide[];
    try {
      slides = await mod.parse(ab);
    } catch (err) {
      this.logger.warn(`pptx-parser failed: ${(err as Error).message}`);
      throw new ParserFormatError(this.name, (err as Error).message);
    }
    const text = slides
      .map(
        (s, i) =>
          `[Slide ${i + 1}]\n${s.text ?? ''}${s.notes ? `\n-- notes --\n${s.notes}` : ''}`,
      )
      .join('\n\n');
    const warnings: ParserWarning[] =
      slides.length > this.maxSlides
        ? [
            {
              code: 'TRUNCATED_SLIDES',
              severity: 'warn',
              message: `Slide count exceeded maxSlides=${this.maxSlides}; truncated.`,
            },
          ]
        : [];
    return {
      text: warnings.length
        ? text.split('\n\n').slice(0, this.maxSlides).join('\n\n')
        : text,
      metadata: {
        pageCount: slides.length,
        charCount: text.length,
        tokenEstimate: Math.ceil(text.length / 4),
      },
      warnings,
    };
  }
}
