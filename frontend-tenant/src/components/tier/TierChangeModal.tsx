'use client';

/**
 * TierChangeModal — tenant-facing plan picker + change request flow.
 *
 * INDUSTRY-SETUP-CONCEPT.md §3.6 / TIER-SYSTEM-CONCEPT.md §8.3.
 *
 * SRP: this modal is render + side-effect. The caller owns `open` /
 * `onClose` / `currentTier`; the modal owns:
 *   1. Fetching the catalogue via `tiersService.list()`
 *   2. Rendering the 4-tier comparison grid (current tier highlighted)
 *   3. Submitting a `tiersService.requestTierChange()` POST and showing
 *      a confirmation banner with the returned `direction` +
 *      `TierChangeRequest.id`.
 *
 * The tenant does NOT mutate their tier directly — per
 * INDUSTRY-GROUPS-CONCEPT.md §1.2 D7, tier change is SuperAdmin-only.
 * We file a PENDING `TierChangeRequest` row; SuperAdmin approves it.
 * The success banner shows the request id so the tenant can quote it
 * if they contact support.
 *
 * DRY: the tier presentation (colours + labels) is shared with TierBadge
 * via `getTierPresentation()` so the badge and the modal look identical.
 */

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Check,
  AlertTriangle,
  Sparkles,
  ArrowUpCircle,
  ArrowDownCircle,
  Loader2,
} from 'lucide-react';
import {
  tiersService,
  type Tier,
  type TierChangeRequestResponse,
} from '@/services/tiers.service';
import { getTierPresentation } from '@/components/tier/TierBadge';

interface TierChangeModalProps {
  open: boolean;
  onClose: () => void;
  /**
   * The tenant's CURRENT tier (resolved by the parent). When null the
   * modal renders without highlighting any row.
   */
  currentTier?: Tier | null;
}

export function TierChangeModal({ open, onClose, currentTier }: TierChangeModalProps) {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null); // tier.id
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TierChangeRequestResponse | null>(null);
  const [reason, setReason] = useState('');

  // Fetch the catalogue whenever the modal opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setResult(null);
    setReason('');
    tiersService
      .list()
      .then((data) => {
        if (!cancelled) setTiers(data);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Failed to load tiers');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Sort tiers by presentation rank ascending so the grid reads left → right
  // = cheap → expensive (matches the order most tenants think about plans).
  const sortedTiers = useMemo(
    () =>
      [...tiers].sort(
        (a, b) =>
          getTierPresentation(a.slug).rank - getTierPresentation(b.slug).rank,
      ),
    [tiers],
  );

  const handleRequest = async (targetTierId: string) => {
    setError(null);
    setSubmitting(targetTierId);
    try {
      const trimmed = reason.trim();
      const res = await tiersService.requestTierChange(
        targetTierId,
        trimmed.length > 0 ? trimmed : undefined,
      );
      setResult(res);
    } catch (err: unknown) {
      // Axios error → try to extract the BE message; fall back to error.message.
      let msg = 'Failed to file tier change request';
      const anyErr = err as { response?: { data?: { message?: string } }; message?: string };
      msg = anyErr?.response?.data?.message ?? anyErr?.message ?? msg;
      setError(msg);
    } finally {
      setSubmitting(null);
    }
  };

  const formatPrice = (t: Tier) => {
    const price = Number(t.monthlyPrice ?? 0);
    return `${t.currency ?? 'USD'} ${price.toFixed(0)}/mo`;
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label="Change subscription tier"
        >
          <div
            className="absolute inset-0 bg-black/60"
            onClick={onClose}
            data-testid="tier-change-modal-backdrop"
          />

          <motion.div
            className="relative w-full max-w-3xl card-surface border border-surface-border shadow-creatio-md flex flex-col max-h-[85vh]"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-surface-border">
              <div>
                <h2 className="text-sm font-semibold text-zinc-100">
                  Change subscription tier
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tier changes require platform admin approval.{' '}
                  {currentTier && (
                    <>
                      You&apos;re on{' '}
                      <strong className="text-zinc-200">{currentTier.name}</strong>.
                    </>
                  )}
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-surface-overlay transition"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {result ? (
                <SuccessBanner
                  result={result}
                  onDismiss={() => {
                    setResult(null);
                    onClose();
                  }}
                />
              ) : (
                <>
                  {error && (
                    <div
                      role="alert"
                      className="rounded-lg border border-state-danger/40 bg-state-danger/10 p-3 text-xs text-state-danger flex items-start gap-2"
                    >
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  {loading ? (
                    <div className="flex items-center gap-2 py-12 justify-center text-xs text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading tier catalogue…
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                      {sortedTiers.map((t) => {
                        const presentation = getTierPresentation(t.slug);
                        const isCurrent = currentTier?.id === t.id;
                        const direction: 'UPGRADE' | 'DOWNGRADE' | 'SAME' | null = currentTier
                          ? currentTier.slug === t.slug
                            ? 'SAME'
                            : presentation.rank >
                              getTierPresentation(currentTier.slug).rank
                              ? 'UPGRADE'
                              : 'DOWNGRADE'
                          : null;
                        const isSubmitting = submitting === t.id;

                        return (
                          <div
                            key={t.id}
                            className={`relative rounded-lg border p-3 flex flex-col gap-2 ${
                              isCurrent
                                ? 'border-primary/60 bg-primary/5 ring-1 ring-primary/30'
                                : 'border-surface-border bg-surface-overlay/20'
                            }`}
                          >
                            {isCurrent && (
                              <span className="absolute -top-2 left-3 inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground text-[9px] px-2 py-0.5 font-bold uppercase tracking-wide">
                                <Check className="w-2.5 h-2.5" /> Current
                              </span>
                            )}
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex h-6 w-6 rounded-full items-center justify-center ${presentation.bgClass} ${presentation.textClass}`}
                              >
                                {direction === 'UPGRADE' ? (
                                  <ArrowUpCircle className="w-3.5 h-3.5" />
                                ) : direction === 'DOWNGRADE' ? (
                                  <ArrowDownCircle className="w-3.5 h-3.5" />
                                ) : (
                                  <Sparkles className="w-3.5 h-3.5" />
                                )}
                              </span>
                              <span className="text-sm font-semibold text-zinc-100">
                                {t.name}
                              </span>
                            </div>
                            {t.tagline && (
                              <p className="text-[11px] text-muted-foreground line-clamp-2">
                                {t.tagline}
                              </p>
                            )}
                            <div className="text-lg font-bold text-zinc-100">
                              {formatPrice(t)}
                            </div>
                            <ul className="text-[10px] text-muted-foreground space-y-0.5">
                              <li>{t.maxUsers} users</li>
                              <li>{t.maxAgents} agents</li>
                              <li>{t.maxDepartments} departments</li>
                              <li>{t.maxStorageGB} GB storage</li>
                            </ul>
                            <button
                              type="button"
                              disabled={
                                isCurrent ||
                                isSubmitting ||
                                (currentTier != null && direction === 'SAME')
                              }
                              onClick={() => void handleRequest(t.id)}
                              className="mt-auto px-3 py-1.5 rounded-md text-xs font-medium border border-surface-border bg-surface-overlay/40 text-zinc-200 hover:bg-surface-overlay transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                            >
                              {isSubmitting ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : isCurrent ? (
                                'Active'
                              ) : direction === 'UPGRADE' ? (
                                <>
                                  <ArrowUpCircle className="w-3 h-3" /> Request upgrade
                                </>
                              ) : direction === 'DOWNGRADE' ? (
                                <>
                                  <ArrowDownCircle className="w-3 h-3" /> Request downgrade
                                </>
                              ) : (
                                'Request'
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="rounded-lg border border-surface-border bg-surface-overlay/20 p-3 space-y-2">
                    <label
                      htmlFor="tier-change-reason"
                      className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium"
                    >
                      Why this change? (optional, max 500 chars)
                    </label>
                    <textarea
                      id="tier-change-reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      maxLength={500}
                      rows={2}
                      placeholder="e.g. We need multi-office support for our 3 regional offices."
                      className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      {reason.length}/500 — shown to your platform admin when they
                      review the request.
                    </p>
                  </div>

                  <p className="text-[10px] text-muted-foreground">
                    Approval typically takes less than 24 hours. You&apos;ll see
                    the new tier limits the moment the admin approves.
                  </p>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SuccessBanner({
  result,
  onDismiss,
}: {
  result: TierChangeRequestResponse;
  onDismiss: () => void;
}) {
  const isUpgrade = result.direction === 'UPGRADE';
  const ArrowIcon = isUpgrade ? ArrowUpCircle : ArrowDownCircle;
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-[color:var(--state-success)]/40 bg-[color:var(--state-success)]/10 p-4 space-y-2"
      data-testid="tier-change-success"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-emerald-300">
        <Check className="w-4 h-4" />
        Tier change {result.direction.toLowerCase()} request filed
      </div>
      <p className="text-xs text-zinc-300">
        Your platform admin will review your request to switch to{' '}
        <strong>{result.toTier.name}</strong> ({result.toTier.slug}).
      </p>
      <p className="text-[10px] text-muted-foreground font-mono">
        Request ID: {result.requestId}
      </p>
      <button
        type="button"
        onClick={onDismiss}
        className="text-xs text-emerald-300 hover:text-emerald-200 underline"
      >
        Done
      </button>
      <ArrowIcon className="absolute right-4 top-4 w-5 h-5 text-[color:var(--state-success)]/30" />
    </motion.div>
  );
}
