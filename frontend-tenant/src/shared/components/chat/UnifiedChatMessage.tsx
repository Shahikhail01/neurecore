// ─── UnifiedChatMessage.tsx ─────────────────────────────────────────────────────
// SRP: Renders a single chat message bubble with all supported inline renderers.
// OCP: New inline types added via the EnvelopeRenderer routing layer — no
//      modification to this file for new component types.
//
// Phase 9 — Response Envelope: the inline chart/metrics/table blocks that
// used to live at lines 188–203 are replaced by a single `EnvelopeRenderer`
// invocation. The renderer reads `{ text, components }` from the parsed
// envelope. Conversational text is rendered from `parsed.text`. The parser
// is memoised per-content so streaming deltas do not re-parse 5KB blobs on
// every keystroke.

'use client';

import { motion } from 'framer-motion';
import { useMemo } from 'react';
import type {
  AutonomousApprovalData,
  ChatMessage,
  SuggestionData,
} from '@/shared/types/chat.types';
import { ApprovalCard } from './ApprovalCard';
import { EnvelopeRenderer } from '@/core/services/chat/envelope/EnvelopeRenderer';
import type { IEnvelopeParser, EnvelopeComponent } from '@/core/services/chat/envelope/interfaces/IEnvelopeParser';
import {
  ProvenanceBadge,
  type Citation,
  type ProvenanceSource,
} from './ProvenanceBadge';

// ── Renderer: Markdown-lite (bold, italic, code, line breaks) ──────────────────
function MarkdownRenderer({ content }: { content: string }) {
  // Assistant content is model-controlled. Escape HTML before applying the
  // deliberately small markdown subset so tags/event handlers cannot reach
  // dangerouslySetInnerHTML.
  const html = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(
      /`(.*?)`/g,
      '<code class="bg-surface-overlay px-1 rounded text-xs text-violet-300">$1</code>',
    )
    .replace(/\n/g, '<br/>');
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
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
  onApprovalDecision: (
    approval: AutonomousApprovalData,
    decision: 'approve' | 'reject',
  ) => Promise<AutonomousApprovalData | null>;
  envelopeParser: IEnvelopeParser;
  onCitationClick?: (citation: Citation) => void;
}

// ── Main Component ──────────────────────────────────────────────────────────────
export function UnifiedChatMessage({
  message,
  onSuggestionSelect,
  sending,
  onApprovalDecision,
  envelopeParser,
  onCitationClick,
}: UnifiedChatMessageProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  // useMemo: envelope comes from metadata (SSE delta, primary) or from
  // content parsing (legacy / query-path fallback). The parser is small
  // (linear in JSON block size) but content can be 5KB+ during streaming
  // — caching the parse result per content prevents redundant work.
  const parsedEnvelope = useMemo(() => {
    // Primary: metadata.envelope arrives from SSE delta (Phase 9).
    if (message.metadata?.envelope) {
      const metaEnv = message.metadata.envelope;
      const components: EnvelopeComponent[] | undefined =
        metaEnv.components
          ? (metaEnv.components as unknown as EnvelopeComponent[])
          : undefined;
      return {
        text: message.content,
        envelope: {
          text: metaEnv.text,
          components,
        },
      };
    }
    // Fallback: parse content for inline envelope JSON (legacy messages
    // persisted before Phase 9, plus hand-crafted chart payloads).
    if (message.content) {
      return envelopeParser.parse(message.content);
    }
    return null;
  }, [message.content, message.metadata?.envelope, envelopeParser]);

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

  const displayText = parsedEnvelope?.text ?? message.content ?? '';

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
          <div className="text-[10px] text-[color:var(--accent-400)] mb-1 font-medium">
            ✦ HeadQuarter AI
          </div>
        )}

        {/* Markdown content (uses envelope text when present, plain content otherwise) */}
        {displayText && <MarkdownRenderer content={displayText} />}

        {/* Phase 9: EnvelopeRenderer replaces the legacy metadata.chart/metrics/table
            blocks. Strictly additive — old messages without envelopes render the
            same text-only path. */}
        {parsedEnvelope?.envelope?.components && (
          <EnvelopeRenderer components={parsedEnvelope.envelope.components} />
        )}

        {/* P1 — provenance display. The provenance is server-attested via
            the message metadata; the FE never accepts a free-text source
            from the LLM. */}
        {isAssistant && message.metadata?.provenance && (
          <ProvenanceBadge
            source={message.metadata.provenance.source as ProvenanceSource}
            confidence={message.metadata.provenance.confidence}
            excerptHash={message.metadata.provenance.excerptHash}
            citations={message.metadata.provenance.citations as Citation[] | undefined}
            onCitationClick={onCitationClick}
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
          <ApprovalCard
            approval={message.metadata.autonomousApproval}
            onDecision={onApprovalDecision}
          />
        )}

        {/* Token counter */}
        {message.tokens && (
          <TokenCounter input={message.tokens.input} output={message.tokens.output} />
        )}

        {/* Timestamp */}
        {isAssistant && (
          <div className="mt-1 text-[9px] text-zinc-600">
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
