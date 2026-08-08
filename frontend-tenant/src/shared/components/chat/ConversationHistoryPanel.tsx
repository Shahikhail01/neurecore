// ─── ConversationHistoryPanel.tsx ──────────────────────────────────────────────
// P1 — list, resume, export, and delete past chat conversations. The data
// comes from `IChatService.getHistory()` (which already proxies
// `/chat/history` and `/chat/conversations`); the panel never invents rows.
// Resume is implemented by re-sending a click handler the parent can use to
// rehydrate the active conversation id.

'use client';

import { useCallback, useEffect, useState } from 'react';
import type { IChatService } from '@/core/services/interfaces/IChatService';
import type { ChatMessage } from '@/shared/types/chat.types';

export interface ConversationRow {
  id: string;
  title: string;
  startedAt: string;
  agentLabel?: string;
  status: 'active' | 'archived' | 'failed';
  messageCount: number;
}

interface ConversationHistoryPanelProps {
  chatService: IChatService;
  onResume?: (conversationId: string) => void;
}

function titleFromMessages(messages: ChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === 'user');
  if (!firstUser) return 'New conversation';
  const trimmed = firstUser.content.trim().replace(/\s+/g, ' ');
  return trimmed.length > 48 ? `${trimmed.slice(0, 45)}…` : trimmed;
}

function classifyStatus(messages: ChatMessage[]): ConversationRow['status'] {
  if (messages.some((m) => m.metadata?.autonomousApproval)) return 'active';
  const last = messages[messages.length - 1];
  if (last?.role === 'assistant' && last.content === '') return 'failed';
  return 'archived';
}

export function ConversationHistoryPanel({
  chatService,
  onResume,
}: ConversationHistoryPanelProps) {
  const [rows, setRows] = useState<ConversationRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const messages = await chatService.getHistory(200);
      const grouped = new Map<string, ChatMessage[]>();
      for (const m of messages) {
        const key = m.id.split('_')[0] ?? m.id;
        const list = grouped.get(key) ?? [];
        list.push(m);
        grouped.set(key, list);
      }
      const result: ConversationRow[] = Array.from(grouped.entries()).map(
        ([id, msgs]) => ({
          id,
          title: titleFromMessages(msgs),
          startedAt: msgs[0]?.timestamp ?? new Date().toISOString(),
          status: classifyStatus(msgs),
          messageCount: msgs.length,
        }),
      );
      result.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
      setRows(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load history');
      setRows([]);
    }
  }, [chatService]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        await chatService.clearHistory();
        setRows((prev) => (prev ?? []).filter((r) => r.id !== id));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Delete failed');
      } finally {
        setBusyId(null);
      }
    },
    [chatService],
  );

  const handleExport = useCallback(async (row: ConversationRow) => {
    try {
      const created = await chatService.createExport({
        conversationId: row.id,
        format: 'json',
        redact: true,
      });
      const url = `/api/v1/chat/export/${encodeURIComponent(created.exportId)}/download`;
      const link = document.createElement('a');
      link.href = url;
      link.rel = 'noopener';
      link.download = `${row.id}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    }
  }, [chatService]);

  if (rows === null) {
    return (
      <div
        className="px-3 py-2 text-[10px] text-zinc-500 border-b border-surface-border"
        role="status"
        aria-live="polite"
      >
        Loading history…
      </div>
    );
  }

  return (
    <div
      className="max-h-44 overflow-y-auto border-b border-surface-border bg-surface-raised/30"
      data-testid="chat-history-panel"
      role="region"
      aria-label="Conversation history"
    >
      {error && (
        <div role="alert" className="px-3 py-1 text-[10px] text-red-300">
          {error}
        </div>
      )}
      {rows.length === 0 ? (
        <div className="px-3 py-2 text-[10px] text-zinc-500">No previous conversations.</div>
      ) : (
        <ul role="list" className="divide-y divide-surface-border">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-2 px-3 py-1.5 text-[10px] hover:bg-surface-overlay"
            >
              <button
                type="button"
                onClick={() => onResume?.(row.id)}
                className="flex-1 min-w-0 text-left focus:outline-none focus:ring-1 focus:ring-violet-500 rounded"
                aria-label={`Resume conversation ${row.title}`}
              >
                <div className="text-zinc-200 truncate">{row.title}</div>
                <div className="text-zinc-500 mt-0.5">
                  {new Date(row.startedAt).toLocaleString()} · {row.messageCount} msg
                  {row.agentLabel ? ` · ${row.agentLabel}` : ''}
                </div>
              </button>
              <span
                className={`shrink-0 rounded-full px-1.5 py-0.5 border text-[9px] ${
                  row.status === 'active'
                    ? 'bg-emerald-900/40 text-emerald-200 border-emerald-700/40'
                    : row.status === 'failed'
                      ? 'bg-red-900/40 text-red-200 border-red-700/40'
                      : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                }`}
                aria-label={`Status ${row.status}`}
              >
                {row.status}
              </span>
              <button
                type="button"
                onClick={() => void handleExport(row)}
                aria-label={`Export conversation ${row.title}`}
                title="Export"
                className="text-zinc-500 hover:text-zinc-300 px-1"
              >
                ⤓
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(row.id)}
                disabled={busyId === row.id}
                aria-label={`Delete conversation ${row.title}`}
                title="Delete"
                className="text-zinc-500 hover:text-red-300 px-1 disabled:opacity-40"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
