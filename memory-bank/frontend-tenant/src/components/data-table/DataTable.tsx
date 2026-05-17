'use client';
// ─── Data Table ───────────────────────────────────────────────────────────────
// L — Liskov: generic over row type T, all usages are substitutable
// O — Open/Closed: new columns/renderers added via ColumnDef without modifying table
import { motion } from 'framer-motion';

export interface ColumnDef<T> {
  key: string;
  header: string;
  accessor: (row: T) => React.ReactNode;
  width?: string;
  sortable?: boolean;
}

interface PaginationProps {
  page: number;
  total: number;
  limit: number;
  onPage: (p: number) => void;
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  loading?: boolean;
  onRowClick?: (row: T) => void;
  renderEmpty?: () => React.ReactNode;
  pagination?: PaginationProps;
  className?: string;
}

function TableSkeleton({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="animate-pulse">
          {Array.from({ length: cols }).map((__, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-3 bg-surface-muted rounded" style={{ width: `${50 + (j * 15) % 40}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function DataTable<T extends { id?: string }>({
  columns,
  data,
  loading = false,
  onRowClick,
  renderEmpty,
  pagination,
  className = '',
}: DataTableProps<T>) {
  const totalPages = pagination ? Math.ceil(pagination.total / pagination.limit) : 1;

  return (
    <div className={`flex flex-col gap-0 ${className}`}>
      <div className="overflow-x-auto rounded-xl border border-surface-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border bg-surface-raised">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500"
                  style={col.width ? { width: col.width } : undefined}
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
                <td colSpan={columns.length} className="px-4 py-12 text-center text-zinc-600">
                  {renderEmpty ? renderEmpty() : 'No data found.'}
                </td>
              </tr>
            ) : (
              data.map((row, i) => (
                <motion.tr
                  key={(row as { id?: string }).id ?? i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className={`border-b border-surface-border/60 transition-colors ${onRowClick ? 'cursor-pointer hover:bg-surface-raised' : ''}`}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3 text-zinc-300">
                      {col.accessor(row)}
                    </td>
                  ))}
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between px-1 pt-3">
          <span className="text-xs text-zinc-600">
            {(pagination.page - 1) * pagination.limit + 1}–
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </span>
          <div className="flex gap-1">
            <button
              disabled={pagination.page === 1}
              onClick={() => pagination.onPage(pagination.page - 1)}
              className="px-3 py-1 text-xs rounded-lg border border-surface-border bg-surface-raised text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              ← Prev
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, k) => {
              const p = Math.max(1, Math.min(totalPages - 4, pagination.page - 2)) + k;
              return (
                <button
                  key={p}
                  onClick={() => pagination.onPage(p)}
                  className={`w-8 h-7 text-xs rounded-lg border transition-colors ${
                    p === pagination.page
                      ? 'border-status-ops bg-status-ops/15 text-status-ops'
                      : 'border-surface-border bg-surface-raised text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {p}
                </button>
              );
            })}
            <button
              disabled={pagination.page === totalPages}
              onClick={() => pagination.onPage(pagination.page + 1)}
              className="px-3 py-1 text-xs rounded-lg border border-surface-border bg-surface-raised text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
