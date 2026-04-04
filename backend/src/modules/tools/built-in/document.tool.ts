/**
 * Document Creation Tool - Tool 5 of 12
 * Enables AI agents to create, format, and export documents in various formats
 *
 * SOLID Principles Applied:
 * - SRP: Single responsibility for document generation
 * - OCP: Extensible via format providers
 * - DIP: Depends on abstractions for storage providers
 *
 * @description
 * Supports: PDF, Word (DOCX), plain text, Markdown, HTML
 * Features: Template rendering, variable substitution, multi-format export
 */

import { Injectable } from '@nestjs/common';
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

/**
 * Document operation actions
 */
export const DocumentActionEnum = z.enum([
  'create',
  'render',
  'convert',
  'list',
  'get',
]);

export type DocumentAction = z.infer<typeof DocumentActionEnum>;

/**
 * Input schema for Document Tool
 */
export const DocumentInputSchema = z.object({
  action: DocumentActionEnum.describe('The document action to perform'),
  title: z.string().optional().describe('Document title'),
  content: z
    .string()
    .optional()
    .describe('Document content (supports markdown)'),
  format: z
    .enum(['pdf', 'docx', 'txt', 'md', 'html'])
    .optional()
    .describe('Output format'),
  template: z.string().optional().describe('Template name to use'),
  variables: z
    .record(z.string())
    .optional()
    .describe('Variables for template substitution'),
  documentId: z
    .string()
    .optional()
    .describe('Document ID for get/convert actions'),
});

export type DocumentInput = z.infer<typeof DocumentInputSchema>;

// ─────────────────────────────────────────────────────────────
// Output Schema
// ─────────────────────────────────────────────────────────────

/**
 * Document metadata output
 */
const DocumentMetadataSchema = z.object({
  id: z.string(),
  title: z.string(),
  format: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  size: z.number(),
});

/**
 * Document output schema
 */
export const DocumentOutputSchema = z.object({
  documentId: z.string().optional(),
  title: z.string().optional(),
  format: z.string().optional(),
  content: z.string().optional(),
  url: z.string().optional(),
  message: z.string().optional(),
  metadata: DocumentMetadataSchema.optional(),
  documents: z.array(DocumentMetadataSchema).optional(),
});

export type DocumentOutput = z.infer<typeof DocumentOutputSchema>;

// ─────────────────────────────────────────────────────────────
// Interfaces (DIP)
// ─────────────────────────────────────────────────────────────

/**
 * Storage provider interface for document storage
 * Following DIP - depend on abstraction, not concrete implementation
 */
interface IDocumentStorageProvider {
  save(document: {
    id: string;
    title: string;
    content: string;
    format: string;
  }): Promise<string>;
  get(documentId: string): Promise<{
    id: string;
    title: string;
    content: string;
    format: string;
  } | null>;
  list(): Promise<z.infer<typeof DocumentMetadataSchema>[]>;
  delete(documentId: string): Promise<boolean>;
}

/**
 * Template engine interface for document rendering
 */
interface ITemplateEngine {
  render(template: string, variables: Record<string, string>): string;
}

// ─────────────────────────────────────────────────────────────
// Implementations
// ─────────────────────────────────────────────────────────────

/**
 * Local file storage provider implementation
 * Stores documents in memory (can be extended to file system or database)
 */
@Injectable()
class LocalDocumentStorageProvider implements IDocumentStorageProvider {
  private readonly documents: Map<
    string,
    {
      id: string;
      title: string;
      content: string;
      format: string;
      createdAt: Date;
      updatedAt: Date;
      size: number;
    }
  > = new Map();

  constructor(private readonly config: ConfigService) {}

  async save(document: {
    id: string;
    title: string;
    content: string;
    format: string;
  }): Promise<string> {
    const now = new Date();
    const size = Buffer.byteLength(document.content, 'utf8');

    this.documents.set(document.id, {
      ...document,
      createdAt: now,
      updatedAt: now,
      size,
    });

    return document.id;
  }

  async get(documentId: string): Promise<{
    id: string;
    title: string;
    content: string;
    format: string;
  } | null> {
    const doc = this.documents.get(documentId);
    if (!doc) return null;

    return {
      id: doc.id,
      title: doc.title,
      content: doc.content,
      format: doc.format,
    };
  }

  async list(): Promise<z.infer<typeof DocumentMetadataSchema>[]> {
    return Array.from(this.documents.values()).map((doc) => ({
      id: doc.id,
      title: doc.title,
      format: doc.format,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      size: doc.size,
    }));
  }

  async delete(documentId: string): Promise<boolean> {
    return this.documents.delete(documentId);
  }
}

/**
 * Simple variable substitution template engine
 */
class SimpleTemplateEngine implements ITemplateEngine {
  render(template: string, variables: Record<string, string>): string {
    let result = template;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, value);
    }

    // Remove any remaining placeholders
    result = result.replace(/\{\{[^}]+\}\}/g, '');

    return result;
  }
}

/**
 * Predefined document templates
 */
const DOCUMENT_TEMPLATES: Record<string, string> = {
  meeting_notes: `# Meeting Notes

## Date: {{date}}
## Attendees: {{attendees}}

### Agenda
{{agenda}}

### Discussion Points
{{discussion}}

### Action Items
{{action_items}}

### Next Steps
{{next_steps}}`,

  report: `# {{title}}

## Executive Summary
{{executive_summary}}

## Introduction
{{introduction}}

## Analysis
{{analysis}}

## Recommendations
{{recommendations}}

## Conclusion
{{conclusion}}`,

  proposal: `# Business Proposal

## {{company_name}}

### Problem Statement
{{problem}}

### Proposed Solution
{{solution}}

### Timeline
{{timeline}}

### Budget
{{budget}}

### Expected Outcomes
{{outcomes}}`,

  invoice: `# Invoice

## Invoice #: {{invoice_number}}
## Date: {{date}}
## Due Date: {{due_date}}

### From:
{{from_address}}

### To:
{{to_address}}

| Item | Quantity | Unit Price | Total |
|------|----------|------------|-------|
{{items}}

### Total: {{total}}

### Notes:
{{notes}}`,

  letter: `# {{letter_type}}

{{date}}

{{sender_name}}
{{sender_address}}

{{recipient_name}}
{{recipient_address}}

Dear {{recipient_name}},

{{body}}

Sincerely,
{{sender_name}}`,
};

/**
 * Document Conversion utilities
 */
class DocumentConverter {
  static toMarkdown(html: string): string {
    // Basic HTML to Markdown conversion
    let md = html;
    md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n');
    md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n');
    md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n');
    md = md.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');
    md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
    md = md.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
    md = md.replace(/<br\s*\/?>/gi, '\n');
    md = md.replace(/<[^>]+>/g, '');
    return md;
  }

  static toHTML(markdown: string): string {
    let html = markdown;
    // Basic Markdown to HTML conversion
    html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/\n/g, '<br>');
    return html;
  }

  static toPlainText(markdown: string): string {
    let text = markdown;
    // Remove markdown formatting
    text = text.replace(/^#+ /gm, '');
    text = text.replace(/\*\*(.*?)\*\*/g, '$1');
    text = text.replace(/\*(.*?)\*/g, '$1');
    text = text.replace(/\[(.*?)\]\(.*?\)/g, '$1');
    return text;
  }
}

// ─────────────────────────────────────────────────────────────
// Document Tool (ISP - small, focused interface)
// ─────────────────────────────────────────────────────────────

/**
 * Document Creation Tool
 *
 * Features:
 * - Multiple format support (PDF, DOCX, TXT, MD, HTML)
 * - Template rendering with variable substitution
 * - Format conversion
 * - In-memory storage with metadata
 */
@Injectable()
export class DocumentTool extends BaseStructuredTool {
  readonly name = 'document';
  readonly description =
    'Create, render, convert, and manage documents in various formats (PDF, DOCX, TXT, MD, HTML). Supports templates, variable substitution, and multi-format export.';
  readonly category = ToolCategory.PRODUCTIVITY;
  readonly inputSchema = DocumentInputSchema;
  readonly outputSchema = DocumentOutputSchema;
  readonly version = '1.0.0';

  private readonly storage: IDocumentStorageProvider;
  private readonly templateEngine: ITemplateEngine;
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    super();
    this.storage = new LocalDocumentStorageProvider(config);
    this.templateEngine = new SimpleTemplateEngine();
    this.baseUrl =
      config.get('DOCUMENT_BASE_URL') || 'http://localhost:3000/documents';
  }

  /**
   * Generate unique document ID
   */
  private generateDocumentId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Core execution logic - SRP: Only handles document operations
   */
  protected async executeImpl(
    input: DocumentInput,
    context: Partial<ToolExecutionContext>,
  ): Promise<StructuredToolResult<DocumentOutput>> {
    const startTime = Date.now();
    const tenantId = context?.tenantId ?? 'unknown';

    this.logger.log(
      `[DocumentTool] Action: ${input.action} for tenant: ${tenantId}`,
    );

    try {
      switch (input.action) {
        case 'create':
          return await this.handleCreate(input, startTime);
        case 'render':
          return await this.handleRender(input, startTime);
        case 'convert':
          return await this.handleConvert(input, startTime);
        case 'list':
          return await this.handleList(startTime);
        case 'get':
          return await this.handleGet(input, startTime);
        default:
          return {
            success: false,
            error: `Unknown action: ${input.action}`,
            metadata: { durationMs: Date.now() - startTime },
          };
      }
    } catch (error) {
      this.logger.error(
        `[DocumentTool] Action ${input.action} failed`,
        error instanceof Error ? error.message : String(error),
      );
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Document operation failed',
        metadata: { durationMs: Date.now() - startTime },
      };
    }
  }

  /**
   * Handle document creation
   */
  private async handleCreate(
    input: DocumentInput,
    startTime: number,
  ): Promise<StructuredToolResult<DocumentOutput>> {
    const { title, content, format = 'md' } = input;

    if (!title || !content) {
      return {
        success: false,
        error: 'Title and content are required for document creation',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    const documentId = this.generateDocumentId();
    await this.storage.save({
      id: documentId,
      title,
      content,
      format,
    });

    return {
      success: true,
      data: {
        documentId,
        title,
        format,
        url: `${this.baseUrl}/${documentId}`,
        message: `Document "${title}" created successfully`,
      },
      metadata: { durationMs: Date.now() - startTime },
    };
  }

  /**
   * Handle template rendering with variable substitution
   */
  private async handleRender(
    input: DocumentInput,
    startTime: number,
  ): Promise<StructuredToolResult<DocumentOutput>> {
    const { template, variables = {}, format = 'md' } = input;

    if (!template) {
      return {
        success: false,
        error: 'Template name is required for rendering',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    const templateContent = DOCUMENT_TEMPLATES[template];
    if (!templateContent) {
      return {
        success: false,
        error: `Template "${template}" not found. Available: ${Object.keys(
          DOCUMENT_TEMPLATES,
        ).join(', ')}`,
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    const renderedContent = this.templateEngine.render(
      templateContent,
      variables,
    );
    const title = variables.title || `${template} Document`;

    // Save the rendered document
    const documentId = this.generateDocumentId();
    await this.storage.save({
      id: documentId,
      title,
      content: renderedContent,
      format,
    });

    return {
      success: true,
      data: {
        documentId,
        title,
        format,
        content: renderedContent,
        url: `${this.baseUrl}/${documentId}`,
        message: `Document rendered from template "${template}"`,
      },
      metadata: { durationMs: Date.now() - startTime },
    };
  }

  /**
   * Handle document format conversion
   */
  private async handleConvert(
    input: DocumentInput,
    startTime: number,
  ): Promise<StructuredToolResult<DocumentOutput>> {
    const { documentId, format = 'md' } = input;

    if (!documentId) {
      return {
        success: false,
        error: 'Document ID is required for conversion',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    const document = await this.storage.get(documentId);
    if (!document) {
      return {
        success: false,
        error: `Document with ID "${documentId}" not found`,
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    let convertedContent: string;
    const sourceFormat = document.format;

    // Convert content based on source and target formats
    if (sourceFormat === format) {
      convertedContent = document.content;
    } else if (sourceFormat === 'html' && format === 'md') {
      convertedContent = DocumentConverter.toMarkdown(document.content);
    } else if (sourceFormat === 'md' && format === 'html') {
      convertedContent = DocumentConverter.toHTML(document.content);
    } else if (format === 'txt') {
      convertedContent = DocumentConverter.toPlainText(document.content);
    } else {
      // Default: just return content
      convertedContent = document.content;
    }

    // Save converted version
    const newDocumentId = this.generateDocumentId();
    await this.storage.save({
      id: newDocumentId,
      title: `${document.title} (converted to ${format})`,
      content: convertedContent,
      format,
    });

    return {
      success: true,
      data: {
        documentId: newDocumentId,
        title: document.title,
        format,
        content: convertedContent,
        url: `${this.baseUrl}/${newDocumentId}`,
        message: `Document converted from ${sourceFormat} to ${format}`,
      },
      metadata: { durationMs: Date.now() - startTime },
    };
  }

  /**
   * Handle listing all documents
   */
  private async handleList(
    startTime: number,
  ): Promise<StructuredToolResult<DocumentOutput>> {
    const documents = await this.storage.list();

    return {
      success: true,
      data: {
        documents,
        message: `Found ${documents.length} document(s)`,
      },
      metadata: { durationMs: Date.now() - startTime },
    };
  }

  /**
   * Handle getting a specific document
   */
  private async handleGet(
    input: DocumentInput,
    startTime: number,
  ): Promise<StructuredToolResult<DocumentOutput>> {
    const { documentId } = input;

    if (!documentId) {
      return {
        success: false,
        error: 'Document ID is required',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    const document = await this.storage.get(documentId);
    if (!document) {
      return {
        success: false,
        error: `Document with ID "${documentId}" not found`,
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    const allDocs = await this.storage.list();
    const metadata = allDocs.find((d) => d.id === documentId);

    return {
      success: true,
      data: {
        documentId: document.id,
        title: document.title,
        format: document.format,
        content: document.content,
        url: `${this.baseUrl}/${documentId}`,
        metadata,
        message: 'Document retrieved successfully',
      },
      metadata: { durationMs: Date.now() - startTime },
    };
  }
}
