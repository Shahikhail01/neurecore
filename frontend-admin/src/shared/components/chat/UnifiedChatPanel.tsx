// ─── UnifiedChatPanel.tsx ──────────────────────────────────────────────────────
// SRP: Composes chat UI from sub-components. Delegates to hook for state.
// DIP: All dependencies injected via props (IChatService, ISlashCommandProvider, ChatConfig).
// OCP: Config-driven — Tenant vs Admin differences come from ChatConfig + SlashCommands.

'use client';

import { useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { IChatService, ISlashCommandProvider, IJsonExtractor } from '@/core/services/interfaces/IChatService';
import type { ChatConfig, SuggestionData } from '@/shared/types/chat.types';
import { useChat } from '@/shared/hooks/useChat';
import { TriggerButton } from './TriggerButton';
import { UnifiedChatHeader } from './UnifiedChatHeader';
import { UnifiedChatMessage } from './UnifiedChatMessage';
import { UnifiedChatInput } from './UnifiedChatInput';
import { UnifiedChatEmptyState } from './UnifiedChatEmptyState';

interface UnifiedChatPanelProps {
  chatService: IChatService;
  slashCommands: ISlashCommandProvider;
  jsonExtractor: IJsonExtractor;
  config: ChatConfig;
  pageContext?: string;
}

export function UnifiedChatPanel({
  chatService,
  slashCommands,
  jsonExtractor,
  config,
  pageContext,
}: UnifiedChatPanelProps) {
  const {
    messages,
    open,
    sending,
    error,
    sendMessage,
    clearHistory,
    setOpen,
    toggleOpen,
    setError,
  } = useChat(chatService, slashCommands, jsonExtractor, config, pageContext);

  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle suggestion chip click
  const handleSuggestionSelect = useCallback(
    (suggestion: SuggestionData) => {
      sendMessage(suggestion.label);
    },
    [sendMessage],
  );

  return (
    <>
      {/* Floating trigger button */}
      <TriggerButton
        open={open}
        onToggle={toggleOpen}
        triggerIcon={config.triggerIcon}
      />

      {/* Sliding panel */}
      <AnimatePresence>
        {open && (
          <>
            {/* Mobile backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-30 bg-black/40 md:hidden"
              onClick={() => setOpen(false)}
            />

            <motion.div
              initial={{ x: 320, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 320, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 30 }}
              className="fixed bottom-16 right-20 z-40 w-80 max-h-[520px] flex flex-col rounded-2xl border border-surface-border bg-surface-raised shadow-2xl overflow-hidden"
              data-testid="chat-panel"
            >
              {/* Header */}
              <UnifiedChatHeader
                title={config.panelTitle}
                badgeLabel={config.badgeLabel}
                badgeColor={config.badgeColor}
                onClear={() => void clearHistory()}
                onClose={() => setOpen(false)}
              />

              {/* Messages thread */}
              <div className="flex-1 overflow-y-auto p-3 space-y-1" data-testid="chat-messages">
                {messages.length === 0 && (
                  <UnifiedChatEmptyState
                    starterPrompts={config.starterPrompts}
                    homeHeroChips={config.homeHeroChips}
                    onPromptClick={sendMessage}
                    disabled={sending}
                  />
                )}
                {messages.map((msg) => (
                  <UnifiedChatMessage
                    key={msg.id}
                    message={msg}
                    onSuggestionSelect={handleSuggestionSelect}
                    sending={sending}
                  />
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Error banner */}
              {error && (
                <div className="px-3 py-1.5 mx-3 mb-1 rounded-lg border border-[color:var(--state-danger)]/40 bg-[color:var(--state-danger)]/30">
                  <button
                    onClick={() => setError(null)}
                    className="text-[10px] text-[color:var(--state-danger)] hover:text-red-300 transition w-full text-left"
                  >
                    ✕ {error}
                  </button>
                </div>
              )}

              {/* Input */}
              <div className="shrink-0">
                <UnifiedChatInput
                  onSend={(query, context) => sendMessage(query)}
                  disabled={sending}
                  placeholder={config.placeholder}
                  slashCommands={slashCommands}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
