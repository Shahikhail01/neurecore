'use client';
// ─── DailyBriefing.tsx ────────────────────────────────────────────────────────
// SRP: Renders the Daily Briefing modal/panel — data via useDailyBriefing().
// OCP: BriefingSectionCard is closed for modification; extend via props.

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDailyBriefing }        from '@/shared/hooks/useDailyBriefing';
import type { BriefingSection }    from '@/core/services/interfaces/IDailyBriefingService';

// ─── Severity color map ───────────────────────────────────────────────────────
const SEVERITY_STYLES: Record<string, string> = {
  positive: 'border-emerald-500/40 bg-emerald-950/30',
  negative: 'border-red-500/40 bg-red-950/30',
  warning:  'border-amber-500/40 bg-amber-950/30',
  neutral:  'border-zinc-700/40 bg-zinc-900/40',
};

const TREND_ICON: Record<string, string> = {
  up:   '↑',
  down: '↓',
  flat: '→',
};

const TREND_COLOR: Record<string, string> = {
  up:   'text-emerald-400',
  down: 'text-red-400',
  flat: 'text-zinc-400',
};

// ─── Section card ─────────────────────────────────────────────────────────────
function BriefingSectionCard({ section, index }: { section: BriefingSection; index: number }) {
  const border = SEVERITY_STYLES[section.severity ?? 'neutral'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.3 }}
      className={`rounded-lg border p-4 ${border}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-sm font-semibold text-zinc-200">{section.title}</h4>
        {section.value != null && (
          <span className="flex items-center gap-1 text-lg font-bold text-indigo-300 shrink-0">
            {section.value}
            {section.valueLabel && (
              <span className="text-xs font-normal text-zinc-400">{section.valueLabel}</span>
            )}
            {section.trend && (
              <span className={`text-sm ${TREND_COLOR[section.trend]}`}>
                {TREND_ICON[section.trend]}
              </span>
            )}
          </span>
        )}
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{section.summary}</p>
    </motion.div>
  );
}

// ─── Score ring ───────────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const radius      = 36;
  const circumference = 2 * Math.PI * radius;
  const dash         = (score / 100) * circumference;
  const color        = score >= 80 ? '#34d399' : score >= 60 ? '#fbbf24' : '#f87171';

  return (
    <svg width="96" height="96" className="shrink-0" viewBox="0 0 96 96">
      <circle cx="48" cy="48" r={radius} fill="none" stroke="#27272a" strokeWidth="8"/>
      <motion.circle
        cx="48" cy="48" r={radius}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${circumference}`}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: circumference - dash }}
        transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
        style={{ transformOrigin: '48px 48px', transform: 'rotate(-90deg)' }}
      />
      <text x="48" y="53" textAnchor="middle" fill={color} fontSize="18" fontWeight="700">{score}</text>
    </svg>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────
interface DailyBriefingModalProps {
  isOpen:    boolean;
  onClose:   () => void;
}

export function DailyBriefingModal({ isOpen, onClose }: DailyBriefingModalProps) {
  const {
    briefing, isLoading, isNarrating, error,
    isSupported, open, refresh, toggleNarration,
  } = useDailyBriefing();

  // Auto-fetch when modal opens
  useEffect(() => {
    if (isOpen) open();
  }, [isOpen, open]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Daily Briefing"
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-zinc-950 shadow-2xl border-l border-zinc-800"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
              <div>
                <h2 className="text-base font-semibold text-zinc-100">Daily Briefing</h2>
                {briefing && (
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {new Date(briefing.date).toLocaleDateString('en-US', {
                      weekday: 'long', month: 'long', day: 'numeric',
                    })}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isSupported && briefing && (
                  <button
                    onClick={toggleNarration}
                    title={isNarrating ? 'Stop narration' : 'Read aloud'}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      isNarrating
                        ? 'bg-indigo-900/60 text-indigo-300 ring-1 ring-indigo-500'
                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    {isNarrating ? '⏹ Stop' : '▶ Read Aloud'}
                  </button>
                )}
                <button
                  onClick={refresh}
                  title="Refresh briefing"
                  className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors"
                  disabled={isLoading}
                >
                  ↺ Refresh
                </button>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="ml-1 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {isLoading && (
                <div className="flex flex-col gap-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 rounded-lg bg-zinc-800/60 animate-pulse" />
                  ))}
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-4 text-sm text-red-400">
                  {error}
                </div>
              )}

              {briefing && !isLoading && (
                <>
                  {/* Headline + score */}
                  <div className="flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                    <ScoreRing score={briefing.overallScore} />
                    <div>
                      <p className="text-sm font-medium text-zinc-100 leading-snug">
                        {briefing.headline}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        Company Score — {briefing.overallScore}/100
                      </p>
                    </div>
                  </div>

                  {/* Sections */}
                  {briefing.sections.map((s, i) => (
                    <BriefingSectionCard key={s.title} section={s} index={i} />
                  ))}

                  {/* Footer timestamp */}
                  <p className="pt-1 text-center text-xs text-zinc-600">
                    Generated at{' '}
                    {new Date(briefing.generatedAt).toLocaleTimeString('en-US', {
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Trigger button ───────────────────────────────────────────────────────────
interface DailyBriefingButtonProps {
  onClick: () => void;
}

export function DailyBriefingButton({ onClick }: DailyBriefingButtonProps) {
  return (
    <button
      onClick={onClick}
      title="Open Daily Briefing"
      className="flex items-center gap-2 rounded-lg bg-indigo-900/40 px-3 py-1.5 text-xs font-medium text-indigo-300 ring-1 ring-indigo-700/50 hover:bg-indigo-900/70 transition-colors"
    >
      <span>☀️</span>
      <span>Daily Briefing</span>
    </button>
  );
}
