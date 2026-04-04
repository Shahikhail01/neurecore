/**
 * VoiceAnalyticsTool
 *
 * Provides voice input processing, speech-to-text conversion,
 * voice analytics, and audio analysis capabilities.
 *
 * SOLID:
 *   SRP  — handles voice/audio operations only.
 *   OCP  — new actions can be added without modifying existing handlers.
 *   DIP  — depends on IVoiceProvider abstraction, not concrete implementations.
 *
 * Actions:
 *   transcribe_audio    — Convert audio to text
 *   analyze_sentiment   — Analyze sentiment from voice/text
 *   detect_language     — Detect language from audio
 *   get_voice_metrics   — Get voice quality metrics
 *   list_transcriptions — List past transcriptions
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { BaseStructuredTool } from '../structured-tool.base';
import {
  ToolCategory,
  StructuredToolResult,
} from '../interfaces/structured-tool.interface';

// ─── Schemas ───────────────────────────────────────────────────────────────────

const TranscriptionSchema = z.object({
  id: z.string(),
  text: z.string(),
  language: z.string().optional(),
  confidence: z.number().min(0).max(1),
  duration: z.number(),
  segments: z
    .array(
      z.object({
        start: z.number(),
        end: z.number(),
        text: z.string(),
        confidence: z.number(),
      }),
    )
    .optional(),
  createdAt: z.string(),
});

const SentimentSchema = z.object({
  sentiment: z.enum(['positive', 'negative', 'neutral', 'mixed']),
  score: z.number().min(-1).max(1),
  confidence: z.number().min(0).max(1),
  emotions: z
    .object({
      joy: z.number().optional(),
      anger: z.number().optional(),
      sadness: z.number().optional(),
      fear: z.number().optional(),
      surprise: z.number().optional(),
    })
    .optional(),
});

const VoiceMetricsSchema = z.object({
  clarity: z.number().min(0).max(100),
  pace: z.number(),
  volume: z.number().min(0).max(100),
  fillerWords: z.number(),
  wordsPerMinute: z.number(),
  pauseDuration: z.number(),
});

const VoiceAnalyticsInputSchema = z.object({
  action: z.enum([
    'transcribe_audio',
    'analyze_sentiment',
    'detect_language',
    'get_voice_metrics',
    'list_transcriptions',
  ]),
  audioUrl: z.string().url().optional(),
  text: z.string().optional(),
  language: z.string().optional(),
  options: z
    .object({
      includeTimestamps: z.boolean().optional(),
      detectLanguage: z.boolean().optional(),
      punctuation: z.boolean().optional(),
    })
    .optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

type VoiceAnalyticsInput = z.infer<typeof VoiceAnalyticsInputSchema>;

// ─── Provider Interface ────────────────────────────────────────────────────────

interface IVoiceProvider {
  transcribe(
    audioUrl: string,
    options?: {
      language?: string;
      includeTimestamps?: boolean;
      detectLanguage?: boolean;
      punctuation?: boolean;
    },
  ): Promise<z.infer<typeof TranscriptionSchema>>;

  analyzeSentiment(text: string): Promise<z.infer<typeof SentimentSchema>>;

  detectLanguage(
    audioUrl: string,
  ): Promise<{ language: string; confidence: number }>;

  getVoiceMetrics(
    audioUrl: string,
  ): Promise<z.infer<typeof VoiceMetricsSchema>>;

  listTranscriptions(
    page: number,
    limit: number,
  ): Promise<{
    transcriptions: z.infer<typeof TranscriptionSchema>[];
    total: number;
  }>;
}

// ─── Mock Provider ─────────────────────────────────────────────────────────────

@Injectable()
class MockVoiceProvider implements IVoiceProvider {
  private readonly transcriptions = new Map<
    string,
    z.infer<typeof TranscriptionSchema>
  >();

  constructor() {
    this.initializeMockData();
  }

  private initializeMockData(): void {
    const mockTranscriptions: z.infer<typeof TranscriptionSchema>[] = [
      {
        id: 'trans-001',
        text: 'Hello, this is a test transcription for the voice analytics system.',
        language: 'en',
        confidence: 0.95,
        duration: 5.2,
        segments: [
          {
            start: 0,
            end: 2.1,
            text: 'Hello, this is a test',
            confidence: 0.97,
          },
          {
            start: 2.1,
            end: 5.2,
            text: 'transcription for the voice analytics system.',
            confidence: 0.93,
          },
        ],
        createdAt: new Date().toISOString(),
      },
      {
        id: 'trans-002',
        text: 'The quarterly report shows a 15% increase in revenue.',
        language: 'en',
        confidence: 0.92,
        duration: 3.8,
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
    ];

    mockTranscriptions.forEach((t) => this.transcriptions.set(t.id, t));
  }

  async transcribe(
    audioUrl: string,
    options?: {
      language?: string;
      includeTimestamps?: boolean;
      detectLanguage?: boolean;
      punctuation?: boolean;
    },
  ): Promise<z.infer<typeof TranscriptionSchema>> {
    const id = `trans-${Date.now()}`;
    const transcription: z.infer<typeof TranscriptionSchema> = {
      id,
      text: 'This is a mock transcription of the provided audio.',
      language: options?.language ?? 'en',
      confidence: 0.88 + Math.random() * 0.1,
      duration: 4.5,
      segments: options?.includeTimestamps
        ? [
            { start: 0, end: 2.25, text: 'This is a mock', confidence: 0.9 },
            {
              start: 2.25,
              end: 4.5,
              text: 'transcription of the provided audio.',
              confidence: 0.86,
            },
          ]
        : undefined,
      createdAt: new Date().toISOString(),
    };

    this.transcriptions.set(id, transcription);
    return transcription;
  }

  async analyzeSentiment(
    text: string,
  ): Promise<z.infer<typeof SentimentSchema>> {
    const positiveWords = ['good', 'great', 'excellent', 'happy', 'wonderful'];
    const negativeWords = ['bad', 'terrible', 'awful', 'sad', 'horrible'];

    const lowerText = text.toLowerCase();
    const hasPositive = positiveWords.some((w) => lowerText.includes(w));
    const hasNegative = negativeWords.some((w) => lowerText.includes(w));

    let sentiment: 'positive' | 'negative' | 'neutral' | 'mixed' = 'neutral';
    let score = 0;

    if (hasPositive && hasNegative) {
      sentiment = 'mixed';
      score = 0;
    } else if (hasPositive) {
      sentiment = 'positive';
      score = 0.7 + Math.random() * 0.3;
    } else if (hasNegative) {
      sentiment = 'negative';
      score = -(0.7 + Math.random() * 0.3);
    }

    return {
      sentiment,
      score,
      confidence: 0.85 + Math.random() * 0.15,
      emotions: {
        joy: hasPositive ? 0.8 : 0.2,
        anger: hasNegative ? 0.6 : 0.1,
        sadness: hasNegative ? 0.5 : 0.1,
        fear: 0.1,
        surprise: 0.15,
      },
    };
  }

  async detectLanguage(
    audioUrl: string,
  ): Promise<{ language: string; confidence: number }> {
    return {
      language: 'en',
      confidence: 0.94,
    };
  }

  async getVoiceMetrics(
    audioUrl: string,
  ): Promise<z.infer<typeof VoiceMetricsSchema>> {
    return {
      clarity: 85 + Math.random() * 15,
      pace: 140 + Math.random() * 20,
      volume: 70 + Math.random() * 20,
      fillerWords: Math.floor(Math.random() * 10),
      wordsPerMinute: 130 + Math.floor(Math.random() * 30),
      pauseDuration: 0.5 + Math.random() * 1.5,
    };
  }

  async listTranscriptions(
    page: number,
    limit: number,
  ): Promise<{
    transcriptions: z.infer<typeof TranscriptionSchema>[];
    total: number;
  }> {
    const all = Array.from(this.transcriptions.values());
    const start = (page - 1) * limit;
    const transcriptions = all.slice(start, start + limit);

    return {
      transcriptions,
      total: all.length,
    };
  }
}

// ─── Tool Implementation ───────────────────────────────────────────────────────

@Injectable()
export class VoiceAnalyticsTool extends BaseStructuredTool {
  readonly name = 'voice_analytics';
  readonly description =
    'Process voice input, transcribe audio, analyze sentiment, and get voice metrics';
  readonly category = ToolCategory.AI;
  readonly inputSchema = VoiceAnalyticsInputSchema;

  private readonly log = new Logger(VoiceAnalyticsTool.name);
  private readonly provider: IVoiceProvider;

  constructor(private readonly config: ConfigService) {
    super();
    this.provider = new MockVoiceProvider();
  }

  protected async executeImpl(
    input: VoiceAnalyticsInput,
  ): Promise<StructuredToolResult<unknown>> {
    try {
      switch (input.action) {
        case 'transcribe_audio':
          return await this.handleTranscribe(input);
        case 'analyze_sentiment':
          return await this.handleSentiment(input);
        case 'detect_language':
          return await this.handleDetectLanguage(input);
        case 'get_voice_metrics':
          return await this.handleVoiceMetrics(input);
        case 'list_transcriptions':
          return await this.handleListTranscriptions(input);
        default:
          return {
            success: false,
            error: `Unknown action: ${input.action as string}`,
          };
      }
    } catch (error) {
      this.log.error(
        `Voice analytics error: ${(error as Error).message}`,
        (error as Error).stack,
      );
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  private async handleTranscribe(
    input: VoiceAnalyticsInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.audioUrl) {
      return {
        success: false,
        error: 'audioUrl is required for transcribe_audio',
      };
    }

    const result = await this.provider.transcribe(input.audioUrl, {
      language: input.language,
      includeTimestamps: input.options?.includeTimestamps,
      detectLanguage: input.options?.detectLanguage,
      punctuation: input.options?.punctuation,
    });

    return {
      success: true,
      data: { ...result, action: 'transcribe_audio' },
    };
  }

  private async handleSentiment(
    input: VoiceAnalyticsInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.text) {
      return {
        success: false,
        error: 'text is required for analyze_sentiment',
      };
    }

    const result = await this.provider.analyzeSentiment(input.text);

    return {
      success: true,
      data: result,
    };
  }

  private async handleDetectLanguage(
    input: VoiceAnalyticsInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.audioUrl) {
      return {
        success: false,
        error: 'audioUrl is required for detect_language',
      };
    }

    const result = await this.provider.detectLanguage(input.audioUrl);

    return {
      success: true,
      data: result,
    };
  }

  private async handleVoiceMetrics(
    input: VoiceAnalyticsInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.audioUrl) {
      return {
        success: false,
        error: 'audioUrl is required for get_voice_metrics',
      };
    }

    const result = await this.provider.getVoiceMetrics(input.audioUrl);

    return {
      success: true,
      data: result,
    };
  }

  private async handleListTranscriptions(
    input: VoiceAnalyticsInput,
  ): Promise<StructuredToolResult<unknown>> {
    const page = input.page ?? 1;
    const limit = input.limit ?? 20;

    const result = await this.provider.listTranscriptions(page, limit);

    return {
      success: true,
      data: { ...result.transcriptions, total: result.total, page, limit },
    };
  }
}
