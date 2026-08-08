'use client';

/**
 * DetailPanel — Creatio-style slide-in detail panel
 *
 * Phase 2 primitive. Slides in from the right when triggered.
 * Reuses the existing InspectorPanel pattern via Sheet, plus adds
 * tabs (Overview / Activity / Audit) for entity detail pages.
 */

import { type ReactNode, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export interface DetailPanelTab {
  id: string;
  label: string;
  icon?: ReactNode;
  content: ReactNode;
}

export interface DetailPanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  tabs?: DetailPanelTab[];
  defaultTab?: string;
  /** Optional footer action buttons (e.g. Save, Delete). */
  footer?: ReactNode;
  /** Width — defaults to 480px. */
  width?: number;
}

export function DetailPanel({
  open,
  onClose,
  title,
  subtitle,
  tabs,
  defaultTab,
  footer,
  width = 480,
}: DetailPanelProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const activeTabId = defaultTab ?? tabs?.[0]?.id ?? null;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 z-40"
            onClick={onClose}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClose(); } }}
          />

          {/* Panel */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            style={{ width }}
            className="fixed right-0 top-0 bottom-0 z-50 detail-panel flex flex-col"
            role="dialog"
            aria-label={title}
          >
            {/* Header */}
            <header className="flex items-start justify-between gap-3 p-5 border-b border-surface-border">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold text-zinc-100 truncate">{title}</h2>
                {subtitle && (
                  <p className="text-sm text-zinc-500 mt-0.5 truncate">{subtitle}</p>
                )}
              </div>
              <button
                onClick={onClose}
                className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-zinc-500 hover:text-zinc-100 hover:bg-surface-overlay transition"
                aria-label="Close panel"
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            {/* Tabs */}
            {tabs && tabs.length > 0 && (
              <nav className="flex border-b border-surface-border bg-surface-raised px-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      const url = new URL(window.location.href);
                      url.searchParams.set('panelTab', tab.id);
                      window.history.replaceState(null, '', url.toString());
                    }}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
                      activeTabId === tab.id
                        ? 'border-accent-500 text-zinc-100'
                        : 'border-transparent text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </nav>
            )}

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {tabs ? (
                tabs.find((t) => t.id === activeTabId)?.content ?? null
              ) : (
                null
              )}
            </div>

            {/* Footer */}
            {footer && (
              <footer className="flex items-center justify-end gap-2 p-4 border-t border-surface-border">
                {footer}
              </footer>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}