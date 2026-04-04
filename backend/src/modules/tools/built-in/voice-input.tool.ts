/**
 * Voice Input Tool - P2-4 of remaining tools
 * Enables AI agents to capture and process voice input
 * For Executive, Admin agents requiring voice capabilities
 *
 * SOLID Principles Applied:
 * - SRP: Single responsibility for voice input operations
 * - OCP: Extensible via voice provider interfaces
 * - DIP: Depends on abstractions for voice providers
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

export const VoiceInputActionEnum = z.enum([
  'capture_voice',
  'process_voice_command',
  'convert_speech_to_text',
  'get_voice_input_settings',
  'configure_voice_input',
  'list_voice_commands',
]);

export type VoiceInputAction = z.infer<typeof VoiceInputActionEnum>;

export const VoiceInputInputSchema = z.object({
  action: VoiceInputActionEnum.describe('The voice input action to perform'),
  audioData: z.string().optional().describe('Audio data in base64'),
  audioUrl: z.string().url().optional().describe('Audio file URL'),
  language: z.string().optional().default('en-US').describe('Language code'),
  transcriptionFormat: z
    .enum(['text', 'json', 'srt', 'vtt'])
    .optional()
    .default('text')
    .describe('Output format for transcription'),
  command: z.string().optional().describe('Voice command to process'),
  settings: z
    .object({
      enablePunctuation: z.boolean().optional().default(true),
      enableProfanityFilter: z.boolean().optional().default(false),
      sampleRate: z.number().optional(),
      channels: z.number().optional(),
    })
    .optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export type VoiceInputInput = z.infer<typeof VoiceInputInputSchema>;

// ─────────────────────────────────────────────────────────────
// Output Types
// ─────────────────────────────────────────────────────────────

type VoiceCaptureResult = {
  sessionId: string;
  status: 'capturing' | 'processing' | 'completed' | 'failed';
  duration: number;
  audioFormat: string;
};

type VoiceCommandResult = {
  command: string;
  action: string;
  parameters: Record<string, unknown>;
  confidence: number;
  intent: string;
};

type TranscriptionResult = {
  text: string;
  confidence: number;
  words: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
  }>;
  language: string;
  duration: number;
};

type VoiceSettings = {
  language: string;
  sampleRate: number;
  channels: number;
  enablePunctuation: boolean;
  enableProfanityFilter: boolean;
  maxDuration: number;
};

type VoiceCommand = {
  id: string;
  phrase: string;
  action: string;
  parameters: string[];
  enabled: boolean;
};

// ─────────────────────────────────────────────────────────────
// Provider Interface (DIP)
// ─────────────────────────────────────────────────────────────

interface IVoiceInputProvider {
  captureVoice(options?: {
    language?: string;
    sampleRate?: number;
    channels?: number;
  }): Promise<VoiceCaptureResult>;

  processVoiceCommand(
    audioData: string,
    language?: string,
  ): Promise<VoiceCommandResult>;

  convertSpeechToText(
    audioData: string,
    language?: string,
    format?: string,
  ): Promise<TranscriptionResult>;

  getVoiceInputSettings(): Promise<VoiceSettings>;

  configureVoiceInput(settings: Partial<VoiceSettings>): Promise<VoiceSettings>;

  listVoiceCommands(): Promise<VoiceCommand[]>;
}

// ─────────────────────────────────────────────────────────────
// Mock Voice Input Provider
// ─────────────────────────────────────────────────────────────

@Injectable()
class MockVoiceInputProvider implements IVoiceInputProvider {
  private readonly logger = new Logger(MockVoiceInputProvider.name);
  private settings: VoiceSettings = {
    language: 'en-US',
    sampleRate: 16000,
    channels: 1,
    enablePunctuation: true,
    enableProfanityFilter: false,
    maxDuration: 300,
  };

  private commands: VoiceCommand[] = [
    {
      id: 'cmd-1',
      phrase: 'Create task',
      action: 'create_task',
      parameters: ['title', 'description', 'dueDate'],
      enabled: true,
    },
    {
      id: 'cmd-2',
      phrase: 'Send email',
      action: 'send_email',
      parameters: ['recipient', 'subject', 'body'],
      enabled: true,
    },
    {
      id: 'cmd-3',
      phrase: 'Schedule meeting',
      action: 'schedule_meeting',
      parameters: ['title', 'participants', 'time'],
      enabled: true,
    },
  ];

  async captureVoice(options?: {
    language?: string;
    sampleRate?: number;
    channels?: number;
  }): Promise<VoiceCaptureResult> {
    this.logger.log('Capturing voice');

    return {
      sessionId: 'session-' + Date.now(),
      status: 'completed',
      duration: Math.floor(Math.random() * 60) + 10,
      audioFormat: 'wav',
    };
  }

  async processVoiceCommand(
    audioData: string,
    language?: string,
  ): Promise<VoiceCommandResult> {
    this.logger.log('Processing voice command');

    return {
      command: 'Create a task for tomorrow',
      action: 'create_task',
      parameters: {
        title: 'Task from voice',
        dueDate: 'tomorrow',
      },
      confidence: 0.85 + Math.random() * 0.1,
      intent: 'create_task',
    };
  }

  async convertSpeechToText(
    audioData: string,
    language?: string,
    format?: string,
  ): Promise<TranscriptionResult> {
    this.logger.log('Converting speech to text');

    return {
      text: 'This is a sample transcription of the voice input.',
      confidence: 0.9 + Math.random() * 0.1,
      words: [
        { word: 'This', start: 0, end: 0.5, confidence: 0.95 },
        { word: 'is', start: 0.5, end: 0.7, confidence: 0.92 },
        { word: 'a', start: 0.7, end: 0.8, confidence: 0.94 },
        { word: 'sample', start: 0.8, end: 1.3, confidence: 0.89 },
        { word: 'transcription', start: 1.3, end: 2.0, confidence: 0.91 },
      ],
      language: language || 'en-US',
      duration: 2.5,
    };
  }

  async getVoiceInputSettings(): Promise<VoiceSettings> {
    this.logger.log('Getting voice input settings');
    return this.settings;
  }

  async configureVoiceInput(
    settings: Partial<VoiceSettings>,
  ): Promise<VoiceSettings> {
    this.logger.log('Configuring voice input');
    this.settings = { ...this.settings, ...settings };
    return this.settings;
  }

  async listVoiceCommands(): Promise<VoiceCommand[]> {
    this.logger.log('Listing voice commands');
    return this.commands;
  }
}

// ─────────────────────────────────────────────────────────────
// Tool Implementation
// ─────────────────────────────────────────────────────────────

@Injectable()
export class VoiceInputTool extends BaseStructuredTool {
  readonly name = 'voice_input';
  readonly description =
    'Capture voice input, process voice commands, convert speech to text';
  readonly category = ToolCategory.AI;
  readonly inputSchema = VoiceInputInputSchema;

  private readonly log = new Logger(VoiceInputTool.name);
  private readonly provider: IVoiceInputProvider;

  constructor(private readonly config: ConfigService) {
    super();
    this.provider = new MockVoiceInputProvider();
  }

  protected async executeImpl(
    input: VoiceInputInput,
    context: ToolExecutionContext,
  ): Promise<StructuredToolResult<unknown>> {
    this.log.log('Executing Voice Input action: ' + input.action);

    try {
      switch (input.action) {
        case 'capture_voice':
          return await this.handleCaptureVoice(input);
        case 'process_voice_command':
          return await this.handleProcessVoiceCommand(input);
        case 'convert_speech_to_text':
          return await this.handleConvertSpeechToText(input);
        case 'get_voice_input_settings':
          return await this.handleGetVoiceInputSettings(input);
        case 'configure_voice_input':
          return await this.handleConfigureVoiceInput(input);
        case 'list_voice_commands':
          return await this.handleListVoiceCommands(input);
        default:
          throw new Error('Unknown action: ' + input.action);
      }
    } catch (error) {
      const err = error as Error;
      this.log.error('Voice Input action failed: ' + err.message, err.stack);
      return { success: false, error: err.message };
    }
  }

  private async handleCaptureVoice(
    input: VoiceInputInput,
  ): Promise<StructuredToolResult<unknown>> {
    const result = await this.provider.captureVoice({
      language: input.language,
      sampleRate: input.settings?.sampleRate,
      channels: input.settings?.channels,
    });

    return {
      success: true,
      data: result,
    };
  }

  private async handleProcessVoiceCommand(
    input: VoiceInputInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.audioData && !input.audioUrl) {
      throw new Error(
        'audioData or audioUrl is required for process_voice_command action',
      );
    }

    const result = await this.provider.processVoiceCommand(
      input.audioData || '',
      input.language,
    );

    return {
      success: true,
      data: result,
    };
  }

  private async handleConvertSpeechToText(
    input: VoiceInputInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.audioData && !input.audioUrl) {
      throw new Error(
        'audioData or audioUrl is required for convert_speech_to_text action',
      );
    }

    const result = await this.provider.convertSpeechToText(
      input.audioData || '',
      input.language,
      input.transcriptionFormat,
    );

    return {
      success: true,
      data: result,
    };
  }

  private async handleGetVoiceInputSettings(
    input: VoiceInputInput,
  ): Promise<StructuredToolResult<unknown>> {
    const result = await this.provider.getVoiceInputSettings();

    return {
      success: true,
      data: result,
    };
  }

  private async handleConfigureVoiceInput(
    input: VoiceInputInput,
  ): Promise<StructuredToolResult<unknown>> {
    const result = await this.provider.configureVoiceInput(
      input.settings || {},
    );

    return {
      success: true,
      data: result,
    };
  }

  private async handleListVoiceCommands(
    input: VoiceInputInput,
  ): Promise<StructuredToolResult<unknown>> {
    const result = await this.provider.listVoiceCommands();

    return {
      success: true,
      data: { commands: result, count: result.length },
    };
  }
}
