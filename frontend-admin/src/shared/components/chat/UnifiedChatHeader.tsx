// ─── UnifiedChatHeader.tsx ──────────────────────────────────────────────────────
// SRP: Chat panel header with title, badge, clear history, and close buttons.

'use client';

interface UnifiedChatHeaderProps {
  title: string;
  badgeLabel: string;
  badgeColor: string;
  onClear: () => void;
  onClose: () => void;
}

export function UnifiedChatHeader({
  title,
  badgeLabel,
  badgeColor,
  onClear,
  onClose,
}: UnifiedChatHeaderProps) {
  const badgeBg = badgeColor === 'indigo' ? 'bg-[color:var(--accent-500)] text-violet-300' : 'bg-zinc-800 text-zinc-300';

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-zinc-200">{title}</span>
        <span className={`text-[9px] rounded-full px-1.5 py-0.5 ${badgeBg}`}>
          {badgeLabel}
        </span>
      </div>
      <div className="flex gap-1.5">
        <button
          onClick={onClear}
          title="Clear history"
          className="text-zinc-600 hover:text-zinc-400 text-xs transition px-1"
        >
          ↺
        </button>
        <button
          onClick={onClose}
          title="Close panel"
          className="text-zinc-600 hover:text-zinc-400 text-xs transition px-1"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
