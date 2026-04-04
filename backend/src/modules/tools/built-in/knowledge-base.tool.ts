/**
 * Knowledge Base Tool - Tool 7 of 12
 * Enables AI agents to manage and query knowledge bases
 *
 * SOLID Principles Applied:
 * - SRP: Single responsibility for knowledge base operations
 * - OCP: Extensible via storage providers
 * - DIP: Depends on abstractions for storage/search
 *
 * @description
 * Features: Article management, category organization, search, versioning
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
 * Knowledge base operation actions
 */
export const KnowledgeBaseActionEnum = z.enum([
  'create',
  'update',
  'delete',
  'get',
  'list',
  'search',
  'add_category',
]);

export type KnowledgeBaseAction = z.infer<typeof KnowledgeBaseActionEnum>;

/**
 * Input schema for Knowledge Base Tool
 */
export const KnowledgeBaseInputSchema = z.object({
  action: KnowledgeBaseActionEnum.describe(
    'The knowledge base action to perform',
  ),
  articleId: z.string().optional().describe('Article ID for get/update/delete'),
  title: z.string().optional().describe('Article title'),
  content: z.string().optional().describe('Article content'),
  category: z.string().optional().describe('Article category'),
  tags: z.array(z.string()).optional().describe('Article tags'),
  query: z.string().optional().describe('Search query'),
  limit: z.number().min(1).max(100).optional().describe('Number of results'),
  categoryName: z
    .string()
    .optional()
    .describe('Category name for add_category'),
});

export type KnowledgeBaseInput = z.infer<typeof KnowledgeBaseInputSchema>;

// ─────────────────────────────────────────────────────────────
// Output Schema
// ─────────────────────────────────────────────────────────────

/**
 * Article metadata
 */
const ArticleMetadataSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string().optional(),
  tags: z.array(z.string()),
  createdAt: z.date(),
  updatedAt: z.date(),
  version: z.number(),
});

/**
 * Category schema
 */
const CategorySchema = z.object({
  name: z.string(),
  articleCount: z.number(),
  createdAt: z.date(),
});

/**
 * Knowledge base output schema
 */
export const KnowledgeBaseOutputSchema = z.object({
  articleId: z.string().optional(),
  title: z.string().optional(),
  content: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  message: z.string().optional(),
  articles: z.array(ArticleMetadataSchema).optional(),
  categories: z.array(CategorySchema).optional(),
  searchResults: z
    .array(
      z.object({
        article: ArticleMetadataSchema,
        relevance: z.number(),
        snippet: z.string(),
      }),
    )
    .optional(),
});

export type KnowledgeBaseOutput = z.infer<typeof KnowledgeBaseOutputSchema>;

// ─────────────────────────────────────────────────────────────
// Interfaces (DIP)
// ─────────────────────────────────────────────────────────────

/**
 * Storage provider interface
 */
interface IKnowledgeStorageProvider {
  create(article: {
    id: string;
    title: string;
    content: string;
    category?: string;
    tags: string[];
  }): Promise<string>;
  update(
    id: string,
    updates: Partial<{
      title: string;
      content: string;
      category: string;
      tags: string[];
    }>,
  ): Promise<string>;
  delete(id: string): Promise<boolean>;
  get(id: string): Promise<{
    id: string;
    title: string;
    content: string;
    category?: string;
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
    version: number;
  } | null>;
  list(limit?: number): Promise<z.infer<typeof ArticleMetadataSchema>[]>;
  search(
    query: string,
    limit?: number,
  ): Promise<
    {
      article: z.infer<typeof ArticleMetadataSchema>;
      relevance: number;
      snippet: string;
    }[]
  >;
  addCategory(name: string): Promise<void>;
  listCategories(): Promise<z.infer<typeof CategorySchema>[]>;
}

// ─────────────────────────────────────────────────────────────
// Implementation
// ─────────────────────────────────────────────────────────────

/**
 * In-memory knowledge base storage
 */
@Injectable()
class InMemoryKnowledgeStorage implements IKnowledgeStorageProvider {
  private readonly articles: Map<
    string,
    {
      id: string;
      title: string;
      content: string;
      category?: string;
      tags: string[];
      createdAt: Date;
      updatedAt: Date;
      version: number;
    }
  > = new Map();

  private readonly categories: Map<
    string,
    {
      name: string;
      articleCount: number;
      createdAt: Date;
    }
  > = new Map();

  private generateId(): string {
    return `kb_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  async create(article: {
    id: string;
    title: string;
    content: string;
    category?: string;
    tags: string[];
  }): Promise<string> {
    const id = article.id || this.generateId();
    const now = new Date();

    this.articles.set(id, {
      ...article,
      id,
      createdAt: now,
      updatedAt: now,
      version: 1,
    });

    if (article.category) {
      const cat = this.categories.get(article.category);
      if (cat) cat.articleCount++;
      else {
        this.categories.set(article.category, {
          name: article.category,
          articleCount: 1,
          createdAt: now,
        });
      }
    }

    return id;
  }

  async update(
    id: string,
    updates: Partial<{
      title: string;
      content: string;
      category: string;
      tags: string[];
    }>,
  ): Promise<string> {
    const article = this.articles.get(id);
    if (!article) throw new Error(`Article not found: ${id}`);

    const oldCategory = article.category;
    const now = new Date();

    this.articles.set(id, {
      ...article,
      ...updates,
      updatedAt: now,
      version: article.version + 1,
    });

    // Update category counts
    if (updates.category && updates.category !== oldCategory) {
      if (oldCategory) {
        const oldCat = this.categories.get(oldCategory);
        if (oldCat) oldCat.articleCount--;
      }
      const newCat = this.categories.get(updates.category);
      if (newCat) newCat.articleCount++;
    }

    return id;
  }

  async delete(id: string): Promise<boolean> {
    const article = this.articles.get(id);
    if (!article) return false;

    if (article.category) {
      const cat = this.categories.get(article.category);
      if (cat) cat.articleCount--;
    }

    return this.articles.delete(id);
  }

  async get(id: string) {
    return this.articles.get(id) || null;
  }

  async list(limit = 50): Promise<z.infer<typeof ArticleMetadataSchema>[]> {
    return Array.from(this.articles.values())
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, limit)
      .map((a) => ({
        id: a.id,
        title: a.title,
        category: a.category,
        tags: a.tags,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        version: a.version,
      }));
  }

  async search(
    query: string,
    limit = 10,
  ): Promise<
    {
      article: z.infer<typeof ArticleMetadataSchema>;
      relevance: number;
      snippet: string;
    }[]
  > {
    const queryLower = query.toLowerCase();
    const results: {
      article: z.infer<typeof ArticleMetadataSchema>;
      relevance: number;
      snippet: string;
    }[] = [];

    for (const article of this.articles.values()) {
      let relevance = 0;
      let snippet = '';

      // Title match (highest weight)
      if (article.title.toLowerCase().includes(queryLower)) {
        relevance += 10;
      }

      // Content match
      if (article.content.toLowerCase().includes(queryLower)) {
        relevance += 5;
        // Extract snippet
        const idx = article.content.toLowerCase().indexOf(queryLower);
        const start = Math.max(0, idx - 50);
        const end = Math.min(article.content.length, idx + query.length + 50);
        snippet =
          (start > 0 ? '...' : '') +
          article.content.slice(start, end) +
          (end < article.content.length ? '...' : '');
      }

      // Tag match
      for (const tag of article.tags) {
        if (tag.toLowerCase().includes(queryLower)) {
          relevance += 3;
        }
      }

      // Category match
      if (article.category?.toLowerCase().includes(queryLower)) {
        relevance += 2;
      }

      if (relevance > 0) {
        results.push({
          article: {
            id: article.id,
            title: article.title,
            category: article.category,
            tags: article.tags,
            createdAt: article.createdAt,
            updatedAt: article.updatedAt,
            version: article.version,
          },
          relevance,
          snippet: snippet || article.content.slice(0, 100) + '...',
        });
      }
    }

    return results.sort((a, b) => b.relevance - a.relevance).slice(0, limit);
  }

  async addCategory(name: string): Promise<void> {
    if (!this.categories.has(name)) {
      this.categories.set(name, {
        name,
        articleCount: 0,
        createdAt: new Date(),
      });
    }
  }

  async listCategories(): Promise<z.infer<typeof CategorySchema>[]> {
    return Array.from(this.categories.values());
  }
}

// ─────────────────────────────────────────────────────────────
// Knowledge Base Tool
// ─────────────────────────────────────────────────────────────

/**
 * Knowledge Base Tool
 *
 * Features:
 * - Article CRUD operations
 * - Category management
 * - Full-text search with relevance scoring
 * - Tag-based organization
 */
@Injectable()
export class KnowledgeBaseTool extends BaseStructuredTool {
  readonly name = 'knowledge_base';
  readonly description =
    'Manage and search knowledge base articles with categories, tags, and full-text search capabilities';
  readonly category = ToolCategory.INFORMATION;
  readonly inputSchema = KnowledgeBaseInputSchema;
  readonly outputSchema = KnowledgeBaseOutputSchema;
  readonly version = '1.0.0';

  private readonly storage: IKnowledgeStorageProvider;

  constructor(private readonly config: ConfigService) {
    super();
    this.storage = new InMemoryKnowledgeStorage();
  }

  /**
   * Core execution logic
   */
  protected async executeImpl(
    input: KnowledgeBaseInput,
    context: Partial<ToolExecutionContext>,
  ): Promise<StructuredToolResult<KnowledgeBaseOutput>> {
    const startTime = Date.now();
    const tenantId = context?.tenantId ?? 'unknown';

    this.logger.log(
      `[KnowledgeBaseTool] Action: ${input.action} for tenant: ${tenantId}`,
    );

    try {
      switch (input.action) {
        case 'create':
          return await this.handleCreate(input, startTime);
        case 'update':
          return await this.handleUpdate(input, startTime);
        case 'delete':
          return await this.handleDelete(input, startTime);
        case 'get':
          return await this.handleGet(input, startTime);
        case 'list':
          return await this.handleList(input, startTime);
        case 'search':
          return await this.handleSearch(input, startTime);
        case 'add_category':
          return await this.handleAddCategory(input, startTime);
        default:
          return {
            success: false,
            error: `Unknown action: ${input.action}`,
            metadata: { durationMs: Date.now() - startTime },
          };
      }
    } catch (error) {
      this.logger.error(
        `[KnowledgeBaseTool] Action ${input.action} failed`,
        error instanceof Error ? error.message : String(error),
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Knowledge base operation failed',
        metadata: { durationMs: Date.now() - startTime },
      };
    }
  }

  private async handleCreate(
    input: KnowledgeBaseInput,
    startTime: number,
  ): Promise<StructuredToolResult<KnowledgeBaseOutput>> {
    const { title, content, category, tags = [] } = input;

    if (!title || !content) {
      return {
        success: false,
        error: 'Title and content are required for creating an article',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    const articleId = await this.storage.create({
      title,
      content,
      category,
      tags,
    });

    return {
      success: true,
      data: {
        articleId,
        title,
        content,
        category,
        tags,
        message: `Article "${title}" created successfully`,
      },
      metadata: { durationMs: Date.now() - startTime },
    };
  }

  private async handleUpdate(
    input: KnowledgeBaseInput,
    startTime: number,
  ): Promise<StructuredToolResult<KnowledgeBaseOutput>> {
    const { articleId, title, content, category, tags } = input;

    if (!articleId) {
      return {
        success: false,
        error: 'articleId is required for update',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    const updates: Partial<{
      title: string;
      content: string;
      category: string;
      tags: string[];
    }> = {};
    if (title) updates.title = title;
    if (content) updates.content = content;
    if (category) updates.category = category;
    if (tags) updates.tags = tags;

    const updatedId = await this.storage.update(articleId, updates);

    return {
      success: true,
      data: {
        articleId: updatedId,
        message: 'Article updated successfully',
      },
      metadata: { durationMs: Date.now() - startTime },
    };
  }

  private async handleDelete(
    input: KnowledgeBaseInput,
    startTime: number,
  ): Promise<StructuredToolResult<KnowledgeBaseOutput>> {
    const { articleId } = input;

    if (!articleId) {
      return {
        success: false,
        error: 'articleId is required for deletion',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    const deleted = await this.storage.delete(articleId);

    if (!deleted) {
      return {
        success: false,
        error: `Article with ID "${articleId}" not found`,
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    return {
      success: true,
      data: {
        articleId,
        message: 'Article deleted successfully',
      },
      metadata: { durationMs: Date.now() - startTime },
    };
  }

  private async handleGet(
    input: KnowledgeBaseInput,
    startTime: number,
  ): Promise<StructuredToolResult<KnowledgeBaseOutput>> {
    const { articleId } = input;

    if (!articleId) {
      return {
        success: false,
        error: 'articleId is required',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    const article = await this.storage.get(articleId);

    if (!article) {
      return {
        success: false,
        error: `Article with ID "${articleId}" not found`,
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    return {
      success: true,
      data: {
        articleId: article.id,
        title: article.title,
        content: article.content,
        category: article.category,
        tags: article.tags,
        message: 'Article retrieved successfully',
      },
      metadata: { durationMs: Date.now() - startTime },
    };
  }

  private async handleList(
    input: KnowledgeBaseInput,
    startTime: number,
  ): Promise<StructuredToolResult<KnowledgeBaseOutput>> {
    const { limit = 50 } = input;

    const articles = await this.storage.list(limit);
    const categories = await this.storage.listCategories();

    return {
      success: true,
      data: {
        articles,
        categories,
        message: `Found ${articles.length} article(s) and ${categories.length} category(ies)`,
      },
      metadata: { durationMs: Date.now() - startTime },
    };
  }

  private async handleSearch(
    input: KnowledgeBaseInput,
    startTime: number,
  ): Promise<StructuredToolResult<KnowledgeBaseOutput>> {
    const { query, limit = 10 } = input;

    if (!query) {
      return {
        success: false,
        error: 'query is required for search',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    const searchResults = await this.storage.search(query, limit);

    return {
      success: true,
      data: {
        searchResults,
        message: `Found ${searchResults.length} result(s) for "${query}"`,
      },
      metadata: { durationMs: Date.now() - startTime },
    };
  }

  private async handleAddCategory(
    input: KnowledgeBaseInput,
    startTime: number,
  ): Promise<StructuredToolResult<KnowledgeBaseOutput>> {
    const { categoryName } = input;

    if (!categoryName) {
      return {
        success: false,
        error: 'categoryName is required',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    await this.storage.addCategory(categoryName);

    return {
      success: true,
      data: {
        category: categoryName,
        message: `Category "${categoryName}" created successfully`,
      },
      metadata: { durationMs: Date.now() - startTime },
    };
  }
}
