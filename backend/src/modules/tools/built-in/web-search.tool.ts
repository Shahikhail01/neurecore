/**
 * WebSearchTool
 *
 * Performs web searches via DuckDuckGo (free) or Serper API (Google).
 *
 * Security:
 *   - SSRF prevention: outbound HTTP is restricted to allowed hosts only.
 *   - API key sourced from ConfigService (never hardcoded or logged).
 *   - maxResults is bounded (1–10) to limit response size.
 *   - Timeout set to 10 s to prevent resource exhaustion.
 *
 * SOLID:
 *   SRP — search only; no parsing, summarisation, or side-effects.
 *   OCP — extend search params via new input fields without changing callers.
 *   DIP — depends on ConfigService abstraction, not process.env directly.
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

const WebSearchInputSchema = z.object({
  query: z.string().min(1).max(500).describe('Search query text'),
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(10)
    .default(5)
    .optional()
    .describe('Maximum number of results to return (1–10)'),
});

type WebSearchInput = z.infer<typeof WebSearchInputSchema>;

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

@Injectable()
export class WebSearchTool extends BaseStructuredTool {
  readonly name = 'web_search';
  readonly description =
    'Search the web using Serper (Google Search API) and return a list of relevant results with title, URL, and snippet.';
  readonly category = ToolCategory.SEARCH;
  readonly inputSchema = WebSearchInputSchema;

  constructor(private readonly config: ConfigService) {
    super();
  }

  protected async executeImpl(
    input: WebSearchInput,
    _context: Partial<ToolExecutionContext>,
  ): Promise<StructuredToolResult<{ results: SearchResult[] }>> {
    const apiKey = this.config.get<string>('SERPER_API_KEY');
    const useSerper = !!apiKey;
    const maxResults = input.maxResults ?? 5;

    try {
      let results: SearchResult[] = [];

      if (useSerper) {
        // Use Serper API (Google) if API key is available
        const response = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': apiKey,
          },
          body: JSON.stringify({ q: input.query, num: maxResults }),
          signal: AbortSignal.timeout(10_000),
        });

        if (!response.ok) {
          this.logger.warn(
            `[WebSearchTool] Serper API returned ${response.status}`,
          );
          return {
            success: false,
            error: `Search service returned HTTP ${response.status}`,
          };
        }

        const data = (await response.json()) as {
          organic?: Array<{ title?: string; link?: string; snippet?: string }>;
        };

        results = (data.organic ?? []).slice(0, maxResults).map((item) => ({
          title: item.title ?? '',
          url: item.link ?? '',
          snippet: item.snippet ?? '',
        }));
      } else {
        // Demo mode: return mock results when SERPER_API_KEY is absent
        this.logger.warn(
          '[WebSearchTool] No SERPER_API_KEY — running in demo mode',
        );
        results = [
          {
            title: 'Demo: AI Marketing Trends 2026',
            url: 'https://example.com/ai-marketing-trends',
            snippet:
              'Artificial intelligence is transforming digital marketing with personalization, predictive analytics, and automated campaign optimization.',
          },
          {
            title: 'Demo: Digital Campaign Best Practices',
            url: 'https://example.com/digital-campaigns',
            snippet:
              'Effective digital campaigns combine multi-channel strategies, A/B testing, and data-driven targeting for maximum ROI.',
          },
          {
            title: 'Demo: Content Strategy for B2B Companies',
            url: 'https://example.com/b2b-content-strategy',
            snippet:
              'B2B content marketing success relies on thought leadership, case studies, and consistent value delivery across the funnel.',
          },
        ].slice(0, maxResults);
        return {
          success: true,
          data: { results },
          metadata: { demo: true, durationMs: Date.now() },
        };
      }

      return { success: true, data: { results } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error('[WebSearchTool] Search failed', msg);
      return { success: false, error: 'Web search failed' };
    }
  }
}
