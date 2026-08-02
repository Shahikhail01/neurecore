/**
 * Image parser — confidence-aware OCR via the optional `tesseract.js`
 * package. When OCR is unavailable the parser abstains with explicit
 * warnings rather than fabricating text (plan §3.7 OCR-aware).
 */
import { Injectable, Logger } from '@nestjs/common';
import {
  IFileParser,
  ParsedDocument,
  ParserFormatError,
  ParserUnavailableError,
  ParserWarning,
} from './parser.interface';

const SUPPORTED = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/tiff',
]);

interface TesseractModule {
  createWorker: (lang?: string) => Promise<{
    recognize: (
      input: Buffer | string,
    ) => Promise<{ data: { text: string; confidence: number } }>;
    terminate: () => Promise<void>;
  }>;
}

let tesseractModule: TesseractModule | null | undefined;
let loadAttempted = false;

function loadTesseract(): TesseractModule | null | undefined {
  if (loadAttempted) return tesseractModule;
  loadAttempted = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    tesseractModule = require('tesseract.js') as TesseractModule;
  } catch {
    tesseractModule = null;
  }
  return tesseractModule;
}

@Injectable()
export class ImageParser implements IFileParser {
  public readonly mime = 'image/png';
  public readonly name = 'image';
  private readonly logger = new Logger(ImageParser.name);

  constructor(private readonly minConfidence = 60) {}

  isAvailable(): boolean {
    return loadTesseract() !== null;
  }

  async parse(buffer: Buffer, mime: string): Promise<ParsedDocument> {
    const lower = mime.toLowerCase();
    if (!SUPPORTED.has(lower)) {
      throw new ParserFormatError(this.name, `unexpected mime ${mime}`);
    }
    if (!buffer || buffer.length === 0) {
      throw new ParserFormatError(this.name, 'empty buffer');
    }
    const mod = loadTesseract();
    if (!mod) {
      throw new ParserUnavailableError(
        this.name,
        'package "tesseract.js" not installed; OCR unavailable',
      );
    }
    let worker: Awaited<ReturnType<TesseractModule['createWorker']>>;
    try {
      worker = await mod.createWorker('eng');
      const { data } = await worker.recognize(buffer);
      await worker.terminate();
      const warnings: ParserWarning[] = [];
      if (data.confidence < this.minConfidence) {
        warnings.push({
          code: 'OCR_LOW_CONFIDENCE',
          severity: 'warn',
          message: `OCR confidence ${data.confidence.toFixed(1)} below threshold ${this.minConfidence}; text retained but flagged.`,
        });
      }
      return {
        text: data.text ?? '',
        metadata: {
          charCount: (data.text ?? '').length,
          tokenEstimate: Math.ceil((data.text ?? '').length / 4),
          extra: { ocrConfidence: data.confidence },
        },
        warnings,
      };
    } catch (err) {
      this.logger.warn(`tesseract failed: ${(err as Error).message}`);
      throw new ParserFormatError(this.name, (err as Error).message);
    }
  }
}
