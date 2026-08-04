'use client';
// ─── Create Routine Form (simplified v1) ──────────────────────────────────────
// v1 form: name + ownerAgentId + cron expression.
// A minimal agent node graph is pre-filled so the backend graph validator passes.
// Full visual graph builder is v2.
import { useState } from 'react';
import { TextField, TextAreaField, SelectField } from '@/components/creatio/FormField';
import { ActionButton } from '@/components/creatio/ActionToolbar';
import api from '@/services/api';

interface Agent {
  id: string;
  name: string;
}

export interface CreateRoutineFormProps {
  agents?: Agent[];
  onClose: () => void;
  onCreated?: (id: string) => void;
}

type RoutineTemplateId =
  | 'daily-briefing'
  | 'approval-checkpoint'
  | 'webhook-intake'
  | 'event-follow-up';

interface RoutineTemplateDefinition {
  id: RoutineTemplateId;
  label: string;
  description: string;
  triggerType: 'SCHEDULE' | 'WEBHOOK' | 'EVENT' | 'MANUAL';
  defaultCron?: string;
  triggerHint: string;
  metadata: Record<string, unknown>;
  buildGraph: (ownerAgentId: string, withApproval: boolean) => {
    nodes: Array<{
      id: string;
      name: string;
      type: 'agent' | 'tool' | 'condition' | 'approval' | 'transform';
      config: Record<string, unknown>;
    }>;
    edges: Array<{ source: string; target: string }>;
    entryPoint: string;
  };
}

const ROUTINE_TEMPLATES: RoutineTemplateDefinition[] = [
  {
    id: 'daily-briefing',
    label: 'Daily Briefing',
    description: 'Run an agent on a schedule to prepare recurring summaries, reviews, or planning packs.',
    triggerType: 'SCHEDULE',
    defaultCron: '0 9 * * *',
    triggerHint: 'Runs on a daily or recurring schedule.',
    metadata: { category: 'operations', recommendedOutcome: 'digest' },
    buildGraph: (ownerAgentId, withApproval) => ({
      nodes: [
        { id: 'start', name: 'Prepare inputs', type: 'transform', config: {} },
        { id: 'agent-run', name: 'Run owner agent', type: 'agent', config: { agentId: ownerAgentId } },
        ...(withApproval
          ? [{ id: 'approval', name: 'Manager review', type: 'approval' as const, config: { approval: { name: 'Routine approval', approverRoles: ['MANAGER'] } } }]
          : []),
      ],
      edges: [
        { source: 'start', target: 'agent-run' },
        ...(withApproval ? [{ source: 'agent-run', target: 'approval' }] : []),
      ],
      entryPoint: 'start',
    }),
  },
  {
    id: 'approval-checkpoint',
    label: 'Approval Checkpoint',
    description: 'Run an agent, then force a review gate before downstream action proceeds.',
    triggerType: 'MANUAL',
    triggerHint: 'Designed for high-impact manual launches.',
    metadata: { category: 'governance', requiresReview: true },
    buildGraph: (ownerAgentId, withApproval) => ({
      nodes: [
        { id: 'start', name: 'Start', type: 'transform', config: {} },
        { id: 'agent-run', name: 'Draft recommendation', type: 'agent', config: { agentId: ownerAgentId } },
        { id: 'approval', name: 'Human approval', type: 'approval', config: { approval: { name: 'Checkpoint approval', approverRoles: ['MANAGER', 'SUPERVISOR'] } } },
        ...(withApproval ? [{ id: 'post-review', name: 'Post approval handoff', type: 'transform' as const, config: {} }] : []),
      ],
      edges: [
        { source: 'start', target: 'agent-run' },
        { source: 'agent-run', target: 'approval' },
        ...(withApproval ? [{ source: 'approval', target: 'post-review' }] : []),
      ],
      entryPoint: 'start',
    }),
  },
  {
    id: 'webhook-intake',
    label: 'Webhook Intake',
    description: 'Expose a webhook endpoint that ingests inbound events and routes them to the owner agent.',
    triggerType: 'WEBHOOK',
    triggerHint: 'Creates a secure inbound webhook trigger.',
    metadata: { category: 'integration', inbound: true },
    buildGraph: (ownerAgentId, withApproval) => ({
      nodes: [
        { id: 'ingest', name: 'Normalize payload', type: 'transform', config: {} },
        { id: 'agent-run', name: 'Triage event', type: 'agent', config: { agentId: ownerAgentId } },
        ...(withApproval
          ? [{ id: 'approval', name: 'Approve action', type: 'approval' as const, config: { approval: { name: 'Webhook action approval', approverRoles: ['MANAGER'] } } }]
          : []),
      ],
      edges: [
        { source: 'ingest', target: 'agent-run' },
        ...(withApproval ? [{ source: 'agent-run', target: 'approval' }] : []),
      ],
      entryPoint: 'ingest',
    }),
  },
  {
    id: 'event-follow-up',
    label: 'Event Follow-up',
    description: 'Listen for business events and let an agent perform a contextual follow-up action.',
    triggerType: 'EVENT',
    triggerHint: 'Useful for lifecycle, service, or sales follow-up reactions.',
    metadata: { category: 'orchestration', reactive: true },
    buildGraph: (ownerAgentId, withApproval) => ({
      nodes: [
        { id: 'event-parse', name: 'Parse business event', type: 'transform', config: {} },
        { id: 'agent-run', name: 'Prepare follow-up', type: 'agent', config: { agentId: ownerAgentId } },
        ...(withApproval
          ? [{ id: 'approval', name: 'Approve outreach', type: 'approval' as const, config: { approval: { name: 'Follow-up approval', approverRoles: ['MANAGER'] } } }]
          : []),
      ],
      edges: [
        { source: 'event-parse', target: 'agent-run' },
        ...(withApproval ? [{ source: 'agent-run', target: 'approval' }] : []),
      ],
      entryPoint: 'event-parse',
    }),
  },
];

export function CreateRoutineForm({ agents = [], onClose, onCreated }: CreateRoutineFormProps) {
  const [templateId, setTemplateId] = useState<RoutineTemplateId>('daily-briefing');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ownerAgentId, setOwnerAgentId] = useState('');
  const [cron, setCron] = useState('0 9 * * *');
  const [eventTypes, setEventTypes] = useState('customer.updated');
  const [webhookMethod, setWebhookMethod] = useState<'POST' | 'GET' | 'ANY'>('POST');
  const [withApproval, setWithApproval] = useState(false);
  const [autoActivate, setAutoActivate] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeTemplate = ROUTINE_TEMPLATES.find((template) => template.id === templateId) ?? ROUTINE_TEMPLATES[0];

  const applyTemplate = (id: RoutineTemplateId) => {
    const template = ROUTINE_TEMPLATES.find((candidate) => candidate.id === id) ?? ROUTINE_TEMPLATES[0];
    setTemplateId(template.id);
    setCron(template.defaultCron ?? '0 9 * * *');
    setWithApproval(Boolean(template.metadata.requiresReview));
    setError(null);
  };

  const submit = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!ownerAgentId) {
      setError('Owner agent is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const graphDefinition = activeTemplate.buildGraph(ownerAgentId, withApproval);
      const triggerConfig =
        activeTemplate.triggerType === 'SCHEDULE'
          ? { cronExpression: cron }
          : activeTemplate.triggerType === 'WEBHOOK'
          ? { method: webhookMethod, authType: 'signature' }
          : activeTemplate.triggerType === 'EVENT'
          ? { eventTypes: eventTypes.split(',').map((value) => value.trim()).filter(Boolean) }
          : {};

      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        ownerAgentId,
        graphDefinition,
        config: { timeoutMs: 60000, checkpointEnabled: withApproval },
        metadata: {
          ...activeTemplate.metadata,
          templateId: activeTemplate.id,
          templateLabel: activeTemplate.label,
          approvalEnabled: withApproval,
        },
        triggers: [
          {
            type: activeTemplate.triggerType,
            name: `${name} ${activeTemplate.triggerType.toLowerCase()} trigger`,
            config: triggerConfig,
          },
        ],
      };

      const res = await api.post('/routines', payload);
      const created = res?.data?.data ?? res?.data ?? res;
      if (autoActivate && created?.id) {
        await api.put(`/routines/${created.id}`, { status: 'ACTIVE' });
      }
      onCreated?.(created?.id ?? '');
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create routine');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Routine template</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {ROUTINE_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => applyTemplate(template.id)}
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
        placeholder="e.g. Daily report digest"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <TextAreaField
        label="Description"
        placeholder="What does this routine do?"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <SelectField
        label="Owner Agent"
        required
        value={ownerAgentId}
        onChange={(e) => setOwnerAgentId(e.target.value)}
      >
        <option value="">— Select agent —</option>
        {agents.map((a) => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </SelectField>

      <div className="rounded-xl border border-surface-border bg-surface-overlay p-4 space-y-3">
        <div>
          <p className="text-sm font-medium text-zinc-100">{activeTemplate.label}</p>
          <p className="text-xs text-zinc-500 mt-1">{activeTemplate.triggerHint}</p>
        </div>

        {activeTemplate.triggerType === 'SCHEDULE' && (
          <TextField
            label="Cron Expression"
            required
            placeholder="0 9 * * *"
            hint="5-field cron (minute hour dom month dow)"
            value={cron}
            onChange={(e) => setCron(e.target.value)}
          />
        )}

        {activeTemplate.triggerType === 'EVENT' && (
          <TextField
            label="Event Types"
            required
            placeholder="customer.updated, deal.won"
            hint="Comma-separated business event types"
            value={eventTypes}
            onChange={(e) => setEventTypes(e.target.value)}
          />
        )}

        {activeTemplate.triggerType === 'WEBHOOK' && (
          <SelectField
            label="Webhook Method"
            value={webhookMethod}
            onChange={(e) => setWebhookMethod(e.target.value as 'POST' | 'GET' | 'ANY')}
          >
            <option value="POST">POST</option>
            <option value="GET">GET</option>
            <option value="ANY">ANY</option>
          </SelectField>
        )}

        <label className="flex items-start gap-3 rounded-lg border border-surface-border px-3 py-2">
          <input
            type="checkbox"
            checked={withApproval}
            onChange={(e) => setWithApproval(e.target.checked)}
            className="mt-0.5"
          />
          <div>
            <p className="text-sm text-zinc-200">Add approval gate</p>
            <p className="text-xs text-zinc-500">Insert a human review checkpoint for higher-risk automations.</p>
          </div>
        </label>

        <label className="flex items-start gap-3 rounded-lg border border-surface-border px-3 py-2">
          <input
            type="checkbox"
            checked={autoActivate}
            onChange={(e) => setAutoActivate(e.target.checked)}
            className="mt-0.5"
          />
          <div>
            <p className="text-sm text-zinc-200">Auto-activate after creation</p>
            <p className="text-xs text-zinc-500">Start the routine immediately instead of leaving it in draft.</p>
          </div>
        </label>
      </div>

      <p className="text-xs text-zinc-500">
        This composer builds a deployable starter graph from the selected template and persists the initial trigger in one step.
      </p>
      {error && <p className="text-xs text-state-danger">{error}</p>}
      <div className="flex justify-end gap-2 pt-3 border-t border-surface-border">
        <ActionButton variant="ghost" size="md" onClick={onClose} disabled={submitting}>
          Cancel
        </ActionButton>
        <ActionButton variant="primary" size="md" onClick={submit} disabled={submitting || !name.trim() || !ownerAgentId}>
          {submitting ? 'Creating…' : 'Create Routine'}
        </ActionButton>
      </div>
    </div>
  );
}
