/**
 * Parsers barrel — re-exports the public parser surface.
 * Importers should depend on `./parser.registry` for routing.
 */
export * from './parser.interface';
export { PdfParser } from './pdf.parser';
export { DocxParser } from './docx.parser';
export { TxtParser } from './txt.parser';
export { CsvXlsxParser } from './csv-xlsx.parser';
export { PptxParser } from './pptx.parser';
export { EmailParser } from './email.parser';
export { ImageParser } from './image.parser';
export { ParserRegistry } from './parser.registry';
