'use client';
// ─── AIChatPanel.tsx ──────────────────────────────────────────────────────────
// SRP: Chat panel shell — layout + input + scroll management.
// DIP: Data via useAIChat(); rendering via AIChatMessage.

import { useState, FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAIChat }          from '@/shared/hooks/useAIChat';
import { AIChatMessage, TypingIndicator } from './AIChatMessage';

// ─── Quick starter prompts (OCP: add entries, no logic change) ────────────────
const STARTER_PROMPTS = [
  'How is my team performing today?',
  'Which agents have the highest workload?',
  'What tasks are overdue?',
  'Show me top workflow bottlenecks.',
  'Summarise yesterday\'s activity.',
];

interface AIChatPanelProps {
  isOpen:      boolean;
  onClose:     () => void;
  pageContext?: string;
}

export function AIChatPanel({ isOpen, onClose, pageContext }: AIChatPanelProps) {
  const { messages, isTyping, error, send, applySuggestion, clear, bottomRef } =
    useAIChat(pageContext);

  const [input, setInput] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput('');
    await send(text);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop (mobile) */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl"
            aria-label="AI Chat"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-900/50 text-sm">✦</span>
                <div>
                  <p className="text-sm font-semibold text-zinc-100">HeadQuarter AI</p>
                  <p className="text-[10px] text-zinc-500">Ask me anything about your company</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    onClick={clear}
                    className="rounded p-1.5 text-xs text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
                    title="Clear conversation"
                  >
                    ↺
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
                  aria-label="Close chat"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {messages.length === 0 ? (
                <div className="py-6">
                  {/* Welcome */}
                  <div className="mb-4 text-center">
                    <p className="text-2xl mb-2">✦</p>
                    <p className="text-sm font-medium text-zinc-300">How can I help?</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Ask questions about your agents, tasks, and operations.
                    </p>
                  </div>
                  {/* Starters */}
                  <div className="space-y-2">
                    {STARTER_PROMPTS.map((p) => (
                      <button
                        key={p}
                        onClick={() => applySuggestion(p)}
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-2.5 text-left text-xs text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/50 transition-colors"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((msg) => (
                    <AIChatMessage
                      key={msg.id}
                      message={msg}
                      onSuggestionSelect={applySuggestion}
                    />
                  ))}
                  <AnimatePresence>
                    {isTyping && <TypingIndicator />}
                  </AnimatePresence>
                </>
              )}

              {error && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-lg border border-red-500/30 bg-red-950/20 px-3 py-2 text-xs text-red-400"
                >
                  {error}
                </motion.div>
              )}

              {/* Auto-scroll anchor */}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="border-t border-zinc-800 px-4 py-3">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about your team…"
                  className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                  autoComplete="off"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isTyping}
                  className="rounded-xl bg-indigo-600 px-3.5 text-sm text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label="Send message"
                >
                  ↑
                </button>
              </form>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Trigger button (for TopBar) ──────────────────────────────────────────────
export function AIChatButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Open AI Chat"
      className="flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 transition-colors"
    >
      <span className="text-indigo-400">✦</span>
      <span>Ask AI</span>
    </button>
  );
}
