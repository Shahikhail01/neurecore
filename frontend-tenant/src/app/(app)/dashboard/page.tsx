"use client";
// ─── dashboard/page.tsx ───────────────────────────────────────────────────────
// SRP: Composes dashboard feature components — owns only layout composition and
//      provisioning status fetch (not owned by useDashboardData).
// OCP: All data displayed here is controlled via feature components and hooks;
//      adding new dashboard sections never modifies this page.

import DashboardV2Page from './dashboardv2/page';

export default function DashboardPage() {
  return <DashboardV2Page />;
}
