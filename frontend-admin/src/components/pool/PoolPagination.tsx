"use client";

/**
 * PoolPagination — shared pagination shell.
 * Phase 10 — SRP: one component, used by all pool pages.
 */

export interface PoolPaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}

export function PoolPagination({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
}: PoolPaginationProps) {
  if (totalPages <= 1 && total <= limit) return null;

  const start = Math.min((page - 1) * limit + 1, total);
  const end = Math.min(page * limit, total);

  const pages: (number | '…')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('…');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i);
    }
    if (page < totalPages - 2) pages.push('…');
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-between gap-4 pt-4 border-t border-surface-border">
      <span className="text-xs text-zinc-500">
        Showing {start}–{end} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1.5 rounded-lg text-xs border border-surface-border text-zinc-400 hover:text-zinc-200 hover:border-[color:var(--accent-500)] disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          ‹ Prev
        </button>
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`ellipsis-${i}`} className="px-2 text-xs text-zinc-600">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p as number)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                p === page
                  ? 'bg-[color:var(--accent-500)] text-white'
                  : 'border border-surface-border text-zinc-400 hover:text-zinc-200 hover:border-[color:var(--accent-500)]'
              }`}
            >
              {p}
            </button>
          ),
        )}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="px-3 py-1.5 rounded-lg text-xs border border-surface-border text-zinc-400 hover:text-zinc-200 hover:border-[color:var(--accent-500)] disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          Next ›
        </button>
      </div>
    </div>
  );
}
