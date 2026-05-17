"use client";
// ─── RightAIPanel.tsx ─────────────────────────────────────────────────────────
// S — Single Responsibility: manages the AI conversation panel layout, mode
//     switching (docked vs slide-in), and the chat input.
// O — Open/Closed: message rendering is delegated to AIResponseCard and user
//     bubble — new response types are added in AIResponseCard, not here.
// D — Dependency Inversion: chat data via useAIChat hook; layout state via
//     useUIPreferencesStore — no direct service or localStorage access.

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, PanelRight } from "lucide-react";
import { usePathname } from "next/navigation";

import { useUIPreferencesStore } from "@/shared/stores/uiPreferencesStore";
import { useAIChat } from "@/shared/hooks/useAIChat";
import { AIResponseCard } from "@/components/ai/AIResponseCard";
import { ChatInput } from "@/components/ai/ChatInput";
import { cn } from "@/lib/utils";

// ─── Starter prompts (OCP: add here, panel logic unchanged) ──────────────────
const STARTER_PROMPTS: string[] = [
  "How is my team performing today?",
  "Which agents have the highest workload?",
  "What tasks are overdue?",
  "Show me top workflow bottlenecks.",
  "Summarise yesterday's activity.",
];

// ─── Typing animation ─────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex justify-start"
    >
      <div className="flex items-center gap-1.5 rounded-card border-l-4 border-brand-dim bg-surface-raised px-4 py-3">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </motion.div>
  );
}

// ─── Panel content (shared between docked and slide-in modes) ─────────────────
function PanelContent() {
  const pathname = usePathname();
  const { setAIPanelOpen, aiPanelDocked, setAIPanelDocked } =
    useUIPreferencesStore();
  const { messages, isTyping, error, send, applySuggestion, clear, bottomRef } =
    useAIChat(pathname);
  const [input, setInput] = useState("");

  const handleSend = async (text: string) => {
    setInput("");
    await send(text);
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-surface-border px-4 py-3 flex-shrink-0 bg-surface-raised">
        <div className="flex items-center gap-2">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full bg-brand/20 text-sm text-brand select-none"
            aria-hidden="true"
          >
            ✦
          </span>
          <div>
            <p className="text-caption font-semibold text-text-primary">
              HeadQuarter AI
            </p>
            <p className="text-micro text-text-secondary">
              Ask anything about your company
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={clear}
              title="Clear conversation"
              aria-label="Clear conversation"
              className="rounded p-1.5 text-text-secondary hover:bg-surface-overlay hover:text-text-primary transition-colors duration-fast"
            >
              ↺
            </button>
          )}
          <button
            onClick={() => setAIPanelDocked(!aiPanelDocked)}
            title={aiPanelDocked ? "Switch to slide-in mode" : "Dock panel"}
            aria-label={
              aiPanelDocked ? "Switch to slide-in mode" : "Dock panel"
            }
            className="rounded p-1.5 text-text-secondary hover:bg-surface-overlay hover:text-text-primary transition-colors duration-fast"
          >
            <PanelRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setAIPanelOpen(false)}
            title="Close AI panel"
            aria-label="Close AI panel"
            className="rounded p-1.5 text-text-secondary hover:bg-surface-overlay hover:text-text-primary transition-colors duration-fast"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Messages ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 hide-scrollbar">
        {messages.length === 0 ? (
          /* Welcome + starter prompts */
          <div className="py-6">
            <div className="mb-4 text-center">
              <p className="text-2xl mb-2 select-none" aria-hidden="true">
                ✦
              </p>
              <p className="text-subheading font-medium text-text-primary">
                How can I help?
              </p>
              <p className="mt-1 text-caption text-text-secondary">
                Ask questions about your agents, tasks, and operations.
              </p>
            </div>
            <div className="space-y-2">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => applySuggestion(prompt)}
                  className="w-full rounded-card border border-surface-border bg-surface-raised px-3 py-2.5 text-left text-caption text-text-secondary hover:border-brand/40 hover:bg-brand/5 hover:text-text-primary transition-colors duration-fast"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) =>
              msg.role === "user" ? (
                /* User message bubble */
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-end"
                >
                  <div className="max-w-[82%]">
                    <p className="mb-0.5 text-micro text-text-secondary text-right">
                      You
                    </p>
                    <div className="rounded-2xl rounded-tr-sm bg-brand px-3.5 py-2.5 text-body text-brand-foreground leading-relaxed">
                      {msg.content}
                    </div>
                    <p className="mt-0.5 text-micro text-text-muted text-right">
                      {new Date(msg.timestamp).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </motion.div>
              ) : (
                /* AI response card */
                <AIResponseCard
                  key={msg.id}
                  agentName="HeadQuarter AI"
                  content={msg.content}
                  timestamp={new Date(msg.timestamp)}
                  kpis={
                    msg.metadata?.chartData &&
                    msg.metadata.chartData.length >= 2
                      ? msg.metadata.chartData.slice(0, 2).map((d) => ({
                          value: d.value,
                          label: d.label,
                        }))
                      : undefined
                  }
                />
              ),
            )}

            <AnimatePresence>{isTyping && <TypingDots />}</AnimatePresence>
          </>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-card border border-status-risk/30 bg-status-risk/10 px-3 py-2 text-caption text-status-risk"
            role="alert"
          >
            {error}
          </motion.div>
        )}

        {/* Auto-scroll anchor */}
        <div ref={bottomRef} />
      </div>

      {/* ── Chat input ──────────────────────────────────────── */}
      <div className="border-t border-surface-border px-4 py-3 flex-shrink-0 bg-surface-raised">
        <ChatInput
          value={input}
          onChange={setInput}
          onSubmit={handleSend}
          placeholder="Ask about your team…"
          disabled={isTyping}
          label="Chat message input"
        />
      </div>
    </div>
  );
}

// ─── RightAIPanel ─────────────────────────────────────────────────────────────
export function RightAIPanel() {
  const { aiPanelOpen, aiPanelDocked, setAIPanelOpen } =
    useUIPreferencesStore();

  // ── Docked mode: renders as a flex-sibling column in the shell layout ───────
  if (aiPanelDocked) {
    return (
      <AnimatePresence>
        {aiPanelOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className={cn(
              "flex flex-col border-l border-surface-border bg-surface-raised flex-shrink-0 overflow-hidden",
            )}
            aria-label="AI Assistant Panel"
          >
            <PanelContent />
          </motion.aside>
        )}
      </AnimatePresence>
    );
  }

  // ── Slide-in overlay mode ────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      {aiPanelOpen && (
        <>
          {/* Mobile backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setAIPanelOpen(false)}
            aria-hidden="true"
          />
          {/* Panel */}
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 280 }}
            className="fixed right-0 top-0 z-50 flex h-full w-80 flex-col border-l border-surface-border bg-surface-raised shadow-float"
            aria-label="AI Assistant Panel"
          >
            <PanelContent />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
