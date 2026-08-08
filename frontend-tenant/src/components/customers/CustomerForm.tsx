'use client';
// ─── Customer create/edit form ────────────────────────────────────────────────
//
// INDUSTRY-SETUP-CONCEPT.md §3.2 G10 (Phase 1 G10) — the Industry field
// used to be a free-text TextField, which let users type values like
// "accounting" or "marketing" that didn't match the canonical 16-industry
// taxonomy and broke IndustryCustomerFields downstream (it expects a
// canonical industry slug).
//
// Fix (DRY — single source of truth): replaced with the existing
// <IndustryGroupPicker /> component, the same one used in onboarding.
// Reads the canonical industry list via `GET /industries/groups` and
// optionally pre-filters to the tenant's industry group (via
// `tenantsService.getCurrent()`). Tenants can still pick any industry,
// but the canonical-selector UX removes the typo risk.
//
// Phase 4 (INDUSTRY-SETUP-CONCEPT.md §3.4): added KYC/AML + lifecycle +
// financialSubType fields. The new fields are only shown when the
// tenant's industryGroup is 'financial-compliance' (since the columns
// are first-class on Customer and meaningful only for F&C verticals).
import { useEffect, useState } from 'react';
import { TextField, TextAreaField } from '@/components/creatio/FormField';
import { ActionButton } from '@/components/creatio/ActionToolbar';
import { IndustryCustomerFields } from '@/components/customers/IndustryCustomerFields';
import { IndustryGroupPicker, type IndustryOption } from '@/components/onboarding/IndustryGroupPicker';
import { customersService } from '@/services/customers.service';
import { tenantsService } from '@/services/tenants.service';
import { industriesService } from '@/services/industries.service';
import { useTenantIndustryGroup } from '@/stores/tenantStore';
import { INDUSTRY_GROUP, isFinancialComplianceGroup } from '@/lib/industryGroups';
import type {
  Customer,
  CustomerFinancialSubType,
  CustomerKycStatus,
  CustomerLifecycleStage,
  CustomerRiskRating,
} from '@/types/customers.types';

interface CustomerFormProps {
  customer?: Customer;
  onClose: () => void;
  onCreated?: (c: Customer) => void;
  onUpdated?: (c: Customer) => void;
  /**
   * Notified whenever the form's `submitting` flag flips. Lets the
   * parent disable backdrop/ESC dismissal while a request is in flight
   * so an accidental click can't lose the submission.
   */
  onSubmittingChange?: (submitting: boolean) => void;
}

function extractIndustryFields(billingInfo?: Record<string, unknown> | null): Record<string, string | boolean> {
  if (!billingInfo) return {};
  const fields = billingInfo['industryFields'];
  if (fields && typeof fields === 'object' && !Array.isArray(fields)) {
    const result: Record<string, string | boolean> = {};
    for (const [key, value] of Object.entries(fields as Record<string, unknown>)) {
      if (typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') {
        result[key] = typeof value === 'number' ? String(value) : value;
      }
    }
    return result;
  }
  return {};
}

export function CustomerForm({ customer, onClose, onCreated, onUpdated, onSubmittingChange }: CustomerFormProps) {
  const { industry: tenantIndustry } = useTenantIndustryGroup();
  const [name, setName] = useState(customer?.name ?? '');
  const [industry, setIndustry] = useState(customer?.industry ?? '');
  const [primaryEmail, setPrimaryEmail] = useState(customer?.primaryEmail ?? '');
  const [primaryPhone, setPrimaryPhone] = useState(customer?.primaryPhone ?? '');
  const [tagsInput, setTagsInput] = useState(customer?.tags?.join(', ') ?? '');
  const [industryFieldValues, setIndustryFieldValues] = useState<Record<string, string | boolean>>(
    extractIndustryFields(customer?.billingInfo),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Phase 1 G10 — Industry picker state. We fetch the canonical 16-industry
  // list (grouped server-side) and the tenant's industryGroup so we can
  // pre-filter the picker to the most relevant industries by default.
  const [allIndustries, setAllIndustries] = useState<IndustryOption[]>([]);
  const [tenantGroup, setTenantGroup] = useState<string | null>(null);

  // When creating a new customer (no customer prop), default to tenant's industry
  // so IndustryCustomerFields renders the correct industry-specific fields.
  useEffect(() => {
    if (!customer && tenantIndustry) {
      setIndustry(tenantIndustry);
    }
  }, [customer, tenantIndustry]);

  // Phase 4 — KYC/AML + lifecycle + financialSubType fields. Only shown
  // for tenants in the 'financial-compliance' group.
  const [kycStatus, setKycStatus] = useState<CustomerKycStatus | ''>(
    customer?.kycStatus ?? '',
  );
  const [riskRating, setRiskRating] = useState<CustomerRiskRating | ''>(
    customer?.riskRating ?? '',
  );
  const [taxId, setTaxId] = useState(customer?.taxId ?? '');
  const [financialSubType, setFinancialSubType] = useState<CustomerFinancialSubType | ''>(
    customer?.financialSubType ?? '',
  );
  const [lifecycleStage, setLifecycleStage] = useState<CustomerLifecycleStage | ''>(
    customer?.lifecycleStage ?? '',
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [all, tenant] = await Promise.all([
          industriesService.listAllIndustries(),
          tenantsService.getCurrent().catch(() => null),
        ]);
        if (cancelled) return;
        setAllIndustries(all);
        setTenantGroup(tenant?.industryGroup ?? null);
      } catch {
        // Non-fatal — picker falls back to empty state
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleIndustryFieldChange = (key: string, value: string | boolean) => {
    setIndustryFieldValues((prev) => ({ ...prev, [key]: value }));
  };

  const submit = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setSubmitting(true);
    onSubmittingChange?.(true);
    setError(null);
    try {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const hasIndustryFields = Object.keys(industryFieldValues).length > 0;
      const billingInfo = hasIndustryFields
        ? { industryFields: industryFieldValues }
        : undefined;

      const trimmedIndustry = industry.trim();
      const industryPayload = trimmedIndustry.length > 0 ? trimmedIndustry : undefined;

      // Phase 4 — assemble the F&C payload only when the tenant is in
      // the F&C group AND the user actually filled something in. We
      // never send empty strings for the new columns (the BE serialiser
      // would otherwise persist `kycStatus: ''` which the BE rejects
      // because the enum doesn't include '').
      const fcPayload: Record<string, unknown> = {};
      if (isFinancialComplianceGroup(tenantGroup)) {
        if (kycStatus) fcPayload.kycStatus = kycStatus;
        if (riskRating) fcPayload.riskRating = riskRating;
        if (taxId.trim()) fcPayload.taxId = taxId.trim();
        if (financialSubType) fcPayload.financialSubType = financialSubType;
        if (lifecycleStage) fcPayload.lifecycleStage = lifecycleStage;
      }

      const basePayload = {
        name: name.trim(),
        industry: industryPayload,
        primaryEmail: primaryEmail.trim() || undefined,
        primaryPhone: primaryPhone.trim() || undefined,
        tags,
        billingInfo,
        ...fcPayload,
      };

      if (customer) {
        const updated = await customersService.update(customer.id, basePayload);
        onUpdated?.(updated);
      } else {
        const created = await customersService.create(basePayload);
        onCreated?.(created);
      }
      onClose();
    } catch (e: unknown) {
      // Surface server-side validation messages cleanly. Axios errors carry
      // { response: { data: { error: { message } } } } or { response: { data: { message } } }
      // depending on the layer that rejected. Fall back to the raw error.
      const message =
        (e as { response?: { data?: { error?: { message?: string }; message?: string } } })?.response
          ?.data?.error?.message ??
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (e instanceof Error ? e.message : 'Failed to save customer');
      setError(message);
      // Do NOT close on error — caller stays on the form to fix and retry.
    } finally {
      setSubmitting(false);
      onSubmittingChange?.(false);
    }
  };

  const showFcFields = isFinancialComplianceGroup(tenantGroup);

  return (
    <div className="space-y-4">
      <TextField
        label="Name"
        required
        placeholder="Acme Industries"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Industry
          {tenantGroup ? (
            <span className="ml-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/70">
              · your tenant group: {tenantGroup}
            </span>
          ) : null}
        </label>
        <IndustryGroupPicker
          industries={allIndustries}
          value={industry}
          onChange={setIndustry}
          showSubIndustries={false}
        />
      </div>

      {showFcFields && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-foreground">
                Financial &amp; Compliance fields
              </div>
              <div className="text-[10px] text-muted-foreground">
                KYC/AML + lifecycle + sub-type. Persisted on first-class columns.
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label htmlFor="customer-financial-subtype" className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80">
                Sub-Type
              </label>
              <select
                id="customer-financial-subtype"
                value={financialSubType}
                onChange={(e) => setFinancialSubType(e.target.value as CustomerFinancialSubType | '')}
                className="w-full px-2 py-1.5 text-xs rounded-md border border-input bg-background"
              >
                <option value="">—</option>
                <option value="BANKING">Banking</option>
                <option value="INSURANCE">Insurance</option>
                <option value="WEALTH_MANAGEMENT">Wealth Management</option>
                               <option value="INVESTMENT">Investment</option>
                <option value="FINTECH">FinTech</option>
                <option value="ACCOUNTING_AUDIT">Accounting &amp; Audit</option>
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="customer-lifecycle-stage" className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80">
                Lifecycle Stage
              </label>
              <select
                id="customer-lifecycle-stage"
                value={lifecycleStage}
                onChange={(e) => setLifecycleStage(e.target.value as CustomerLifecycleStage | '')}
                className="w-full px-2 py-1.5 text-xs rounded-md border border-input bg-background"
              >
                <option value="">—</option>
                <option value="PROSPECT">Prospect</option>
                <option value="KYC_VERIFIED">KYC Verified</option>
                <option value="ACTIVE">Active</option>
                <option value="DORMANT">Dormant</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="customer-kyc-status" className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80">
                KYC Status
              </label>
              <select
                id="customer-kyc-status"
                value={kycStatus}
                onChange={(e) => setKycStatus(e.target.value as CustomerKycStatus | '')}
                className="w-full px-2 py-1.5 text-xs rounded-md border border-input bg-background"
              >
                <option value="">—</option>
                <option value="PENDING">Pending</option>
                <option value="VERIFIED">Verified</option>
                <option value="EXPIRED">Expired</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="customer-risk-rating" className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80">
                Risk Rating
              </label>
              <select
                id="customer-risk-rating"
                value={riskRating}
                onChange={(e) => setRiskRating(e.target.value as CustomerRiskRating | '')}
                className="w-full px-2 py-1.5 text-xs rounded-md border border-input bg-background"
              >
                <option value="">—</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
          </div>
          <TextField
            label="Tax ID / EIN"
            placeholder="XX-XXXXXXX"
            value={taxId}
            onChange={(e) => setTaxId(e.target.value)}
          />
        </div>
      )}

      <TextField
        label="Primary Email"
        type="email"
        placeholder="ops@acme.com"
        value={primaryEmail}
        onChange={(e) => setPrimaryEmail(e.target.value)}
      />
      <TextField
        label="Primary Phone"
        type="tel"
        placeholder="+1 …"
        value={primaryPhone}
        onChange={(e) => setPrimaryPhone(e.target.value)}
      />
      <TextAreaField
        label="Tags"
        placeholder="comma-separated, e.g. priority, retainer"
        value={tagsInput}
        onChange={(e) => setTagsInput(e.target.value)}
        rows={1}
      />

      <IndustryCustomerFields
        industrySlug={industry || null}
        fieldValues={industryFieldValues}
        onFieldChange={handleIndustryFieldChange}
      />

      {error && <p className="text-xs text-state-danger">{error}</p>}
      <div className="flex justify-end gap-2 pt-3 border-t border-surface-border">
        <ActionButton variant="ghost" size="md" onClick={onClose} disabled={submitting}>
          Cancel
        </ActionButton>
        <ActionButton
          variant="primary"
          size="md"
          onClick={submit}
          disabled={submitting || !name.trim()}
        >
          {submitting ? 'Saving…' : customer ? 'Save Changes' : 'Create Customer'}
        </ActionButton>
      </div>
    </div>
  );
}
