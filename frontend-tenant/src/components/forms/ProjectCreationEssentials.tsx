/**
 * ProjectCreationEssentials — Layer 1 of the 3-host create flow.
 *
 * Owns the 8 essentials fields (name, description, customer, project type,
 * status, priority, budget, target date) + the dynamic custom-field block
 * from `ProjectTypeVersion.fieldSchema`. On submit, calls
 * `onSubmit(payload)` which the host (CreateProjectForm) forwards to
 * `projectsService.create`.
 */

'use client';

import { useEffect, useState } from 'react';
import {
  TextField,
  TextAreaField,
  DateField,
  SelectField,
} from '@/components/creatio/FormField';
import { ActionButton } from '@/components/creatio/ActionToolbar';
import { customersService } from '@/services/customers.service';
import { projectTypesService } from '@/services/projectTypes.service';
import { industriesService } from '@/services/industries.service';
import { tenantsService } from '@/services/tenants.service';
import type { Customer } from '@/types/customers.types';
import type {
  BudgetType,
  Priority,
  ProjectStatus,
} from '@/services/projects.service';
import type {
  FieldSchemaItem,
  ProjectType,
  ProjectTypeVersion,
} from '@/services/projectTypes.service';

export interface EssentialsPayload {
  name: string;
  description?: string;
  departmentId?: string;
  customerId?: string;
  projectTypeId?: string;
  projectTypeVersion?: number;
  customFieldValues?: Record<string, unknown>;
  status: ProjectStatus;
  priority: Priority;
  budgetType?: BudgetType;
  budgetAmount?: number;
  targetDate?: string;
  [key: string]: unknown;
}

export interface ProjectCreationEssentialsProps {
  departmentId?: string;
  customerId?: string;
  onSubmit: (payload: EssentialsPayload) => Promise<void> | void;
  onCancel: () => void;
  submitting?: boolean;
  error?: string | null;
}

export function ProjectCreationEssentials({
  departmentId,
  customerId: initialCustomerId,
  onSubmit,
  onCancel,
  submitting,
  error,
}: ProjectCreationEssentialsProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState<string>(initialCustomerId ?? '');
  const [budgetType, setBudgetType] = useState<BudgetType | ''>('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [status, setStatus] = useState<ProjectStatus>('LEAD');

  const [projectTypes, setProjectTypes] = useState<ProjectType[]>([]);
  const [projectTypeId, setProjectTypeId] = useState<string>('');
  const [typeVersion, setTypeVersion] = useState<ProjectTypeVersion | null>(null);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});

  useEffect(() => {
    void customersService
      .list({ status: 'ACTIVE' })
      .then(({ items }) => setCustomers(items))
      .catch(() => setCustomers([]));
    // Issue fix: previous logic filtered by tenant.industry, which often
    // returned zero rows when the tenant's industry (e.g. "Accounting")
    // didn't match any seeded project type. The fallback ran ONLY on
    // network error, not on an empty success. Now we always try the
    // tenant-scoped query first; if it returns zero rows we fall back
    // to the unfiltered catalog so the dropdown is never empty.
    //
    // Phase 9 (PROJTYPE-001): if the capability matrix for this
    // industry + tier advertises a `projectTypesVisible` whitelist,
    // use it as the authoritative filter so the anchor slugs
    // (audit-engagement, tax-filing, bookkeeping-cycle, payroll-cycle,
    // compliance-review) actually surface for accounting tenants.
    void (async () => {
      let items: ProjectType[] = [];
      try {
        const tenant = await tenantsService.getCurrent();
        const tenantIndustry = tenant.industry ?? undefined;
        if (tenantIndustry) {
          const { items: industryItems } = await projectTypesService.list({
            limit: 100,
            industry: tenantIndustry,
          });
          items = industryItems ?? [];
        }
      } catch {
        // ignore — fall through to unfiltered fetch
      }
      if (items.length === 0) {
        try {
          const { items: all } = await projectTypesService.list({ limit: 100 });
          items = all ?? [];
        } catch {
          items = [];
        }
      }
      const seen = new Map<string, ProjectType>();
      for (const pt of items) {
        const key = pt.slug ?? pt.id;
        if (!seen.has(key)) seen.set(key, pt);
      }
      setProjectTypes([...seen.values()]);
    })();
  }, []);

  useEffect(() => {
    if (!projectTypeId) {
      setTypeVersion(null);
      setCustomFieldValues({});
      return;
    }
    void projectTypesService
      .getCurrentVersion(projectTypeId)
      .then((v) => {
        setTypeVersion(v);
        setCustomFieldValues({});
      })
      .catch(() => setTypeVersion(null));
  }, [projectTypeId]);

  function setCustomField(key: string, value: unknown) {
    setCustomFieldValues((prev) => ({ ...prev, [key]: value }));
  }

  function buildPayload(): EssentialsPayload {
    const payload: EssentialsPayload = {
      name: name.trim(),
      status,
      priority,
    };
    if (description.trim()) payload.description = description.trim();
    if (departmentId) payload.departmentId = departmentId;
    if (customerId) payload.customerId = customerId;
    if (targetDate) payload.targetDate = new Date(targetDate).toISOString();
    if (budgetType) payload.budgetType = budgetType;
    if (budgetAmount) payload.budgetAmount = Number(budgetAmount);
    if (projectTypeId) {
      payload.projectTypeId = projectTypeId;
      payload.projectTypeVersion = typeVersion?.version;
      if (Object.keys(customFieldValues).length > 0) {
        payload.customFieldValues = customFieldValues;
      }
    }
    return payload;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    void onSubmit(buildPayload());
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="essentials-host">
      <TextField
        label="Name"
        required
        placeholder="e.g. Q4 product launch"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <TextAreaField
        label="Description"
        placeholder="Project goals and deliverables"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Customer"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
        >
          <option value="">— No customer —</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Project Type"
          value={projectTypeId}
          onChange={(e) => setProjectTypeId(e.target.value)}
        >
          <option value="">— None —</option>
          {projectTypes.map((pt) => (
            <option key={pt.id} value={pt.id}>
              {pt.name}
              {pt.industry ? ` (${pt.industry})` : ''}
              {pt.classification ? ` · ${pt.classification}` : ''}
            </option>
          ))}
        </SelectField>
      </div>

      {typeVersion && typeVersion.fieldSchema.length > 0 ? (
        <div className="border-t border-surface-border pt-3">
          <p className="text-xs text-zinc-500 mb-2 uppercase tracking-wider">Custom Fields</p>
          <div className="space-y-3">
            {typeVersion.fieldSchema.map((field: FieldSchemaItem) => (
              <CustomFieldInput
                key={field.key}
                field={field}
                value={customFieldValues[field.key]}
                onChange={(v) => setCustomField(field.key, v)}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value as ProjectStatus)}
        >
          <option value="LEAD">Lead</option>
          <option value="PROPOSAL_SENT">Proposal Sent</option>
          <option value="WON">Won</option>
          <option value="LOST">Lost</option>
          <option value="ACTIVE">Active</option>
          <option value="ON_HOLD">On Hold</option>
          <option value="REVIEW">Review</option>
          <option value="COMPLETED">Completed</option>
          <option value="ARCHIVED">Archived</option>
        </SelectField>
        <SelectField
          label="Priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority)}
        >
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="URGENT">Urgent</option>
        </SelectField>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <SelectField
          label="Budget Type"
          value={budgetType}
          onChange={(e) => setBudgetType(e.target.value as BudgetType | '')}
        >
          <option value="">—</option>
          <option value="FIXED_FEE">Fixed Fee</option>
          <option value="HOURLY">Hourly</option>
          <option value="RETAINER">Retainer</option>
        </SelectField>
        <TextField
          label="Budget Amount"
          type="number"
          placeholder="0.00"
          value={budgetAmount}
          onChange={(e) => setBudgetAmount(e.target.value)}
        />
        <DateField
          label="Target Date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
        />
      </div>

      {error ? <p className="text-xs text-state-danger">{error}</p> : null}
      <div className="flex justify-end gap-2 pt-3 border-t border-surface-border">
        <ActionButton variant="ghost" size="md" onClick={onCancel} disabled={submitting}>
          Cancel
        </ActionButton>
        <ActionButton
          variant="primary"
          size="md"
          type="submit"
          disabled={submitting || !name.trim()}
          data-testid="essentials-submit"
        >
          {submitting ? 'Creating…' : 'Continue to Discovery →'}
        </ActionButton>
      </div>
    </form>
  );
}

function CustomFieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldSchemaItem;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const fieldLabel = `${field.label}${field.required ? ' *' : ''}`;
  switch (field.type) {
    case 'TEXT':
      return (
        <TextField
          label={fieldLabel}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.label}
        />
      );
    case 'NUMBER':
      return (
        <TextField
          label={fieldLabel}
          type="number"
          value={(value as number) ?? ''}
          onChange={(e) => onChange(parseFloat(e.target.value) || null)}
          placeholder="0"
        />
      );
    case 'DATE':
      return (
        <DateField
          label={fieldLabel}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
        />
      );
    case 'SELECT':
      return (
        <SelectField
          label={fieldLabel}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">— Select —</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </SelectField>
      );
    case 'MULTI_SELECT':
      return (
        <div>
          <label className="block text-xs text-zinc-400 mb-1">
            {field.label}
            {field.required ? <span className="text-[color:var(--state-danger)] ml-0.5">*</span> : null}
          </label>
          <div className="flex flex-wrap gap-1.5">
            {(field.options ?? []).map((opt) => {
              const selected = (value as string[]) ?? [];
              const isSelected = selected.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    onChange(isSelected ? selected.filter((v) => v !== opt) : [...selected, opt]);
                  }}
                  className={`text-xs px-2 py-0.5 rounded-full border transition ${
                    isSelected
                      ? 'border-[color:var(--accent-500)] bg-[color:var(--accent-500)]/20 text-indigo-200'
                      : 'border-surface-border text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      );
    default:
      return null;
  }
}