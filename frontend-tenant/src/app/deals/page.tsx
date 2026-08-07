'use client';
// ─── /deals — Deal pipeline list + creation ────────────────────────────────────
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import TenantShell from '@/components/TenantShell';
import { GlassPanel } from '@/components/home/GlassPanel';
import { Modal } from '@/components/creatio/Modal';
import { ActionButton } from '@/components/creatio/ActionToolbar';
import { EntityTable, type ColumnDef } from '@/components/creatio/EntityTable';
import { DealForm } from '@/components/deals/DealForm';
import { dealsService } from '@/services/deals.service';
import type { Deal, DealStage } from '@/types/deals.types';
import { useTenantAuth } from '@/hooks/useTenantAuth';

function stageTone(stage: DealStage): string {
  switch (stage) {
    case 'LEAD':
      return 'bg-zinc-500/15 text-zinc-300 border-zinc-500/40';
    case 'QUALIFIED':
      return 'bg-blue-500/15 text-blue-300 border-blue-500/40';
    case 'PROPOSAL':
      return 'bg-amber-500/15 text-amber-300 border-amber-500/40';
    case 'NEGOTIATION':
      return 'bg-purple-500/15 text-purple-300 border-purple-500/40';
    case 'WON':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40';
    case 'LOST':
      return 'bg-red-500/15 text-red-300 border-red-500/40';
    default:
      return 'bg-surface-overlay text-zinc-300 border-surface-border';
  }
}

export default function DealsPage() {
  const user = useTenantAuth()!;
  const [items, setItems] = useState<Deal[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [createOpen, setCreateOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { items: rows, total: count } = await dealsService.list({
        q: search || undefined,
        stage: stageFilter ? (stageFilter as DealStage) : undefined,
        page,
        limit: pageSize,
      });
      setItems(rows);
      setTotal(count);
    } catch {
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [search, stageFilter, page, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter((d) => d.name.toLowerCase().includes(q));
  }, [items, search]);

  const columns: ColumnDef<Deal>[] = [
    {
      key: 'name',
      header: 'Deal',
      accessor: (d) => (
        <Link
          href={`/deals/${d.id}`}
          className="text-sm font-medium text-zinc-100 hover:text-primary"
          onClick={(e) => e.stopPropagation()}
        >
          {d.name}
        </Link>
      ),
    },
    {
      key: 'stage',
      header: 'Stage',
      accessor: (d) => (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${stageTone(d.stage as DealStage)}`}
          aria-label={`Stage ${d.stage}`}
        >
          {d.stage}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      accessor: (d) => (
        <span className="text-sm text-zinc-200 tabular-nums">
          {Number(d.amount).toLocaleString()} {d.currency}
        </span>
      ),
    },
    {
      key: 'probability',
      header: 'Prob.',
      align: 'right',
      accessor: (d) => (
        <span className="text-xs text-zinc-400 tabular-nums">
          {Math.round(Number(d.probability) * 100)}%
        </span>
      ),
    },
    {
      key: 'weighted',
      header: 'Weighted',
      align: 'right',
      accessor: (d) => (
        <span className="text-sm text-zinc-300 tabular-nums">
          {(Number(d.amount) * Number(d.probability)).toFixed(2)} {d.currency}
        </span>
      ),
    },
    {
      key: 'expectedCloseDate',
      header: 'Expected close',
      accessor: (d) => (
        <span className="text-xs text-zinc-400">
          {d.expectedCloseDate
            ? new Date(d.expectedCloseDate).toLocaleDateString()
            : '—'}
        </span>
      ),
    },
  ];

  return (
    <TenantShell user={user}>
      <div className="px-6 py-6 flex flex-col gap-6 max-w-7xl mx-auto w-full">
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">Deals</h1>
            <p className="text-sm text-zinc-500 mt-1">
              Pipeline through Lead → Qualified → Proposal → Negotiation → Won. Weighted forecast
              drives monthly board reporting.
            </p>
          </div>
          <ActionButton
            variant="primary"
            size="md"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setCreateOpen(true)}
          >
            New Deal
          </ActionButton>
        </header>

        <GlassPanel className="p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[12rem]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                className="w-full pl-9 pr-3 py-2 bg-surface text-sm text-zinc-200 rounded-lg border border-surface-border focus:outline-none focus:border-primary"
                placeholder="Search deals by name"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                aria-label="Search deals"
              />
            </div>
            <select
              className="px-3 py-2 bg-surface text-sm text-zinc-200 rounded-lg border border-surface-border focus:outline-none focus:border-primary"
              value={stageFilter}
              onChange={(e) => {
                setStageFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Stage filter"
            >
              <option value="">All stages</option>
              <option value="LEAD">Lead</option>
              <option value="QUALIFIED">Qualified</option>
              <option value="PROPOSAL">Proposal</option>
              <option value="NEGOTIATION">Negotiation</option>
              <option value="WON">Won</option>
              <option value="LOST">Lost</option>
            </select>
            <select
              className="px-3 py-2 bg-surface text-sm text-zinc-200 rounded-lg border border-surface-border focus:outline-none focus:border-primary"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              aria-label="Page size"
            >
              <option value="10">10 / page</option>
              <option value="20">20 / page</option>
              <option value="50">50 / page</option>
              <option value="100">100 / page</option>
            </select>
            <span className="text-xs text-zinc-500 ml-auto">
              {loading ? '…' : `${total} total`}
            </span>
          </div>
        </GlassPanel>

        <GlassPanel className="p-0 overflow-hidden">
          <EntityTable
            columns={columns}
            data={filtered}
            loading={loading}
            pagination={{
              page,
              total,
              limit: pageSize,
              onPage: (p) => setPage(p),
            }}
            renderEmpty={() => (
              <div className="p-12 text-center text-sm text-zinc-500">
                No deals yet.{' '}
                <button
                  className="text-primary hover:underline"
                  onClick={() => setCreateOpen(true)}
                >
                  Create the first one
                </button>
                .
              </div>
            )}
          />
        </GlassPanel>
      </div>

      <Modal
        open={createOpen}
        onClose={() => {
          if (createSubmitting) return;
          setCreateOpen(false);
        }}
        title="New Deal"
      >
        <DealForm
          onClose={() => {
            if (createSubmitting) return;
            setCreateOpen(false);
          }}
          onSubmittingChange={setCreateSubmitting}
          onCreated={() => {
            setCreateOpen(false);
            void load();
          }}
        />
      </Modal>
    </TenantShell>
  );
}