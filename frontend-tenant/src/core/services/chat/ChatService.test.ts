// ─── ChatService.test.ts ────────────────────────────────────────────────────────
// Verifies ChatService correctly delegates to IApiClient and parses responses.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IApiClient, ApiResponse } from '@/core/services/api/interfaces/IApiClient';
import { ChatService } from '@/core/services/chat/ChatService';
import { BraceBalancedJsonExtractor } from '@/core/services/chat/fallback/BraceBalancedJsonExtractor';
import { KeywordFallbackReply } from '@/core/services/chat/fallback/KeywordFallbackReply';
import type { ISystemPromptBuilder } from '@/core/services/interfaces/IChatService';
import type { ChatConfig } from '@/shared/types/chat.types';

const testConfig: ChatConfig = {
  panelTitle: 'Test',
  badgeLabel: 'AI',
  badgeColor: 'indigo',
  triggerIcon: '✦',
  placeholder: 'Ask…',
  maxMessages: 100,
  storageKey: 'test_chat_store',
  apiEndpoint: '/chat/messages',
  starterPrompts: [],
  homeHeroChips: [],
};

const noopPromptBuilder: ISystemPromptBuilder = { build: () => 'system prompt' };

function mockApiClient(impl: Partial<IApiClient> = {}): IApiClient {
  return {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    ...impl,
  } as IApiClient;
}

describe('ChatService.sendMessage', () => {
  let api: IApiClient;
  let service: ChatService;

  beforeEach(() => {
    api = mockApiClient();
    service = new ChatService(
      api,
      testConfig,
      new KeywordFallbackReply(),
      new BraceBalancedJsonExtractor(),
      noopPromptBuilder,
    );
  });

  it('sends {message, conversationId, context, systemPrompt, history} to backend', async () => {
    const ok: ApiResponse<{ reply: string; conversationId: string }> = {
      status: 'success',
      data: { reply: 'hi back', conversationId: 'c1' },
      meta: { timestamp: 't', requestId: 'r' },
    };
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce(ok);

    await service.sendMessage({
      message: 'hello',
      conversationId: 'c0',
      context: { pageContext: '/home' },
      history: [],
    });

    expect(api.post).toHaveBeenCalledWith(
      '/chat/messages',
      expect.objectContaining({
        message: 'hello',
        conversationId: 'c0',
        context: { pageContext: '/home' },
        systemPrompt: 'system prompt',
        history: [],
      }),
      { timeoutMs: undefined },
    );
  });

  it('parses reply, conversationId, tokens from success response', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: 'success',
      data: {
        reply: 'all good',
        conversationId: 'c1',
        tokens: { input: 10, output: 5, total: 15 },
      },
      meta: { timestamp: 't', requestId: 'r' },
    });

    const r = await service.sendMessage({ message: 'hi' });
    expect(r.reply).toBe('all good');
    expect(r.conversationId).toBe('c1');
    expect(r.tokens.total).toBe(15);
  });

  it('extracts chart JSON from reply via IJsonExtractor', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: 'success',
      data: {
        reply: 'stats {"chartType":"bar","chartData":[{"label":"A","value":1}]}',
        conversationId: 'c2',
      },
      meta: { timestamp: 't', requestId: 'r' },
    });

    const r = await service.sendMessage({ message: 'stats' });
    expect(r.chartType).toBe('bar');
    expect(r.chartData).toEqual([{ label: 'A', value: 1 }]);
    expect(r.reply).not.toContain('chartType');
  });

  it('returns fallback when backend throws', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('network down'),
    );
    const r = await service.sendMessage({ message: 'agents status' });
    expect(r.reply).toContain('Agents page');
  });

  it('returns fallback when backend returns empty reply', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: 'success',
      data: { reply: '', conversationId: '' },
      meta: { timestamp: 't', requestId: 'r' },
    });
    const r = await service.sendMessage({ message: 'unknown query xyz' });
    expect(r.reply).toContain('offline');
  });
});

describe('ChatService.getHistory', () => {
  it('returns empty array on failure', async () => {
    const api = mockApiClient({
      get: vi.fn().mockRejectedValue(new Error('fail')),
    });
    const service = new ChatService(
      api,
      testConfig,
      new KeywordFallbackReply(),
      new BraceBalancedJsonExtractor(),
      noopPromptBuilder,
    );
    const r = await service.getHistory(10);
    expect(r).toEqual([]);
  });

  it('returns data.messages when wrapped', async () => {
    const api = mockApiClient({
      get: vi.fn().mockResolvedValue({
        status: 'success',
        data: { messages: [{ id: 'm1', role: 'user', content: 'hi', timestamp: 't' }] },
        meta: { timestamp: 't', requestId: 'r' },
      }),
    });
    const service = new ChatService(
      api,
      testConfig,
      new KeywordFallbackReply(),
      new BraceBalancedJsonExtractor(),
      noopPromptBuilder,
    );
    const r = await service.getHistory();
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe('m1');
  });

  it('returns backend ChatHistoryEntry shape (data[] + total)', async () => {
    const api = mockApiClient({
      get: vi.fn().mockResolvedValue({
        status: 'success',
        data: {
          data: [
            {
              id: 'm1',
              conversationId: 'conv-1',
              role: 'user',
              content: 'hi',
              createdAt: '2026-07-19T22:00:00.000Z',
            },
          ],
          total: 1,
        },
        meta: { timestamp: 't', requestId: 'r' },
      }),
    });
    const service = new ChatService(
      api,
      testConfig,
      new KeywordFallbackReply(),
      new BraceBalancedJsonExtractor(),
      noopPromptBuilder,
    );
    const r = await service.getHistory();
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe('m1');
    expect(r[0].content).toBe('hi');
  });
});

describe('ChatService.clearHistory', () => {
  it('calls DELETE /chat/history', async () => {
    const api = mockApiClient({
      delete: vi.fn().mockResolvedValue({ status: 'success', meta: { timestamp: 't', requestId: 'r' } }),
    });
    const service = new ChatService(
      api,
      testConfig,
      new KeywordFallbackReply(),
      new BraceBalancedJsonExtractor(),
      noopPromptBuilder,
    );
    await service.clearHistory();
    expect(api.delete).toHaveBeenCalledWith('/chat/history');
  });

  it('silently swallows errors', async () => {
    const api = mockApiClient({
      delete: vi.fn().mockRejectedValue(new Error('boom')),
    });
    const service = new ChatService(
      api,
      testConfig,
      new KeywordFallbackReply(),
      new BraceBalancedJsonExtractor(),
      noopPromptBuilder,
    );
    await expect(service.clearHistory()).resolves.toBeUndefined();
  });
});

describe('ChatService.isAvailable', () => {
  it('returns true when window exists (jsdom env)', () => {
    const api = mockApiClient();
    const service = new ChatService(
      api,
      testConfig,
      new KeywordFallbackReply(),
      new BraceBalancedJsonExtractor(),
      noopPromptBuilder,
    );
    expect(service.isAvailable()).toBe(true);
  });
});
