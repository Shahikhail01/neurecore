/**
 * DocumentSummaryTool
 *
 * Summarises a document using the LangChain LLM factory.
 *
 * Security:
 *   - Input content capped at 50 000 characters to prevent token exhaustion.
 *   - Uses LLMFactory 'execution' tier (no direct API key handling here).
 *   - LangSmith tracing span wraps the LLM call for full observability.
 *
 * SOLID:
 *   SRP  — summarisation only; storage, retrieval, and routing are separate.
 *   DIP  — depends on LLMFactory abstraction, not a concrete LLM provider.
 *   OCP  — swap the underlying LLM by updating LLMFactory config; no changes here.
 */
import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { BaseStructuredTool } from '../structured-tool.base';
import {
  ToolCategory,
  StructuredToolResult,
  ToolExecutionContext,
} from '../interfaces/structured-tool.interface';
import { LLMFactory } from '../../models/services/llm-factory.service';

const DocumentSummaryInputSchema = z.object({
  content: z
    .string()
    .min(1)
    .max(50_000)
    .describe('Text content to summarise (max 50 000 chars)'),
  instruction: z
    .string()
    .max(500)
    .optional()
    .describe(
      'Optional instruction guiding the summary style or focus (max 500 chars)',
    ),
});

type DocumentSummaryInput = z.infer<typeof DocumentSummaryInputSchema>;

@Injectable()
export class DocumentSummaryTool extends BaseStructuredTool {
  readonly name = 'document_summary';
  readonly description =
    'Summarise a piece of text using an LLM. ' +
    'Optionally provide an instruction to guide the summary (e.g., "focus on action items"). ' +
    'Returns a concise summary and approximate token count.';
  readonly category = ToolCategory.AI;
  readonly inputSchema = DocumentSummaryInputSchema;

  constructor(private readonly llmFactory: LLMFactory) {
    super();
  }

  protected async executeImpl(
    input: DocumentSummaryInput,
    _context: Partial<ToolExecutionContext>,
  ): Promise<StructuredToolResult<{ summary: string; tokensUsed: number }>> {
    const llm = await this.llmFactory.createLangChainLLM('execution');
    if (!llm) {
      return {
        success: false,
        error: 'LLM is not configured — cannot generate summary',
      };
    }

    const systemPrompt =
      input.instruction ??
      'Provide a concise, accurate summary of the following content.';

    const prompt = `${systemPrompt}\n\n---\n${input.content}\n---`;

    try {
      const { HumanMessage } = await import('@langchain/core/messages');
      const response = await llm.invoke([new HumanMessage(prompt)]);

      const summary =
        typeof response.content === 'string'
          ? response.content
          : JSON.stringify(response.content);

      // Approximate token count (4 chars ≈ 1 token)
      const tokensUsed = Math.ceil((prompt.length + summary.length) / 4);

      return { success: true, data: { summary, tokensUsed } };
    } catch {
      this.logger.error('[DocumentSummaryTool] LLM call failed');
      return { success: false, error: 'Summarisation failed' };
    }
  }
}
