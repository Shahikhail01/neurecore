'use client';

/**
 * RailCustomizeModal — per-user left-rail customization.
 *
 * Lets the user toggle sections (Workspace / Marketplace / Service Desk / …)
 * and individual items on/off. Changes persist to localStorage via the
 * railPreferencesStore and are reflected immediately in the IconRail.
 *
 * "Reset to defaults" restores the canonical 19-link rail.
 *
 * INDUSTRY-SETUP-CONCEPT.md §3.1 G5: previously this modal imported the
 * static `RAIL_SECTIONS` (= `buildRailSections(null)`) and therefore could
 * not toggle industry-specific extras. The modal now accepts the tenant's
 * `industryGroup` as a prop and rebuilds the rail via `buildRailSections`
 * so users see the same items the runtime IconRail renders.
 */

import { useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  RotateCcw,
  Eye,
  EyeOff,
  Check,
  Minus,
} from 'lucide-react';
import { buildRailSections } from '@/components/layout/IconRail';
import { useRailPreferencesStore } from '@/stores/railPreferencesStore';

interface RailCustomizeModalProps {
  open: boolean;
  onClose: () => void;
  /**
   * The tenant's industry-group slug (e.g. "financial-compliance"). When
   * provided, the modal rebuilds the rail with the industry-specific
   * Workspace extras + Customers label/icon. When null/undefined, falls
   * back to the generic 19-link rail.
   */
  industryGroup?: string | null;
}

export function RailCustomizeModal({ open, onClose, industryGroup }: RailCustomizeModalProps) {
  // Read raw state (arrays) so the modal re-renders when toggles change.
// Calling s.isSectionVisible / s.isItemVisible returns a stable function ref
// each time, so Zustand wouldn't notify this component on state change.
  const hiddenSections = useRailPreferencesStore((s) => s.hiddenSections);
  const hiddenItems = useRailPreferencesStore((s) => s.hiddenItems);
  const toggleSection = useRailPreferencesStore((s) => s.toggleSection);
  const toggleItem = useRailPreferencesStore((s) => s.toggleItem);
  const reset = useRailPreferencesStore((s) => s.reset);

  const isSectionVisible = (id: string) => !hiddenSections.includes(id as never);
  const isItemVisible = (id: string) => !hiddenItems.includes(id as never);

  // Industry-aware rail — same builder IconRail uses at runtime, so the
  // toggles the user picks here line up 1:1 with what they actually see.
  const railSections = useMemo(
    () => buildRailSections(industryGroup ?? null),
    [industryGroup],
  );

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const totalVisibleItems = railSections.reduce(
    (acc, s) => acc + (isSectionVisible(s.id) ? s.items.filter((i) => isItemVisible(i.id)).length : 0),
    0,
  );
  const totalItems = railSections.reduce((acc, s) => acc + s.items.length, 0);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label="Customize navigation rail"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60" onClick={onClose} />

          {/* Panel */}
          <motion.div
            className="relative w-full max-w-md card-surface border border-surface-border shadow-creatio-md flex flex-col max-h-[80vh]"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-surface-border">
              <div>
                <h2 className="text-sm font-semibold text-zinc-100">Customize navigation</h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Choose what appears in your left rail. {totalVisibleItems}/{totalItems} links visible.
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-surface-overlay transition"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
              {railSections.map((section) => {
                const sectionVisible = isSectionVisible(section.id);
                const visibleItemCount = section.items.filter((i) => isItemVisible(i.id)).length;
                const sectionHiddenBecauseAllItems =
                  sectionVisible && visibleItemCount === 0;

                return (
                  <div
                    key={section.id}
                    className={`rounded-lg border ${
                      sectionVisible
                        ? 'border-surface-border bg-surface-overlay/30'
                        : 'border-surface-border/40 bg-surface-overlay/10'
                    }`}
                  >
                    {/* Section header */}
                    <button
                      type="button"
                      onClick={() => toggleSection(section.id)}
                      className="w-full flex items-center justify-between gap-3 p-3 text-left"
                      aria-pressed={sectionVisible}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 text-xs font-semibold ${
                            sectionVisible
                              ? 'bg-accent-500/15 text-accent-500'
                              : 'bg-surface-overlay text-zinc-500'
                          }`}
                        >
                          {sectionVisible ? <Check className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-zinc-100 truncate">
                            {section.label ?? section.id.charAt(0).toUpperCase() + section.id.slice(1)}
                          </p>
                          <p className="text-[11px] text-zinc-500">
                            {sectionVisible
                              ? `${visibleItemCount}/${section.items.length} items`
                              : 'Section hidden'}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] uppercase tracking-widest text-zinc-500 shrink-0">
                        {sectionVisible ? 'On' : 'Off'}
                      </span>
                    </button>

                    {/* Per-item toggles — only shown when section is on */}
                    {sectionVisible && section.items.length > 0 && (
                      <div className="border-t border-surface-border/60 px-2 py-1.5 space-y-0.5">
                        {section.items.map((item) => {
                          const Icon = item.icon;
                          const itemVisible = isItemVisible(item.id);
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => toggleItem(item.id)}
                              className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left text-xs transition ${
                                itemVisible
                                  ? 'text-zinc-200 hover:bg-surface-overlay'
                                  : 'text-zinc-500 hover:bg-surface-overlay'
                              }`}
                              aria-pressed={itemVisible}
                            >
                              <Icon className="w-3.5 h-3.5 shrink-0" />
                              <span className="flex-1 truncate">{item.label}</span>
                              <span
                                className={`shrink-0 w-4 h-4 rounded flex items-center justify-center border ${
                                  itemVisible
                                    ? 'bg-accent-500 border-accent-500 text-white'
                                    : 'border-surface-border bg-transparent text-transparent'
                                }`}
                                aria-hidden="true"
                              >
                                <Check className="w-3 h-3" />
                              </span>
                            </button>
                          );
                        })}
                        {sectionHiddenBecauseAllItems && (
                          <p className="text-[11px] text-[color:var(--state-warning)] px-2 py-1">
                            All items hidden — section is effectively invisible.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-2 p-4 border-t border-surface-border">
              <button
                onClick={reset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-zinc-400 hover:text-zinc-100 hover:bg-surface-overlay transition"
                aria-label="Reset to default"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset to defaults
              </button>
              <button
                onClick={onClose}
                className="px-4 py-1.5 rounded-md bg-accent-500 hover:bg-accent-600 text-white text-xs font-medium transition"
              >
                Done
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}