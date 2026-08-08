'use client';

/**
 * ApprovalTemplateEditor — per-plan §5.2 — risk-tiered approval chain matrix.
 * Phase 2 stub: collects ordered approval steps with riskTier filter.
 */

import type { ApprovalStep, RiskTier } from '@/services/projectTypes.service';

export type { ApprovalStep, RiskTier };

interface ApprovalTemplateEditorProps {
  steps: ApprovalStep[];
  onChange: (next: ApprovalStep[]) => void;
  readOnly?: boolean;
}

const APPROVER_ROLES = [
  'REVIEWER',
  'PARTNER',
  'PREPARER',
  'CLIENT_LIAISON',
  'COMPLIANCE_OFFICER',
] as const;

const RISK_TIERS: RiskTier[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const EMPTY_STEP: ApprovalStep = {
  stepOrder: 1,
  approverRole: 'REVIEWER',
  approvalType: 'INTERNAL',
  riskTier: ['LOW', 'MEDIUM'],
};

export function ApprovalTemplateEditor({
  steps,
  onChange,
  readOnly = false,
}: ApprovalTemplateEditorProps) {
  function add() {
    onChange([
      ...steps,
      { ...EMPTY_STEP, stepOrder: steps.length + 1 },
    ]);
  }
  function remove(idx: number) {
    onChange(
      steps
        .filter((_, i) => i !== idx)
        .map((s, i) => ({ ...s, stepOrder: i + 1 })),
    );
  }
  function update(idx: number, patch: Partial<ApprovalStep>) {
    onChange(steps.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }
  function toggleRisk(idx: number, tier: RiskTier) {
    const current = steps[idx].riskTier ?? [];
    const next = current.includes(tier)
      ? current.filter((t) => t !== tier)
      : [...current, tier];
    update(idx, { riskTier: next });
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">
        Define an ordered approval chain. Each step is filtered by risk tier — the steps whose
        riskTier array contains the deliverable&apos;s riskTier are resolved at runtime.
      </p>
      {steps.map((step, idx) => (
        <div
          key={idx}
          className="rounded-lg border border-surface-border bg-surface-overlay p-3 space-y-2"
        >
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-600 w-6">#{step.stepOrder}</span>
            <select
              aria-label="Approver role"
              value={step.approverRole}
              onChange={(e) => update(idx, { approverRole: e.target.value })}
              disabled={readOnly}
              className="flex-1 px-2 py-1 bg-surface text-xs text-zinc-200 rounded border border-surface-border focus:outline-none focus:border-[color:var(--accent-500)] disabled:opacity-50"
            >
              {APPROVER_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <select
              aria-label="Approval type"
              value={step.approvalType}
              onChange={(e) =>
                update(idx, { approvalType: e.target.value as ApprovalStep['approvalType'] })
              }
              disabled={readOnly}
              className="px-2 py-1 bg-surface text-xs text-zinc-200 rounded border border-surface-border focus:outline-none focus:border-[color:var(--accent-500)] disabled:opacity-50"
            >
              <option value="INTERNAL">INTERNAL</option>
              <option value="CLIENT_FACING">CLIENT_FACING</option>
              <option value="DUAL">DUAL</option>
            </select>
            {!readOnly && (
              <button
                type="button"
                onClick={() => remove(idx)}
                className="text-zinc-600 hover:text-[color:var(--state-danger)] transition"
                aria-label="Remove step"
              >
                <span aria-hidden className="text-sm">×</span>
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] text-zinc-500">Applies to risk tier:</span>
            {RISK_TIERS.map((tier) => {
              const active = (step.riskTier ?? []).includes(tier);
              return (
                <button
                  key={tier}
                  type="button"
                  disabled={readOnly}
                  onClick={() => toggleRisk(idx, tier)}
                  className={`text-[10px] px-2 py-0.5 rounded border transition ${
                    active
                      ? 'border-[color:var(--accent-500)] bg-[color:var(--accent-500)]/10 text-indigo-300'
                      : 'border-surface-border text-zinc-500 hover:text-zinc-300'
                  } disabled:opacity-50`}
                >
                  {tier}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {!readOnly && (
        <button
          type="button"
          onClick={add}
          className="w-full py-2 rounded-lg border border-dashed border-surface-border text-xs text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition flex items-center justify-center gap-2"
        >
          <span aria-hidden>+</span>
          Add Approval Step
        </button>
      )}
    </div>
  );
}
