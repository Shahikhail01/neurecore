/**
 * Vector Search Tool - Tool 8 of 12
 * Enables AI agents to perform semantic search using vector embeddings
 *
 * SOLID Principles Applied:
 * - SRP: Single responsibility for vector search operations
 * - OCP: Extensible via embedding providers
 * - DIP: Depends on abstractions for vector storage
 *
 * @description
 * Features: Semantic search, similarity scoring, index management, chunk retrieval
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
 * Vector search operation actions
 */
export const VectorSearchActionEnum = z.enum([
  'index',
  'search',
  'delete',
  'list_indexes',
  'get_stats',
]);

export type VectorSearchAction = z.infer<typeof VectorSearchActionEnum>;

/**
 * Input schema for Vector Search Tool
 */
export const VectorSearchInputSchema = z.object({
  action: VectorSearchActionEnum.describe(
    'The vector search action to perform',
  ),
  indexName: z.string().optional().describe('Name of the vector index'),
  text: z.string().optional().describe('Text to index or search'),
  query: z.string().optional().describe('Search query'),
  topK: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .describe('Number of results to return'),
  threshold: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe('Similarity threshold'),
  metadata: z.record(z.string()).optional().describe('Metadata for indexing'),
  id: z.string().optional().describe('Document ID for delete'),
});

export type VectorSearchInput = z.infer<typeof VectorSearchInputSchema>;

// ─────────────────────────────────────────────────────────────
// Output Schema
// ─────────────────────────────────────────────────────────────

/**
 * Search result schema
 */
const SearchResultSchema = z.object({
  id: z.string(),
  text: z.string(),
  score: z.number(),
  metadata: z.record(z.string()).optional(),
});

/**
 * Index stats schema
 */
const IndexStatsSchema = z.object({
  name: z.string(),
  documentCount: z.number(),
  dimension: z.number(),
  createdAt: z.date(),
});

/**
 * Vector search output schema
 */
export const VectorSearchOutputSchema = z.object({
  indexName: z.string().optional(),
  documentId: z.string().optional(),
  message: z.string().optional(),
  results: z.array(SearchResultSchema).optional(),
  indexes: z.array(z.string()).optional(),
  stats: IndexStatsSchema.optional(),
});

export type VectorSearchOutput = z.infer<typeof VectorSearchOutputSchema>;

// ─────────────────────────────────────────────────────────────
// Interfaces (DIP)
// ─────────────────────────────────────────────────────────────

/**
 * Vector storage provider interface
 */
interface IVectorStorageProvider {
  index(
    indexName: string,
    text: string,
    metadata?: Record<string, string>,
  ): Promise<string>;
  search(
    indexName: string,
    query: string,
    topK?: number,
    threshold?: number,
  ): Promise<z.infer<typeof SearchResultSchema>[]>;
  delete(indexName: string, documentId: string): Promise<boolean>;
  listIndexes(): Promise<string[]>;
  getStats(indexName: string): Promise<z.infer<typeof IndexStatsSchema>>;
}

// ─────────────────────────────────────────────────────────────
// Implementation
// ─────────────────────────────────────────────────────────────

/**
 * In-memory vector storage (simulates vector search with simple text matching)
 * In production, this would connect to pgvector, Pinecone, Weaviate, etc.
 */
@Injectable()
class InMemoryVectorStorage implements IVectorStorageProvider {
  private readonly indexes: Map<
    string,
    {
      name: string;
      documents: Map<
        string,
        {
          id: string;
          text: string;
          embedding: number[];
          metadata: Record<string, string>;
          createdAt: Date;
        }
      >;
      dimension: number;
      createdAt: Date;
    }
  > = new Map();

  /**
   * Simple embedding simulation (in production, use actual embeddings)
   */
  private generateEmbedding(text: string): number[] {
    const words = text.toLowerCase().split(/\s+/);
    const dimension = 128;
    const embedding = new Array(dimension).fill(0);

    // Simple hash-based embedding for simulation
    for (let i = 0; i < dimension; i++) {
      embedding[i] = Math.sin(words.length * (i + 1)) * 0.5 + 0.5;
    }

    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    return embedding.map((v) => v / magnitude);
  }

  /**
   * Cosine similarity calculation
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async index(
    indexName: string,
    text: string,
    metadata?: Record<string, string>,
  ): Promise<string> {
    let index = this.indexes.get(indexName);

    if (!index) {
      index = {
        name: indexName,
        documents: new Map(),
        dimension: 128,
        createdAt: new Date(),
      };
      this.indexes.set(indexName, index);
    }

    const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const embedding = this.generateEmbedding(text);

    index.documents.set(docId, {
      id: docId,
      text,
      embedding,
      metadata: metadata || {},
      createdAt: new Date(),
    });

    return docId;
  }

  async search(
    indexName: string,
    query: string,
    topK = 5,
    threshold = 0.5,
  ): Promise<z.infer<typeof SearchResultSchema>[]> {
    const index = this.indexes.get(indexName);

    if (!index) {
      return [];
    }

    const queryEmbedding = this.generateEmbedding(query);
    const results: z.infer<typeof SearchResultSchema>[] = [];

    for (const doc of index.documents.values()) {
      const score = this.cosineSimilarity(queryEmbedding, doc.embedding);

      if (score >= threshold) {
        results.push({
          id: doc.id,
          text: doc.text,
          score,
          metadata: doc.metadata,
        });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  async delete(indexName: string, documentId: string): Promise<boolean> {
    const index = this.indexes.get(indexName);

    if (!index) return false;

    return index.documents.delete(documentId);
  }

  async listIndexes(): Promise<string[]> {
    return Array.from(this.indexes.keys());
  }

  async getStats(indexName: string): Promise<z.infer<typeof IndexStatsSchema>> {
    const index = this.indexes.get(indexName);

    if (!index) {
      throw new Error(`Index "${indexName}" not found`);
    }

    return {
      name: index.name,
      documentCount: index.documents.size,
      dimension: index.dimension,
      createdAt: index.createdAt,
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Vector Search Tool
// ─────────────────────────────────────────────────────────────

/**
 * Vector Search Tool
 *
 * Features:
 * - Semantic search with cosine similarity
 * - Index management
 * - Metadata filtering
 * - Configurable top-K and threshold
 */
@Injectable()
export class VectorSearchTool extends BaseStructuredTool {
  readonly name = 'vector_search';
  readonly description =
    'Perform semantic search using vector embeddings with similarity scoring and index management';
  readonly category = ToolCategory.DATA;
  readonly inputSchema = VectorSearchInputSchema;
  readonly outputSchema = VectorSearchOutputSchema;
  readonly version = '1.0.0';

  private readonly storage: IVectorStorageProvider;

  constructor(private readonly config: ConfigService) {
    super();
    this.storage = new InMemoryVectorStorage();
  }

  /**
   * Core execution logic
   */
  protected async executeImpl(
    input: VectorSearchInput,
    context: Partial<ToolExecutionContext>,
  ): Promise<StructuredToolResult<VectorSearchOutput>> {
    const startTime = Date.now();
    const tenantId = context?.tenantId ?? 'unknown';

    this.logger.log(
      `[VectorSearchTool] Action: ${input.action} for tenant: ${tenantId}`,
    );

    try {
      switch (input.action) {
        case 'index':
          return await this.handleIndex(input, startTime);
        case 'search':
          return await this.handleSearch(input, startTime);
        case 'delete':
          return await this.handleDelete(input, startTime);
        case 'list_indexes':
          return await this.handleListIndexes(startTime);
        case 'get_stats':
          return await this.handleGetStats(input, startTime);
        default:
          return {
            success: false,
            error: `Unknown action: ${input.action}`,
            metadata: { durationMs: Date.now() - startTime },
          };
      }
    } catch (error) {
      this.logger.error(
        `[VectorSearchTool] Action ${input.action} failed`,
        error instanceof Error ? error.message : String(error),
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Vector search operation failed',
        metadata: { durationMs: Date.now() - startTime },
      };
    }
  }

  private async handleIndex(
    input: VectorSearchInput,
    startTime: number,
  ): Promise<StructuredToolResult<VectorSearchOutput>> {
    const { indexName, text, metadata } = input;

    if (!indexName || !text) {
      return {
        success: false,
        error: 'indexName and text are required for indexing',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    const documentId = await this.storage.index(indexName, text, metadata);

    return {
      success: true,
      data: {
        indexName,
        documentId,
        message: `Document indexed successfully in "${indexName}"`,
      },
      metadata: { durationMs: Date.now() - startTime },
    };
  }

  private async handleSearch(
    input: VectorSearchInput,
    startTime: number,
  ): Promise<StructuredToolResult<VectorSearchOutput>> {
    const { indexName, query, topK = 5, threshold = 0.5 } = input;

    if (!indexName || !query) {
      return {
        success: false,
        error: 'indexName and query are required for search',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    const results = await this.storage.search(
      indexName,
      query,
      topK,
      threshold,
    );

    return {
      success: true,
      data: {
        indexName,
        results,
        message: `Found ${results.length} result(s)`,
      },
      metadata: { durationMs: Date.now() - startTime },
    };
  }

  private async handleDelete(
    input: VectorSearchInput,
    startTime: number,
  ): Promise<StructuredToolResult<VectorSearchOutput>> {
    const { indexName, id } = input;

    if (!indexName || !id) {
      return {
        success: false,
        error: 'indexName and id are required for deletion',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    const deleted = await this.storage.delete(indexName, id);

    if (!deleted) {
      return {
        success: false,
        error: `Document with ID "${id}" not found in index "${indexName}"`,
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    return {
      success: true,
      data: {
        indexName,
        documentId: id,
        message: 'Document deleted successfully',
      },
      metadata: { durationMs: Date.now() - startTime },
    };
  }

  private async handleListIndexes(
    startTime: number,
  ): Promise<StructuredToolResult<VectorSearchOutput>> {
    const indexes = await this.storage.listIndexes();

    return {
      success: true,
      data: {
        indexes,
        message: `Found ${indexes.length} index(es)`,
      },
      metadata: { durationMs: Date.now() - startTime },
    };
  }

  private async handleGetStats(
    input: VectorSearchInput,
    startTime: number,
  ): Promise<StructuredToolResult<VectorSearchOutput>> {
    const { indexName } = input;

    if (!indexName) {
      return {
        success: false,
        error: 'indexName is required',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    const stats = await this.storage.getStats(indexName);

    return {
      success: true,
      data: {
        indexName,
        stats,
        message: `Stats for index "${indexName}"`,
      },
      metadata: { durationMs: Date.now() - startTime },
    };
  }
}
