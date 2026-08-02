/**
 * Plain-text parser.
 *
 * No external dependency. Handles `.txt`, `.md`, `.log`, `.json`, `.xml`,
 * `.html` (text-only extraction) and any other text/* mime that has not
 * been routed to a richer parser.
 */
import { Injectable } from '@nestjs/common';
import {
  IFileParser,
  ParsedDocument,
  ParserFormatError,
} from './parser.interface';

const SUPPORTED = new Set([
  'text/plain',
  'text/markdown',
  'text/html',
  'text/xml',
  'text/csv',
  'application/json',
  'application/xml',
]);

@Injectable()
export class TxtParser implements IFileParser {
  public readonly mime = 'text/plain';
  public readonly name = 'txt';

  isAvailable(): boolean {
    return true;
  }

  async parse(buffer: Buffer, mime: string): Promise<ParsedDocument> {
    return Promise.resolve(this.parseSync(buffer, mime));
  }

  private parseSync(buffer: Buffer, mime: string): ParsedDocument {
    const lower = mime.toLowerCase();
    if (!SUPPORTED.has(lower) && !lower.startsWith('text/')) {
      throw new ParserFormatError(this.name, `unexpected mime ${mime}`);
    }
    const text = buffer.toString('utf8');
    return {
      text,
      metadata: {
        charCount: text.length,
        tokenEstimate: Math.ceil(text.length / 4),
      },
      warnings: [],
    };
  }
}
