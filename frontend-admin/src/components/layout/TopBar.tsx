'use client';
// ─── TopBar ───────────────────────────────────────────────────────────────────
// S — Single Responsibility: global header bar with alerts, approvals, command trigger
import { useEffect, useState } from 'react';
import { useCommandStore } from '@/stores/commandStore';
import { useActivityStore } from '@/stores/activityStore';
import api from '@/services/api';
import { unwrapList } from '@/services/unwrap';

interface TopBarProps {
  title?: string;
}

export function TopBar({ title }: TopBarProps) {
  const { openPalette } = useCommandStore();
  const { events } = useActivityStore();
  const [pendingApprovals, setPendingApprovals] = useState(0);

  const errorCount = events.filter((e) => e.severity === 'error').length;

  useEffect(() => {
    api.get('/approvals?status=PENDING&limit=1')
      .then((res) => setPendingApprovals(unwrapList(res).total ?? 0))
      .catch(() => setPendingApprovals(0));
  }, []);

  return (
    <header className="h-12 border-b border-surface-border bg-surface-raised flex items-center px-4 gap-3 flex-shrink-0 z-20">
      {/* Breadcrumb / title */}
      <div className="flex-1 min-w-0">
        {title && <span className="text-sm font-medium text-zinc-400">{title}</span>}
      </div>

      {/* Command box trigger */}
      <button
        onClick={openPalette}
        className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-surface-border bg-surface text-zinc-500 text-xs hover:border-surface-muted transition-colors"
      >
        <span>Search or command…</span>
        <kbd className="text-[10px] bg-surface-muted px-1.5 py-0.5 rounded text-zinc-600">⌘K</kbd>
      </button>

      {/* Alerts badge */}
      {errorCount > 0 && (
        <button className="relative flex items-center justify-center w-8 h-8 rounded-lg hover:bg-surface-overlay">
          <span className="text-sm">🔔</span>
          <span className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center rounded-full bg-status-risk text-[9px] font-bold text-white">
            {errorCount}
          </span>
        </button>
      )}

      {/* Approvals badge */}
      {pendingApprovals > 0 && (
        <a
          href="/approvals"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-status-warn/15 border border-status-warn/30 text-status-warn text-xs font-medium hover:bg-status-warn/25 transition-colors"
        >
          ⏳ {pendingApprovals} pending
        </a>
      )}
    </header>
  );
}
