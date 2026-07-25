// ─── UnifiedChatInput.tsx ───────────────────────────────────────────────────────
// SRP: Text input + slash command autocomplete + live suggestions dropdown.
// Features: auto-resize textarea, Ctrl+Enter send, Escape clear, double-submit guard.

'use client';

import { useState, KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ISlashCommandProvider } from '@/core/services/interfaces/IChatService';
import type { SlashCommand } from '@/shared/types/chat.types';

interface UnifiedChatInputProps {
  onSend: (query: string, context?: string) => void;
  disabled: boolean;
  placeholder: string;
  slashCommands: ISlashCommandProvider;
}

export function UnifiedChatInput({
  onSend,
  disabled,
  placeholder,
  slashCommands,
}: UnifiedChatInputProps) {
  const [value, setValue] = useState('');
  const [matchedCommand, setMatchedCommand] = useState<SlashCommand | null>(null);

  const handleChange = (v: string) => {
    setValue(v);
    if (v.startsWith('/')) {
      const slash = slashCommands.getSuggestions(v)[0] ?? null;
      setMatchedCommand(slash);
    } else {
      setMatchedCommand(null);
    }
  };

  const submit = () => {
    const q = value.trim();
    if (!q) return;
    const ctx = matchedCommand?.context ?? slashCommands.getContextForTrigger(q.toLowerCase());
    onSend(q, ctx);
    setValue('');
    setMatchedCommand(null);
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
      return;
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      submit();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setValue('');
      setMatchedCommand(null);
    }
  };

  return (
    <div className="relative">
      {/* Slash-command suggestions */}
      <AnimatePresence>
        {matchedCommand && value.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute bottom-full left-0 right-0 mb-1 rounded-xl border border-surface-border bg-surface-raised shadow-xl z-10"
          >
            {matchedCommand.suggestions.slice(0, 5).map((s) => (
              <button
                key={s}
                onClick={() => {
                  setValue(s);
                  setMatchedCommand(null);
                }}
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
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={onKey}
          disabled={disabled}
          placeholder={placeholder}
          className="flex-1 resize-none bg-surface-overlay rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 border border-surface-border focus:outline-none focus:border-violet-600 transition min-h-[32px] max-h-[80px]"
          style={{ height: 'auto' }}
          data-testid="chat-input"
        />
        <button
          onClick={submit}
          disabled={disabled || !value.trim()}
          className="shrink-0 rounded-lg bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] disabled:opacity-40 text-white px-3 py-2 text-xs transition"
          data-testid="chat-submit"
        >
          {disabled ? '…' : '↵'}
        </button>
      </div>
    </div>
  );
}
