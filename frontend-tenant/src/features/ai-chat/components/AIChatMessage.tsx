'use client';
// ─── AIChatMessage.tsx ────────────────────────────────────────────────────────
// SRP: Renders a single chat message bubble with optional metadata (chart, suggestions).
// OCP: Metadata renderers (chart, suggestions) are closed components — swap without touching this file.

import { motion } from 'framer-motion';
import type { ChatMessage } from '@/core/services/interfaces/IConversationalAIService';

// ─── Mini inline bar chart ────────────────────────────────────────────────────
function MiniChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="mt-2 rounded-lg border border-zinc-700/50 bg-zinc-900/50 p-3">
      <div className="flex items-end gap-1.5 h-16">
        {data.slice(0, 8).map((d) => (
          <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full rounded-t bg-indigo-500 transition-all"
              style={{ height: `${(d.value / max) * 100}%`, minHeight: '2px' }}
            />
            <span className="text-[8px] text-zinc-500 truncate w-full text-center">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Suggestions ──────────────────────────────────────────────────────────────
function Suggestions({
  items,
  onSelect,
}: {
  items: string[];
  onSelect: (text: string) => void;
}) {
  if (!items.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {items.map((s) => (
        <button
          key={s}
          onClick={() => onSelect(s)}
          className="rounded-full border border-zinc-700 bg-zinc-800/60 px-2.5 py-1 text-[11px] text-zinc-300 hover:border-indigo-600 hover:text-indigo-300 transition-colors"
        >
          {s}
        </button>
      ))}
    </div>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────
interface AIChatMessageProps {
  message:    ChatMessage;
  onSuggestionSelect: (text: string) => void;
}

export function AIChatMessage({ message, onSuggestionSelect }: AIChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`max-w-[85%] ${isUser ? 'order-2' : 'order-1'}`}>
        {/* Avatar */}
        <div className={`mb-1 flex items-center gap-1.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
          <span className="text-[10px] text-zinc-600">
            {isUser ? 'You' : '✦ HeadQuarter AI'}
          </span>
        </div>

        {/* Bubble */}
        <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'bg-indigo-600 text-white rounded-tr-sm'
            : 'bg-zinc-800/80 text-zinc-200 rounded-tl-sm border border-zinc-700/50'
        }`}>
          {message.content}

          {/* Inline chart */}
          {!isUser && message.metadata?.chartData && message.metadata.chartData.length > 0 && (
            <MiniChart data={message.metadata.chartData}/>
          )}
        </div>

        {/* Suggestions (only on assistant messages) */}
        {!isUser && message.metadata?.suggestions && (
          <Suggestions
            items={message.metadata.suggestions}
            onSelect={onSuggestionSelect}
          />
        )}

        {/* Timestamp */}
        <p className={`mt-0.5 text-[9px] text-zinc-600 ${isUser ? 'text-right' : 'text-left'}`}>
          {new Date(message.timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit',
          })}
        </p>
      </div>
    </motion.div>
  );
}

// ─── Typing indicator ─────────────────────────────────────────────────────────
export function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="flex justify-start"
    >
      <div className="rounded-2xl rounded-tl-sm border border-zinc-700/50 bg-zinc-800/80 px-4 py-3">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-zinc-400"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
