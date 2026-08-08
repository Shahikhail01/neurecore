'use client';

/**
 * UnifiedDataTable — Consolidated table component (Phase 8)
 *
 * SOLID Principles:
 * - S: Single responsibility (render data table with features)
 * - O: Open/Closed - extensible via feature flags, closed for modification
 * - L: Liskov Substitution - replaces both DataTable + EntityTable seamlessly
 * - I: Interface Segregation - optional features via flags
 * - D: Dependency Inversion - depends on column/action abstractions
 *
 * Merges concerns from:
 *   - DataTable (pagination, sorting)
 *   - EntityTable (bulk actions, selection)
 *
 * Features:
 *   - Selectable rows (checkbox column)
 *   - Bulk actions bar (when rows selected)
 *   - Sortable columns (click header)
 *   - Pagination (limit + offset)
 *   - Row click handlers
 *   - Loading skeleton rows
 *   - Empty/error states
 *   - Responsive horizontal scroll
 */

import { useState, useCallback, useMemo, type ReactNode } from 'react';
import { ChevronUp, ChevronDown, Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '../common/Button';
import { SkeletonTable } from '../common/Skeleton';
import { EmptyState, ErrorState } from '../common/StateDisplay';

export interface ColumnDef<T> {
    /** Unique column key */
    key: keyof T;
    /** Display header label */
    label: string;
    /** Render cell value (optional) */
    render?: (value: any, row: T, index: number) => ReactNode;
    /** Column width (tailwind: w-16, w-32, etc.) */
    width?: string;
    /** Allow sorting by this column */
    sortable?: boolean;
    /** Align cell content */
    align?: 'left' | 'center' | 'right';
}

export interface PaginationConfig {
    /** Current page (1-indexed) */
    page: number;
    /** Items per page */
    limit: number;
    /** Total items count */
    total: number;
    /** Callback when page changes */
    onPage: (page: number) => void;
    /** Callback when limit changes */
    onLimit?: (limit: number) => void;
}

export interface BulkAction<T> {
    /** Action label */
    label: string;
    /** Visual variant */
    variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning';
    /** Called with selected rows */
    onClick: (rows: T[]) => void | Promise<void>;
    /** Disable action if condition met */
    disabled?: (rows: T[]) => boolean;
}

export interface UnifiedDataTableProps<T extends { id?: string | number }> {
    /** Columns definition */
    columns: ColumnDef<T>[];
    /** Table data rows */
    data: T[];
    /** Loading state (shows skeleton) */
    loading?: boolean;
    /** Error state message */
    error?: string;
    /** Empty state rendered when no data */
    renderEmpty?: () => ReactNode;
    /** Row click handler */
    onRowClick?: (row: T, index: number) => void;
    /** Enable row selection checkbox */
    selectable?: boolean;
    /** Bulk actions when rows selected */
    bulkActions?: BulkAction<T>[];
    /** Pagination config (optional) */
    pagination?: PaginationConfig;
    /** Current sort column */
    sortBy?: keyof T;
    /** Sort direction */
    sortDir?: 'asc' | 'desc';
    /** Sort change handler */
    onSort?: (column: keyof T) => void;
    /** Table CSS class */
    className?: string;
}

/**
 * UnifiedDataTable — Consolidated table with selection + actions + sorting
 *
 * @example
 * <UnifiedDataTable
 *   columns={[
 *     { key: 'name', label: 'Name', sortable: true },
 *     { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> }
 *   ]}
 *   data={agents}
 *   selectable={true}
 *   bulkActions={[
 *     { label: 'Delete', variant: 'danger', onClick: (rows) => deleteMany(rows) }
 *   ]}
 *   pagination={{ page, limit, total, onPage }}
 *   sortBy="name"
 *   sortDir="asc"
 *   onSort={handleSort}
 * />
 */
export function UnifiedDataTable<T extends { id?: string | number }>({
    columns,
    data,
    loading = false,
    error,
    renderEmpty,
    onRowClick,
    selectable = false,
    bulkActions = [],
    pagination,
    sortBy,
    sortDir = 'asc',
    onSort,
    className = '',
}: UnifiedDataTableProps<T>) {
    // ─── Local selection state ────────────────────────────────────────────
    const [selectedRows, setSelectedRows] = useState<Set<string | number>>(
        new Set(),
    );

    // ─── Selection handlers ───────────────────────────────────────────────
    const isRowSelected = useCallback(
        (row: T) => selectedRows.has(row.id ?? Math.random()),
        [selectedRows],
    );

    const isAllSelected = useMemo(
        () => data.length > 0 && data.every((row) => isRowSelected(row)),
        [data, isRowSelected],
    );

    const isPartialSelected = useMemo(
        () =>
            selectedRows.size > 0 && selectedRows.size < data.length,
        [selectedRows.size, data.length],
    );

    const toggleRowSelection = useCallback(
        (row: T) => {
            const rowId = row.id ?? Math.random();
            setSelectedRows((prev) => {
                const next = new Set(prev);
                if (next.has(rowId)) {
                    next.delete(rowId);
                } else {
                    next.add(rowId);
                }
                return next;
            });
        },
        [],
    );

    const toggleAllSelection = useCallback(() => {
        if (isAllSelected) {
            setSelectedRows(new Set());
        } else {
            setSelectedRows(new Set(data.map((r) => r.id ?? Math.random())));
        }
    }, [isAllSelected, data]);

    const selectedData = useMemo(
        () => data.filter((row) => isRowSelected(row)),
        [data, isRowSelected],
    );

    // ─── Render loading state ──────────────────────────────────────────────
    if (loading) {
        return <SkeletonTable rows={pagination?.limit ?? 5} />;
    }

    // ─── Render error state ────────────────────────────────────────────────
    if (error) {
        return (
            <ErrorState
                icon={<span>⚠️</span>}
                title="Failed to load data"
                description={error}
            />
        );
    }

    // ─── Render empty state ────────────────────────────────────────────────
    if (data.length === 0) {
        return (
            renderEmpty?.() ?? (
                <EmptyState
                    icon={<span>📋</span>}
                    title="No data"
                    description="No records found"
                />
            )
        );
    }

    return (
        <>
            {/* Bulk actions bar (when rows selected) */}
            {selectable && selectedRows.size > 0 && bulkActions.length > 0 && (
                <div className="mb-4 p-3 rounded-lg bg-accent-500/10 border border-accent-500/30 flex items-center justify-between">
                    <span className="text-sm font-medium text-zinc-200">
                        {selectedRows.size} selected
                    </span>
                    <div className="flex gap-2">
                        {bulkActions.map((action, i) => (
                            <Button
                                key={i}
                                size="sm"
                                variant={action.variant ?? 'secondary'}
                                disabled={action.disabled?.(selectedData)}
                                onClick={() => action.onClick(selectedData)}
                            >
                                {action.label}
                            </Button>
                        ))}
                    </div>
                </div>
            )}

            {/* Table */}
            <div className={cn('overflow-x-auto', className)}>
                <table className="w-full border-collapse">
                    {/* Header */}
                    <thead>
                        <tr className="border-b border-surface-border bg-surface-overlay/50">
                            {/* Checkbox column */}
                            {selectable && (
                                <th className="w-10 px-3 py-2 text-left">
                                    <button
                                        onClick={toggleAllSelection}
                                        className="inline-flex items-center justify-center min-w-[24px] min-h-[24px] w-5 h-5 rounded border border-surface-border hover:bg-surface-overlay transition"
                                        aria-label="Select all"
                                    >
                                        {isAllSelected ? (
                                            <Check className="w-3 h-3 text-accent-500" />
                                        ) : isPartialSelected ? (
                                            <Minus className="w-3 h-3 text-accent-500" />
                                        ) : null}
                                    </button>
                                </th>
                            )}

                            {/* Column headers */}
                            {columns.map((col) => (
                                <th
                                    key={String(col.key)}
                                    className={cn(
                                        'px-4 py-2 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wide',
                                        col.width,
                                    )}
                                >
                                    <button
                                        onClick={() => col.sortable && onSort?.(col.key)}
                                        className={cn(
                                            'flex items-center gap-1 hover:text-zinc-200 transition',
                                            col.sortable ? 'cursor-pointer' : 'cursor-default',
                                        )}
                                    >
                                        {col.label}
                                        {col.sortable && sortBy === col.key && (
                                            <span className="text-accent-500">
                                                {sortDir === 'asc' ? (
                                                    <ChevronUp className="w-3 h-3" />
                                                ) : (
                                                    <ChevronDown className="w-3 h-3" />
                                                )}
                                            </span>
                                        )}
                                    </button>
                                </th>
                            ))}
                        </tr>
                    </thead>

                    {/* Body */}
                    <tbody>
                        {data.map((row, i) => (
                            <tr
                                key={row.id ?? i}
                                className={cn(
                                    'border-b border-surface-border/50 hover:bg-surface-overlay/50 transition',
                                    onRowClick ? 'cursor-pointer' : '',
                                )}
                                onClick={() => onRowClick?.(row, i)}
                                onKeyDown={(e) => { if (onRowClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onRowClick(row, i); } }}
                                tabIndex={onRowClick ? 0 : undefined}
                                role={onRowClick ? 'button' : undefined}
                            >
                                {/* Checkbox column */}
                                {selectable && (
                                    <td className="w-10 px-3 py-2" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); } }}>
                                        <button
                                            onClick={() => toggleRowSelection(row)}
                                            className="inline-flex items-center justify-center min-w-[24px] min-h-[24px] w-5 h-5 rounded border border-surface-border hover:bg-surface-overlay transition"
                                            aria-label={`Select row ${i + 1}`}
                                        >
                                            {isRowSelected(row) && (
                                                <Check className="w-3 h-3 text-accent-500" />
                                            )}
                                        </button>
                                    </td>
                                )}

                                {/* Data cells */}
                                {columns.map((col) => (
                                    <td
                                        key={String(col.key)}
                                        className={cn(
                                            'px-4 py-2 text-sm text-zinc-300',
                                            col.align === 'center' && 'text-center',
                                            col.align === 'right' && 'text-right',
                                        )}
                                    >
                                        {col.render
                                            ? col.render(row[col.key], row, i)
                                            : String(row[col.key] ?? '—')}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination controls */}
            {pagination && (
                <div className="mt-4 flex items-center justify-between px-2 py-2">
                    <div className="text-sm text-zinc-500">
                        Showing {(pagination.page - 1) * pagination.limit + 1}–
                        {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                        {pagination.total}
                    </div>

                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            variant="secondary"
                            disabled={pagination.page === 1}
                            onClick={() => pagination.onPage(pagination.page - 1)}
                        >
                            ← Previous
                        </Button>

                        {Array.from(
                            { length: Math.ceil(pagination.total / pagination.limit) },
                            (_, i) => i + 1,
                        )
                            .slice(
                                Math.max(0, pagination.page - 2),
                                Math.min(
                                    pagination.page + 1,
                                    Math.ceil(pagination.total / pagination.limit),
                                ),
                            )
                            .map((pageNum) => (
                                <Button
                                    key={pageNum}
                                    size="sm"
                                    variant={
                                        pageNum === pagination.page ? 'primary' : 'secondary'
                                    }
                                    onClick={() => pagination.onPage(pageNum)}
                                >
                                    {pageNum}
                                </Button>
                            ))}

                        <Button
                            size="sm"
                            variant="secondary"
                            disabled={
                                pagination.page ===
                                Math.ceil(pagination.total / pagination.limit)
                            }
                            onClick={() => pagination.onPage(pagination.page + 1)}
                        >
                            Next →
                        </Button>
                    </div>
                </div>
            )}
        </>
    );
}

export default UnifiedDataTable;
