'use client';

import { motion, AnimatePresence } from 'framer-motion';

type Variant = 'danger' | 'warning';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  busy?: boolean;
  variant?: Variant;
  onCancel: () => void;
  onConfirm: () => void;
}

const STYLES: Record<Variant, { border: string; button: string }> = {
  danger: {
    border: 'border-red-800/40',
    button: 'bg-red-700 hover:bg-[color:var(--state-danger)]',
  },
  warning: {
    border: 'border-amber-800/40',
    button: 'bg-amber-700 hover:bg-[color:var(--state-warning)]',
  },
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  busy,
  variant = 'danger',
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const s = STYLES[variant];

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
            className={`w-full max-w-sm rounded-2xl border ${s.border} bg-surface-raised p-6 shadow-2xl`}
          >
            <h3 className="text-base font-semibold text-zinc-100 mb-2">{title}</h3>
            {description && (
              <div className="text-sm text-zinc-400 mb-5 leading-relaxed">{description}</div>
            )}
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                disabled={busy}
                className="flex-1 py-2 rounded-lg border border-surface-border text-sm text-zinc-400 hover:text-zinc-200 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={busy}
                className={`flex-1 py-2 rounded-lg text-white text-sm font-medium transition disabled:opacity-50 ${s.button}`}
              >
                {busy ? 'Working…' : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
