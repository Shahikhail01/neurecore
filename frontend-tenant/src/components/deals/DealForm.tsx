'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  SelectField,
  TextAreaField,
  TextField,
} from '@/components/creatio/FormField';
import { ActionButton } from '@/components/creatio/ActionToolbar';
import { customersService } from '@/services/customers.service';
import { dealsService } from '@/services/deals.service';
import type { Customer } from '@/types/customers.types';
import type {
  CreateDealPayload,
  Deal,
  DealStage,
} from '@/types/deals.types';

interface DealFormProps {
  deal?: Deal;
  defaultCustomerId?: string;
  onClose: () => void;
  onCreated?: (d: Deal) => void;
  onUpdated?: (d: Deal) => void;
  onSubmittingChange?: (submitting: boolean) => void;
}

const STAGES: { value: DealStage; label: string; needsCloseDate: boolean }[] = [
  { value: 'LEAD', label: 'Lead', needsCloseDate: false },
  { value: 'QUALIFIED', label: 'Qualified', needsCloseDate: false },
  { value: 'PROPOSAL', label: 'Proposal', needsCloseDate: true },
  { value: 'NEGOTIATION', label: 'Negotiation', needsCloseDate: true },
  { value: 'WON', label: 'Won', needsCloseDate: true },
];

export function DealForm({
  deal,
  defaultCustomerId,
  onClose,
  onCreated,
  onUpdated,
  onSubmittingChange,
}: DealFormProps) {
  const isEdit = Boolean(deal);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [customerId, setCustomerId] = useState<string>(
    deal?.customerId ?? defaultCustomerId ?? '',
  );
  const [name, setName] = useState<string>(deal?.name ?? '');
  const [stage, setStage] = useState<DealStage>((deal?.stage as DealStage) ?? 'LEAD');
  const [amount, setAmount] = useState<string>(
    deal?.amount != null ? String(deal.amount) : '',
  );
  const [currency, setCurrency] = useState<string>(deal?.currency ?? 'USD');
  const [probability, setProbability] = useState<string>(
    deal?.probability != null ? String(deal.probability) : '0.10',
  );
  const [expectedCloseDate, setExpectedCloseDate] = useState<string>(
    deal?.expectedCloseDate
      ? new Date(deal.expectedCloseDate).toISOString().slice(0, 10)
      : '',
  );
  const [source, setSource] = useState<string>(deal?.source ?? 'INBOUND');
  const [notes, setNotes] = useState<string>(deal?.notes ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onSubmittingChange?.(submitting);
  }, [submitting, onSubmittingChange]);

  useEffect(() => {
    let cancelled = false;
    setLoadingCustomers(true);
    customersService
      .list({ limit: 200 })
      .then(({ items }) => {
        if (!cancelled) setCustomers(items);
      })
      .catch(() => {
        if (!cancelled) setCustomers([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingCustomers(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const needsCloseDate =
    stage === 'PROPOSAL' || stage === 'NEGOTIATION' || stage === 'WON';

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Deal name is required');
      return;
    }
    if (needsCloseDate && !expectedCloseDate) {
      setError(`Expected close date is required for stage ${stage}`);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const payload: CreateDealPayload = {
        name: name.trim(),
        customerId: customerId || null,
        stage,
        source: source as CreateDealPayload['source'],
        amount: amount === '' ? 0 : Number(amount),
        currency: currency || 'USD',
        probability:
          probability === '' ? undefined : Number(probability),
        expectedCloseDate: expectedCloseDate || null,
        notes: notes || null,
      };
      if (isEdit && deal) {
        const updated = await dealsService.update(deal.id, {
          name: payload.name,
          customerId: payload.customerId,
          amount: payload.amount,
          currency: payload.currency,
          probability: payload.probability,
          expectedCloseDate: payload.expectedCloseDate,
          source: payload.source,
          notes: payload.notes,
        });
        onUpdated?.(updated);
      } else {
        const created = await dealsService.create(payload);
        onCreated?.(created);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save deal');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <TextField
        label="Deal name"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Acme renewal Q4"
        aria-label="Deal name"
      />
      <SelectField
        label="Customer"
        value={customerId}
        onChange={(e) => setCustomerId(e.target.value)}
        aria-label="Customer"
        disabled={loadingCustomers}
      >
        <option value="">— No customer —</option>
        {customers.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </SelectField>
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Stage"
          value={stage}
          onChange={(e) => setStage(e.target.value as DealStage)}
          aria-label="Stage"
        >
          {STAGES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Source"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          aria-label="Source"
        >
          <option value="INBOUND">Inbound</option>
          <option value="OUTBOUND">Outbound</option>
          <option value="REFERRAL">Referral</option>
          <option value="PARTNER">Partner</option>
          <option value="EVENT">Event</option>
          <option value="OTHER">Other</option>
        </SelectField>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <TextField
          label="Amount"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-label="Amount"
        />
        <TextField
          label="Currency"
          value={currency}
          onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 3))}
          aria-label="Currency"
          maxLength={3}
        />
        <TextField
          label="Probability"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          max="1"
          value={probability}
          onChange={(e) => setProbability(e.target.value)}
          hint="0–1; auto-set by stage if blank"
          aria-label="Probability"
        />
      </div>
      <TextField
        label="Expected close date"
        type="date"
        value={expectedCloseDate}
        onChange={(e) => setExpectedCloseDate(e.target.value)}
        required={needsCloseDate}
        hint={
          needsCloseDate
            ? 'Required for Proposal, Negotiation, Won'
            : 'Optional for Lead / Qualified'
        }
        aria-label="Expected close date"
      />
      <TextAreaField
        label="Notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        placeholder="Optional context, objections, next steps…"
        aria-label="Notes"
      />

      {error && (
        <p className="text-xs text-state-danger" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2 pt-2">
        <ActionButton
          type="button"
          variant="ghost"
          onClick={onClose}
          disabled={submitting}
        >
          Cancel
        </ActionButton>
        <ActionButton type="submit" variant="primary" loading={submitting}>
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isEdit ? (
            'Save changes'
          ) : (
            'Create deal'
          )}
        </ActionButton>
      </div>
    </form>
  );
}