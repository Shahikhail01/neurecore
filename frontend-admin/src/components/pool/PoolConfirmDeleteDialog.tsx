"use client";

/**
 * PoolConfirmDeleteDialog — Phase 10.
 * Reusable confirmation dialog used by every pool's delete action.
 */

import { motion, AnimatePresence } from "framer-motion";

export function PoolConfirmDeleteDialog({
  open,
  title,
  description,
  busy,
  onCancel,
  onConfirm,
  confirmLabel = "Delete",
}: {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
        >
          <motion.div
            initial={{ scale: 0.96 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.96 }}
            className="w-full max-w-sm rounded-2xl border border-red-800/40 bg-surface-raised p-6 shadow-2xl"
          >
            <h3 className="text-base font-semibold text-zinc-100 mb-2">
              {title}
            </h3>
            {description && (
              <div className="text-sm text-zinc-400 mb-5">{description}</div>
            )}
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 py-2 rounded-lg border border-surface-border text-sm text-zinc-400 hover:text-zinc-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={busy}
                className="flex-1 py-2 rounded-lg bg-red-700 hover:bg-[color:var(--state-danger)] text-white text-sm font-medium transition disabled:opacity-50"
              >
                {busy ? "Working…" : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
