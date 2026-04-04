/**
 * LLM Integration Tool - P1-12 of remaining tools
 * Enables AI agents to interact with LLM providers for text generation, embeddings, etc.
 * For all AI agents requiring LLM capabilities
 *
 * SOLID Principles Applied:
 * - SRP: Single responsibility for LLM operations
 * - OCP: Extensible via LLM provider interfaces
 * - DIP: Depends on abstractions for LLM providers
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

export const LLMIntegrationActionEnum = z.enum([
  'generate_text',
  'generate_structured',
  'embed_text',
  'batch_embed',
  'count_tokens',
  'list_models',
]);

export type LLMIntegrationAction = z.infer<typeof LLMIntegrationActionEnum>;

export const LLMIntegrationInputSchema = z.object({
  action: LLMIntegrationActionEnum.describe('The LLM action to perform'),
  prompt: z.string().optional().describe('Text prompt for generation'),
  messages: z
    .array(
      z.object({
        role: z.enum(['system', 'user', 'assistant']),
        content: z.string(),
      }),
    )
    .optional()
    .describe('Chat messages'),
  model: z.string().optional().describe('Model to use'),
  temperature: z.number().min(0).max(2).optional().default(0.7),
  maxTokens: z.number().int().positive().optional().default(2048),
  texts: z.array(z.string()).optional().describe('Texts for embedding'),
  schema: z
    .record(z.unknown())
    .optional()
    .describe('Zod schema for structured output'),
  options: z
    .object({
      stopSequences: z.array(z.string()).optional(),
      topP: z.number().min(0).max(1).optional(),
      frequencyPenalty: z.number().min(-2).max(2).optional(),
      presencePenalty: z.number().min(-2).max(2).optional(),
      seed: z.number().int().optional(),
    })
    .optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export type LLMIntegrationInput = z.infer<typeof LLMIntegrationInputSchema>;

// ─────────────────────────────────────────────────────────────
// Output Types
// ─────────────────────────────────────────────────────────────

type TextGenerationResult = {
  text: string;
  model: string;
  finishReason: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
};

type StructuredGenerationResult = {
  data: Record<string, unknown>;
  text: string;
  model: string;
  finishReason: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
};

type EmbeddingResult = {
  embedding: number[];
  model: string;
  text: string;
};

type BatchEmbeddingResult = Array<{
  embedding: number[];
  text: string;
  index: number;
}>;

type ModelInfo = {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
  maxTokens: number;
  supportsStreaming: boolean;
  supportsFunctionCalling: boolean;
};

// ─────────────────────────────────────────────────────────────
// Provider Interface (DIP)
// ─────────────────────────────────────────────────────────────

interface ILLMProvider {
  generateText(
    prompt: string,
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      stopSequences?: string[];
      topP?: number;
      frequencyPenalty?: number;
      presencePenalty?: number;
      seed?: number;
    },
  ): Promise<TextGenerationResult>;

  generateFromMessages(
    messages: Array<{ role: string; content: string }>,
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    },
  ): Promise<TextGenerationResult>;

  generateStructured(
    prompt: string,
    schema: Record<string, unknown>,
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    },
  ): Promise<StructuredGenerationResult>;

  embedText(text: string, model?: string): Promise<EmbeddingResult>;

  batchEmbed(texts: string[], model?: string): Promise<BatchEmbeddingResult>;

  countTokens(text: string, model?: string): Promise<{ count: number }>;

  listModels(): Promise<ModelInfo[]>;
}

// ─────────────────────────────────────────────────────────────
// Mock LLM Provider
// ─────────────────────────────────────────────────────────────

@Injectable()
class MockLLMProvider implements ILLMProvider {
  private readonly logger = new Logger(MockLLMProvider.name);

  private readonly models: ModelInfo[] = [
    {
      id: 'gpt-4',
      name: 'GPT-4',
      provider: 'OpenAI',
      contextWindow: 8192,
      maxTokens: 4096,
      supportsStreaming: true,
      supportsFunctionCalling: true,
    },
    {
      id: 'gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      provider: 'OpenAI',
      contextWindow: 4096,
      maxTokens: 2048,
      supportsStreaming: true,
      supportsFunctionCalling: true,
    },
    {
      id: 'claude-3-opus',
      name: 'Claude 3 Opus',
      provider: 'Anthropic',
      contextWindow: 200000,
      maxTokens: 4096,
      supportsStreaming: true,
      supportsFunctionCalling: false,
    },
  ];

  async generateText(
    prompt: string,
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      stopSequences?: string[];
      topP?: number;
      frequencyPenalty?: number;
      presencePenalty?: number;
      seed?: number;
    },
  ): Promise<TextGenerationResult> {
    this.logger.log(
      'Generating text with model: ' + (options?.model || 'gpt-4'),
    );

    // Mock response - in production, call actual LLM API
    const text = `Generated response for: ${prompt.substring(0, 50)}...`;
    const model = options?.model || 'gpt-4';
    const promptTokens = Math.ceil(prompt.length / 4);
    const completionTokens = Math.ceil(text.length / 4);

    return {
      text,
      model,
      finishReason: 'stop',
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
    };
  }

  async generateFromMessages(
    messages: Array<{ role: string; content: string }>,
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    },
  ): Promise<TextGenerationResult> {
    this.logger.log(
      'Generating from messages with model: ' + (options?.model || 'gpt-4'),
    );

    const lastUserMessage = messages.filter((m) => m.role === 'user').pop();
    const prompt = lastUserMessage?.content || '';

    return this.generateText(prompt, options);
  }

  async generateStructured(
    prompt: string,
    schema: Record<string, unknown>,
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    },
  ): Promise<StructuredGenerationResult> {
    this.logger.log('Generating structured output');

    const textResult = await this.generateText(prompt, options);
    const model = options?.model || 'gpt-4';

    // Mock structured data based on schema
    const data: Record<string, unknown> = {};
    if (schema && typeof schema === 'object') {
      const properties = (schema as { properties?: Record<string, unknown> })
        .properties;
      if (properties) {
        Object.keys(properties).forEach((key) => {
          data[key] = `generated_${key}`;
        });
      }
    }

    return {
      data,
      text: textResult.text,
      model,
      finishReason: textResult.finishReason,
      usage: textResult.usage,
    };
  }

  async embedText(text: string, model?: string): Promise<EmbeddingResult> {
    this.logger.log('Embedding text');

    // Generate mock embedding - in production, use actual embedding API
    const embedding: number[] = [];
    for (let i = 0; i < 1536; i++) {
      embedding.push(Math.random() * 2 - 1);
    }

    return {
      embedding,
      model: model || 'text-embedding-ada-002',
      text,
    };
  }

  async batchEmbed(
    texts: string[],
    model?: string,
  ): Promise<BatchEmbeddingResult> {
    this.logger.log('Batch embedding ' + texts.length + ' texts');

    const results: BatchEmbeddingResult = [];
    for (let i = 0; i < texts.length; i++) {
      const result = await this.embedText(texts[i], model);
      results.push({
        embedding: result.embedding,
        text: texts[i],
        index: i,
      });
    }

    return results;
  }

  async countTokens(text: string, model?: string): Promise<{ count: number }> {
    this.logger.log('Counting tokens');
    // Approximate token count
    const count = Math.ceil(text.length / 4);
    return { count };
  }

  async listModels(): Promise<ModelInfo[]> {
    this.logger.log('Listing models');
    return this.models;
  }
}

// ─────────────────────────────────────────────────────────────
// Tool Implementation
// ─────────────────────────────────────────────────────────────

@Injectable()
export class LLMIntegrationTool extends BaseStructuredTool {
  readonly name = 'llm_integration';
  readonly description =
    'Interact with LLM providers for text generation, embeddings, and model management';
  readonly category = ToolCategory.AI;
  readonly inputSchema = LLMIntegrationInputSchema;

  private readonly log = new Logger(LLMIntegrationTool.name);
  private readonly provider: ILLMProvider;

  constructor(private readonly config: ConfigService) {
    super();
    this.provider = new MockLLMProvider();
  }

  protected async executeImpl(
    input: LLMIntegrationInput,
    context: ToolExecutionContext,
  ): Promise<StructuredToolResult<unknown>> {
    this.log.log('Executing LLM Integration action: ' + input.action);

    try {
      switch (input.action) {
        case 'generate_text':
          return await this.handleGenerateText(input);
        case 'generate_structured':
          return await this.handleGenerateStructured(input);
        case 'embed_text':
          return await this.handleEmbedText(input);
        case 'batch_embed':
          return await this.handleBatchEmbed(input);
        case 'count_tokens':
          return await this.handleCountTokens(input);
        case 'list_models':
          return await this.handleListModels(input);
        default:
          throw new Error('Unknown action: ' + input.action);
      }
    } catch (error) {
      const err = error as Error;
      this.log.error(
        'LLM Integration action failed: ' + err.message,
        err.stack,
      );
      return { success: false, error: err.message };
    }
  }

  private async handleGenerateText(
    input: LLMIntegrationInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.prompt && (!input.messages || input.messages.length === 0)) {
      throw new Error(
        'prompt or messages is required for generate_text action',
      );
    }

    let result;
    if (input.messages && input.messages.length > 0) {
      result = await this.provider.generateFromMessages(input.messages, {
        model: input.model,
        temperature: input.temperature,
        maxTokens: input.maxTokens,
      });
    } else {
      result = await this.provider.generateText(input.prompt!, {
        model: input.model,
        temperature: input.temperature,
        maxTokens: input.maxTokens,
        stopSequences: input.options?.stopSequences,
        topP: input.options?.topP,
        frequencyPenalty: input.options?.frequencyPenalty,
        presencePenalty: input.options?.presencePenalty,
        seed: input.options?.seed,
      });
    }

    return {
      success: true,
      data: result,
    };
  }

  private async handleGenerateStructured(
    input: LLMIntegrationInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.prompt) {
      throw new Error('prompt is required for generate_structured action');
    }
    if (!input.schema) {
      throw new Error('schema is required for generate_structured action');
    }

    const result = await this.provider.generateStructured(
      input.prompt,
      input.schema,
      {
        model: input.model,
        temperature: input.temperature,
        maxTokens: input.maxTokens,
      },
    );

    return {
      success: true,
      data: result,
    };
  }

  private async handleEmbedText(
    input: LLMIntegrationInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.texts || input.texts.length === 0) {
      throw new Error('texts array is required for embed_text action');
    }

    const result = await this.provider.embedText(input.texts[0], input.model);

    return {
      success: true,
      data: result,
    };
  }

  private async handleBatchEmbed(
    input: LLMIntegrationInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.texts || input.texts.length === 0) {
      throw new Error('texts array is required for batch_embed action');
    }

    const result = await this.provider.batchEmbed(input.texts, input.model);

    return {
      success: true,
      data: { embeddings: result, count: result.length },
    };
  }

  private async handleCountTokens(
    input: LLMIntegrationInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.prompt) {
      throw new Error('prompt is required for count_tokens action');
    }

    const result = await this.provider.countTokens(input.prompt, input.model);

    return {
      success: true,
      data: result,
    };
  }

  private async handleListModels(
    input: LLMIntegrationInput,
  ): Promise<StructuredToolResult<unknown>> {
    const result = await this.provider.listModels();

    return {
      success: true,
      data: { models: result, count: result.length },
    };
  }
}
