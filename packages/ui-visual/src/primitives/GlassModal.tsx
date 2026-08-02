'use client';

/**
 * GlassModal — the ONLY modal surface in the monorepo.
 *
 * SOLID: SRP — modal chrome (backdrop, animation, body-scroll lock, ESC).
 * SOLID: LSP — equivalent to legacy Modal props + adds `accent` variant.
 *
 * Consumers (CreateTaskForm etc.) drop-in replace `<Modal>` with
 * `<GlassModal>`; their bodies don't change.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import type { AccentPalette } from '../tokens/palette';
import { DEFAULT_ACCENT } from '../tokens/palette';

export interface GlassModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  accent?: AccentPalette;
  /** Custom close icon. Defaults to a built-in X glyph (no icon-lib dep). */
  closeIcon?: ReactNode;
}

const SIZE_CLASS: Record<NonNullable<GlassModalProps['size']>, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

export function GlassModal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  accent = DEFAULT_ACCENT,
  closeIcon,
}: GlassModalProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-49"
            onClick={onClose}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              ref={ref}
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className={clsx(
                'pointer-events-auto w-full',
                SIZE_CLASS[size],
                'nv-surface-modal flex flex-col max-h-[90vh]',
              )}
              style={{
                boxShadow:
                  '0 25px 50px -12px rgb(0 0 0 / 0.5), 0 0 60px -10px var(--visual-glow-' +
                  accent +
                  ')',
              }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="glass-modal-title"
            >
              <div className="flex items-start justify-between gap-4 p-5 border-b border-white/10">
                <div className="min-w-0 flex-1">
                  <h2
                    id="glass-modal-title"
                    className="text-base font-semibold text-zinc-100 truncate"
                  >
                    {title}
                  </h2>
                  {description && (
                    <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-zinc-400 hover:text-zinc-200 transition-colors"
                  aria-label="Close"
                >
                  {closeIcon ?? (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  )}
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5">{children}</div>
              {footer && (
                <div className="border-t border-white/10 p-4 flex items-center justify-end gap-2">
                  {footer}
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}