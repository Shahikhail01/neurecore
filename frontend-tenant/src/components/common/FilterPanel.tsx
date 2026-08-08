'use client';

/**
 * FilterPanel — Collapsible filter sidebar (Phase 8)
 *
 * SOLID Principles:
 * - S: Single responsibility (render filter controls)
 * - O: Open/Closed - extensible via custom filter fields
 * - L: Liskov Substitution - works as sidebar or drawer
 * - I: Interface Segregation - minimal required props
 * - D: Dependency Inversion - depends on filter abstraction
 *
 * Features:
 *   - Collapsible sections (Filters, Date Range, etc.)
 *   - Text search field
 *   - Multiple select filters
 *   - Date range picker
 *   - Clear filters button
 *   - Responsive (drawer on mobile, sidebar on desktop)
 */

import { useState, type ReactNode } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

export interface FilterField {
    /** Filter key */
    id: string;
    /** Display label */
    label: string;
    /** Filter type */
    type: 'text' | 'select' | 'multiselect' | 'date' | 'daterange';
    /** Options for select/multiselect */
    options?: Array<{ value: string | number; label: string }>;
    /** Current value */
    value?: string | string[] | number;
    /** Change handler */
    onChange: (value: any) => void;
    /** Placeholder text */
    placeholder?: string;
}

export interface FilterPanelProps {
    /** Filter fields */
    fields: FilterField[];
    /** Show/hide panel */
    open?: boolean;
    /** Toggle panel */
    onToggle?: (open: boolean) => void;
    /** Clear all filters */
    onClear?: () => void;
    /** Apply filters (optional, auto-apply if undefined) */
    onApply?: () => void;
    /** Panel title */
    title?: string;
    /** Responsive mode ('sidebar' | 'drawer') */
    mode?: 'sidebar' | 'drawer';
    /** Panel CSS class */
    className?: string;
}

/**
 * FilterPanel — Collapsible sidebar with filter controls
 *
 * @example
 * const [filters, setFilters] = useState({ status: '', search: '' });
 *
 * <FilterPanel
 *   open={panelOpen}
 *   onToggle={setPanelOpen}
 *   fields={[
 *     {
 *       id: 'search',
 *       label: 'Search',
 *       type: 'text',
 *       value: filters.search,
 *       onChange: (v) => setFilters({ ...filters, search: v }),
 *       placeholder: 'Search agents...'
 *     },
 *     {
 *       id: 'status',
 *       label: 'Status',
 *       type: 'multiselect',
 *       options: [
 *         { value: 'active', label: 'Active' },
 *         { value: 'inactive', label: 'Inactive' }
 *       ],
 *       value: filters.status,
 *       onChange: (v) => setFilters({ ...filters, status: v })
 *     }
 *   ]}
 *   onClear={() => setFilters({ status: '', search: '' })}
 * />
 */
export function FilterPanel({
    fields,
    open = true,
    onToggle,
    onClear,
    onApply,
    title = 'Filters',
    mode = 'sidebar',
    className = '',
}: FilterPanelProps) {
    const [expandedSections, setExpandedSections] = useState<Set<string>>(
        new Set(['search']),
    );

    const toggleSection = (id: string) => {
        setExpandedSections((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    // ─── Filter groups ────────────────────────────────────────────────────
    const searchFields = fields.filter((f) => f.type === 'text');
    const selectFields = fields.filter(
        (f) => f.type === 'select' || f.type === 'multiselect',
    );
    const dateFields = fields.filter((f) => f.type === 'date' || f.type === 'daterange');

    const content = (
        <div className="space-y-3">
            {/* Search section */}
            {searchFields.length > 0 && (
                <FilterSection
                    id="search"
                    title="Search"
                    expanded={expandedSections.has('search')}
                    onToggle={() => toggleSection('search')}
                >
                    <div className="space-y-2">
                        {searchFields.map((field) => (
                            <input
                                key={field.id}
                                type="text"
                                aria-label={field.placeholder || field.label || 'Search'}
                                placeholder={field.placeholder || 'Search...'}
                                value={(field.value as string) || ''}
                                onChange={(e) => field.onChange(e.target.value)}
                                className="w-full px-2 py-1 rounded bg-surface-overlay/50 border border-surface-border text-zinc-300 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-accent-500/50 transition"
                            />
                        ))}
                    </div>
                </FilterSection>
            )}

            {/* Select filters section */}
            {selectFields.length > 0 && (
                <FilterSection
                    id="filters"
                    title="Filters"
                    expanded={expandedSections.has('filters')}
                    onToggle={() => toggleSection('filters')}
                >
                    <div className="space-y-3">
                        {selectFields.map((field) => (
                            <div key={field.id}>
                                <label className="text-xs font-medium text-zinc-400 block mb-1">
                                    {field.label}
                                </label>
                                {field.type === 'select' && (
                                    <select
                                        aria-label={field.label}
                                        value={(field.value as string) || ''}
                                        onChange={(e) => field.onChange(e.target.value)}
                                        className="w-full px-2 py-1 rounded bg-surface-overlay/50 border border-surface-border text-zinc-300 focus:outline-none focus:ring-2 focus:ring-accent-500/50 transition"
                                    >
                                        <option value="">All</option>
                                        {field.options?.map((opt) => (
                                            <option key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                )}

                                {field.type === 'multiselect' && (
                                    <div className="space-y-1">
                                        {field.options?.map((opt) => {
                                            const isSelected = Array.isArray(field.value)
                                                ? (field.value as (string | number)[]).includes(opt.value)
                                                : field.value === opt.value;

                                            return (
                                                <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => {
                                                            if (Array.isArray(field.value)) {
                                                                const next = isSelected
                                                                    ? field.value.filter((v) => v !== opt.value)
                                                                    : [...field.value, opt.value];
                                                                field.onChange(next);
                                                            } else {
                                                                field.onChange([opt.value]);
                                                            }
                                                        }}
                                                        className="rounded border-surface-border"
                                                    />
                                                    <span className="text-sm text-zinc-300">
                                                        {opt.label}
                                                    </span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </FilterSection>
            )}

            {/* Date filters section */}
            {dateFields.length > 0 && (
                <FilterSection
                    id="dates"
                    title="Date Range"
                    expanded={expandedSections.has('dates')}
                    onToggle={() => toggleSection('dates')}
                >
                    <div className="space-y-2">
                        {dateFields.map((field) => (
                            <input
                                key={field.id}
                                aria-label={field.label}
                                type={field.type === 'daterange' ? 'text' : 'date'}
                                value={(field.value as string) || ''}
                                onChange={(e) => field.onChange(e.target.value)}
                                className="w-full px-2 py-1 rounded bg-surface-overlay/50 border border-surface-border text-zinc-300 focus:outline-none focus:ring-2 focus:ring-accent-500/50 transition"
                                placeholder={field.placeholder || field.label}
                            />
                        ))}
                    </div>
                </FilterSection>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 pt-2">
                {onApply && (
                    <Button size="sm" variant="primary" onClick={onApply} className="flex-1">
                        Apply
                    </Button>
                )}
                {onClear && (
                    <Button size="sm" variant="secondary" onClick={onClear} className="flex-1">
                        Clear
                    </Button>
                )}
            </div>
        </div>
    );

    // ─── Sidebar mode (always visible) ────────────────────────────────────
    if (mode === 'sidebar') {
        return (
            <div className={cn('w-64 p-4 bg-surface-overlay/50 rounded-lg border border-surface-border', className)}>
                <h3 className="font-semibold text-zinc-200 mb-4">{title}</h3>
                {content}
            </div>
        );
    }

    // ─── Drawer mode (collapsible, mobile-first) ────────────────────────
    return (
        <div className={className}>
            <button
                onClick={() => onToggle?.(!open)}
                className="flex items-center justify-between w-full px-4 py-2 rounded-lg bg-surface-overlay/50 border border-surface-border text-zinc-200 hover:bg-surface-overlay transition"
            >
                <span className="font-medium">{title}</span>
                <ChevronDown
                    className={cn('w-4 h-4 transition', open ? 'rotate-180' : '')}
                />
            </button>

            {open && (
                <div className="mt-2 p-4 rounded-lg bg-surface-overlay/50 border border-surface-border">
                    {content}
                </div>
            )}
        </div>
    );
}

/**
 * FilterSection — Collapsible filter section within panel
 */
function FilterSection({
    id,
    title,
    expanded,
    onToggle,
    children,
}: {
    id: string;
    title: string;
    expanded: boolean;
    onToggle: () => void;
    children: ReactNode;
}) {
    return (
        <div className="border-t border-surface-border/50 pt-2">
            <button
                onClick={onToggle}
                className="flex items-center justify-between w-full py-1 text-sm font-medium text-zinc-300 hover:text-zinc-100 transition"
            >
                {title}
                <ChevronDown
                    className={cn(
                        'w-4 h-4 transition',
                        expanded ? 'rotate-180' : '',
                    )}
                />
            </button>

            {expanded && <div className="mt-2 ml-0">{children}</div>}
        </div>
    );
}

export default FilterPanel;
