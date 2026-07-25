'use client';

/**
 * /home — Creatio-style home with hero + KPIs + right rail.
 *
 * Navigation is provided by the IconRail (rendered by TenantShell). The
 * /home page only renders the centre content + right widgets.
 *
 * Chat is provided by the unified UnifiedChatPanel (mounted by TenantShell).
 * This page only triggers external sends via the chat store (HomeHero prompt).
 *
 * Visual chrome is composed from @neurecore/ui-visual primitives
 * (PageShell, GlassPanel, AmbientBackdrop). Every page in the monorepo
 * follows the same composition — this file is the conformance proof.
 *
 * Layout:
 *   ┌─ IconRail (in TenantShell) ─┬─ Centre ────────────────────┬─ Right rail ──┐
 *   │                             │  Hero (date/greeting/AI)    │  Live Feed    │
 *   │                             │  KPI Strip                  │  Stats        │
 *   │                             │  Network Status (errors)    │  Quick Actions│
 *   │                             │                             │  Tasks        │
 *   │                             │                             │  Approvals    │
 *   └─────────────────────────────┴─────────────────────────────┴───────────────┘
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTenantAuth } from '@/hooks/useTenantAuth';
import { useAuthStore } from '@/stores/authStore';
import { useApprovals } from '@/hooks/useApprovals';
import { useAgentStore } from '@/stores/agentStore';
import { useTaskStore } from '@/stores/taskStore';
import { useDepartmentStore } from '@/stores/departmentStore';
import { useUIPreferencesStore } from '@/stores/uiPreferencesStore';
import { commandCenterService } from '@/services/command-center.service';
import TenantShell from '@/components/TenantShell';
import { HomeHero } from '@/components/home/HomeHero';
import { HomeKpiStrip } from '@/components/home/HomeKpiStrip';
import { HomeNetworkStatus } from '@/components/home/HomeNetworkStatus';
import { RightPanel } from '@/components/home/RightPanel';
import { PageShell, GlassPanel } from '@neurecore/ui-visual';
import { useChatStore } from '@/core/services/chat/chat.factory';

export default function HomePage() {
  const user = useTenantAuth();
  const hasHydrated = useAuthStore((s) => s._hasHydrated);

  const backgroundStyle = useUIPreferencesStore((s) => s.backgroundStyle);

  const setAgents = useAgentStore((s) => s.setAgents);
  const agents = useAgentStore((s) => s.agents);
  const tasks = useTaskStore((s) => s.tasks);
  const setTasks = useTaskStore((s) => s.setTasks);
  const departments = useDepartmentStore((s) => s.departments);
  const setDepartments = useDepartmentStore((s) => s.setDepartments);

  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [monthCost, setMonthCost] = useState<number | null>(null);

  const { critical, routine } = useApprovals({ autoRefresh: true, refreshInterval: 120_000 });
  const pendingApprovals = useMemo(
    () => (Array.isArray(critical) ? critical : []).length + (Array.isArray(routine) ? routine : []).length,
    [critical, routine],
  );

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const summary = await commandCenterService.getSummary();
      const allAgents = (summary as { agents?: { list: unknown[] } }).agents?.list ?? [];
      setAgents(allAgents as never[]);
      const allTasks = (summary as { tasks?: { list: unknown[] } }).tasks?.list ?? [];
      setTasks(allTasks as never[]);
      const allDepts = (summary as { departments?: { list: unknown[] } }).departments?.list ?? [];
      setDepartments(allDepts as never[]);
      const monthCents = (summary as { costs?: { monthCents: number } }).costs?.monthCents;
      if (typeof monthCents === 'number') setMonthCost(monthCents / 100);
      setSummaryError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Workspace data unavailable';
      setSummaryError(message);
    } finally {
      setSummaryLoading(false);
    }
  }, [setAgents, setTasks, setDepartments]);

  useEffect(() => {
    if (!user) return;
    void fetchSummary();
  }, [user, fetchSummary]);

  const safeDepartments = useMemo(() => (Array.isArray(departments) ? departments : []), [departments]);
  const safeTasks = useMemo(() => (Array.isArray(tasks) ? tasks : []), [tasks]);

  const agentCountByDept = useMemo(() => {
    const m = new Map<string, number>();
    if (!Array.isArray(agents)) return m;
    for (const a of agents) {
      const id = (a as { departmentId?: string }).departmentId;
      if (id) m.set(id, (m.get(id) ?? 0) + 1);
    }
    return m;
  }, [agents]);

  // Route HomeHero prompt through the unified chat (mounted in TenantShell).
  const requestExternalSend = useChatStore((s) => s.requestExternalSend);
  const handleSend = (message: string) => {
    requestExternalSend(message);
  };

  if (!hasHydrated || !user) {
    return (
      <div className="nv-page nv-hero-gradient flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-zinc-500">Loading workspace...</p>
        </div>
      </div>
    );
  }

  // Visual chrome composed entirely from the @neurecore/ui-visual package.
  // backgroundStyle is still read for back-compat (settings store) but the
  // hero gradient is now provided by PageShell; the per-style override is
  // intentionally ignored to enforce a single visual contract globally.
  void backgroundStyle;

  return (
    <TenantShell user={user}>
      <PageShell variant="default" noAmbient>
        <div className="flex flex-col gap-6">
          <GlassPanel variant="hero" padding="lg" className="max-w-2xl mx-auto w-full">
            <HomeHero tenant={null} onSend={handleSend} />
          </GlassPanel>

          <div className="max-w-2xl mx-auto w-full">
            <HomeKpiStrip
              monthCost={monthCost}
              pendingApprovals={pendingApprovals}
              loading={summaryLoading}
            />
          </div>

          {summaryError && (
            <div className="max-w-2xl mx-auto w-full">
              <HomeNetworkStatus
                errors={[{ key: 'summary', message: summaryError }]}
                onRetry={() => void fetchSummary()}
                busy={summaryLoading}
              />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <RightPanel />
          </div>
        </div>
      </PageShell>
    </TenantShell>
  );
}