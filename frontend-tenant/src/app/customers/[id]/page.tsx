'use client';
// ─── /customers/[id] — Customer detail + projects list ────────────────────────
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import TenantShell from '@/components/TenantShell';
import { GlassPanel } from '@/components/home/GlassPanel';
import { StatusBadge } from '@/components/creatio/StatusBadge';
import { ActionButton } from '@/components/creatio/ActionToolbar';
import { Modal } from '@/components/creatio/Modal';
import { CustomerForm } from '@/components/customers/CustomerForm';
import { customersService } from '@/services/customers.service';
import { projectsService } from '@/services/projects.service';
import type { Customer, CustomerContact } from '@/types/customers.types';
import type { Project } from '@/services/projects.service';
import { useTenantAuth } from '@/hooks/useTenantAuth';

export default function CustomerDetailPage() {
  const user = useTenantAuth()!;
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [contacts, setContacts] = useState<CustomerContact[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, contactsList, projectsList] = await Promise.all([
        customersService.get(id),
        customersService.listContacts(id),
        projectsService.list({ customerId: id }),
      ]);
      setCustomer(c);
      setContacts(contactsList);
      setProjects(projectsList.items);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !customer) {
    return (
      <TenantShell user={user}>
        <div className="p-12 text-center text-sm text-zinc-500">Loading…</div>
      </TenantShell>
    );
  }
  if (!customer) {
    return (
      <TenantShell user={user}>
        <div className="p-12 text-center text-sm text-zinc-500">
          Customer not found.{' '}
          <Link href="/customers" className="text-primary hover:underline">
            Back to list
          </Link>
        </div>
      </TenantShell>
    );
  }

  return (
    <TenantShell user={user}>
      <div className="px-6 py-6 flex flex-col gap-6 max-w-6xl mx-auto w-full">
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <Link href="/customers" className="text-xs text-zinc-500 hover:text-zinc-300">
              ← All customers
            </Link>
            <h1 className="text-2xl font-bold text-zinc-100 mt-1">{customer.name}</h1>
            <div className="flex items-center gap-2 mt-2 text-sm text-zinc-400">
              {customer.industry && <span>{customer.industry}</span>}
              <StatusBadge status={customer.status} />
            </div>
          </div>
          <ActionButton variant="secondary" size="md" onClick={() => setEditing(true)}>
            Edit
          </ActionButton>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <GlassPanel className="p-4 lg:col-span-2">
            <h2 className="text-sm font-semibold text-zinc-300 mb-3">Projects</h2>
            {projects.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No projects yet for this customer.
              </p>
            ) : (
              <div className="space-y-2">
                {projects.map((p) => (
                  <Link
                    key={p.id}
                    href={`/departments?tab=projects&projectId=${p.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border border-surface-border hover:bg-surface-overlay transition-colors"
                  >
                    <div>
                      <div className="text-sm font-medium text-zinc-100">{p.name}</div>
                      {p.targetDate && (
                        <div className="text-xs text-zinc-500 mt-0.5">
                          Due {new Date(p.targetDate).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <StatusBadge status={p.status} />
                  </Link>
                ))}
              </div>
            )}
          </GlassPanel>

          <GlassPanel className="p-4">
            <h2 className="text-sm font-semibold text-zinc-300 mb-3">Details</h2>
            <div className="space-y-2 text-sm text-zinc-300">
              <Row label="Email" value={customer.primaryEmail ?? '—'} />
              <Row label="Phone" value={customer.primaryPhone ?? '—'} />
              <Row
                label="Created"
                value={new Date(customer.createdAt).toLocaleDateString()}
              />
              {customer.tags?.length > 0 && (
                <div>
                  <span className="text-xs text-zinc-500">Tags</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {customer.tags.map((t) => (
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
          </GlassPanel>
        </div>

        {/*
          FIX-CUST-D1 (Round-3 verification, 2026-07-24): surface the
          industry-specific fields captured by CustomerForm. Persisted on
          `billingInfo.industryFields` by the BE; we read them through
          that path because Customer.industryFields is not surfaced by
          the BE response today.
        */}
        {(() => {
          const indFields =
            (customer.billingInfo &&
              (customer.billingInfo as Record<string, unknown>)['industryFields']) as
              | Record<string, string | boolean | null>
              | undefined;
          if (!indFields || Object.keys(indFields).length === 0) return null;
          return (
            <GlassPanel className="p-4">
              <h2 className="text-sm font-semibold text-zinc-300 mb-3">
                Industry-specific details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-zinc-300">
                {Object.entries(indFields).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex justify-between items-center border-b border-surface-border/40 pb-1"
                  >
                    <span className="text-xs text-zinc-500 capitalize">
                      {key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()}
                    </span>
                    <span className="font-medium">
                      {value === null || value === undefined || value === ''
                        ? '—'
                        : typeof value === 'boolean'
                          ? value
                            ? 'Yes'
                            : 'No'
                          : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </GlassPanel>
          );
        })()}

        {customer.financialSubType ||
        customer.lifecycleStage ||
        customer.kycStatus ||
        customer.riskRating ||
        customer.taxId ? (
          <GlassPanel className="p-4">
            <h2 className="text-sm font-semibold text-zinc-300 mb-3">
              Financial & Compliance
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-zinc-300">
              {customer.financialSubType && (
                <div className="flex justify-between items-center border-b border-surface-border/40 pb-1">
                  <span className="text-xs text-zinc-500">Sub-Type</span>
                  <span className="font-medium">{customer.financialSubType}</span>
                </div>
              )}
              {customer.lifecycleStage && (
                <div className="flex justify-between items-center border-b border-surface-border/40 pb-1">
                  <span className="text-xs text-zinc-500">Lifecycle</span>
                  <span className="font-medium">{customer.lifecycleStage}</span>
                </div>
              )}
              {customer.kycStatus && (
                <div className="flex justify-between items-center border-b border-surface-border/40 pb-1">
                  <span className="text-xs text-zinc-500">KYC Status</span>
                  <span className="font-medium">{customer.kycStatus}</span>
                </div>
              )}
              {customer.riskRating && (
                <div className="flex justify-between items-center border-b border-surface-border/40 pb-1">
                  <span className="text-xs text-zinc-500">Risk Rating</span>
                  <span className="font-medium">{customer.riskRating}</span>
                </div>
              )}
              {customer.taxId && (
                <div className="flex justify-between items-center border-b border-surface-border/40 pb-1">
                  <span className="text-xs text-zinc-500">Tax ID</span>
                  <span className="font-medium">{customer.taxId}</span>
                </div>
              )}
            </div>
          </GlassPanel>
        ) : null}

        <GlassPanel className="p-4">
          <h2 className="text-sm font-semibold text-zinc-300 mb-3">Contacts</h2>
          {contacts.length === 0 ? (
            <p className="text-sm text-zinc-500">No contacts on file.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {contacts.map((ct) => (
                <div
                  key={ct.id}
                  className="p-3 rounded-lg border border-surface-border"
                >
                  <div className="text-sm font-medium text-zinc-100">
                    {ct.name}
                    {ct.isPrimary && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                        Primary
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-400 mt-1">{ct.email}</div>
                  {ct.role && (
                    <div className="text-xs text-zinc-500 mt-0.5">{ct.role}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </GlassPanel>
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title="Edit Customer">
        <CustomerForm
          customer={customer}
          onClose={() => setEditing(false)}
          onUpdated={(c) => {
            setCustomer(c);
            void load();
          }}
        />
      </Modal>
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
