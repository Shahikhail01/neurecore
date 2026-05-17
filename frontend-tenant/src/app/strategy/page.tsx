'use client';

import { useTenantAuth } from '@/hooks/useTenantAuth';
import TenantShell from '@/components/TenantShell';
import { ScenarioSimulator } from '@/features/strategy/components/ScenarioSimulator';

export default function StrategyPage() {
  const user = useTenantAuth();
  if (!user) return null;

  return (
    <TenantShell user={user}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Strategy Simulator</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Model what-if scenarios and predict outcomes before committing to changes.
          </p>
        </div>

        <ScenarioSimulator />
      </div>
    </TenantShell>
  );
}
