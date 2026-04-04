/**
 * Template Engine Tool - P1-10 of remaining tools
 * Enables AI agents to render document templates with dynamic data
 * For Sales, Finance, Legal, HR agents
 *
 * SOLID Principles Applied:
 * - SRP: Single responsibility for template rendering operations
 * - OCP: Extensible via template provider interfaces
 * - DIP: Depends on abstractions for template sources
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

export const TemplateActionEnum = z.enum([
  'render_template',
  'list_templates',
  'create_template',
  'update_template',
  'validate_template',
]);

export type TemplateAction = z.infer<typeof TemplateActionEnum>;

export const TemplateInputSchema = z.object({
  action: TemplateActionEnum.describe('The template action to perform'),
  templateId: z.string().optional().describe('Template ID to use'),
  templateName: z.string().optional().describe('Template name'),
  templateContent: z
    .string()
    .optional()
    .describe('Template content with placeholders'),
  data: z.record(z.unknown()).optional().describe('Data to fill in template'),
  variables: z.record(z.string()).optional().describe('Template variables'),
  format: z
    .enum(['html', 'text', 'markdown', 'pdf'])
    .optional()
    .default('html')
    .describe('Output format'),
  options: z
    .object({
      strict: z.boolean().optional().default(true),
      partialRender: z.boolean().optional().default(false),
      cache: z.boolean().optional().default(true),
    })
    .optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export type TemplateInput = z.infer<typeof TemplateInputSchema>;

// ─────────────────────────────────────────────────────────────
// Output Types
// ─────────────────────────────────────────────────────────────

type Template = {
  id: string;
  name: string;
  content: string;
  category: string;
  variables: string[];
  createdAt: string;
  updatedAt: string;
};

type TemplateList = Array<Template>;

type RenderResult = {
  content: string;
  variables: string[];
  missingVariables: string[];
  format: string;
};

// ─────────────────────────────────────────────────────────────
// Provider Interface (DIP)
// ─────────────────────────────────────────────────────────────

interface ITemplateProvider {
  renderTemplate(
    templateId: string,
    data: Record<string, unknown>,
    options?: { strict?: boolean; partialRender?: boolean },
  ): Promise<RenderResult>;

  renderFromContent(
    content: string,
    data: Record<string, unknown>,
    options?: { strict?: boolean; partialRender?: boolean },
  ): Promise<RenderResult>;

  listTemplates(
    page: number,
    limit: number,
  ): Promise<{ templates: TemplateList; total: number }>;

  createTemplate(template: {
    name: string;
    content: string;
    category: string;
  }): Promise<Template>;

  updateTemplate(
    id: string,
    updates: Partial<{ name: string; content: string; category: string }>,
  ): Promise<Template>;

  validateTemplate(
    content: string,
  ): Promise<{ valid: boolean; errors: string[] }>;
}

// ─────────────────────────────────────────────────────────────
// Mock Template Provider
// ─────────────────────────────────────────────────────────────

@Injectable()
class MockTemplateProvider implements ITemplateProvider {
  private readonly logger = new Logger(MockTemplateProvider.name);
  private readonly templates = new Map<string, Template>();

  constructor() {
    this.initializeMockTemplates();
  }

  private initializeMockTemplates(): void {
    const mockTemplates: Template[] = [
      {
        id: 'tmpl-001',
        name: 'Invoice Template',
        content:
          'Invoice #{{invoiceNumber}}\n\nDate: {{date}}\n\nClient: {{clientName}}\n\nItems:\n{{items}}\n\nTotal: {{total}}',
        category: 'finance',
        variables: ['invoiceNumber', 'date', 'clientName', 'items', 'total'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'tmpl-002',
        name: 'Welcome Email',
        content:
          'Dear {{firstName}} {{lastName}},\n\nWelcome to {{companyName}}!\n\nYour login: {{email}}\nPassword: {{temporaryPassword}}',
        category: 'hr',
        variables: [
          'firstName',
          'lastName',
          'companyName',
          'email',
          'temporaryPassword',
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'tmpl-003',
        name: 'Sales Proposal',
        content:
          'Proposal for {{clientName}}\n\n{{proposalContent}}\n\nPrice: ${{price}}\nValid until: {{validUntil}}',
        category: 'sales',
        variables: ['clientName', 'proposalContent', 'price', 'validUntil'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    mockTemplates.forEach((t) => this.templates.set(t.id, t));
  }

  async renderTemplate(
    templateId: string,
    data: Record<string, unknown>,
    options?: { strict?: boolean; partialRender?: boolean },
  ): Promise<RenderResult> {
    this.logger.log('Rendering template: ' + templateId);
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error('Template not found: ' + templateId);
    }

    return this.renderFromContent(template.content, data, options);
  }

  async renderFromContent(
    content: string,
    data: Record<string, unknown>,
    options?: { strict?: boolean; partialRender?: boolean },
  ): Promise<RenderResult> {
    this.logger.log('Rendering template from content');
    const strict = options?.strict ?? true;
    const partialRender = options?.partialRender ?? false;

    // Extract variables from template
    const variablePattern = /\{\{(\w+)\}\}/g;
    const variables: string[] = [];
    let match;
    while ((match = variablePattern.exec(content)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }

    // Find missing variables
    const missingVariables = variables.filter((v) => !(v in data));

    // Render template
    let rendered = content;
    for (const [key, value] of Object.entries(data)) {
      rendered = rendered.replace(
        new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
        String(value),
      );
    }

    // Handle missing variables
    if (missingVariables.length > 0 && strict) {
      throw new Error(
        'Missing required variables: ' + missingVariables.join(', '),
      );
    }

    if (!partialRender) {
      rendered = rendered.replace(/\{\{\w+\}\}/g, '[MISSING]');
    }

    return {
      content: rendered,
      variables,
      missingVariables,
      format: 'text',
    };
  }

  async listTemplates(
    page: number,
    limit: number,
  ): Promise<{ templates: TemplateList; total: number }> {
    this.logger.log('Listing templates');
    const all = Array.from(this.templates.values());
    const start = (page - 1) * limit;
    const templates = all.slice(start, start + limit);

    return { templates, total: all.length };
  }

  async createTemplate(template: {
    name: string;
    content: string;
    category: string;
  }): Promise<Template> {
    this.logger.log('Creating template: ' + template.name);
    const id = 'tmpl-' + Date.now();
    const newTemplate: Template = {
      id,
      ...template,
      variables: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Extract variables
    const variablePattern = /\{\{(\w+)\}\}/g;
    let match;
    while ((match = variablePattern.exec(template.content)) !== null) {
      if (!newTemplate.variables.includes(match[1])) {
        newTemplate.variables.push(match[1]);
      }
    }

    this.templates.set(id, newTemplate);
    return newTemplate;
  }

  async updateTemplate(
    id: string,
    updates: Partial<{ name: string; content: string; category: string }>,
  ): Promise<Template> {
    this.logger.log('Updating template: ' + id);
    const template = this.templates.get(id);
    if (!template) {
      throw new Error('Template not found: ' + id);
    }

    const updated: Template = {
      ...template,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    if (updates.content) {
      // Re-extract variables
      const variablePattern = /\{\{(\w+)\}\}/g;
      const variables: string[] = [];
      let match;
      while ((match = variablePattern.exec(updates.content)) !== null) {
        if (!variables.includes(match[1])) {
          variables.push(match[1]);
        }
      }
      updated.variables = variables;
    }

    this.templates.set(id, updated);
    return updated;
  }

  async validateTemplate(
    content: string,
  ): Promise<{ valid: boolean; errors: string[] }> {
    this.logger.log('Validating template');
    const errors: string[] = [];

    // Check for balanced braces
    const openBraces = (content.match(/\{\{/g) || []).length;
    const closeBraces = (content.match(/\}\}/g) || []).length;
    if (openBraces !== closeBraces) {
      errors.push('Unbalanced template braces');
    }

    // Check for common syntax issues
    if (content.includes('{{}') || content.includes('{{}}')) {
      errors.push('Invalid variable syntax');
    }

    return { valid: errors.length === 0, errors };
  }
}

// ─────────────────────────────────────────────────────────────
// Tool Implementation
// ─────────────────────────────────────────────────────────────

@Injectable()
export class TemplateEngineTool extends BaseStructuredTool {
  readonly name = 'template_engine';
  readonly description =
    'Render document templates with dynamic data, manage template library';
  readonly category = ToolCategory.FILE;
  readonly inputSchema = TemplateInputSchema;

  private readonly log = new Logger(TemplateEngineTool.name);
  private readonly provider: ITemplateProvider;

  constructor(private readonly config: ConfigService) {
    super();
    this.provider = new MockTemplateProvider();
  }

  protected async executeImpl(
    input: TemplateInput,
    context: ToolExecutionContext,
  ): Promise<StructuredToolResult<unknown>> {
    this.log.log('Executing Template action: ' + input.action);

    try {
      switch (input.action) {
        case 'render_template':
          return await this.handleRenderTemplate(input);
        case 'list_templates':
          return await this.handleListTemplates(input);
        case 'create_template':
          return await this.handleCreateTemplate(input);
        case 'update_template':
          return await this.handleUpdateTemplate(input);
        case 'validate_template':
          return await this.handleValidateTemplate(input);
        default:
          throw new Error('Unknown action: ' + input.action);
      }
    } catch (error) {
      const err = error as Error;
      this.log.error('Template action failed: ' + err.message, err.stack);
      return { success: false, error: err.message };
    }
  }

  private async handleRenderTemplate(
    input: TemplateInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.templateId) {
      throw new Error('templateId is required for render_template action');
    }
    if (!input.data) {
      throw new Error('data is required for render_template action');
    }

    const result = await this.provider.renderTemplate(
      input.templateId,
      input.data,
      {
        strict: input.options?.strict,
        partialRender: input.options?.partialRender,
      },
    );

    return {
      success: true,
      data: result,
    };
  }

  private async handleListTemplates(
    input: TemplateInput,
  ): Promise<StructuredToolResult<unknown>> {
    const page = input.page ?? 1;
    const limit = input.limit ?? 20;

    const result = await this.provider.listTemplates(page, limit);
    return {
      success: true,
      data: result,
    };
  }

  private async handleCreateTemplate(
    input: TemplateInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.templateName || !input.templateContent) {
      throw new Error(
        'templateName and templateContent are required for create_template action',
      );
    }

    const result = await this.provider.createTemplate({
      name: input.templateName,
      content: input.templateContent,
      category: 'general',
    });

    return {
      success: true,
      data: result,
    };
  }

  private async handleUpdateTemplate(
    input: TemplateInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.templateId || !input.templateName) {
      throw new Error(
        'templateId and templateName are required for update_template action',
      );
    }

    const result = await this.provider.updateTemplate(input.templateId, {
      name: input.templateName,
      content: input.templateContent,
    });

    return {
      success: true,
      data: result,
    };
  }

  private async handleValidateTemplate(
    input: TemplateInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.templateContent) {
      throw new Error(
        'templateContent is required for validate_template action',
      );
    }

    const result = await this.provider.validateTemplate(input.templateContent);
    return {
      success: true,
      data: result,
    };
  }
}
