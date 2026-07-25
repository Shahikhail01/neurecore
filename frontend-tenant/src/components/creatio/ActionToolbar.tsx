'use client';

/**
 * ActionToolbar — Creatio-style action button group
 *
 * Phase 2 primitive. Wraps the existing Button component with:
 *   - Primary / secondary / danger / ghost variants (Creatio-style)
 *   - Inline action group (left-aligned + right-aligned groups)
 *   - Optional loading state per button
 *   - Icon-only mode for compact toolbars
 */

import { type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export type ActionVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
export type ActionSize = 'sm' | 'md' | 'lg';

export interface ActionButtonProps {
  variant?: ActionVariant;
  size?: ActionSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  iconOnly?: boolean;
  children?: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
}

const VARIANT_CLASS: Record<ActionVariant, string> = {
  primary:
    'bg-accent-500 hover:bg-accent-600 active:bg-accent-700 text-white border border-transparent shadow-creatio-sm',
  secondary:
    'bg-surface-overlay hover:bg-surface-border text-zinc-100 border border-surface-border',
  danger:
    'bg-state-danger hover:bg-[color:var(--state-danger)] active:bg-red-700 text-white border border-transparent shadow-creatio-sm',
  ghost:
    'bg-transparent hover:bg-surface-overlay text-zinc-300 hover:text-zinc-100 border border-transparent',
  outline:
    'bg-transparent hover:bg-accent-500/10 text-accent-500 border border-accent-500/50 hover:border-accent-500',
};

const SIZE_CLASS: Record<ActionSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-4 text-sm',
  lg: 'h-11 px-6 text-base',
};

const ICON_SIZE: Record<ActionSize, string> = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

export function ActionButton({
  variant = 'secondary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconOnly = false,
  children,
  onClick,
  type = 'button',
  className = '',
}: ActionButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${VARIANT_CLASS[variant]} ${SIZE_CLASS[size]} ${className}`}
    >
      {loading ? (
        <Loader2 className={`${ICON_SIZE[size]} animate-spin`} />
      ) : icon ? (
        <span className={ICON_SIZE[size]}>{icon}</span>
      ) : null}
      {!iconOnly && children}
    </button>
  );
}

export interface ActionToolbarProps {
  /** Left-aligned actions (e.g. bulk actions when rows selected). */
  left?: ReactNode;
  /** Right-aligned actions (e.g. primary CTA + secondary actions). */
  right?: ReactNode;
  /** Optional separator / status text between left and right. */
  center?: ReactNode;
  className?: string;
}

/**
 * ActionToolbar — horizontal action bar used above tables, forms, and
 * page-level CTAs. Left/right slots allow consistent alignment.
 */
export function ActionToolbar({ left, right, center, className = '' }: ActionToolbarProps) {
  if (!left && !right && !center) return null;
  return (
    <div className={`flex items-center justify-between gap-3 px-1 ${className}`}>
      <div className="flex items-center gap-2">{left}</div>
      {center && <div className="flex-1 flex items-center justify-center">{center}</div>}
      <div className="flex items-center gap-2">{right}</div>
    </div>
  );
}