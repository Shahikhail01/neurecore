'use client';
// ─── Create Workflow Form ─────────────────────────────────────────────────────
import { useState } from 'react';
import { TextField, TextAreaField } from '@/components/creatio/FormField';
import { ActionButton } from '@/components/creatio/ActionToolbar';
import api from '@/services/api';

export interface CreateWorkflowFormProps {
  onClose: () => void;
  onCreated?: (id: string) => void;
}

type WorkflowTemplateId =
  | 'customer-onboarding'
  | 'approval-routing'
  | 'incident-escalation'
  | 'renewal-follow-up';

const WORKFLOW_TEMPLATES: Array<{
  id: WorkflowTemplateId;
  label: string;
  description: string;
  stageCount: number;
  buildDefinition: () => Record<string, unknown>;
}> = [
  {
    id: 'customer-onboarding',
    label: 'Customer Onboarding',
    description: 'Lead a new customer from intake through setup, approval, and follow-up handoff.',
    stageCount: 4,
    buildDefinition: () => ({
      nodes: [
        { id: 'intake', label: 'Intake', type: 'intake' },
        { id: 'setup', label: 'Configure Workspace', type: 'task' },
        { id: 'approval', label: 'Manager Approval', type: 'approval' },
        { id: 'handoff', label: 'Success Handoff', type: 'handoff' },
      ],
      edges: [
        { source: 'intake', target: 'setup' },
        { source: 'setup', target: 'approval' },
        { source: 'approval', target: 'handoff' },
      ],
    }),
  },
  {
    id: 'approval-routing',
    label: 'Approval Routing',
    description: 'Route a request through drafting, review, approval, and completion.',
    stageCount: 4,
    buildDefinition: () => ({
      nodes: [
        { id: 'draft', label: 'Draft Request', type: 'task' },
        { id: 'review', label: 'Review Context', type: 'review' },
        { id: 'approval', label: 'Approval Decision', type: 'approval' },
        { id: 'complete', label: 'Complete Action', type: 'completion' },
      ],
      edges: [
        { source: 'draft', target: 'review' },
        { source: 'review', target: 'approval' },
        { source: 'approval', target: 'complete' },
      ],
    }),
  },
  {
    id: 'incident-escalation',
    label: 'Incident Escalation',
    description: 'Detect, triage, escalate, and close an operational incident with clear checkpoints.',
    stageCount: 4,
    buildDefinition: () => ({
      nodes: [
        { id: 'detect', label: 'Detect Incident', type: 'monitor' },
        { id: 'triage', label: 'Triage', type: 'task' },
        { id: 'escalate', label: 'Escalate', type: 'handoff' },
        { id: 'close', label: 'Close Incident', type: 'completion' },
      ],
      edges: [
        { source: 'detect', target: 'triage' },
        { source: 'triage', target: 'escalate' },
        { source: 'escalate', target: 'close' },
      ],
    }),
  },
  {
    id: 'renewal-follow-up',
    label: 'Renewal Follow-up',
    description: 'Coordinate renewal preparation, outreach, approval, and conversion follow-up.',
    stageCount: 4,
    buildDefinition: () => ({
      nodes: [
        { id: 'prepare', label: 'Prepare Renewal', type: 'task' },
        { id: 'outreach', label: 'Customer Outreach', type: 'communication' },
        { id: 'approval', label: 'Commercial Approval', type: 'approval' },
        { id: 'convert', label: 'Convert / Follow Up', type: 'completion' },
      ],
      edges: [
        { source: 'prepare', target: 'outreach' },
        { source: 'outreach', target: 'approval' },
        { source: 'approval', target: 'convert' },
      ],
    }),
  },
];

export function CreateWorkflowForm({ onClose, onCreated }: CreateWorkflowFormProps) {
  const [templateId, setTemplateId] = useState<WorkflowTemplateId>('customer-onboarding');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isTemplate, setIsTemplate] = useState(false);
  const [autoActivate, setAutoActivate] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeTemplate = WORKFLOW_TEMPLATES.find((template) => template.id === templateId) ?? WORKFLOW_TEMPLATES[0];

  const submit = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        definition: activeTemplate.buildDefinition(),
        config: {
          templateId: activeTemplate.id,
          stageCount: activeTemplate.stageCount,
          starterTemplate: true,
        },
        isTemplate,
      };
      if (description.trim()) payload.description = description.trim();

      const res = await api.post('/workflows', payload);
      const created = res?.data?.data ?? res?.data ?? res;
      if (autoActivate && created?.id) {
        await api.patch(`/workflows/${created.id}/activate`);
      }
      onCreated?.(created?.id ?? '');
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create workflow');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Workflow template</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {WORKFLOW_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => setTemplateId(template.id)}
              className={`rounded-xl border p-3 text-left transition ${
                templateId === template.id
                  ? 'border-accent-500 bg-accent-500/10'
                  : 'border-surface-border bg-surface-overlay hover:border-zinc-500'
              }`}
            >
              <p className="text-sm font-medium text-zinc-100">{template.label}</p>
              <p className="mt-1 text-xs text-zinc-500">{template.description}</p>
            </button>
          ))}
        </div>
      </div>

      <TextField
        label="Name"
        required
        placeholder="e.g. Customer onboarding"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <TextAreaField
        label="Description"
        placeholder="What does this workflow do?"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
        <input
          type="checkbox"
          checked={isTemplate}
          onChange={(e) => setIsTemplate(e.target.checked)}
          className="w-4 h-4 rounded border-surface-border bg-surface-overlay accent-accent-500"
        />
        Save as template
      </label>
      <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
        <input
          type="checkbox"
          checked={autoActivate}
          onChange={(e) => setAutoActivate(e.target.checked)}
          className="w-4 h-4 rounded border-surface-border bg-surface-overlay accent-accent-500"
        />
        Auto-activate after creation
      </label>
      <div className="rounded-xl border border-surface-border bg-surface-overlay p-3">
        <p className="text-sm font-medium text-zinc-100">{activeTemplate.label}</p>
        <p className="mt-1 text-xs text-zinc-500">{activeTemplate.description}</p>
        <p className="mt-2 text-[11px] text-zinc-400">
          Starter definition includes {activeTemplate.stageCount} workflow stages and can be refined later in the builder.
        </p>
      </div>
      <p className="text-xs text-zinc-500">
        This creates a meaningful starter definition instead of an empty workflow shell.
      </p>
      {error && <p className="text-xs text-state-danger">{error}</p>}
      <div className="flex justify-end gap-2 pt-3 border-t border-surface-border">
        <ActionButton variant="ghost" size="md" onClick={onClose} disabled={submitting}>
          Cancel
        </ActionButton>
        <ActionButton variant="primary" size="md" onClick={submit} disabled={submitting || !name.trim()}>
          {submitting ? 'Creating…' : 'Create Workflow'}
        </ActionButton>
      </div>
    </div>
  );
}
