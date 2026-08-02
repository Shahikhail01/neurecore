/**
 * Parser registry — single entry point for the ingestion service to
 * route an uploaded buffer to the correct {@link IFileParser}.
 *
 * The registry is built from the canonical parser implementations in
 * this directory. Every parser declares the MIME(s) it owns; the
 * registry picks the best match for an incoming `mime` string.
 *
 * Adding a new parser means dropping the file next to this one and
 * registering it in `BUILTIN_PARSERS`. No edits to consumers.
 */
import { Injectable } from '@nestjs/common';
import { IFileParser } from './parser.interface';
import { PdfParser } from './pdf.parser';
import { DocxParser } from './docx.parser';
import { TxtParser } from './txt.parser';
import { CsvXlsxParser } from './csv-xlsx.parser';
import { PptxParser } from './pptx.parser';
import { EmailParser } from './email.parser';
import { ImageParser } from './image.parser';

@Injectable()
export class ParserRegistry {
  private readonly parsers: IFileParser[];

  constructor(
    pdf: PdfParser,
    docx: DocxParser,
    txt: TxtParser,
    csvXlsx: CsvXlsxParser,
    pptx: PptxParser,
    email: EmailParser,
    image: ImageParser,
  ) {
    this.parsers = [pdf, docx, txt, csvXlsx, pptx, email, image];
  }

  /** Returns the parser that owns the supplied mime, or `null`. */
  findFor(mime: string): IFileParser | null {
    const lower = mime.toLowerCase();
    for (const p of this.parsers) {
      if (p.mime.toLowerCase() === lower) return p;
    }
    for (const p of this.parsers) {
      if (lower.includes(p.mime.toLowerCase())) return p;
    }
    return null;
  }

  list(): IFileParser[] {
    return [...this.parsers];
  }

  /** Stable human-readable status — used by the command center. */
  status(): Array<{ name: string; mime: string; available: boolean }> {
    return this.parsers.map((p) => ({
      name: p.name,
      mime: p.mime,
      available: p.isAvailable(),
    }));
  }
}
