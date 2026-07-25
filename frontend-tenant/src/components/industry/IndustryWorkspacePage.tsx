'use client';

/**
 * IndustryWorkspacePage — functional workspace module for industry-specific
 * routes (replaces the IndustryStubFromNav placeholder).
 *
 * Loads the tenant's projects filtered by project-type slug (audit-engagement,
 * tax-filing, compliance-review, bookkeeping-cycle, payroll-cycle) and renders
 * a list of projects with status, customer, target date, and a "New Project"
 * CTA. The page is intentionally read-only for invoice/transaction data
 * (which depends on bookkeeping specifics); all F&C views share the same
 * project-shape and industry-awareness pipeline.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Plus, ArrowLeft, Briefcase, Building2, Calendar, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  PageShell,
  PageHero,
  GlassPanel,
  StatTile,
  StatRow,
} from '@neurecore/ui-visual';
import { projectsService, type Project, type ProjectStatus } from '@/services/projects.service';
import { tenantsService } from '@/services/tenants.service';
import { projectTypesService } from '@/services/projectTypes.service';

export interface IndustryWorkspaceConfig {
  /** Rail item id used by the IconRail */
  featureId: string;
  /** Display title (e.g. "Tax") */
  title: string;
  /** Description for the page header */
  description: string;
  /** Slug of the project type to filter (e.g. 'tax-filing'). Multiple = OR. */
  projectTypeSlugs: string[];
  /** Optional KPI label/key extractor */
  computeKpis?: (projects: Project[]) => Array<{ label: string; value: string | number }>;
}

export function IndustryWorkspacePage({ config }: { config: IndustryWorkspaceConfig }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tenant, setTenant] = useState<{ id: string; name: string; industry?: string | null } | null>(null);
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'ALL'>('ALL');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const t = await tenantsService.getCurrent();
        if (cancelled) return;
        setTenant({ id: t.id, name: t.name, industry: t.industry ?? null });
        // Fetch all tenant projects then filter by project type slug.
        const { items } = await projectsService.list({ limit: 100 });
        if (cancelled) return;
        // Map project type ids to slugs to enable filtering.
        let typeSlugById: Record<string, string> = {};
        if (t.industry) {
          try {
            const { items: types } = await projectTypesService.list({ industry: t.industry, limit: 100 });
            typeSlugById = Object.fromEntries(
              (types ?? [])
                .filter((pt) => pt.id && pt.slug)
                .map((pt) => [pt.id as string, pt.slug as string]),
            );
          } catch {
            // ignore
          }
        }
        const filtered = (items ?? []).filter((p) => {
          const slug = p.projectTypeId ? typeSlugById[p.projectTypeId] : null;
          return slug ? config.projectTypeSlugs.includes(slug) : false;
        });
        setProjects(filtered);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load projects');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [config.projectTypeSlugs.join('|')]);

  const filteredProjects = useMemo(() => {
    if (statusFilter === 'ALL') return projects;
    return projects.filter((p) => p.status === statusFilter);
  }, [projects, statusFilter]);

  const kpis = useMemo(() => {
    if (config.computeKpis) return config.computeKpis(projects);
    const active = projects.filter((p) => p.status === 'ACTIVE').length;
    const completed = projects.filter((p) => p.status === 'COMPLETED').length;
    const total = projects.length;
    return [
      { label: 'Total', value: total },
      { label: 'Active', value: active },
      { label: 'Completed', value: completed },
    ];
  }, [projects, config]);

  const STATUS_OPTIONS: ProjectStatus[] = [
    'LEAD', 'PROPOSAL_SENT', 'WON', 'ACTIVE', 'ON_HOLD', 'REVIEW', 'COMPLETED', 'ARCHIVED', 'LOST',
  ];

  return (
    <PageShell variant="default">
      <PageHero
        eyebrow={
          <span className="inline-flex items-center gap-1">
            <Link href="/home" className="inline-flex items-center gap-1 hover:text-zinc-300">
              <ArrowLeft className="w-3.5 h-3.5" /> Home
            </Link>
          </span>
        }
        title={config.title}
        subtitle={
          <>
            {config.description}
            {tenant?.industry && (
              <span className="block mt-1 text-xs text-zinc-500">
                Industry: <strong className="text-zinc-300">{tenant.industry}</strong>
              </span>
            )}
          </>
        }
        actions={
          <Link href="/projects/new">
            <Button className="nv-btn-accent">
              <Plus className="w-4 h-4 mr-1" /> New Project
            </Button>
          </Link>
        }
      />

      {kpis.length > 0 && (
        <StatRow>
          {kpis.map((k, i) => (
            <StatTile
              key={k.label}
              label={k.label}
              value={k.value as React.ReactNode}
              accent={(['violet', 'cyan', 'emerald', 'amber'] as const)[i % 4]}
              loading={loading}
            />
          ))}
        </StatRow>
      )}

      <GlassPanel variant="panel" padding="md">
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-xs text-zinc-400">Status:</label>
          {(['ALL', ...STATUS_OPTIONS] as Array<ProjectStatus | 'ALL'>).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition border ${
                statusFilter === s
                  ? 'border-[color:var(--accent-500)] bg-[color:var(--accent-500)]/15 text-zinc-100'
                  : 'border-white/10 bg-transparent text-zinc-400 hover:text-zinc-100'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </GlassPanel>

      {loading ? (
        <GlassPanel variant="panel" padding="lg" className="text-center flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading {config.title.toLowerCase()} projects...
        </GlassPanel>
      ) : error ? (
        <GlassPanel variant="panel" padding="md" className="border border-[color:var(--state-danger)]/40 text-sm text-[color:var(--state-danger)] flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </GlassPanel>
      ) : filteredProjects.length === 0 ? (
        <GlassPanel variant="panel" padding="lg" className="text-center">
          <Briefcase className="w-10 h-10 mx-auto text-zinc-500" />
          <p className="mt-3 text-sm text-zinc-400">
            No {config.title.toLowerCase()} projects yet.
          </p>
          <Link href="/projects/new">
            <Button className="nv-btn-accent mt-4">
              <Plus className="w-4 h-4 mr-1" /> Create the first one
            </Button>
          </Link>
        </GlassPanel>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-3"
        >
          {filteredProjects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`}>
              <GlassPanel variant="tile" padding="md" interactive className="block">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold truncate text-zinc-100">{p.name}</h3>
                    {p.description && (
                      <p className="text-xs text-zinc-400 mt-1 line-clamp-2">
                        {p.description}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline">{p.status}</Badge>
                </div>
                <div className="flex items-center gap-3 mt-3 text-xs text-zinc-400">
                  {p.customer?.name && (
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="w-3 h-3" /> {p.customer.name}
                    </span>
                  )}
                  {p.targetDate && (
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {p.targetDate.slice(0, 10)}
                    </span>
                  )}
                  {p.priority && <Badge variant="secondary">{p.priority}</Badge>}
                </div>
              </GlassPanel>
            </Link>
          ))}
        </motion.div>
      )}

      </PageShell>
  );
}
