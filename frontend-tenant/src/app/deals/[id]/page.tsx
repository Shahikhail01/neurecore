'use client';
// ─── /deals/[id] — Deal detail + stage transitions ────────────────────────────
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Trash2 } from 'lucide-react';
import TenantShell from '@/components/TenantShell';
import { GlassPanel } from '@/components/home/GlassPanel';
import { StatusBadge } from '@/components/creatio/StatusBadge';
import { ActionButton } from '@/components/creatio/ActionToolbar';
import { Modal } from '@/components/creatio/Modal';
import { DealForm } from '@/components/deals/DealForm';
import { customersService } from '@/services/customers.service';
import { dealsService } from '@/services/deals.service';
import type { Customer } from '@/types/customers.types';
import type { Deal, DealStage } from '@/types/deals.types';
import { useTenantAuth } from '@/hooks/useTenantAuth';
import { useRouter } from 'next/navigation';

const STAGE_TRANSITIONS: Record<DealStage, DealStage[]> = {
  LEAD: ['QUALIFIED', 'LOST'],
  QUALIFIED: ['PROPOSAL', 'LOST'],
  PROPOSAL: ['NEGOTIATION', 'LOST'],
  NEGOTIATION: ['WON', 'LOST'],
  WON: [],
  LOST: [],
};

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

export default function DealDetailPage() {
  const user = useTenantAuth()!;
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [deal, setDeal] = useState<Deal | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [transitioning, setTransitioning] = useState<DealStage | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await dealsService.get(id);
      setDeal(d);
      if (d?.customerId) {
        const c = await customersService.get(d.customerId);
        setCustomer(c);
      } else {
        setCustomer(null);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !deal) {
    return (
      <TenantShell user={user}>
        <div className="p-12 text-center text-sm text-zinc-500">Loading…</div>
      </TenantShell>
    );
  }
  if (!deal) {
    return (
      <TenantShell user={user}>
        <div className="p-12 text-center text-sm text-zinc-500">
          Deal not found.{' '}
          <Link href="/deals" className="text-primary hover:underline">
            Back to deals
          </Link>
        </div>
      </TenantShell>
    );
  }

  const transitions = STAGE_TRANSITIONS[deal.stage as DealStage] ?? [];
  const isClosed = deal.stage === 'WON' || deal.stage === 'LOST';

  const onTransition = async (to: DealStage) => {
    if (to === deal.stage) return;
    setTransitioning(to);
    try {
      await dealsService.transition(deal.id, to);
      await load();
    } finally {
      setTransitioning(null);
    }
  };

  const onDelete = async () => {
    if (!confirm('Delete this deal? Soft-delete preserves audit trail.')) return;
    await dealsService.archive(deal.id);
    router.push('/deals');
  };

  return (
    <TenantShell user={user}>
      <div className="px-6 py-6 flex flex-col gap-6 max-w-6xl mx-auto w-full">
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <Link href="/deals" className="text-xs text-zinc-500 hover:text-zinc-300">
              ← All deals
            </Link>
            <h1 className="text-2xl font-bold text-zinc-100 mt-1">{deal.name}</h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap text-sm">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${stageTone(deal.stage as DealStage)}`}
                aria-label={`Stage ${deal.stage}`}
              >
                {deal.stage}
              </span>
              {customer && (
                <Link
                  href={`/customers/${customer.id}`}
                  className="text-zinc-300 hover:text-primary"
                >
                  {customer.name}
                </Link>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ActionButton variant="secondary" size="md" onClick={() => setEditing(true)}>
              Edit
            </ActionButton>
            <ActionButton
              variant="ghost"
              size="md"
              icon={<Trash2 className="w-4 h-4 text-state-danger" />}
              onClick={() => void onDelete()}
            >
              Delete
            </ActionButton>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <GlassPanel className="p-4 lg:col-span-2">
            <h2 className="text-sm font-semibold text-zinc-300 mb-3">Forecast</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Metric label="Amount" value={`${deal.amount} ${deal.currency}`} />
              <Metric
                label="Probability"
                value={`${Math.round(Number(deal.probability) * 100)}%`}
              />
              <Metric
                label="Weighted"
                value={`${(
                  Number(deal.amount) * Number(deal.probability)
                ).toFixed(2)} ${deal.currency}`}
              />
              <Metric
                label="Expected close"
                value={
                  deal.expectedCloseDate
                    ? new Date(deal.expectedCloseDate).toLocaleDateString()
                    : '—'
                }
              />
            </div>
            {deal.notes && (
              <>
                <h2 className="text-sm font-semibold text-zinc-300 mt-5 mb-2">Notes</h2>
                <p className="text-sm text-zinc-300 whitespace-pre-wrap">{deal.notes}</p>
              </>
            )}
          </GlassPanel>

          <GlassPanel className="p-4">
            <h2 className="text-sm font-semibold text-zinc-300 mb-3">Stage pipeline</h2>
            <ol className="space-y-2">
              {(
                [
                  'LEAD',
                  'QUALIFIED',
                  'PROPOSAL',
                  'NEGOTIATION',
                  'WON',
                ] as DealStage[]
              ).map((s, idx) => {
                const reached =
                  [
                    'LEAD',
                    'QUALIFIED',
                    'PROPOSAL',
                    'NEGOTIATION',
                    'WON',
                  ].indexOf(deal.stage as DealStage) >= idx || deal.stage === 'LOST';
                const isCurrent = deal.stage === s;
                return (
                  <li
                    key={s}
                    className={`flex items-center gap-2 text-xs ${
                      reached ? 'text-zinc-300' : 'text-zinc-600'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isCurrent
                          ? 'bg-accent-500'
                          : reached
                          ? 'bg-zinc-500'
                          : 'bg-zinc-700'
                      }`}
                    />
                    <span className={isCurrent ? 'font-semibold' : ''}>{s}</span>
                  </li>
                );
              })}
              {deal.stage === 'LOST' && (
                <li className="flex items-center gap-2 text-xs text-red-300">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="font-semibold">LOST</span>
                </li>
              )}
            </ol>

            {!isClosed && transitions.length > 0 && (
              <>
                <h2 className="text-sm font-semibold text-zinc-300 mt-5 mb-2">Transition</h2>
                <div className="flex flex-col gap-2">
                  {transitions.map((t) => (
                    <ActionButton
                      key={t}
                      variant={
                        t === 'WON'
                          ? 'primary'
                          : t === 'LOST'
                          ? 'danger'
                          : 'secondary'
                      }
                      size="sm"
                      onClick={() => void onTransition(t)}
                      loading={transitioning === t}
                    >
                      Move to {t}
                    </ActionButton>
                  ))}
                </div>
              </>
            )}
            {isClosed && (
              <p className="text-xs text-zinc-500 mt-4">
                This deal is closed. Transition history is preserved in the
                audit log.
              </p>
            )}
          </GlassPanel>
        </div>

        <GlassPanel className="p-4">
          <h2 className="text-sm font-semibold text-zinc-300 mb-2">Metadata</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Row label="Source" value={deal.source ?? '—'} />
            <Row
              label="Created"
              value={new Date(deal.createdAt).toLocaleString()}
            />
            <Row
              label="Updated"
              value={new Date(deal.updatedAt).toLocaleString()}
            />
            <Row
              label="AI score"
              value={deal.aiScore != null ? String(deal.aiScore) : '—'}
            />
          </div>
        </GlassPanel>

        <StatusBadge status="INFO" label="placeholder" className="hidden" />
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title={`Edit ${deal.name}`}>
        <DealForm
          deal={deal}
          onClose={() => setEditing(false)}
          onUpdated={() => {
            setEditing(false);
            void load();
          }}
        />
      </Modal>
    </TenantShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-surface-border p-3 bg-surface-overlay/40">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="text-sm font-semibold text-zinc-100 mt-1">{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="text-sm text-zinc-200 mt-0.5">{value}</div>
    </div>
  );
}