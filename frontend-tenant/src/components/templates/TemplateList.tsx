'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Plus,
  Pencil,
  Copy,
  Archive,
  RotateCcw,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import {
  tenantTemplatesService,
  type TenantTemplate,
  type TemplateType,
  TEMPLATE_TYPE_LABELS,
} from '@/services/tenant-templates.service';
import { tenantsService } from '@/services/tenants.service';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TemplateEditor } from './TemplateEditor';

interface TemplateListProps {
  templateType: TemplateType;
}

export function TemplateList({ templateType }: TemplateListProps) {
  const [templates, setTemplates] = useState<TenantTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [reseedLoading, setReseedLoading] = useState(false);
  const [tenantIndustry, setTenantIndustry] = useState<string | null>(null);

  useEffect(() => {
    tenantsService.getCurrent().then((t) => setTenantIndustry(t.industry)).catch(() => {});
  }, []);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await tenantTemplatesService.list(templateType);
      setTemplates(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [templateType]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleArchive = async (id: string) => {
    try {
      await tenantTemplatesService.archive(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive template');
    }
  };

  const handleClone = async (id: string) => {
    try {
      await tenantTemplatesService.clone(id);
      await fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clone template');
    }
  };

  const handleReseed = async () => {
    if (!tenantIndustry) return;
    setReseedLoading(true);
    try {
      await tenantTemplatesService.reseed(tenantIndustry);
      await fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore defaults');
    } finally {
      setReseedLoading(false);
    }
  };

  const handleApplyBaseline = async () => {
    setReseedLoading(true);
    try {
      await tenantTemplatesService.applyBaseline();
      await fetchTemplates();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to apply baseline templates',
      );
    } finally {
      setReseedLoading(false);
    }
  };

  const handleSaved = () => {
    setEditingId(null);
    setCreating(false);
    fetchTemplates();
  };

  if (editingId || creating) {
    return (
      <TemplateEditor
        templateType={templateType}
        templateId={editingId ?? undefined}
        onCancel={() => {
          setEditingId(null);
          setCreating(false);
        }}
        onSaved={handleSaved}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">
          {TEMPLATE_TYPE_LABELS[templateType]}
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReseed}
            disabled={reseedLoading || !tenantIndustry}
            title={
              tenantIndustry
                ? `Restore industry-specific defaults for ${tenantIndustry}`
                : 'Pick an industry first, or use Apply Baseline for universal defaults'
            }
          >
            {reseedLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RotateCcw className="w-4 h-4" />
            )}
            <span className="ml-1">Restore System Defaults</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleApplyBaseline}
            disabled={reseedLoading}
            title="Apply the universal baseline templates (works without an industry)"
          >
            {reseedLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RotateCcw className="w-4 h-4" />
            )}
            <span className="ml-1">Apply Baseline</span>
          </Button>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4" />
            <span className="ml-1">New</span>
          </Button>
        </div>
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

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <p className="text-sm">No templates found for this type.</p>
          <p className="text-xs">
            Click &ldquo;New&rdquo; to create one, &ldquo;Restore System Defaults&rdquo; to load
            industry-specific seeds, or &ldquo;Apply Baseline&rdquo; for universal fallback.
          </p>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Industry</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Version</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Source</th>
                <th className="px-4 py-3 font-medium text-muted-foreground w-[140px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{t.name}</div>
                    {t.description && (
                      <div className="text-xs text-muted-foreground truncate max-w-[300px]">
                        {t.description}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {t.industrySlug ?? 'Universal'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">v{t.version}</td>
                  <td className="px-4 py-3">
                    {t.sourceSeedId ? (
                      <Badge variant="secondary" className="text-xs">Seed</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">Custom</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditingId(t.id)}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleClone(t.id)}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="Clone"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleArchive(t.id)}
                        className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        title="Archive"
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
