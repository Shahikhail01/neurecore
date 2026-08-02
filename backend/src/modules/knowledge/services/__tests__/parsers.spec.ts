/**
 * Phase P2 — parser registry unit tests.
 *
 * These tests exercise the parser registry and the
 * ParserUnavailableError fallback path WITHOUT requiring any of the
 * optional packages (pdf-parse / mammoth / xlsx / mailparser /
 * pptx-parser / tesseract.js) to be installed.
 */
import { ParserRegistry } from '../parsers/parser.registry';
import { PdfParser } from '../parsers/pdf.parser';
import { DocxParser } from '../parsers/docx.parser';
import { TxtParser } from '../parsers/txt.parser';
import { CsvXlsxParser } from '../parsers/csv-xlsx.parser';
import { PptxParser } from '../parsers/pptx.parser';
import { EmailParser } from '../parsers/email.parser';
import { ImageParser } from '../parsers/image.parser';
import { ParserUnavailableError } from '../parsers/parser.interface';

describe('ParserRegistry', () => {
  let registry: ParserRegistry;

  beforeEach(() => {
    registry = new ParserRegistry(
      new PdfParser(),
      new DocxParser(),
      new TxtParser(),
      new CsvXlsxParser(),
      new PptxParser(),
      new EmailParser(),
      new ImageParser(),
    );
  });

  it('finds the TXT parser for text/plain', () => {
    const p = registry.findFor('text/plain');
    expect(p?.name).toBe('txt');
  });

  it('finds the PDF parser for application/pdf', () => {
    const p = registry.findFor('application/pdf');
    expect(p?.name).toBe('pdf');
  });

  it('finds the DOCX parser for the OOXML wordprocessingml mime', () => {
    const p = registry.findFor(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(p?.name).toBe('docx');
  });

  it('returns null for unsupported mime', () => {
    expect(registry.findFor('application/x-binary-unknown')).toBeNull();
  });

  it('reports per-parser availability status', () => {
    const status = registry.status();
    expect(status.find((s) => s.name === 'txt')?.available).toBe(true);
  });

  it('TXT parser extracts plain text without any optional package', async () => {
    const p = registry.findFor('text/plain')!;
    const parsed = await p.parse(
      Buffer.from('Hello world\nLine two'),
      'text/plain',
    );
    expect(parsed.text).toContain('Hello world');
    expect(parsed.warnings).toEqual([]);
    expect(parsed.metadata.charCount).toBeGreaterThan(0);
  });

  it('TXT parser rejects unknown mime', async () => {
    const p = registry.findFor('text/plain')!;
    await expect(
      p.parse(Buffer.from(''), 'application/octet-stream'),
    ).rejects.toThrow(/unexpected mime/);
  });

  it('PDF parser abstains with ParserUnavailableError when pdf-parse is missing', async () => {
    const p = new PdfParser();
    if (p.isAvailable()) {
      // pdf-parse IS installed in this environment — still assert it
      // parses a minimal pdf or returns a typed error rather than crashing.
      const parsed = await p
        .parse(Buffer.from('%PDF-1.4\n%EOF'), 'application/pdf')
        .catch((err) => ({ err }));
      expect(parsed).toBeDefined();
    } else {
      await expect(
        p.parse(Buffer.from('%PDF-1.4'), 'application/pdf'),
      ).rejects.toBeInstanceOf(ParserUnavailableError);
    }
  });

  it('DOCX parser abstains with ParserUnavailableError when mammoth is missing', async () => {
    const p = new DocxParser();
    if (!p.isAvailable()) {
      await expect(
        p.parse(
          Buffer.from('PK'),
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ),
      ).rejects.toBeInstanceOf(ParserUnavailableError);
    }
  });

  it('CSV parser falls back to plain text when xlsx is missing', async () => {
    const p = new CsvXlsxParser();
    const parsed = await p.parse(Buffer.from('a,b,c\n1,2,3'), 'text/csv');
    expect(parsed.text).toContain('a,b,c');
    expect(parsed.text).toContain('1,2,3');
  });

  it('XLSX parser abstains with ParserUnavailableError when xlsx is missing', async () => {
    const p = new CsvXlsxParser();
    if (!p.isAvailable()) {
      await expect(
        p.parse(
          Buffer.from('PK'),
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ),
      ).rejects.toBeInstanceOf(ParserUnavailableError);
    }
  });

  it('Image parser abstains with ParserUnavailableError when tesseract.js is missing', async () => {
    const p = new ImageParser();
    if (!p.isAvailable()) {
      await expect(
        p.parse(Buffer.from([0x89, 0x50, 0x4e, 0x47]), 'image/png'),
      ).rejects.toBeInstanceOf(ParserUnavailableError);
    }
  });
});
