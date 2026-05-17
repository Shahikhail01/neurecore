'use client';
// ─── KpiSection.tsx ───────────────────────────────────────────────────────────
// SRP: Renders only the KPI metrics grid; data is passed in via props.
// OCP: Add new KPI tiles by supplying new `kpis` array entries.

import { motion } from 'framer-motion';
import { KpiTile } from '@/components/kpi/KpiTile';
import type { CompanyMetrics } from '@/shared/types/domain.types';
import type { KpiTileProps } from '@/types/ui.types';

interface KpiSectionProps {
  metrics: CompanyMetrics | null;
  loading: boolean;
}

function buildKpis(m: CompanyMetrics): KpiTileProps[] {
  return [
    {
      label: 'Total Agents',
      value: m.totalAgents,
      delta: m.activeAgents,
      deltaLabel: `${m.activeAgents} active`,
      color: 'ops',
    },
    {
      label: 'Team Harmony',
      value: `${m.teamHarmony}%`,
      delta: m.teamHarmony,
      deltaLabel: 'score',
      color: m.teamHarmony >= 80 ? 'profit' : m.teamHarmony >= 50 ? 'warn' : 'risk',
    },
    {
      label: 'Tasks Today',
      value: m.tasksCompletedToday,
      delta: m.tasksPending,
      deltaLabel: 'pending',
      color: 'strategy',
    },
    {
      label: 'Active Workflows',
      value: m.activeWorkflows,
      delta: m.pendingApprovals,
      deltaLabel: 'approvals pending',
      color: m.pendingApprovals > 0 ? 'warn' : 'neutral',
    },
    {
      label: 'Company Score',
      value: `${m.companyScore}%`,
      delta: m.companyScore,
      deltaLabel: 'performance',
      color: m.companyScore >= 80 ? 'profit' : m.companyScore >= 50 ? 'warn' : 'risk',
    },
    {
      label: 'Alerts',
      value: m.alertCount,
      delta: m.criticalAlertCount,
      deltaLabel: 'critical',
      color: m.criticalAlertCount > 0 ? 'risk' : m.alertCount > 0 ? 'warn' : 'neutral',
    },
  ];
}

export function KpiSection({ metrics, loading }: KpiSectionProps) {
  const kpis = metrics ? buildKpis(metrics) : [];

  return (
    <section aria-label="Company KPIs">
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {loading || !metrics
          ? Array.from({ length: 6 }).map((_, i) => (
              <KpiTile key={i} label="" value={0} color="neutral" loading />
            ))
          : kpis.map((kpi, i) => (
              <motion.div
                key={kpi.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.2 }}
              >
                <KpiTile {...kpi} />
              </motion.div>
            ))}
      </div>
    </section>
  );
}
