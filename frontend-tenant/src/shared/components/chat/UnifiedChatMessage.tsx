// ─── UnifiedChatMessage.tsx ─────────────────────────────────────────────────────
// SRP: Renders a single chat message bubble with all supported inline renderers.
// OCP: New inline types added via conditional rendering blocks — no modification
//      to existing renderers. Markdown, chart, metrics, table, suggestions, tokens.

'use client';

import { motion } from 'framer-motion';
import type { AutonomousApprovalData, ChatMessage, SuggestionData } from '@/shared/types/chat.types';
import { ApprovalCard } from './ApprovalCard';

// ── Renderer: Markdown-lite (bold, italic, code, line breaks) ──────────────────
function MarkdownRenderer({ content }: { content: string }) {
  const html = content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code class="bg-surface-overlay px-1 rounded text-xs text-violet-300">$1</code>')
    .replace(/\n/g, '<br/>');
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

// ── Renderer: Mini Bar Chart ────────────────────────────────────────────────────
function MiniChart({ data }: { data: Array<{ label: string; value: number }> }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const items = data.slice(0, 8);
  return (
    <div className="mt-2 flex items-end gap-1 h-20">
      {items.map((d, i) => (
        <div key={i} className="flex flex-col items-center flex-1 min-w-0">
          <div
            className="w-full rounded-t bg-[color:var(--accent-500)]/70 transition-all"
            style={{ height: `${Math.max((d.value / max) * 100, 4)}%` }}
          />
          <span className="text-[8px] text-zinc-500 mt-0.5 truncate w-full text-center">
            {d.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Renderer: Metrics Badges ────────────────────────────────────────────────────
function MetricsRenderer({ items }: { items: Array<{ label: string; value: string | number; color?: string }> }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item.label} className="rounded-md bg-surface-raised px-2 py-0.5 text-[10px] text-zinc-300">
          <span className="text-zinc-500">{item.label}:</span> {item.value}
        </span>
      ))}
    </div>
  );
}

// ── Renderer: Inline Table ──────────────────────────────────────────────────────
function TableRenderer({ headers, rows }: { headers: string[]; rows: Array<Record<string, string | number | boolean>> }) {
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="text-[10px] w-full border-collapse">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} className="text-left text-zinc-500 px-1.5 py-0.5 border-b border-surface-border">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-surface-border/50">
              {headers.map((h) => (
                <td key={h} className="px-1.5 py-0.5 text-zinc-300">
                  {String(row[h] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Renderer: Suggestion Chips ──────────────────────────────────────────────────
function SuggestionRenderer({
  suggestions,
  onSelect,
  disabled,
}: {
  suggestions: SuggestionData[];
  onSelect: (item: SuggestionData) => void;
  disabled: boolean;
}) {
  if (!suggestions.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {suggestions.map((s, i) => (
        <button
          key={i}
          onClick={() => onSelect(s)}
          disabled={disabled}
          className="text-[10px] rounded-full border border-zinc-700 bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-300 px-2.5 py-1 transition disabled:opacity-40"
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

// ── Renderer: Token Counter ─────────────────────────────────────────────────────
function TokenCounter({ input, output }: { input: number; output: number }) {
  if (input === 0 && output === 0) return null;
  return (
    <div className="mt-1 text-[9px] text-zinc-600">
      {input}↑ {output}↓ tokens
    </div>
  );
}

// ── Typing Indicator ────────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex items-center h-5 px-1">
      <div className="flex gap-1 items-center">
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-bounce [animation-delay:200ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-bounce [animation-delay:400ms]" />
      </div>
    </div>
  );
}

// ── Props ───────────────────────────────────────────────────────────────────────
interface UnifiedChatMessageProps {
  message: ChatMessage;
  onSuggestionSelect: (suggestion: SuggestionData) => void;
  sending: boolean;
  onApprovalDecision: (approval: AutonomousApprovalData, decision: 'approve' | 'reject') => Promise<AutonomousApprovalData | null>;
}

// ── Main Component ──────────────────────────────────────────────────────────────
export function UnifiedChatMessage({ message, onSuggestionSelect, sending, onApprovalDecision }: UnifiedChatMessageProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  if (message.content === '' && message.metadata?.isStreaming) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="flex justify-start mb-2"
      >
        <div className="max-w-[85%] rounded-xl px-3 py-2 bg-surface-overlay border border-surface-border">
          <TypingIndicator />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-2`}
      data-testid={isUser ? 'chat-message-user' : 'chat-message-assistant'}
    >
      <div
        className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
          isUser
            ? 'bg-violet-700/80 text-white'
            : 'bg-surface-overlay border border-surface-border text-zinc-200'
        }`}
      >
        {/* Avatar label */}
        {isAssistant && (
          <div className="text-[10px] text-[color:var(--accent-400)] mb-1 font-medium">✦ HeadQuarter AI</div>
        )}

        {/* Markdown content */}
        {message.content && <MarkdownRenderer content={message.content} />}

        {/* Inline chart */}
        {message.metadata?.chart && (
          <MiniChart data={message.metadata.chart.chartData} />
        )}

        {/* Inline metrics */}
        {message.metadata?.metrics && (
          <MetricsRenderer items={message.metadata.metrics.items} />
        )}

        {/* Inline table */}
        {message.metadata?.table && (
          <TableRenderer
            headers={message.metadata.table.headers}
            rows={message.metadata.table.rows}
          />
        )}

        {/* Suggestion chips */}
        {message.metadata?.suggestions && (
          <SuggestionRenderer
            suggestions={message.metadata.suggestions}
            onSelect={onSuggestionSelect}
            disabled={sending}
          />
        )}

        {message.metadata?.autonomousApproval && (
          <ApprovalCard approval={message.metadata.autonomousApproval} onDecision={onApprovalDecision} />
        )}

        {/* Token counter */}
        {message.tokens && (
          <TokenCounter input={message.tokens.input} output={message.tokens.output} />
        )}

        {/* Timestamp */}
        {isAssistant && (
          <div className="mt-1 text-[9px] text-zinc-600">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
