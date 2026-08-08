'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, Loader2, AlertTriangle } from 'lucide-react';
import {
  tenantTemplatesService,
  type TenantTemplate,
  type TemplateType,
} from '@/services/tenant-templates.service';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AgentPromptField } from './fields/AgentPromptField';
import { KpiListField } from './fields/KpiListField';
import { LifecycleStageEditor } from './fields/LifecycleStageEditor';
import { CustomerFieldEditor } from './fields/CustomerFieldEditor';
import { RoutineTriggerField } from './fields/RoutineTriggerField';
import { ReportMetricPicker } from './fields/ReportMetricPicker';

interface TemplateEditorProps {
  templateType: TemplateType;
  templateId?: string;
  onCancel: () => void;
  onSaved: () => void;
}

export function TemplateEditor({
  templateType,
  templateId,
  onCancel,
  onSaved,
}: TemplateEditorProps) {
  const [template, setTemplate] = useState<TenantTemplate | null>(null);
  const [loading, setLoading] = useState(!!templateId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    industrySlug: '',
    config: {} as Record<string, unknown>,
  });

  useEffect(() => {
    if (!templateId) return;
    setLoading(true);
    tenantTemplatesService
      .get(templateId)
      .then((t) => {
        setTemplate(t);
        setForm({
          name: t.name,
          description: t.description ?? '',
          industrySlug: t.industrySlug ?? '',
          config: t.config,
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load template'))
      .finally(() => setLoading(false));
  }, [templateId]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      if (templateId) {
        await tenantTemplatesService.update(templateId, {
          name: form.name,
          description: form.description || undefined,
          industrySlug: form.industrySlug || undefined,
          config: form.config,
        });
      } else {
        await tenantTemplatesService.create({
          slug: form.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
          name: form.name,
          description: form.description || undefined,
          templateType,
          industrySlug: form.industrySlug || undefined,
          config: form.config,
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleConfigChange = (config: Record<string, unknown>) => {
    setForm((prev) => ({ ...prev, config }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onCancel}
          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-semibold text-foreground">
          {templateId ? 'Edit Template' : 'Create Template'}
        </h2>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </motion.div>
      )}

      <Card className="p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Template name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="industrySlug">Industry Slug</Label>
            <Input
              id="industrySlug"
              value={form.industrySlug}
              onChange={(e) => setForm((p) => ({ ...p, industrySlug: e.target.value }))}
              placeholder="e.g. financial-services"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            placeholder="Optional description"
            rows={2}
          />
        </div>
      </Card>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          Configuration
        </h3>

        {templateType === 'AGENT_ROLE' && (
          <Card className="p-6 space-y-5">
            <AgentPromptField
              value={(form.config as { systemPrompt?: string }).systemPrompt ?? ''}
              onChange={(systemPrompt) =>
                handleConfigChange({ ...form.config, systemPrompt })
              }
            />
            <KpiListField
              value={(form.config as { kpis?: Array<{ name: string; target?: string }> }).kpis ?? []}
              onChange={(kpis) =>
                handleConfigChange({ ...form.config, kpis })
              }
            />
          </Card>
        )}

        {templateType === 'CUSTOMER_LIFECYCLE' && (
          <Card className="p-6 space-y-5">
            <LifecycleStageEditor
              value={(form.config as { stages?: Array<{ key: string; label: string; order: number }> }).stages ?? []}
              onChange={(stages) =>
                handleConfigChange({ ...form.config, stages })
              }
            />
            <div className="space-y-2">
              <Label>Default Stage</Label>
              <Input
                value={(form.config as { defaultStage?: string }).defaultStage ?? ''}
                onChange={(e) =>
                  handleConfigChange({ ...form.config, defaultStage: e.target.value })
                }
                placeholder="Stage key (e.g. prospect)"
              />
            </div>
            <CustomerFieldEditor
              value={
                (form.config as { customerFieldDefinitions?: Array<{ key: string; label: string; type: string; options?: string[] }> }).customerFieldDefinitions ?? []
              }
              onChange={(customerFieldDefinitions) =>
                handleConfigChange({ ...form.config, customerFieldDefinitions })
              }
            />
          </Card>
        )}

        {templateType === 'ROUTINE' && (
          <Card className="p-6 space-y-5">
            <RoutineTriggerField
              value={(form.config as { trigger?: string }).trigger ?? ''}
              onChange={(trigger) =>
                handleConfigChange({ ...form.config, trigger })
              }
            />
            <div className="space-y-2">
              <Label>Action</Label>
              <Textarea
                value={(form.config as { action?: string }).action ?? ''}
                onChange={(e) =>
                  handleConfigChange({ ...form.config, action: e.target.value })
                }
                placeholder="What should the routine do?"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Channels (comma-separated)</Label>
              <Input
                value={
                  Array.isArray((form.config as { channels?: string[] }).channels)
                    ? ((form.config as { channels?: string[] }).channels ?? []).join(', ')
                    : ''
                }
                onChange={(e) =>
                  handleConfigChange({
                    ...form.config,
                    channels: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="in-app, email"
              />
            </div>
          </Card>
        )}

        {templateType === 'REPORT' && (
          <Card className="p-6 space-y-5">
            <ReportMetricPicker
              value={(form.config as { metrics?: string[] }).metrics ?? []}
              onChange={(metrics) =>
                handleConfigChange({ ...form.config, metrics })
              }
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Period</Label>
                <select
                  aria-label="Period"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={(form.config as { period?: string }).period ?? 'monthly'}
                  onChange={(e) =>
                    handleConfigChange({ ...form.config, period: e.target.value })
                  }
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Format</Label>
                <select
                  aria-label="Format"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={(form.config as { format?: string }).format ?? 'dashboard'}
                  onChange={(e) =>
                    handleConfigChange({ ...form.config, format: e.target.value })
                  }
                >
                  <option value="dashboard">Dashboard</option>
                  <option value="table">Table</option>
                  <option value="chart">Chart</option>
                  <option value="pdf">PDF</option>
                  <option value="csv">CSV</option>
                </select>
              </div>
            </div>
          </Card>
        )}

        {templateType === 'TASK_TEMPLATE' && (
          <Card className="p-6 space-y-5">
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={(form.config as { description?: string }).description ?? ''}
                onChange={(e) =>
                  handleConfigChange({ ...form.config, description: e.target.value })
                }
                placeholder="Task description"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Estimated Duration</Label>
                <Input
                  value={(form.config as { estimatedDuration?: string }).estimatedDuration ?? ''}
                  onChange={(e) =>
                    handleConfigChange({ ...form.config, estimatedDuration: e.target.value })
                  }
                  placeholder="e.g. 2 days"
                />
              </div>
              <div className="space-y-2">
                <Label>Assign to Role</Label>
                <Input
                  value={(form.config as { assignToRole?: string }).assignToRole ?? ''}
                  onChange={(e) =>
                    handleConfigChange({ ...form.config, assignToRole: e.target.value })
                  }
                  placeholder="e.g. compliance-officer"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Subtasks (one per line)</Label>
              <Textarea
                value={
                  Array.isArray((form.config as { subtasks?: string[] }).subtasks)
                    ? ((form.config as { subtasks?: string[] }).subtasks ?? []).join('\n')
                    : ''
                }
                onChange={(e) =>
                  handleConfigChange({
                    ...form.config,
                    subtasks: e.target.value
                      .split('\n')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="Enter each subtask on a new line"
                rows={5}
              />
            </div>
          </Card>
        )}

        {templateType === 'DEPARTMENT_DEFAULT' && (
          <Card className="p-6 space-y-5">
            <div className="space-y-2">
              <Label>Departments & Roles (JSON)</Label>
              <Textarea
                value={
                  Array.isArray((form.config as { departments?: Array<{ name: string; roles: string[] }> }).departments)
                    ? JSON.stringify((form.config as { departments?: Array<{ name: string; roles: string[] }> }).departments, null, 2)
                    : '[]'
                }
                onChange={(e) => {
                  const text = e.target.value;
                  try {
                    const parsed = JSON.parse(text);
                    if (!Array.isArray(parsed)) {
                      setError('Departments must be a JSON array');
                      return;
                    }
                    setError(null);
                    handleConfigChange({ ...form.config, departments: parsed });
                  } catch {
                    setError('Invalid JSON for departments — please correct before saving');
                  }
                }}
                placeholder='[{"name": "Sales", "roles": ["Sales Rep", "Sales Manager"]}]'
                rows={12}
                className="font-mono text-sm"
              />
            </div>
          </Card>
        )}
      </div>

      <div className="flex items-center gap-3 pt-4 border-t border-border">
        <Button onClick={handleSave} disabled={saving || !form.name}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span className="ml-1">{templateId ? 'Update' : 'Create'}</span>
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
