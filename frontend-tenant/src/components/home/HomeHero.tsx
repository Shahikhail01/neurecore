'use client';

// HomeHero — Top-of-page greeting panel for the tenant home page.
//
// Mirrors the Creatio reference image (home-page-initial.png):
//   - Centered date/time pill (live, updates every minute)
//   - Large headline greeting using the user's first name + time-of-day
//   - AI prompt input with send button (paper-airplane) on right
//   - Quick-suggestion chips below the prompt that fill the input on click
//
// Theming: tailwind classes only — semantic tokens (bg-surface/text-zinc-100/
// accent-500) are theme-aware via CSS variables in globals.css. The hero uses
// the existing .hero-gradient class which has light/dark variants.

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { Send, Sparkles } from 'lucide-react';
import { useTenantAuth } from '@/hooks/useTenantAuth';
import type { TenantSelf } from '@/services/tenants.service';

const SUGGESTION_CHIPS = [
  'Score my top 10 leads by propensity to buy',
  'What is the next best action for my deals?',
  'Forecast the pipeline for this quarter',
  'Generate a draft quote for my top deal',
  'Summarize recent activity on this customer',
  'Show me the 360 view of this customer',
  'Find a knowledge base article about this error',
  'Run my AI Twin on this task',
] as const;

function greeting(hour: number): string {
  if (hour < 5) return 'Working late';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Working late';
}

function currentTime(tz: string): string {
  try {
    return new Date().toLocaleTimeString('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
}

function currentWeekday(tz: string): string {
  try {
    return new Date().toLocaleDateString('en-US', { timeZone: tz, weekday: 'long' });
  } catch {
    return new Date().toLocaleDateString('en-US', { weekday: 'long' });
  }
}

function currentMonthYear(tz: string): string {
  try {
    return new Date().toLocaleDateString('en-US', { timeZone: tz, month: 'long', year: 'numeric' });
  } catch {
    return new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
}

interface HomeHeroProps {
  tenant: TenantSelf | null;
  onSend?: (message: string) => void;
  isSending?: boolean;
}

export function HomeHero({ tenant, onSend, isSending = false }: HomeHeroProps) {
  const user = useTenantAuth();
  const [now, setNow] = useState(() => new Date());
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Live clock — updates every minute so the greeting + time stays current
  // without forcing a re-render every second (which would jitter the layout).
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const tz = tenant?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
  const firstName = user?.firstName ?? 'Commander';
  const tenantName = tenant?.name ?? 'your workspace';
  const accentName = `${tenantName} AI`;

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || isSending) return;
    onSend?.(trimmed);
    setMessage('');
  };

  const fillChip = (chip: string) => {
    setMessage(chip);
    // Focus the input so the user can refine before sending.
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      aria-label="Home greeting and AI prompt"
      className="hero-gradient -mx-6 -mt-6 px-6 pt-8 pb-10 mb-6 border-b border-surface-border"
    >
      <div className="max-w-5xl mx-auto flex flex-col items-center text-center">
        {/* Live date + time pill (Creatio clock badge style). */}
        <div className="inline-flex items-center gap-2 rounded-full border border-surface-border bg-surface-raised/70 backdrop-blur-sm px-3 py-1.5 text-xs text-zinc-400 mb-5">
          <span className="w-2 h-2 rounded-full bg-[color:var(--state-success)] shrink-0" aria-hidden />
          <span suppressHydrationWarning className="font-medium text-zinc-300">{currentWeekday(tz)}</span>
          <span aria-hidden className="text-zinc-600">·</span>
          <time suppressHydrationWarning className="font-mono font-bold text-[color:var(--visual-accent-cyan-400)] tabular-nums">
            {currentTime(tz)}
          </time>
          <span aria-hidden className="text-zinc-600">—</span>
          <span suppressHydrationWarning className="text-zinc-400">{currentMonthYear(tz)}</span>
        </div>

        <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
          <span className="text-zinc-100">{greeting(now.getHours())}, </span>
          <span
            className="bg-gradient-to-r from-violet-400 via-purple-400 to-pink-400 bg-clip-text text-transparent"
          >
            {firstName}
          </span>
        </h1>

        <p className="mt-3 text-sm md:text-base text-zinc-400 max-w-2xl">
          Your intelligent workspace is ready. What would you like to achieve today?
        </p>

        {/* AI prompt input — disabled when sending or when no onSend handler. */}
        <form
          onSubmit={handleSubmit}
          className="mt-6 w-full max-w-2xl flex items-center gap-2 rounded-2xl border border-surface-border bg-surface-raised/80 backdrop-blur px-4 py-3 shadow-creatio-md focus-within:border-accent-500 transition-colors"
        >
          <Sparkles className="w-4 h-4 text-accent-500 shrink-0" aria-hidden />
          <label htmlFor="home-ai-prompt" className="sr-only">
            Ask any agent or department
          </label>
          <input
            id="home-ai-prompt"
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ask any agent or department..."
            className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 outline-none"
            autoComplete="off"
            disabled={isSending}
          />
          <button
            type="submit"
            disabled={!message.trim() || isSending}
            aria-label={`Send message to ${accentName}`}
            className="flex items-center justify-center w-9 h-9 rounded-lg bg-accent-500 hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed text-white transition shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* Suggestion chips — Creatio pattern of pre-built prompt shortcuts. */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {SUGGESTION_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => fillChip(chip)}
              className="inline-flex items-center gap-1.5 rounded-full border border-surface-border bg-surface-raised/60 hover:border-accent-500 hover:text-accent-500 px-3 py-1.5 text-xs text-zinc-400 transition"
            >
              <span className="text-accent-500" aria-hidden>›</span>
              {chip}
            </button>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
