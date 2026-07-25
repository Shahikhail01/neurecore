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
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <Link
          href="/home"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">{config.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">{config.description}</p>
            {tenant?.industry && (
              <p className="text-xs text-muted-foreground mt-2">
                Industry: <strong className="text-foreground">{tenant.industry}</strong>
              </p>
            )}
          </div>
          <Link href="/projects/new">
            <Button>
              <Plus className="w-4 h-4 mr-1" /> New Project
            </Button>
          </Link>
        </div>
      </div>

      {kpis.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {kpis.map((k) => (
            <Card key={k.label} className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{k.label}</p>
              <p className="text-2xl font-bold mt-1">{k.value}</p>
            </Card>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-xs text-muted-foreground">Status:</label>
        {(['ALL', ...STATUS_OPTIONS] as Array<ProjectStatus | 'ALL'>).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-2.5 py-1 rounded text-xs font-medium transition border ${
              statusFilter === s
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border bg-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <Card className="p-8 text-center flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading {config.title.toLowerCase()} projects...
        </Card>
      ) : error ? (
        <Card className="p-6 border-destructive/30 bg-destructive/5 text-sm text-destructive flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </Card>
      ) : filteredProjects.length === 0 ? (
        <Card className="p-8 text-center">
          <Briefcase className="w-10 h-10 mx-auto text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            No {config.title.toLowerCase()} projects yet.
          </p>
          <Link href="/projects/new">
            <Button className="mt-4">
              <Plus className="w-4 h-4 mr-1" /> Create the first one
            </Button>
          </Link>
        </Card>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-3"
        >
          {filteredProjects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`}>
              <Card className="p-4 hover:border-primary/40 transition cursor-pointer">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold truncate">{p.name}</h3>
                    {p.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {p.description}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline">{p.status}</Badge>
                </div>
                <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
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
              </Card>
            </Link>
          ))}
        </motion.div>
      )}
    </div>
  );
}
