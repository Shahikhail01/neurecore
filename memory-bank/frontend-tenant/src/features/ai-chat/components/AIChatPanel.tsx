"use client";
// ─── AIChatPanel.tsx ──────────────────────────────────────────────────────────
// SRP: Chat panel shell — layout + input + scroll management.
// DIP: Data via useAIChat(); rendering via AIChatMessage.

import { useState, FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAIChat } from "@/shared/hooks/useAIChat";
import { AIChatMessage, TypingIndicator } from "./AIChatMessage";

// ─── Quick starter prompts (OCP: add entries, no logic change) ────────────────
const STARTER_PROMPTS = [
  "How is my team performing today?",
  "Which agents have the highest workload?",
  "What tasks are overdue?",
  "Show me top workflow bottlenecks.",
  "Summarise yesterday's activity.",
];

interface AIChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  pageContext?: string;
}

export function AIChatPanel({
  isOpen,
  onClose,
  pageContext,
}: AIChatPanelProps) {
  const { messages, isTyping, error, send, applySuggestion, clear, bottomRef } =
    useAIChat(pageContext);

  const [input, setInput] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");
    await send(text);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop (mobile) */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 280 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-surface-border bg-surface shadow-float"
            aria-label="AI Chat"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand/20 text-sm text-brand">
                  ✦
                </span>
                <div>
                  <p className="text-body font-semibold text-text-primary">
                    HeadQuarter AI
                  </p>
                  <p className="text-micro text-text-secondary">
                    Ask me anything about your company
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    onClick={clear}
                    className="rounded p-1.5 text-caption text-text-secondary hover:bg-surface-overlay hover:text-text-primary transition-colors duration-fast"
                    title="Clear conversation"
                  >
                    ↺
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="rounded p-1.5 text-text-secondary hover:bg-surface-overlay hover:text-text-primary transition-colors duration-fast"
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
                    <p className="text-2xl mb-2 text-brand">✦</p>
                    <p className="text-body font-medium text-text-primary">
                      How can I help?
                    </p>
                    <p className="mt-1 text-caption text-text-secondary">
                      Ask questions about your agents, tasks, and operations.
                    </p>
                  </div>
                  {/* Starters */}
                  <div className="space-y-2">
                    {STARTER_PROMPTS.map((p) => (
                      <button
                        key={p}
                        onClick={() => applySuggestion(p)}
                        className="w-full rounded-card border border-surface-border bg-surface-overlay px-3 py-2.5 text-left text-caption text-text-secondary hover:border-brand/30 hover:bg-surface-muted transition-colors duration-fast"
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
                  className="rounded-input border border-status-risk/30 bg-status-risk/10 px-3 py-2 text-caption text-status-risk"
                >
                  {error}
                </motion.div>
              )}

              {/* Auto-scroll anchor */}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="border-t border-surface-border px-4 py-3">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about your team…"
                  className="flex-1 rounded-input border border-surface-border bg-surface-overlay px-3 py-2 text-body text-text-primary placeholder:text-text-secondary focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                  autoComplete="off"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isTyping}
                  className="rounded-input bg-brand px-3.5 text-body text-brand-foreground hover:bg-brand-dim disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-fast"
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
      className="flex items-center gap-1.5 rounded-input bg-surface-overlay px-3 py-1.5 text-caption font-medium text-text-secondary hover:bg-surface-muted hover:text-text-primary transition-colors duration-fast"
    >
      <span className="text-brand">✦</span>
      <span>Ask AI</span>
    </button>
  );
}
