"use client";
// ─── DashboardKPIRow.tsx ──────────────────────────────────────────────────────
// SRP: Renders the 4-tile KPI strip on the dashboard.
// Composes the existing KpiSection feature component.
// OCP: To add new KPI tiles, update KpiSection.tsx — this wrapper never changes.

import { KpiSection } from "@/features/dashboard/components/KpiSection";
import type { CompanyMetrics } from "@/shared/types/domain.types";

interface DashboardKPIRowProps {
  metrics: CompanyMetrics | null;
  loading: boolean;
}

export function DashboardKPIRow({ metrics, loading }: DashboardKPIRowProps) {
  return <KpiSection metrics={metrics} loading={loading} />;
}
