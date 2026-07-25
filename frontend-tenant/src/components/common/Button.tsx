'use client';

/**
 * Button — Unified button component (Phase 7)
 *
 * SOLID Principles:
 * - S (Single Responsibility): Single purpose (render button with variants)
 * - O (Open/Closed): Extensible via variants prop; closed for modification
 * - L (Liskov Substitution): Fully compatible with native button element
 * - I (Interface Segregation): Minimal required props; optional features
 * - D (Dependency Inversion): Depends on abstractions (variants), not concrete impls
 *
 * Consolidates:
 *   - creatio/ActionButton (primary, secondary, danger, ghost, outline variants)
 *   - ui/button (default, destructive, outline, secondary, ghost, link variants)
 *
 * Features:
 *   - 7 semantic variants (primary, secondary, danger, success, warning, ghost, outline)
 *   - 3 sizes (sm, md, lg)
 *   - Built-in loading state
 *   - Disabled state handling
 *   - Optional icon support
 *   - Full TypeScript support
 *   - Accessibility (aria-busy, aria-disabled)
 */

import { type ReactNode, forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'warning' | 'ghost' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    /** Visual style variant */
    variant?: ButtonVariant;
    /** Button size */
    size?: ButtonSize;
    /** Show loading spinner and disable button */
    loading?: boolean;
    /** Optional icon to display before text */
    icon?: ReactNode;
    /** Hide text, show only icon (requires icon prop) */
    iconOnly?: boolean;
    /** Stretch button to full width */
    fullWidth?: boolean;
}

// ─── Variant class mappings (extensible for future variants) ──────────────
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
    primary:
        'bg-accent-500 hover:bg-accent-600 active:bg-accent-700 text-white border border-transparent shadow-sm',
    secondary:
        'bg-surface-overlay hover:bg-surface-border text-zinc-100 border border-surface-border',
    danger:
        'bg-state-danger hover:bg-[color:var(--state-danger)] active:bg-red-700 text-white border border-transparent shadow-sm',
    success:
        'bg-state-success hover:bg-[color:var(--state-success)] active:bg-green-700 text-white border border-transparent shadow-sm',
    warning:
        'bg-state-warning hover:bg-[color:var(--state-warning)] active:bg-amber-700 text-white border border-transparent shadow-sm',
    ghost:
        'bg-transparent hover:bg-surface-overlay text-zinc-300 hover:text-zinc-100 border border-transparent',
    outline:
        'bg-transparent hover:bg-accent-500/10 text-accent-500 border border-accent-500/50 hover:border-accent-500',
};

// ─── Size class mappings ──────────────────────────────────────────────────
const SIZE_CLASSES: Record<ButtonSize, string> = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-9 px-4 text-sm',
    lg: 'h-11 px-6 text-base',
};

// ─── Icon size mappings ──────────────────────────────────────────────────
const ICON_SIZES: Record<ButtonSize, string> = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
};

// ─── Base classes (common to all buttons) ────────────────────────────────
const BASE_CLASSES =
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface';

/**
 * Button — Unified button component
 *
 * @example
 * // Primary button
 * <Button variant="primary">Click me</Button>
 *
 * @example
 * // With icon and loading
 * <Button icon={<SaveIcon />} loading={saving}>Save</Button>
 *
 * @example
 * // Icon-only button
 * <Button icon={<DeleteIcon />} iconOnly variant="danger" size="sm" />
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            variant = 'secondary',
            size = 'md',
            loading = false,
            icon,
            iconOnly = false,
            fullWidth = false,
            disabled = false,
            className,
            children,
            ...props
        },
        ref,
    ) => {
        // ─── Compute classes with SOLID principles ─────────────────────────────
        const variantClass = VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.secondary;
        const sizeClass = SIZE_CLASSES[size] ?? SIZE_CLASSES.md;
        const iconSize = ICON_SIZES[size] ?? ICON_SIZES.md;
        const fullWidthClass = fullWidth ? 'w-full' : '';

        return (
            <button
                ref={ref}
                type="button"
                disabled={disabled || loading}
                aria-busy={loading}
                aria-disabled={disabled || loading}
                className={cn(
                    BASE_CLASSES,
                    variantClass,
                    sizeClass,
                    fullWidthClass,
                    className,
                )}
                {...props}
            >
                {loading ? (
                    <Loader2 className={cn(iconSize, 'animate-spin')} />
                ) : icon ? (
                    <span className={iconSize}>{icon}</span>
                ) : null}

                {!iconOnly && children}
            </button>
        );
    },
);

Button.displayName = 'Button';

export default Button;
