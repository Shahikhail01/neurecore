'use client';
// ─── /customers — Customer list + creation surface ────────────────────────────
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Mail, Phone, Archive, ArchiveRestore, Sparkles } from 'lucide-react';
import TenantShell from '@/components/TenantShell';
import { useChatStore } from '@/core/services/chat/chat.factory';
import { ActionButton } from '@/components/creatio/ActionToolbar';
import { GlassPanel } from '@/components/home/GlassPanel';
import { Modal } from '@/components/creatio/Modal';
import { StatusBadge } from '@/components/creatio/StatusBadge';
import { EntityTable, type ColumnDef } from '@/components/creatio/EntityTable';
import { CustomerForm } from '@/components/customers/CustomerForm';
import { isFinancialComplianceGroup } from '@/lib/industryGroups';
import { customersService } from '@/services/customers.service';
import { tenantsService } from '@/services/tenants.service';
import type { Customer } from '@/types/customers.types';
import { useTenantAuth } from '@/hooks/useTenantAuth';
import { getIndustryNavConfig } from '@/lib/industryNavigation';

export default function CustomersPage() {
  const user = useTenantAuth()!;
  const [items, setItems] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ACTIVE');
  // Phase 4 — F&C discriminator filter. When the tenant's industry is
  // not in the 'financial-compliance' group, we hide the filter entirely.
  const [financialSubTypeFilter, setFinancialSubTypeFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortKey, setSortKey] = useState<'name' | 'industry' | 'status' | 'createdAt' | 'updatedAt'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [createOpen, setCreateOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [active, setActive] = useState<Customer | null>(null);
  const [tenantGroup, setTenantGroup] = useState<string | null>(null);

  // Determine if we should show the F&C filter (only meaningful for
  // tenants in the 'financial-compliance' group).
  useEffect(() => {
    let cancelled = false;
    tenantsService
      .getCurrent()
      .then((t) => {
        if (!cancelled) setTenantGroup(t.industryGroup ?? null);
      })
      .catch(() => {
        if (!cancelled) setTenantGroup(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const isFinancialTenant = isFinancialComplianceGroup(tenantGroup);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { items, total } = await customersService.list({
        search: search || undefined,
        status: statusFilter || undefined,
        // Phase 4 G4 — pass financialSubType only when set + when tenant
        // is in the F&C group (defence-in-depth: BE would ignore the
        // value for non-F&C tenants anyway, but FE should not send it).
        ...(isFinancialTenant && financialSubTypeFilter
          ? { financialSubType: financialSubTypeFilter as 'BANKING' }
          : {}),
        page,
        limit: pageSize,
        sortKey,
        sortDir,
      });
      setItems(items);
      setTotal(total);
    } catch {
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [
    search,
    statusFilter,
    isFinancialTenant,
    financialSubTypeFilter,
    page,
    pageSize,
    sortKey,
    sortDir,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  // Client-side name/industry/email search within the current page for
  // instant feedback; the server-side `search` filter handles the full set.
  const filtered = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.industry ?? '').toLowerCase().includes(q) ||
        (c.primaryEmail ?? '').toLowerCase().includes(q),
    );
  }, [items, search]);

  const onArchive = async (id: string) => {
    if (!confirm('Archive this customer? Their projects will be retained.')) {
      return;
    }
    await customersService.archive(id);
    void load();
  };

  const onUnarchive = async (id: string) => {
    await customersService.unarchive(id);
    void load();
  };

  // ── Phase 10.5 — Creatio AI parity: inline AI action ────────────────────
  // Opens the global chat and seeds a pre-formed prompt scoped to the row.
  // The chat executes the backend nc.* tool (customer_360 / search_kb /
  // summarize) wired in Phase 10.3.
  const promptChat = useChatStore((s) => s.requestExternalSend);
  const onAi = (c: Customer) => {
    promptChat(
      `Show me the 360 view and summarize recent activity for customer "${c.name}" (${c.id}).`,
    );
  };

  const columns: ColumnDef<Customer>[] = [
    {
      key: 'name',
      header: 'Customer',
      accessor: (c) => (
        <div>
          <Link
            href={`/customers/${c.id}`}
            className="text-sm font-medium text-zinc-100 hover:text-primary"
            onClick={(e) => e.stopPropagation()}
          >
            {c.name}
          </Link>
          {c.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {c.tags.slice(0, 3).map((t) => (
                <span
                  key={t}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-surface text-zinc-400 border border-surface-border"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'industry',
      header: 'Industry',
      accessor: (c) => (
        <span className="text-sm text-zinc-300 truncate">{c.industry ?? '—'}</span>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      accessor: (c) => (
        <div className="text-xs text-zinc-400 flex flex-col gap-0.5">
          {c.primaryEmail && (
            <span className="flex items-center gap-1.5 truncate">
              <Mail className="w-3 h-3 text-zinc-500" /> {c.primaryEmail}
            </span>
          )}
          {c.primaryPhone && (
            <span className="flex items-center gap-1.5">
              <Phone className="w-3 h-3 text-zinc-500" /> {c.primaryPhone}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (c) => <StatusBadge status={c.status} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      accessor: (c) => (
        <div
          className="flex justify-end gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <span title="AI: summarize / 360 view">
            <ActionButton
              variant="ghost"
              size="sm"
              icon={<Sparkles className="w-3.5 h-3.5 text-primary" />}
              onClick={() => onAi(c)}
            >
              AI
            </ActionButton>
          </span>
          {c.status === 'ARCHIVED' ? (
            <ActionButton
              variant="ghost"
              size="sm"
              icon={<ArchiveRestore className="w-3.5 h-3.5" />}
              onClick={() => void onUnarchive(c.id)}
            >
              Unarchive
            </ActionButton>
          ) : (
            <ActionButton
              variant="ghost"
              size="sm"
              icon={<Archive className="w-3.5 h-3.5" />}
              onClick={() => void onArchive(c.id)}
            >
              Archive
            </ActionButton>
          )}
        </div>
      ),
    },
  ];

  return (
    <TenantShell user={user}>
      <div className="px-6 py-6 flex flex-col gap-6 max-w-7xl mx-auto w-full">
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">
              {tenantGroup ? (getIndustryNavConfig(tenantGroup as any)?.customersLabel ?? 'Customers') : 'Customers'}
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Persistent client relationships — projects across time and departments roll up to these.
            </p>
          </div>
          <ActionButton
            variant="primary"
            size="md"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setCreateOpen(true)}
          >
            New Customer
          </ActionButton>
        </header>

        <GlassPanel className="p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[12rem]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                className="w-full pl-9 pr-3 py-2 bg-surface text-sm text-zinc-200 rounded-lg border border-surface-border focus:outline-none focus:border-primary"
                placeholder="Search by name, industry, or email"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <select
              className="px-3 py-2 bg-surface text-sm text-zinc-200 rounded-lg border border-surface-border focus:outline-none focus:border-primary"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="ARCHIVED">Archived</option>
            </select>
            {isFinancialTenant && (
              <select
                className="px-3 py-2 bg-surface text-sm text-zinc-200 rounded-lg border border-surface-border focus:outline-none focus:border-primary"
                value={financialSubTypeFilter}
                aria-label="Financial sub-type"
                onChange={(e) => {
                  setFinancialSubTypeFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All sub-types</option>
                <option value="BANKING">Banking</option>
                <option value="INSURANCE">Insurance</option>
                <option value="WEALTH_MANAGEMENT">Wealth Management</option>
                <option value="INVESTMENT">Investment</option>
                <option value="FINTECH">FinTech</option>
                <option value="ACCOUNTING_AUDIT">Accounting & Audit</option>
              </select>
            )}
            <select
              className="px-3 py-2 bg-surface text-sm text-zinc-200 rounded-lg border border-surface-border focus:outline-none focus:border-primary"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              <option value="10">10 / page</option>
              <option value="20">20 / page</option>
              <option value="50">50 / page</option>
              <option value="100">100 / page</option>
            </select>
            <select
              className="px-3 py-2 bg-surface text-sm text-zinc-200 rounded-lg border border-surface-border focus:outline-none focus:border-primary"
              value={sortKey}
              onChange={(e) => {
                setSortKey(e.target.value as typeof sortKey);
                setPage(1);
              }}
            >
              <option value="name">Sort: Name</option>
              <option value="industry">Sort: Industry</option>
              <option value="status">Sort: Status</option>
              <option value="createdAt">Sort: Created</option>
              <option value="updatedAt">Sort: Updated</option>
            </select>
            <button
              type="button"
              className="px-3 py-2 bg-surface text-sm text-zinc-200 rounded-lg border border-surface-border focus:outline-none focus:border-primary"
              onClick={() => {
                setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                setPage(1);
              }}
              title={`Sort direction (${sortDir})`}
            >
              {sortDir === 'asc' ? '↑' : '↓'}
            </button>
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
            onRowClick={(c) => setActive(c)}
            pagination={{
              page,
              total,
              limit: pageSize,
              onPage: (p) => setPage(p),
            }}
            renderEmpty={() => (
              <div className="p-12 text-center text-sm text-zinc-500">
                No customers yet.{' '}
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
          // Block backdrop / ESC dismissal while a create is in flight so
          // the user can't accidentally lose the request mid-submit.
          if (createSubmitting) return;
          setCreateOpen(false);
        }}
        title="New Customer"
      >
        <CustomerForm
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

      {active && (
        <Modal open={!!active} onClose={() => setActive(null)} title={active.name}>
          <div className="space-y-3 text-sm text-zinc-300">
            <Row label="Industry" value={active.industry ?? '—'} />
            <Row label="Email" value={active.primaryEmail ?? '—'} />
            <Row label="Phone" value={active.primaryPhone ?? '—'} />
            <Row label="Status" value={active.status} />
            <Row
              label="Created"
              value={new Date(active.createdAt).toLocaleDateString()}
            />
            {active.tags?.length > 0 && (
              <div>
                <p className="text-xs text-zinc-500 mb-1">Tags</p>
                <div className="flex flex-wrap gap-1">
                  {active.tags.map((t) => (
                    <span
                      key={t}
                      className="text-xs px-2 py-0.5 rounded bg-surface text-zinc-300 border border-surface-border"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </TenantShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="text-sm text-zinc-300 font-medium">{value}</span>
    </div>
  );
}
