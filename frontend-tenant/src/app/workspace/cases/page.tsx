'use client';
// ─── /workspace/cases — Phase 10.6 R1 real page. ───────────────────────────────
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search, Briefcase } from 'lucide-react';
import TenantShell from '@/components/TenantShell';
import { GlassPanel } from '@/components/home/GlassPanel';
import { ActionButton } from '@/components/creatio/ActionToolbar';
import { StatusBadge } from '@/components/creatio/StatusBadge';
import { EntityTable, type ColumnDef } from '@/components/creatio/EntityTable';
import { casesService, type Case } from '@/services/cases.service';
import { useTenantAuth } from '@/hooks/useTenantAuth';

export default function CasesPage() {
  const user = useTenantAuth()!;
  const [items, setItems] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { items: rows } = await casesService.list({
        q: search || undefined,
        status: (statusFilter as Case['status']) || undefined,
        limit: 100,
      });
      setItems(rows);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: ColumnDef<Case>[] = useMemo(
    () => [
      {
        key: 'caseNumber',
        header: 'Case #',
        accessor: (c) => <span className="text-sm font-medium text-zinc-100">{c.caseNumber}</span>,
      },
      {
        key: 'beneficiary',
        header: 'Beneficiary',
        accessor: (c) => (
          <span className="text-sm text-zinc-300">{c.beneficiaryId ?? '—'}</span>
        ),
      },
      {
        key: 'openedAt',
        header: 'Opened',
        accessor: (c) => (
          <span className="text-xs text-zinc-400">
            {new Date(c.openedAt).toLocaleDateString()}
          </span>
        ),
      },
      {
        key: 'assignedAgent',
        header: 'Agent',
        accessor: (c) => (
          <span className="text-sm text-zinc-300">{c.assignedAgent ?? '—'}</span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        accessor: (c) => <StatusBadge status={c.status} />,
      },
    ],
    [],
  );

  return (
    <TenantShell user={user}>
      <div className="px-6 py-6 flex flex-col gap-6 max-w-7xl mx-auto w-full">
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-zinc-100">Cases</h1>
              <p className="text-sm text-zinc-500 mt-0.5">
                Beneficiary case tracking with intervention history.
              </p>
            </div>
          </div>
          <ActionButton variant="primary" size="md" icon={<Plus className="w-4 h-4" />}>
            New Case
          </ActionButton>
        </header>

        <GlassPanel className="p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[12rem]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                className="w-full pl-9 pr-3 py-2 bg-surface text-sm text-zinc-200 rounded-lg border border-surface-border focus:outline-none focus:border-primary"
                placeholder="Search cases"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search cases"
              />
            </div>
            <select
              className="px-3 py-2 bg-surface text-sm text-zinc-200 rounded-lg border border-surface-border focus:outline-none focus:border-primary"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Status filter"
            >
              <option value="">All statuses</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>
            <span className="text-xs text-zinc-500 ml-auto">
              {loading ? '…' : `${items.length} total`}
            </span>
          </div>
        </GlassPanel>

        <GlassPanel className="p-0 overflow-hidden">
          <EntityTable
            columns={columns}
            data={items}
            loading={loading}
            renderEmpty={() => (
              <div className="p-12 text-center text-sm text-zinc-500">
                No cases yet.
              </div>
            )}
          />
        </GlassPanel>
      </div>
    </TenantShell>
  );
}