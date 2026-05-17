'use client';

import { useCallback, useEffect, useState } from 'react';
import TenantShell from '@/components/TenantShell';
import { useTenantAuth } from '@/hooks/useTenantAuth';
import { financeService, type Invoice } from '@/services/finance.service';

export default function TenantBillingPage() {
  const user = useTenantAuth();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const result = await financeService.listInvoices({ page: 1, limit: 20 });
      setInvoices(result?.data ?? []);
    } catch {
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchInvoices();
  }, [fetchInvoices]);

  if (!user) return null;

  return (
    <TenantShell user={user}>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Billing</h1>
          <p className="text-sm text-zinc-500 mt-1">View your invoices</p>
        </div>

        <div className="rounded-2xl border border-surface-border bg-surface-raised">
          <div className="px-6 py-4 border-b border-surface-border">
            <h2 className="text-sm font-semibold text-zinc-200">Invoices</h2>
          </div>
          <div className="p-4 overflow-x-auto">
            {loading ? (
              <div className="py-8 text-center text-zinc-500 text-sm">Loading…</div>
            ) : invoices.length === 0 ? (
              <div className="py-8 text-center text-zinc-500 text-sm">No invoices found.</div>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="text-zinc-500">
                  <tr className="text-left">
                    <th className="py-2 pr-4">Number</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Total</th>
                    <th className="py-2">Created</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-200">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-t border-surface-border/60">
                      <td className="py-2 pr-4 font-mono text-xs text-zinc-300">{inv.number}</td>
                      <td className="py-2 pr-4">{inv.status}</td>
                      <td className="py-2 pr-4">${Number(inv.total).toFixed(2)}</td>
                      <td className="py-2">{new Date(inv.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </TenantShell>
  );
}
