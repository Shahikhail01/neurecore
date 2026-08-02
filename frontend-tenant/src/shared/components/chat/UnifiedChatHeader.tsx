// ─── UnifiedChatHeader.tsx ──────────────────────────────────────────────────────
// SRP: Chat panel header with title, badge, agent identity, history toggle,
// clear-history, and close buttons. WCAG 2.2 AA: every interactive control
// has a programmatic accessible name (aria-label or visible text).

'use client';

interface UnifiedChatHeaderProps {
  title: string;
  badgeLabel: string;
  badgeColor: string;
  onClear: () => void;
  onClose: () => void;
  onOpenHistory?: () => void;
  historyOpen?: boolean;
  agentLabel?: string;
}

export function UnifiedChatHeader({
  title,
  badgeLabel,
  badgeColor,
  onClear,
  onClose,
  onOpenHistory,
  historyOpen,
  agentLabel,
}: UnifiedChatHeaderProps) {
  const badgeBg = badgeColor === 'indigo' ? 'bg-[color:var(--accent-500)] text-violet-300' : 'bg-zinc-800 text-zinc-300';

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs font-semibold text-zinc-200 truncate">{title}</span>
        <span className={`text-[9px] rounded-full px-1.5 py-0.5 ${badgeBg}`}>
          {badgeLabel}
        </span>
        {agentLabel && (
          <span
            className="text-[9px] rounded-full px-1.5 py-0.5 bg-emerald-900/40 text-emerald-200 border border-emerald-700/40"
            aria-label={`Active agent: ${agentLabel}`}
          >
            {agentLabel}
          </span>
        )}
      </div>
      <div className="flex gap-1.5 shrink-0">
        {onOpenHistory && (
          <button
            onClick={onOpenHistory}
            aria-label={historyOpen ? 'Hide conversation history' : 'Show conversation history'}
            aria-expanded={Boolean(historyOpen)}
            title="Conversation history"
            className="text-zinc-600 hover:text-zinc-400 text-xs transition px-1"
          >
            ☰
          </button>
        )}
        <button
          onClick={onClear}
          aria-label="Clear conversation history"
          title="Clear history"
          className="text-zinc-600 hover:text-zinc-400 text-xs transition px-1"
        >
          ↺
        </button>
        <button
          onClick={onClose}
          aria-label="Close conversation panel"
          title="Close panel"
          className="text-zinc-600 hover:text-zinc-400 text-xs transition px-1"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
