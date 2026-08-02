// ─── UnifiedChatPanel.tsx ──────────────────────────────────────────────────────
// SRP: Composes chat UI from sub-components. Delegates to hook for state.
// DIP: All dependencies injected via props (IChatService, ISlashCommandProvider, ChatConfig).
// OCP: Config-driven — Tenant vs Admin differences come from ChatConfig + SlashCommands.

'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { IChatService, ISlashCommandProvider, IJsonExtractor } from '@/core/services/interfaces/IChatService';
import type { AutonomousApprovalData, ChatConfig, SuggestionData } from '@/shared/types/chat.types';
import type { IEnvelopeParser } from '@/core/services/chat/envelope/interfaces/IEnvelopeParser';
import { useChat } from '@/shared/hooks/useChat';
import { TriggerButton } from './TriggerButton';
import { UnifiedChatHeader } from './UnifiedChatHeader';
import { UnifiedChatMessage } from './UnifiedChatMessage';
import { UnifiedChatInput } from './UnifiedChatInput';
import { UnifiedChatEmptyState } from './UnifiedChatEmptyState';
import { ContextChips } from './ContextChips';
import { ConversationHistoryPanel } from './ConversationHistoryPanel';
import { usePageContext } from '@/shared/contexts/page-context';
import type { Citation } from './ProvenanceBadge';

interface UnifiedChatPanelProps {
  chatService: IChatService;
  slashCommands: ISlashCommandProvider;
  jsonExtractor: IJsonExtractor;
  envelopeParser: IEnvelopeParser;
  config: ChatConfig;
  pageContext?: import('@/shared/contexts/page-context').PageContext;
}

export function UnifiedChatPanel({
  chatService,
  slashCommands,
  jsonExtractor,
  envelopeParser,
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
  } = useChat(chatService, slashCommands, jsonExtractor, envelopeParser, config, pageContext);

  const bottomRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const { pageContext: livePageContext } = usePageContext();
  const effectivePageContext = pageContext ?? livePageContext;

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus management: when the panel opens, move focus to the first
  // interactive control; when it closes, return focus to the trigger
  // so screen-reader users can resume navigation. WCAG 2.2 AA — 2.4.3.
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
      requestAnimationFrame(() => {
        panelRef.current?.querySelector<HTMLElement>('[data-testid="chat-input"]')?.focus();
      });
    } else if (previouslyFocusedRef.current) {
      previouslyFocusedRef.current.focus();
      previouslyFocusedRef.current = null;
    }
  }, [open]);

  // Global keyboard shortcuts: Esc closes the panel, Ctrl/Cmd+K opens it.
  // Both are gated to non-input elements to avoid stomping on text fields
  // elsewhere in the app (WCAG 2.1.1).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const inField =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        setOpen(false);
        return;
      }
      const isModK = (e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K');
      if (isModK && !inField) {
        e.preventDefault();
        if (!open) setOpen(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  // Handle suggestion chip click
  const handleSuggestionSelect = useCallback(
    (suggestion: SuggestionData) => {
      sendMessage(suggestion.label);
    },
    [sendMessage],
  );
  const handleApprovalDecision = useCallback(
    async (approval: AutonomousApprovalData, decision: 'approve' | 'reject') => {
      const execution = await chatService.submitAutonomousApproval(
        approval.executionId,
        approval.approvalId,
        decision,
      );
      const pending = execution?.pendingApproval;
      return pending && execution
        ? {
            executionId: execution.executionId,
            approvalId: pending.approvalId,
            toolName: pending.toolName,
            reason: pending.reason,
            status: 'PENDING' as const,
          }
        : null;
    },
    [chatService],
  );

  // P1 — citation click re-authorizes the user before navigating to the
  // underlying record. Server-side reauthorization is the only path
  // through which a citation can become clickable (records/pages with
  // revoked ACLs must not silently 404).
  const handleCitationClick = useCallback(async (citation: Citation) => {
    if (!citation.href) return;
    try {
      const res = await fetch(citation.href, {
        method: 'HEAD',
        credentials: 'include',
      });
      if (res.ok) {
        window.location.href = citation.href;
      }
    } catch {
      // Network/permission failure: fall through silently. The user keeps
      // the citation label visible without navigation.
    }
  }, []);

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
              aria-hidden="true"
            />

            <motion.div
              ref={panelRef}
              initial={{ x: 320, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 320, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 30 }}
              className="fixed bottom-28 right-20 z-40 w-80 max-h-[520px] flex flex-col rounded-2xl border border-surface-border bg-surface-raised shadow-2xl overflow-hidden"
              data-testid="chat-panel"
              role="dialog"
              aria-modal="false"
              aria-label={config.panelTitle}
            >
              {/* Header */}
              <UnifiedChatHeader
                title={config.panelTitle}
                badgeLabel={config.badgeLabel}
                badgeColor={config.badgeColor}
                onClear={() => void clearHistory()}
                onClose={() => setOpen(false)}
                onOpenHistory={() => setHistoryOpen((v) => !v)}
                historyOpen={historyOpen}
              />

              {/* P1 — Context chips for the typed PageContext. */}
              <ContextChips
                activeAgentLabel={effectivePageContext.entityType ? `Agent · ${effectivePageContext.entityType}` : 'Agent · Universal'}
              />

              {/* Conversation history (collapsible) */}
              {historyOpen && (
                <ConversationHistoryPanel
                  chatService={chatService}
                  onResume={() => setHistoryOpen(false)}
                />
              )}

              {/* Messages thread — role="log" + aria-live="polite" so screen
                  readers announce new assistant messages without stealing
                  focus (WCAG 2.2 AA — 4.1.3). */}
              <div
                className="flex-1 overflow-y-auto p-3 space-y-1"
                data-testid="chat-messages"
                role="log"
                aria-live="polite"
                aria-relevant="additions"
                aria-label="Conversation transcript"
              >
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
                    onApprovalDecision={handleApprovalDecision}
                    envelopeParser={envelopeParser}
                    onCitationClick={handleCitationClick}
                  />
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Error banner */}
              {error && (
                <div
                  className="px-3 py-1.5 mx-3 mb-1 rounded-lg border border-[color:var(--state-danger)]/40 bg-[color:var(--state-danger)]/30"
                  data-testid="chat-error"
                  role="alert"
                >
                  <button
                    onClick={() => setError(null)}
                    aria-label="Dismiss error"
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
