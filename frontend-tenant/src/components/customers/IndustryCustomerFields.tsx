'use client';

/**
 * IndustryCustomerFields
 *
 * Stage 2 Phase 2B: Dynamic customer field rendering.
 *
 * Reads per-industry customer field definitions from the backend API
 * and renders structured form sections with appropriate input types.
 * Fields are grouped by `appearance.section` for logical organization.
 *
 * Props:
 * - industrySlug: the customer's industry (e.g. 'financial-services')
 * - fieldValues: current values for the dynamic fields (controlled form)
 * - onFieldChange: callback when any field value changes
 *
 * SOLID:
 * - SRP: This component ONLY renders industry-specific fields.
 * - OCP: New industry = new definitions in backend registry. Zero changes here.
 * - ISP: Tight interface (industrySlug + values + onChange).
 */

import { useState, useEffect, useCallback } from 'react';
import { TextField, SelectField, DateField } from '@/components/creatio/FormField';
import api from '@/services/api';
import { unwrapItem } from '@/services/unwrap';

export interface CustomerFieldDef {
  key: string;
  label: string;
  type: 'string' | 'enum' | 'date' | 'month-day' | 'boolean' | 'encrypted';
  options?: string[];
  required: boolean;
  placeholder?: string;
  hint?: string;
  appearance?: { section: string; order: number };
}

export interface CustomerFieldSection {
  section: string;
  fields: CustomerFieldDef[];
}

interface CustomerFieldsResponse {
  industrySlug: string;
  hasFields: boolean;
  fields: CustomerFieldDef[];
  sections: CustomerFieldSection[];
}

export interface IndustryCustomerFieldsProps {
  industrySlug: string | null | undefined;
  fieldValues: Record<string, string | boolean>;
  onFieldChange: (key: string, value: string | boolean) => void;
}

async function fetchFieldDefinitions(industrySlug: string): Promise<CustomerFieldsResponse | null> {
  try {
    const res = await api.get(`/industries/${encodeURIComponent(industrySlug)}/customer-fields`);
    return unwrapItem(res) as CustomerFieldsResponse;
  } catch {
    return null;
  }
}

function renderField(
  def: CustomerFieldDef,
  value: string | boolean | undefined,
  onChange: (key: string, value: string | boolean) => void,
) {
  const currentValue = value ?? '';

  switch (def.type) {
    case 'boolean':
      return (
        <SelectField
          key={def.key}
          label={def.label}
          required={def.required}
          hint={def.hint}
          value={currentValue === true ? 'true' : currentValue === false ? 'false' : ''}
          onChange={(e) => {
            const v = e.target.value;
            if (v === 'true') onChange(def.key, true);
            else if (v === 'false') onChange(def.key, false);
          }}
        >
          <option value="">— Select —</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </SelectField>
      );

    case 'enum':
      return (
        <SelectField
          key={def.key}
          label={def.label}
          required={def.required}
          hint={def.hint}
          value={String(currentValue)}
          onChange={(e) => onChange(def.key, e.target.value)}
        >
          <option value="">— {def.required ? 'Select' : 'None'} —</option>
          {def.options?.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </SelectField>
      );

    case 'date':
      return (
        <DateField
          key={def.key}
          label={def.label}
          required={def.required}
          hint={def.hint}
          value={String(currentValue)}
          onChange={(e) => onChange(def.key, e.target.value)}
        />
      );

    case 'month-day': {
      // MM-DD only. Renders two number inputs and persists as MM-DD string.
      const monthValue = String(currentValue).slice(0, 2);
      const dayValue = String(currentValue).slice(3, 5);
      const fieldKey = def.key;
      const handleMonth = (m: string) => {
        const mm = m.padStart(2, '0').slice(0, 2);
        const next = `${mm}-${dayValue || '01'}`;
        onChange(fieldKey, next);
      };
      const handleDay = (d: string) => {
        const dd = d.padStart(2, '0').slice(0, 2);
        const next = `${monthValue || '01'}-${dd}`;
        onChange(fieldKey, next);
      };
      return (
        <div key={def.key} className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            {def.label}
            {def.required && <span className="text-destructive ml-1">*</span>}
          </label>
          {def.hint && (
            <p className="text-xs text-muted-foreground">{def.hint}</p>
          )}
          <div className="flex items-center gap-2">
            <select
              aria-label={`${def.label} — month`}
              value={monthValue}
              onChange={(e) => handleMonth(e.target.value)}
              className="bg-surface-overlay border border-surface-border rounded-md px-3 py-2 text-sm text-zinc-100"
            >
              <option value="">Month</option>
              {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <span className="text-sm text-muted-foreground">/</span>
            <select
              aria-label={`${def.label} — day`}
              value={dayValue}
              onChange={(e) => handleDay(e.target.value)}
              className="bg-surface-overlay border border-surface-border rounded-md px-3 py-2 text-sm text-zinc-100"
            >
              <option value="">Day</option>
              {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0')).map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>
      );
    }

    case 'encrypted':
      return (
        <TextField
          key={def.key}
          label={`${def.label} (Encrypted)`}
          required={def.required}
          placeholder={def.placeholder}
          hint={def.hint}
          type="password"
          value={String(currentValue)}
          onChange={(e) => onChange(def.key, e.target.value)}
        />
      );

    case 'string':
    default:
      return (
        <TextField
          key={def.key}
          label={def.label}
          required={def.required}
          placeholder={def.placeholder}
          hint={def.hint}
          value={String(currentValue)}
          onChange={(e) => onChange(def.key, e.target.value)}
        />
      );
  }
}

export function IndustryCustomerFields({
  industrySlug,
  fieldValues,
  onFieldChange,
}: IndustryCustomerFieldsProps) {
  const [sections, setSections] = useState<CustomerFieldSection[]>([]);
  const [loading, setLoading] = useState(false);

  const loadFields = useCallback(async () => {
    if (!industrySlug) {
      setSections([]);
      return;
    }
    setLoading(true);
    const data = await fetchFieldDefinitions(industrySlug);
    setSections(data?.sections ?? []);
    setLoading(false);
  }, [industrySlug]);

  useEffect(() => {
    void loadFields();
  }, [loadFields]);

  if (!industrySlug || (!loading && sections.length === 0)) {
    return null;
  }

  if (loading) {
    return (
      <div className="space-y-4 mt-4">
        <p className="text-xs text-zinc-500">Loading industry-specific fields...</p>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-3 w-24 bg-surface-muted rounded mb-2" />
              <div className="h-9 w-full bg-surface-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 border-t border-surface-border pt-4">
      <h3 className="text-sm font-semibold text-zinc-300 mb-1">
        Industry-Specific Fields
      </h3>
      <p className="text-xs text-zinc-500 mb-4">
        Fields configured for {industrySlug}
      </p>

      {sections.map((section) => (
        <div key={section.section} className="mb-5">
          <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">
            {section.section}
          </h4>
          <div className="space-y-3">
            {section.fields.map((def) =>
              renderField(def, fieldValues[def.key], onFieldChange),
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
