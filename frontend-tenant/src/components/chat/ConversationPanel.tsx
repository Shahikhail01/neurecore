'use client';
// ─── ConversationPanel ────────────────────────────────────────────────────────
// S — Single Responsibility: chat UI rendering only; data from useChat hook
// O — Open/Closed: extend via className / onSuggestionClick props, never mutate
import { useRef, useEffect, useState, KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChat } from '@/hooks/useChat';
import { useChatStore } from '@/stores/chatStore';
import chatService, { SLASH_COMMANDS } from '@/services/chat.service';
import type { ConversationMessage, ChatRequest } from '@/types/chat.types';

// ─── Markdown-lite renderer (no external dep needed for simple responses) ─────
function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code class="bg-surface-overlay px-1 rounded text-xs text-violet-300">$1</code>')
    .replace(/\n/g, '<br/>');
}

// ─── Single message bubble ────────────────────────────────────────────────────
function MessageBubble({ msg }: { msg: ConversationMessage }) {
  const isUser = msg.role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-2`}
    >
      <div
        className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
          isUser
            ? 'bg-violet-700/80 text-white'
            : 'bg-surface-overlay border border-surface-border text-zinc-200'
        }`}
      >
        {msg.streaming && msg.content === '' ? (
          <span className="flex gap-1 items-center text-zinc-500">
            <span className="animate-pulse">●</span>
            <span className="animate-pulse delay-100">●</span>
            <span className="animate-pulse delay-200">●</span>
          </span>
        ) : (
          <span dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
        )}

        {/* Inline metrics */}
        {msg.data?.metrics && (
          <div className="mt-2 flex flex-wrap gap-2">
            {msg.data.metrics.items.map((item) => (
              <span
                key={item.label}
                className="rounded-md bg-surface-raised px-2 py-0.5 text-[10px] text-zinc-300"
              >
                <span className="text-zinc-500">{item.label}:</span> {item.value}
              </span>
            ))}
          </div>
        )}

        {/* Inline table */}
        {msg.data?.table && (
          <div className="mt-2 overflow-x-auto">
            <table className="text-[10px] w-full border-collapse">
              <thead>
                <tr>
                  {msg.data.table.headers.map((h) => (
                    <th key={h} className="text-left text-zinc-500 px-1.5 py-0.5 border-b border-surface-border">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {msg.data.table.rows.map((row, i) => (
                  <tr key={i} className="border-b border-surface-border/50">
                    {msg.data!.table!.headers.map((h) => (
                      <td key={h} className="px-1.5 py-0.5 text-zinc-300">{String(row[h] ?? '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Action suggestion */}
        {msg.suggestion && (
          <div className="mt-2 rounded-lg border border-amber-700/40 bg-amber-950/30 p-2">
            <p className="text-xs text-amber-300 mb-1.5">{msg.suggestion.confirmationMessage}</p>
            <button
              className="text-[10px] rounded-md bg-amber-700/60 hover:bg-amber-700 text-white px-2 py-1 transition"
              onClick={() => window.dispatchEvent(new CustomEvent('chat:execute-suggestion', { detail: msg.suggestion }))}
            >
              {msg.suggestion.label}
            </button>
          </div>
        )}

        {/* Token usage (tiny) */}
        {msg.tokens && (msg.tokens.input > 0 || msg.tokens.output > 0) && (
          <div className="mt-1 text-[9px] text-zinc-600">
            {msg.tokens.input}↑ {msg.tokens.output}↓ tokens
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Input Box ────────────────────────────────────────────────────────────────
function InputBox({
  onSend,
  disabled,
}: {
  onSend: (query: string, context?: ChatRequest['context']) => void;
  disabled: boolean;
}) {
  const [value, setValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [context, setContext] = useState<ChatRequest['context']>(undefined);

  const handleChange = async (v: string) => {
    setValue(v);
    if (v.startsWith('/')) {
      const slash = SLASH_COMMANDS.find((s) => v.startsWith(s.trigger));
      if (slash) {
        setContext(slash.context);
        setSuggestions(slash.suggestions);
        return;
      }
    }
    setContext(undefined);
    if (v.length > 2) {
      const s = await chatService.getSuggestions(v);
      setSuggestions(s);
    } else {
      setSuggestions([]);
    }
  };

  const submit = () => {
    const q = value.trim();
    if (!q) return;
    onSend(q, context);
    setValue('');
    setSuggestions([]);
    setContext(undefined);
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); }
    if (e.key === 'Escape') { setValue(''); setSuggestions([]); }
  };

  return (
    <div className="relative">
      {/* Suggestions */}
      <AnimatePresence>
        {suggestions.length > 0 && value.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute bottom-full left-0 right-0 mb-1 rounded-xl border border-surface-border bg-surface-raised shadow-xl z-10"
          >
            {suggestions.slice(0, 5).map((s) => (
              <button
                key={s}
                onClick={() => { setValue(s); setSuggestions([]); }}
                className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-surface-overlay transition first:rounded-t-xl last:rounded-b-xl"
              >
                {s}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-2 items-end border-t border-surface-border p-3">
        <textarea
          rows={1}
          value={value}
          onChange={(e) => void handleChange(e.target.value)}
          onKeyDown={onKey}
          disabled={disabled}
          placeholder="Ask anything… or type / for commands"
          className="flex-1 resize-none bg-surface-overlay rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 border border-surface-border focus:outline-none focus:border-violet-600 transition min-h-[32px] max-h-[80px]"
          style={{ height: 'auto' }}
        />
        <button
          onClick={submit}
          disabled={disabled || !value.trim()}
          className="shrink-0 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white px-3 py-2 text-xs transition"
        >
          {disabled ? '…' : '↵'}
        </button>
      </div>
    </div>
  );
}

// ─── ConversationPanel (main export) ─────────────────────────────────────────
export function ConversationPanel() {
  const { open, toggleOpen } = useChatStore();
  const { messages, sending, sendMessage, clearHistory } = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={toggleOpen}
        aria-label="Toggle conversation panel"
        className="fixed bottom-16 right-4 z-50 w-10 h-10 rounded-full bg-violet-600 hover:bg-violet-500 shadow-lg flex items-center justify-center text-white text-base transition-transform hover:scale-105"
      >
        {open ? '✕' : '💬'}
      </button>

      {/* Sliding panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 320, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed bottom-16 right-4 z-40 w-80 max-h-[520px] flex flex-col rounded-2xl border border-surface-border bg-surface-raised shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-zinc-200">Ask NeureCore</span>
                <span className="text-[9px] bg-violet-900 text-violet-300 rounded-full px-1.5 py-0.5">AI</span>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => void clearHistory()}
                  title="Clear history"
                  className="text-zinc-600 hover:text-zinc-400 text-xs transition px-1"
                >
                  ↺
                </button>
              </div>
            </div>

            {/* Messages thread */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {messages.length === 0 && (
                <div className="text-center text-zinc-600 text-xs py-8">
                  <p className="mb-3">Ask anything about your agents, tasks, or costs.</p>
                  <div className="flex flex-col gap-1.5">
                    {['How many agents are running?', 'Show me cost breakdown', 'What tasks completed today?'].map((s) => (
                      <button
                        key={s}
                        onClick={() => sendMessage(s)}
                        className="text-xs rounded-lg border border-surface-border bg-surface-overlay hover:bg-surface-overlay/80 text-zinc-400 px-3 py-1.5 transition text-left"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} />
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="shrink-0">
              <InputBox onSend={sendMessage} disabled={sending} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
