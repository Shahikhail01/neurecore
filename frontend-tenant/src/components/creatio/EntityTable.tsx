'use client';

/**
 * EntityTable — Creatio-style data table with bulk actions
 *
 * Phase 2 primitive. Wraps the existing DataTable with Creatio features:
 *   - Sticky header
 *   - Bulk action toolbar (slot for ActionToolbar)
 *   - Status pill column support
 *   - Selection state + indeterminate checkbox
 *   - Loading skeleton + empty state
 *
 * Built on the existing DataTable for backward compatibility.
 */

import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';

export interface ColumnDef<T> {
  key: string;
  header: string;
  accessor: (row: T) => React.ReactNode;
  width?: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
}

interface PaginationProps {
  page: number;
  total: number;
  limit: number;
  onPage: (p: number) => void;
}

interface EntityTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  loading?: boolean;
  onRowClick?: (row: T) => void;
  renderEmpty?: () => ReactNode;
  pagination?: PaginationProps;
  className?: string;
  /** Phase 2 — bulk actions toolbar shown when rows selected. */
  bulkActions?: (selectedIds: string[]) => ReactNode;
  /** Phase 2 — get row id (defaults to `row.id`). */
  getRowId?: (row: T) => string;
}

function TableSkeleton({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="animate-pulse">
          {Array.from({ length: cols + 1 }).map((__, j) => (
            <td key={j} className="px-4 py-3">
              <div
                className="h-3 bg-surface-muted rounded"
                style={{ width: `${50 + (j * 15) % 40}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function EntityTable<T extends { id?: string }>({
  columns,
  data,
  loading = false,
  onRowClick,
  renderEmpty,
  pagination,
  className = '',
  bulkActions,
  getRowId = (row) => row.id ?? '',
}: EntityTableProps<T>) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const totalPages = pagination ? Math.ceil(pagination.total / pagination.limit) : 1;

  const toggleRow = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (selected.size === data.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(data.map((r) => getRowId(r))));
    }
  };

  const allSelected = data.length > 0 && selected.size === data.length;
  const someSelected = selected.size > 0 && selected.size < data.length;

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Bulk actions toolbar — shown when rows selected */}
      <AnimatePresence>
        {selected.size > 0 && bulkActions && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-3 p-3 card-surface border-accent-500/40 bg-accent-500/5"
          >
            <span className="text-sm font-medium text-zinc-300">
              {selected.size} selected
            </span>
            <div className="flex-1">{bulkActions(Array.from(selected))}</div>
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1"
            >
              Clear
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <div className="card-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border bg-surface-raised sticky top-0 z-10">
                {bulkActions && (
                  <th className="w-10 px-4 py-3">
                    <button
                      onClick={toggleAll}
                      className={`w-4 h-4 rounded border flex items-center justify-center transition ${
                        allSelected
                          ? 'bg-accent-500 border-accent-500'
                          : someSelected
                          ? 'bg-accent-500/40 border-accent-500'
                          : 'border-surface-muted hover:border-accent-500'
                      }`}
                      aria-label="Select all"
                    >
                      {allSelected && <Check className="w-3 h-3 text-white" />}
                      {someSelected && <span className="block w-2 h-0.5 bg-white rounded" />}
                    </button>
                  </th>
                )}
                {columns.map((col) => (
                  <th
                    key={col.key}
                    style={{ width: col.width }}
                    className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 ${
                      col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                    }`}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSkeleton cols={columns.length} />
              ) : data.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + (bulkActions ? 1 : 0)}
                    className="px-4 py-12 text-center text-zinc-500"
                  >
                    {renderEmpty ? renderEmpty() : 'No data'}
                  </td>
                </tr>
              ) : (
                data.map((row, idx) => {
                  const id = getRowId(row);
                  const isSelected = selected.has(id);
                  return (
                    <motion.tr
                      key={id || idx}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.02, duration: 0.15 }}
                      onClick={() => onRowClick?.(row)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick?.(row); } }}
                      className={`border-b border-surface-border transition-colors ${
                        onRowClick ? 'cursor-pointer hover:bg-surface-overlay' : ''
                      } ${isSelected ? 'bg-accent-500/5' : ''}`}
                    >
                      {bulkActions && (
                        <td className="px-4 py-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleRow(id);
                            }}
                            className={`w-4 h-4 rounded border flex items-center justify-center transition ${
                              isSelected
                                ? 'bg-accent-500 border-accent-500'
                                : 'border-surface-muted hover:border-accent-500'
                            }`}
                            aria-label="Select row"
                          >
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </button>
                        </td>
                      )}
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={`px-4 py-3 ${
                            col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                          }`}
                        >
                          {col.accessor(row)}
                        </td>
                      ))}
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between px-2 py-1 text-xs text-zinc-500">
          <span>
            Page {pagination.page} of {totalPages} ({pagination.total} total)
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={pagination.page === 1}
              onClick={() => pagination.onPage(pagination.page - 1)}
              className="px-3 py-1.5 rounded border border-surface-border hover:border-accent-500 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Prev
            </button>
            <button
              disabled={pagination.page >= totalPages}
              onClick={() => pagination.onPage(pagination.page + 1)}
              className="px-3 py-1.5 rounded border border-surface-border hover:border-accent-500 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}