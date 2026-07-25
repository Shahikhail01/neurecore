"use client";

/**
 * /departments-pool — Phase 10 Departments Pool page.
 *
 * Surfaces DepartmentTemplate entries that are not legacy tier rows.
 * Existing /dept-templates page remains as a 302 redirect (see
 * /dept-templates/page.tsx).
 * Now includes "Deploy Dept" quick action per template.
 */

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { usePoolList } from '@/hooks/usePoolList';
import { PoolToolbar } from '@/components/pool/PoolToolbar';
import { PoolPagination } from '@/components/pool/PoolPagination';
import { PoolEmptyState } from '@/components/pool/PoolEmptyState';
import { PoolConfirmDeleteDialog } from '@/components/pool/PoolConfirmDeleteDialog';
import {
  DeployToTenantModal,
  type TenantOption,
  type DeptDeployConfig,
} from '@/components/pool/DeployToTenantModal';
import {
  departmentsPoolService,
  type DepartmentPoolEntry,
  type CreateDepartmentPoolPayload,
} from '@/services/departmentsPool.service';
import { deptTemplatesService } from '@/services/deptTemplates.service';
import api from '@/services/api';
import { unwrapList } from '@/services/unwrap';

export default function DepartmentsPoolPage() {
  const user = useAdminAuth();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('ALL');
  const { items, total, page: currentPage, totalPages, loading, refresh, setOpts } = usePoolList<
    DepartmentPoolEntry,
    CreateDepartmentPoolPayload
  >(departmentsPoolService);

  useEffect(() => {
    setOpts({ search, status: category === 'ALL' ? undefined : category, page: 1, limit: 20 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, category]);

  const [deleting, setDeleting] = useState<DepartmentPoolEntry | null>(null);

  // Deploy modal
  const [deployTarget, setDeployTarget] = useState<DepartmentPoolEntry | null>(null);
  const [deployTenants, setDeployTenants] = useState<TenantOption[]>([]);
  const [deployBusy, setDeployBusy] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [deployResult, setDeployResult] = useState<{ label: string } | null>(null);

  const canEdit = user?.role === 'SUPER_ADMIN';

  async function openDeployModal(item: DepartmentPoolEntry) {
    setDeployTarget(item);
    setDeployError(null);
    setDeployResult(null);
    try {
      const res = await api.get('/tenants', { params: { limit: 200 } });
      const list = unwrapList(res);
      setDeployTenants((list.items ?? []) as TenantOption[]);
    } catch {
      setDeployTenants([]);
    }
  }

  async function handleDeployDept(tenantId: string, config: DeptDeployConfig) {
    if (!deployTarget) return;
    setDeployBusy(true);
    setDeployError(null);
    try {
      const result = await deptTemplatesService.deploySingleDepartment(
        tenantId,
        deployTarget.id,
        config.itemIndex,
      );
      setDeployResult({ label: `Deployed "${result.name}" department to tenant.` });
    } catch (err: unknown) {
      setDeployError(err instanceof Error ? err.message : 'Deploy failed');
    } finally {
      setDeployBusy(false);
    }
  }

  const categories = useMemo(() => {
    const set = new Set<string>(['ALL', 'general', 'startup', 'scaleup', 'ecommerce', 'saas', 'enterprise']);
    items.forEach((i) => i.category && set.add(i.category));
    return Array.from(set).map((c) => ({ label: c === 'ALL' ? 'All' : c, value: c }));
  }, [items]);

  const filtered = useMemo(
    () =>
      items.filter((t) => {
        const matchesSearch =
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          (t.description ?? '').toLowerCase().includes(search.toLowerCase()) ||
          t.slug.toLowerCase().includes(search.toLowerCase());
        const matchesCategory = category === 'ALL' || t.category === category;
        return matchesSearch && matchesCategory;
      }),
    [items, search, category],
  );

  if (!user) return null;

  return (
    <AdminShell user={user}>
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">Departments</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Org-structure building blocks. Used directly by packages as
              composition. Use the legacy page for tier templates.
            </p>
          </div>
        </div>

        <PoolToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search departments…"
          filters={categories}
          activeFilter={category}
          onFilterChange={setCategory}
          count={total}
          countLabel="templates"
        />

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-52 rounded-xl bg-surface-raised animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <PoolEmptyState
            title="No department templates match your filters"
            hint="Add seed entries with the seeder or visit the legacy editor."
          />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <AnimatePresence>
              {filtered.map((tmpl) => (
                <motion.div
                  key={tmpl.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-xl border border-surface-border bg-surface-raised p-4 flex flex-col gap-3 hover:border-[color:var(--accent-500)]/50 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-zinc-100 truncate">{tmpl.name}</div>
                      <div className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{tmpl.description ?? ''}</div>
                      <div className="text-[11px] text-zinc-600 mt-1 font-mono">{tmpl.slug}</div>
                    </div>
                    <span className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium bg-zinc-800 text-zinc-300 capitalize">
                      {tmpl.category}
                    </span>
                  </div>

                  <div className="rounded-lg bg-surface-overlay border border-surface-border/50 p-2.5 space-y-1 max-h-28 overflow-y-auto">
                    {tmpl.structure.slice(0, 6).map((item, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs">
                        <span className="text-zinc-600">{item.parentName ? '  └' : '◆'}</span>
                        <span className="text-zinc-300 truncate">{item.name}</span>
                      </div>
                    ))}
                    {tmpl.structure.length > 6 && (
                      <div className="text-[10px] text-zinc-600">+{tmpl.structure.length - 6} more</div>
                    )}
                  </div>

                  {canEdit && (
                    <div className="flex gap-2 mt-auto pt-2 border-t border-surface-border/50">
                      <button
                        onClick={() => openDeployModal(tmpl)}
                        className="flex-1 py-1.5 rounded-lg text-xs border border-[color:var(--accent-500)]/40 text-indigo-300 hover:text-indigo-100 hover:border-indigo-400 transition"
                      >
                        Deploy Dept
                      </button>
                      <a
                        href="/dept-templates"
                        className="flex-1 text-center py-1.5 rounded-lg text-xs border border-surface-border text-zinc-400 hover:text-zinc-200 transition"
                      >
                        Open in Legacy Editor
                      </a>
                      <button
                        onClick={() => setDeleting(tmpl)}
                        className="px-3 py-1.5 rounded-lg text-xs border border-surface-border text-zinc-600 hover:text-[color:var(--state-danger)] hover:border-[color:var(--state-danger)] transition"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <PoolPagination
            page={currentPage}
            totalPages={totalPages}
            total={total}
            limit={20}
            onPageChange={(p) => setOpts((o) => ({ ...o, page: p }))}
          />
        </>
        )}
      </div>

      <PoolConfirmDeleteDialog
        open={Boolean(deleting)}
        title="Delete department template?"
        description={
          deleting ? (
            <>
              "<span className="text-zinc-200 font-medium">{deleting.name}</span>" will be permanently removed.
              Already-deployed departments are unaffected.
            </>
          ) : ''
        }
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await departmentsPoolService.remove(deleting.id);
          } catch {
            /* noop */
          }
          setDeleting(null);
          refresh();
        }}
      />

      <DeployToTenantModal
        open={Boolean(deployTarget)}
        onClose={() => setDeployTarget(null)}
        deployType="department"
        itemName={deployTarget?.name ?? ''}
        itemDescription={`${deployTarget?.structure?.length ?? 0} structure items · ${deployTarget?.category ?? 'general'}`}
        tenants={deployTenants}
        busy={deployBusy}
        error={deployError}
        result={deployResult}
        onDeploy={(tenantId, config) => handleDeployDept(tenantId, config as DeptDeployConfig)}
      />
    </AdminShell>
  );
}
