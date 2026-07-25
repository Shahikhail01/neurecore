// components/threads/ThreadView.tsx — Enterprise Communication Platform
// SRP: displays messages for a single thread with real-time WS updates.
//
// 2026-07-11: Created for comms-gated tenant UI rollout.

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useThreads } from '@/hooks/useThreads';
import type { ThreadMessage } from '@/services/threads.service';
import { m } from 'framer-motion';
import { Loader2, Archive, User, Bot, Cpu } from 'lucide-react';
import { useThreadStore } from '@/stores/threadStore';

interface ThreadViewProps {
  threadId: string;
  onClose?: () => void;
}

export default function ThreadView({ threadId, onClose }: ThreadViewProps) {
  const { getMessages, markRead, error: threadError } = useThreads();
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialLoadDone = useRef(false);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const msgs = await getMessages(threadId, { limit: 100 });
      setMessages(msgs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [threadId, getMessages]);

  // Initial load
  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  // Mark read on mount
  useEffect(() => {
    if (!initialLoadDone.current) {
      markRead(threadId).catch(() => {});
      initialLoadDone.current = true;
    }
  }, [threadId, markRead]);

  // Listen for new messages via WS → store bridge
  useEffect(() => {
    const unsub = useThreadStore.subscribe((state, prev) => {
      // When a thread:message event causes updatedAt change, reload messages
      const prevThread = prev.threads.find((t) => t.id === threadId);
      const currThread = state.threads.find((t) => t.id === threadId);
      if (
        prevThread &&
        currThread &&
        prevThread.updatedAt !== currThread.updatedAt
      ) {
        void loadMessages();
      }
    });
    return unsub;
  }, [threadId, loadMessages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current && messages.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const roleIcon = (role: string) => {
    switch (role) {
      case 'USER':
        return <User className="w-3.5 h-3.5" />;
      case 'HERMES':
        return <Bot className="w-3.5 h-3.5" />;
      case 'SYSTEM':
        return <Cpu className="w-3.5 h-3.5" />;
      default:
        return <MessageBubble className="w-3.5 h-3.5" />;
    }
  };

  const roleLabel = (role: string) =>
    role === 'USER' ? 'You' : role === 'HERMES' ? 'Agent' : 'System';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-surface-border flex items-center justify-between shrink-0">
        <span className="text-xs font-medium text-zinc-400">
          {messages.length} message{messages.length !== 1 ? 's' : ''}
        </span>
        {onClose && (
          <button
            onClick={onClose}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-zinc-500 hover:text-[color:var(--visual-accent-rose-400)] hover:bg-[color:var(--visual-accent-rose-500)]/10 transition"
            title="Close thread"
          >
            <Archive className="w-3 h-3" />
            Close
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading && (
          <div className="flex items-center justify-center py-8 gap-2 text-zinc-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs">Loading messages…</span>
          </div>
        )}

        {error && !loading && (
          <div className="text-center py-8 text-[color:var(--visual-accent-rose-400)] text-xs">{error}</div>
        )}

        {!loading && !error && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-zinc-600">
            <MessageBubble className="w-8 h-8 opacity-20" />
            <p className="text-xs">No messages in this thread yet.</p>
          </div>
        )}

        {messages.map((msg, i) => {
          const isUser = msg.role === 'USER';
          const isConsecutive =
            i > 0 && messages[i - 1].role === msg.role;
          return (
            <m.div
              key={msg.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.3) }}
              className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && !isConsecutive && (
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                    msg.role === 'HERMES'
                      ? 'bg-[color:var(--accent-500)]/20 text-indigo-300'
                      : 'bg-zinc-700 text-zinc-400'
                  }`}
                >
                  {roleIcon(msg.role)}
                </div>
              )}
              {!isUser && isConsecutive && <div className="w-6 shrink-0" />}

              <div className="max-w-[80%] min-w-0">
                {!isConsecutive && (
                  <div
                    className={`text-[10px] mb-1 ${
                      isUser ? 'text-right text-zinc-500' : 'text-zinc-500'
                    }`}
                  >
                    {roleLabel(msg.role)}
                    <span className="ml-2 text-zinc-700">
                      {formatMsgTime(msg.createdAt)}
                    </span>
                  </div>
                )}
                <div
                  className={`rounded-xl px-3 py-2 text-sm leading-relaxed ${
                    isUser
                      ? 'bg-[color:var(--accent-500)]/30 text-zinc-100 rounded-br-sm'
                      : 'bg-surface-raised text-zinc-200 rounded-bl-sm'
                  }`}
                >
                  {msg.content}
                </div>
              </div>

              {isUser && !isConsecutive && (
                <div className="w-6 h-6 rounded-full bg-[color:var(--accent-500)]/30 flex items-center justify-center shrink-0 mt-0.5 text-indigo-300">
                  {roleIcon(msg.role)}
                </div>
              )}
              {isUser && isConsecutive && <div className="w-6 shrink-0" />}
            </m.div>
          );
        })}
      </div>
    </div>
  );
}

function formatMsgTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function MessageBubble({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}
