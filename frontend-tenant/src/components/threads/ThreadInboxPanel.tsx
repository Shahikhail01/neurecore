// components/threads/ThreadInboxPanel.tsx — Enterprise Communication Platform
// SRP: displays the list of threads the user participates in.
// OCP: gated behind COMM_THREADS_ENABLED feature flag.
//
// 2026-07-11: Created for comms-gated tenant UI rollout.

'use client';

import { useServerFeatureFlag } from '@/hooks/useServerFeatureFlag';
import { useThreads } from '@/hooks/useThreads';
import ThreadView from './ThreadView';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Plus, Archive, Loader2, AlertCircle, Hash } from 'lucide-react';

export default function ThreadInboxPanel() {
  const commsEnabled = useServerFeatureFlag('COMM_THREADS_ENABLED');
  const {
    threads,
    activeThread,
    activeThreadId,
    unreadCount,
    loading,
    error,
    selectThread,
    createThread,
    closeThread,
  } = useThreads();

  if (!commsEnabled) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-zinc-500">
        <MessageCircle className="w-10 h-10 opacity-30" />
        <p className="text-sm">Thread communication is not enabled for this tenant.</p>
        <p className="text-xs text-zinc-600">Contact your administrator to enable COMM_THREADS_ENABLED.</p>
      </div>
    );
  }

  async function handleCreateThread() {
    const title = window.prompt('Thread title:');
    if (!title?.trim()) return;
    try {
      const thread = await createThread({ title: title.trim(), participants: [] });
      if (thread && thread.id) {
        selectThread(thread.id);
      }
    } catch (err) {
      console.error('Failed to create thread:', err);
      alert('Failed to create thread. Please try again.');
    }
  }

  async function handleCloseThread(threadId: string) {
    if (!window.confirm('Close this thread? It will be archived.')) return;
    await closeThread(threadId);
  }

  const statusColor = (status: string) =>
    status === 'ACTIVE' ? 'bg-[color:var(--state-success)]' : status === 'CLOSED' ? 'bg-[color:var(--visual-accent-rose-500)]' : 'bg-zinc-500';

  return (
    <div className="flex h-full min-h-[500px] gap-0 border border-surface-border rounded-xl overflow-hidden bg-surface">
      {/* ── Thread list sidebar ─────────────────────────────────────────────── */}
      <div className="w-80 shrink-0 border-r border-surface-border flex flex-col">
        <div className="p-3 border-b border-surface-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Hash className="w-4 h-4 text-zinc-400" />
            <span className="text-sm font-semibold text-zinc-100">Threads</span>
            {unreadCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[color:var(--accent-500)] text-white font-medium">
                {unreadCount}
              </span>
            )}
          </div>
          <button
            onClick={handleCreateThread}
            className="p-1 rounded hover:bg-surface-raised text-zinc-400 hover:text-zinc-200 transition"
            title="New thread"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && threads.length === 0 && (
            <div className="flex items-center justify-center py-12 gap-2 text-zinc-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs">Loading threads…</span>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center py-8 gap-2 text-[color:var(--visual-accent-rose-400)]">
              <AlertCircle className="w-4 h-4" />
              <span className="text-xs">{error}</span>
            </div>
          )}

          {!loading && !error && threads.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-zinc-600">
              <MessageCircle className="w-8 h-8 opacity-30" />
              <p className="text-xs">No threads yet</p>
              <p className="text-[10px] text-zinc-700">
                Threads are created when you execute an agent or start a conversation.
              </p>
            </div>
          )}

          <AnimatePresence>
            {threads.map((thread) => (
              <motion.button
                key={thread.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                onClick={() => selectThread(thread.id === activeThreadId ? null : thread.id)}
                className={`w-full text-left p-3 border-b border-surface-border hover:bg-surface-raised transition flex items-start gap-3 ${
                  thread.id === activeThreadId ? 'bg-surface-raised' : ''
                }`}
              >
                <span
                  className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${statusColor(thread.status)}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-zinc-200 truncate">{thread.title}</div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">
                    {thread.status === 'ACTIVE' ? 'Active' : thread.status === 'CLOSED' ? 'Closed' : 'Archived'}
                    {thread.hopCount > 0 && ` · ${thread.hopCount} hops`}
                  </div>
                </div>
                <span className="text-[9px] text-zinc-600 whitespace-nowrap mt-1">
                  {formatTime(thread.createdAt)}
                </span>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Thread detail panel ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeThread ? (
          <ThreadView
            threadId={activeThread.id}
            onClose={() => handleCloseThread(activeThread.id)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-zinc-500">
            <MessageCircle className="w-12 h-12 opacity-20" />
            <p className="text-sm">Select a thread to view messages</p>
            <p className="text-xs text-zinc-600">
              {threads.length === 0
                ? 'Create a new thread or execute an agent to begin.'
                : `${threads.length} thread${threads.length !== 1 ? 's' : ''} available`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const now = Date.now();
    const diff = now - d.getTime();
    if (diff < 60_000) return 'now';
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3600_000)}h`;
    return d.toLocaleDateString();
  } catch {
    return '';
  }
}
