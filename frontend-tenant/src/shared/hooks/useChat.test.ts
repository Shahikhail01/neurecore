// ─── useChat.test.ts ────────────────────────────────────────────────────────────
// Regression test for the external-message consumption bug.
//
// The bug: the useEffect that consumed pendingExternalMessage from the store
// depended only on `consumeExternalMessage` (a stable Zustand selector). That
// meant the effect ran once on mount and never re-fired when requestExternalSend
// was called after mount. Result: HomeHero chip clicks would stage a message
// in the store but the panel would never auto-send it.
//
// Fix: subscribe to `pendingExternalMessage` directly so the effect re-runs
// whenever a new external request arrives.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useChat } from '@/shared/hooks/useChat';
import type {
  IChatService,
  ISlashCommandProvider,
  IJsonExtractor,
} from '@/core/services/interfaces/IChatService';
import type { IEnvelopeParser } from '@/core/services/chat/envelope/interfaces/IEnvelopeParser';
import type { ChatConfig } from '@/shared/types/chat.types';
import { useChatStore } from '@/core/services/chat/chat.factory';

const mockSlashCommands: ISlashCommandProvider = {
  commands: [],
  getContextForTrigger: () => undefined,
  getSuggestions: () => [],
};

const mockJsonExtractor: IJsonExtractor = {
  extract: (raw: string) => ({ cleaned: raw }),
};

const mockEnvelopeParser: IEnvelopeParser = {
  parse: (raw: string) => ({ text: raw }),
};

function makeChatService(): IChatService {
  return {
    isAvailable: () => true,
    sendMessage: vi.fn(),
    sendMessageStream: vi.fn(() => () => {}),
    getHistory: vi.fn(async () => []),
    clearHistory: vi.fn(async () => undefined),
    getSuggestions: vi.fn(async () => []),
    submitAutonomousApproval: vi.fn(async () => undefined),
    createExport: vi.fn(async () => ({
      exportId: 'exp_test',
      byteSize: 0,
      expiresAt: new Date().toISOString(),
      redacted: false,
    })),
  };
}

const dummyConfig: ChatConfig = {
  panelTitle: 'Test',
  badgeLabel: 'AI',
  badgeColor: 'indigo',
  triggerIcon: '✦',
  placeholder: 'Ask…',
  maxMessages: 100,
  storageKey: 'useChat_test_store',
  apiEndpoint: '/chat/messages',
  starterPrompts: [],
  homeHeroChips: [],
};

describe('useChat — external message consumption', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset store state
    useChatStore.setState({
      messages: [],
      open: false,
      sending: false,
      conversationId: null,
      pendingExternalMessage: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('consumes pendingExternalMessage when requestExternalSend fires after mount', async () => {
    const chatService = makeChatService();

    const { rerender } = renderHook(() =>
      useChat(
        chatService,
        mockSlashCommands,
        mockJsonExtractor,
        mockEnvelopeParser,
        dummyConfig,
      ),
    );

    // Allow mount effect to run.
    await act(async () => {
      await Promise.resolve();
    });

    // Simulate HomeHero calling requestExternalSend AFTER mount.
    // This is the exact scenario that was broken before the fix.
    await act(async () => {
      useChatStore.getState().requestExternalSend('hello from hero');
      rerender();
    });

    // The effect should have fired and called sendMessageStream with the message.
    expect(chatService.sendMessageStream).toHaveBeenCalled();
    const callArgs = (chatService.sendMessageStream as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[0].message).toBe('hello from hero');

    // The pendingExternalMessage should have been cleared (consumed).
    expect(useChatStore.getState().pendingExternalMessage).toBeNull();
  });

  it('does nothing when no external request is pending', async () => {
    const chatService = makeChatService();

    renderHook(() =>
      useChat(
        chatService,
        mockSlashCommands,
        mockJsonExtractor,
        mockEnvelopeParser,
        dummyConfig,
      ),
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(chatService.sendMessageStream).not.toHaveBeenCalled();
  });

  it('preserves an SSE envelope on the completed assistant message', async () => {
    const chatService = makeChatService();
    const stream = chatService.sendMessageStream as ReturnType<typeof vi.fn>;
    stream.mockImplementation((_request, onDelta, onDone, _onError, onFinish, onEnvelope) => {
      onDelta('Here are your projects.');
      onEnvelope({
        text: '(1 total)',
        components: [{
          type: 'table',
          props: { headers: ['name'], rows: [{ name: 'Project A' }] },
        }],
      });
      onDone('conv-envelope');
      onFinish();
      return () => {};
    });

    const { result } = renderHook(() =>
      useChat(
        chatService,
        mockSlashCommands,
        mockJsonExtractor,
        mockEnvelopeParser,
        dummyConfig,
      ),
    );

    await act(async () => {
      await result.current.sendMessage('show my projects');
    });

    const assistant = useChatStore.getState().messages.find((m) => m.role === 'assistant');
    expect(assistant?.content).toBe('Here are your projects.');
    expect(assistant?.metadata?.isStreaming).toBe(false);
    expect(assistant?.metadata?.envelope?.components?.[0]?.type).toBe('table');
    expect(useChatStore.getState().conversationId).toBe('conv-envelope');
  });
});
