/**
 * PDF Generation Tool - P1-6 of remaining tools
 * Enables AI agents to generate PDFs for Legal, Finance, Operations
 *
 * SOLID Principles Applied:
 * - SRP: Single responsibility for PDF operations
 * - OCP: Extensible via PDF provider interfaces
 * - DIP: Depends on abstractions for PDF generation
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { BaseStructuredTool } from '../structured-tool.base';
import {
  ToolCategory,
  StructuredToolResult,
  ToolExecutionContext,
} from '../interfaces/structured-tool.interface';

// ─────────────────────────────────────────────────────────────
// Input Schema
// ─────────────────────────────────────────────────────────────

export const PDFGenerationActionEnum = z.enum([
  'create_pdf',
  'convert_html_to_pdf',
  'add_images',
  'add_tables',
  'merge_pdfs',
  'extract_text',
  'list_pdfs',
  'get_pdf_info',
]);

export type PDFGenerationAction = z.infer<typeof PDFGenerationActionEnum>;

export const PDFGenerationInputSchema = z.object({
  action: PDFGenerationActionEnum.describe('The PDF action to perform'),
  // For create_pdf, convert_html_to_pdf
  content: z.string().optional().describe('HTML content or text content'),
  title: z.string().optional().describe('Document title'),
  filename: z.string().optional().describe('Output filename'),
  // For add_images
  imageUrls: z
    .array(z.string())
    .optional()
    .describe('List of image URLs to add'),
  // For add_tables
  tableData: z
    .array(z.array(z.union([z.string(), z.number()])))
    .optional()
    .describe('Table data as 2D array'),
  headers: z.array(z.string()).optional().describe('Table headers'),
  // For merge_pdfs
  pdfIds: z.array(z.string()).optional().describe('List of PDF IDs to merge'),
  // For extract_text, get_pdf_info
  pdfId: z.string().optional().describe('PDF ID'),
  // Options
  orientation: z.enum(['portrait', 'landscape']).optional().default('portrait'),
  fontSize: z.number().optional().default(12),
  margin: z.number().optional().default(20),
});

export type PDFGenerationInput = z.infer<typeof PDFGenerationInputSchema>;

// ─────────────────────────────────────────────────────────────
// Output Schemas
// ─────────────────────────────────────────────────────────────

export const PDFInfoSchema = z.object({
  id: z.string(),
  title: z.string(),
  filename: z.string(),
  pageCount: z.number(),
  createdAt: z.string(),
  size: z.number(),
});

export const PDFGenerationOutputSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  data: z.record(z.unknown()).optional(),
  pdfId: z.string().optional(),
  pdf: PDFInfoSchema.optional(),
  pdfs: z.array(PDFInfoSchema).optional(),
  text: z.string().optional(),
});

// ─────────────────────────────────────────────────────────────
// Provider Interface (DIP)
// ─────────────────────────────────────────────────────────────

interface IPDFProvider {
  createPDF(options: {
    content: string;
    title?: string;
    filename?: string;
    orientation?: string;
    fontSize?: number;
    margin?: number;
  }): Promise<{ id: string; filename: string }>;

  convertHTMLToPDF(options: {
    html: string;
    title?: string;
    filename?: string;
  }): Promise<{ id: string; filename: string }>;

  addImages(options: {
    imageUrls: string[];
    title?: string;
  }): Promise<{ id: string }>;

  addTables(options: {
    tableData: string[][];
    headers?: string[];
    title?: string;
  }): Promise<{ id: string }>;

  mergePDFs(pdfIds: string[]): Promise<{ id: string }>;

  extractText(pdfId: string): Promise<string>;

  getPDFInfo(pdfId: string): Promise<z.infer<typeof PDFInfoSchema>>;

  listPDFs(): Promise<z.infer<typeof PDFInfoSchema>[]>;
}

// ─────────────────────────────────────────────────────────────
// Mock PDF Provider (Development Mode)
// ─────────────────────────────────────────────────────────────

@Injectable()
class MockPDFProvider implements IPDFProvider {
  private readonly logger = new Logger(MockPDFProvider.name);
  private pdfs = new Map<string, z.infer<typeof PDFInfoSchema>>();
  private pdfContents = new Map<string, string>();

  constructor() {
    this.initializeMockData();
  }

  private initializeMockData(): void {
    const mockPdfs = [
      {
        id: 'pdf-1',
        title: 'Invoice INV-001',
        filename: 'invoice-inv001.pdf',
        pageCount: 3,
        createdAt: '2026-04-01T10:00:00Z',
        size: 125000,
      },
      {
        id: 'pdf-2',
        title: 'Contract - John Doe',
        filename: 'contract-john-doe.pdf',
        pageCount: 12,
        createdAt: '2026-03-28T14:30:00Z',
        size: 450000,
      },
      {
        id: 'pdf-3',
        title: 'Report Q1 2026',
        filename: 'report-q1-2026.pdf',
        pageCount: 25,
        createdAt: '2026-04-02T09:15:00Z',
        size: 780000,
      },
    ];
    mockPdfs.forEach((p) => this.pdfs.set(p.id, p));
  }

  async createPDF(options: {
    content: string;
    title?: string;
    filename?: string;
    orientation?: string;
    fontSize?: number;
    margin?: number;
  }): Promise<{ id: string; filename: string }> {
    this.logger.log(`Creating PDF: ${options.title || 'Untitled'}`);
    const id = `pdf-${Date.now()}`;
    const pdf: z.infer<typeof PDFInfoSchema> = {
      id,
      title: options.title || 'Untitled Document',
      filename: options.filename || `document-${Date.now()}.pdf`,
      pageCount: Math.ceil(options.content.length / 2000),
      createdAt: new Date().toISOString(),
      size: options.content.length * 1.5,
    };
    this.pdfs.set(id, pdf);
    this.pdfContents.set(id, options.content);
    return { id, filename: pdf.filename };
  }

  async convertHTMLToPDF(options: {
    html: string;
    title?: string;
    filename?: string;
  }): Promise<{ id: string; filename: string }> {
    this.logger.log(`Converting HTML to PDF: ${options.title || 'Untitled'}`);
    const id = `pdf-${Date.now()}`;
    const pdf: z.infer<typeof PDFInfoSchema> = {
      id,
      title: options.title || 'HTML Document',
      filename: options.filename || `html-doc-${Date.now()}.pdf`,
      pageCount: Math.ceil(options.html.length / 3000),
      createdAt: new Date().toISOString(),
      size: options.html.length * 2,
    };
    this.pdfs.set(id, pdf);
    this.pdfContents.set(id, options.html);
    return { id, filename: pdf.filename };
  }

  async addImages(options: {
    imageUrls: string[];
    title?: string;
  }): Promise<{ id: string }> {
    this.logger.log(`Adding images to PDF: ${options.imageUrls.length} images`);
    const id = `pdf-${Date.now()}`;
    const pdf: z.infer<typeof PDFInfoSchema> = {
      id,
      title: options.title || 'Image Collection',
      filename: `images-${Date.now()}.pdf`,
      pageCount: options.imageUrls.length,
      createdAt: new Date().toISOString(),
      size: options.imageUrls.length * 50000,
    };
    this.pdfs.set(id, pdf);
    return { id };
  }

  async addTables(options: {
    tableData: string[][];
    headers?: string[];
    title?: string;
  }): Promise<{ id: string }> {
    this.logger.log(`Adding table to PDF: ${options.tableData.length} rows`);
    const id = `pdf-${Date.now()}`;
    const pdf: z.infer<typeof PDFInfoSchema> = {
      id,
      title: options.title || 'Table Document',
      filename: `table-${Date.now()}.pdf`,
      pageCount: Math.ceil(options.tableData.length / 30),
      createdAt: new Date().toISOString(),
      size: options.tableData.length * 500,
    };
    this.pdfs.set(id, pdf);
    return { id };
  }

  async mergePDFs(pdfIds: string[]): Promise<{ id: string }> {
    this.logger.log(`Merging ${pdfIds.length} PDFs`);
    const totalPages = pdfIds.reduce((sum, id) => {
      const pdf = this.pdfs.get(id);
      return sum + (pdf?.pageCount || 0);
    }, 0);

    const id = `pdf-${Date.now()}`;
    const pdf: z.infer<typeof PDFInfoSchema> = {
      id,
      title: 'Merged Document',
      filename: `merged-${Date.now()}.pdf`,
      pageCount: totalPages,
      createdAt: new Date().toISOString(),
      size: totalPages * 50000,
    };
    this.pdfs.set(id, pdf);
    return { id };
  }

  async extractText(pdfId: string): Promise<string> {
    this.logger.log(`Extracting text from PDF: ${pdfId}`);
    const content = this.pdfContents.get(pdfId);
    if (!content) {
      return `Extracted text from PDF ${pdfId}. This is mock extracted content representing the document's text content. Lorem ipsum dolor sit amet, consectetur adipiscing elit.`;
    }
    return content;
  }

  async getPDFInfo(pdfId: string): Promise<z.infer<typeof PDFInfoSchema>> {
    this.logger.log(`Getting PDF info: ${pdfId}`);
    const pdf = this.pdfs.get(pdfId);
    if (!pdf) {
      throw new Error(`PDF not found: ${pdfId}`);
    }
    return pdf;
  }

  async listPDFs(): Promise<z.infer<typeof PDFInfoSchema>[]> {
    this.logger.log('Listing all PDFs');
    return Array.from(this.pdfs.values());
  }
}

// ─────────────────────────────────────────────────────────────
// Tool Implementation
// ─────────────────────────────────────────────────────────────

@Injectable()
export class PDFGenerationTool extends BaseStructuredTool {
  readonly name = 'pdf_generation';
  readonly description =
    'Generate and manipulate PDF documents including creation, conversion, merging, and extraction';
  readonly category = ToolCategory.FILE;
  readonly inputSchema = PDFGenerationInputSchema;

  private readonly provider: IPDFProvider;

  constructor(private readonly config: ConfigService) {
    super();
    this.provider = new MockPDFProvider();
  }

  protected async executeImpl(
    input: PDFGenerationInput,
    context: ToolExecutionContext,
  ): Promise<StructuredToolResult<unknown>> {
    this.logger.log(`Executing PDF action: ${input.action}`);

    try {
      switch (input.action) {
        case 'create_pdf':
          return await this.handleCreatePDF(input);
        case 'convert_html_to_pdf':
          return await this.handleConvertHTMLToPDF(input);
        case 'add_images':
          return await this.handleAddImages(input);
        case 'add_tables':
          return await this.handleAddTables(input);
        case 'merge_pdfs':
          return await this.handleMergePDFs(input);
        case 'extract_text':
          return await this.handleExtractText(input);
        case 'list_pdfs':
          return await this.handleListPDFs();
        case 'get_pdf_info':
          return await this.handleGetPDFInfo(input);
        default:
          throw new Error(`Unknown action: ${input.action}`);
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`PDF action failed: ${err.message}`, err.stack);
      return {
        success: false,
        error: err.message,
      };
    }
  }

  private async handleCreatePDF(
    input: PDFGenerationInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.content) {
      throw new Error('content is required for create_pdf action');
    }

    const result = await this.provider.createPDF({
      content: input.content,
      title: input.title,
      filename: input.filename,
      orientation: input.orientation,
      fontSize: input.fontSize,
      margin: input.margin,
    });

    return {
      success: true,
      data: {
        pdfId: result.id,
        filename: result.filename,
        message: 'PDF created successfully',
      },
    };
  }

  private async handleConvertHTMLToPDF(
    input: PDFGenerationInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.content) {
      throw new Error(
        'content (HTML) is required for convert_html_to_pdf action',
      );
    }

    const result = await this.provider.convertHTMLToPDF({
      html: input.content,
      title: input.title,
      filename: input.filename,
    });

    return {
      success: true,
      data: {
        pdfId: result.id,
        filename: result.filename,
        message: 'HTML converted to PDF successfully',
      },
    };
  }

  private async handleAddImages(
    input: PDFGenerationInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.imageUrls || input.imageUrls.length === 0) {
      throw new Error('imageUrls array is required for add_images action');
    }

    const result = await this.provider.addImages({
      imageUrls: input.imageUrls,
      title: input.title,
    });

    return {
      success: true,
      data: {
        pdfId: result.id,
        message: `Added ${input.imageUrls.length} images to PDF`,
      },
    };
  }

  private async handleAddTables(
    input: PDFGenerationInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.tableData || input.tableData.length === 0) {
      throw new Error('tableData is required for add_tables action');
    }

    const result = await this.provider.addTables({
      tableData:
        input.tableData?.map((row) => row.map((cell) => String(cell))) ?? [],
      headers: input.headers,
      title: input.title,
    });

    return {
      success: true,
      data: {
        pdfId: result.id,
        message: `Added table with ${input.tableData.length} rows to PDF`,
      },
    };
  }

  private async handleMergePDFs(
    input: PDFGenerationInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.pdfIds || input.pdfIds.length < 2) {
      throw new Error('At least 2 PDF IDs are required for merge_pdfs action');
    }

    const result = await this.provider.mergePDFs(input.pdfIds);

    return {
      success: true,
      data: {
        pdfId: result.id,
        message: `Merged ${input.pdfIds.length} PDFs successfully`,
      },
    };
  }

  private async handleExtractText(
    input: PDFGenerationInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.pdfId) {
      throw new Error('pdfId is required for extract_text action');
    }

    const text = await this.provider.extractText(input.pdfId);

    return {
      success: true,
      data: { text, pdfId: input.pdfId },
    };
  }

  private async handleListPDFs(): Promise<StructuredToolResult<unknown>> {
    const pdfs = await this.provider.listPDFs();

    return {
      success: true,
      data: { pdfs, total: pdfs.length },
    };
  }

  private async handleGetPDFInfo(
    input: PDFGenerationInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.pdfId) {
      throw new Error('pdfId is required for get_pdf_info action');
    }

    const pdf = await this.provider.getPDFInfo(input.pdfId);

    return {
      success: true,
      data: { pdf },
    };
  }
}
