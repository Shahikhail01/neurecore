'use client';
// ─── /workspace/campaigns — Phase 10.6 R1 real page. ───────────────────────────
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search, Megaphone } from 'lucide-react';
import TenantShell from '@/components/TenantShell';
import { GlassPanel } from '@/components/home/GlassPanel';
import { ActionButton } from '@/components/creatio/ActionToolbar';
import { StatusBadge } from '@/components/creatio/StatusBadge';
import { EntityTable, type ColumnDef } from '@/components/creatio/EntityTable';
import { campaignsService, type Campaign } from '@/services/campaigns.service';
import { useTenantAuth } from '@/hooks/useTenantAuth';

export default function CampaignsPage() {
  const user = useTenantAuth()!;
  const [items, setItems] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { items: rows } = await campaignsService.list({
        q: search || undefined,
        status: (statusFilter as Campaign['status']) || undefined,
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

  const columns: ColumnDef<Campaign>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Campaign',
        accessor: (c) => <span className="text-sm font-medium text-zinc-100">{c.name}</span>,
      },
      {
        key: 'channel',
        header: 'Channel',
        accessor: (c) => (
          <span className="text-xs uppercase tracking-wide text-zinc-300">{c.channel}</span>
        ),
      },
      {
        key: 'budget',
        header: 'Budget',
        align: 'right',
        accessor: (c) => (
          <span className="text-sm text-zinc-200 tabular-nums">
            {Number(c.budget).toLocaleString()}
          </span>
        ),
      },
      {
        key: 'audience',
        header: 'Audience',
        accessor: (c) => (
          <span className="text-xs text-zinc-400">{c.targetAudience ?? '—'}</span>
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
              <Megaphone className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-zinc-100">Campaigns</h1>
              <p className="text-sm text-zinc-500 mt-0.5">
                Marketing campaigns, audience targeting, performance, budget tracking.
              </p>
            </div>
          </div>
          <ActionButton variant="primary" size="md" icon={<Plus className="w-4 h-4" />}>
            New Campaign
          </ActionButton>
        </header>

        <GlassPanel className="p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[12rem]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                className="w-full pl-9 pr-3 py-2 bg-surface text-sm text-zinc-200 rounded-lg border border-surface-border focus:outline-none focus:border-primary"
                placeholder="Search campaigns"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search campaigns"
              />
            </div>
            <select
              className="px-3 py-2 bg-surface text-sm text-zinc-200 rounded-lg border border-surface-border focus:outline-none focus:border-primary"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Status filter"
            >
              <option value="">All statuses</option>
              <option value="PLANNED">Planned</option>
              <option value="ACTIVE">Active</option>
              <option value="PAUSED">Paused</option>
              <option value="ENDED">Ended</option>
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
                No campaigns yet.
              </div>
            )}
          />
        </GlassPanel>
      </div>
    </TenantShell>
  );
}