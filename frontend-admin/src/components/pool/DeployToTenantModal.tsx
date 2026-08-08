"use client";

/**
 * DeployToTenantModal — reusable modal for deploying AI Employees or
 * Departments from pool pages to a specific tenant.
 *
 * SRP: Rendering the deploy-to-tenant form. Data fetching + submission
 *       is handled by the parent page.
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface TenantOption {
  id: string;
  name: string;
  slug?: string;
}

export interface DeployToTenantModalProps {
  open: boolean;
  onClose: () => void;
  deployType: 'agent' | 'department';
  itemName: string;
  itemDescription?: string;
  tenants: TenantOption[];
  busy?: boolean;
  error?: string | null;
  result?: { label: string } | null;
  onDeploy: (tenantId: string, config: AgentDeployConfig | DeptDeployConfig) => void | Promise<void>;
  /** Agent-specific prefill */
  agentPrefill?: { type?: string; defaultName?: string };
}

export interface AgentDeployConfig {
  name: string;
  budgetPerDay: number;
  authorityLevel: 'AUTO' | 'RECOMMEND' | 'APPROVAL';
}

export interface DeptDeployConfig {
  itemIndex: number;
  parentDepartmentId?: string;
  withHeadAgent?: boolean;
}

export function DeployToTenantModal({
  open,
  onClose,
  deployType,
  itemName,
  itemDescription,
  tenants,
  busy,
  error,
  result,
  onDeploy,
  agentPrefill,
}: DeployToTenantModalProps) {
  const [tenantId, setTenantId] = useState('');
  const [tenantSearch, setTenantSearch] = useState('');

  // Agent config
  const [agentName, setAgentName] = useState(agentPrefill?.defaultName ?? itemName);
  const [budget, setBudget] = useState(100);
  const [authority, setAuthority] = useState<'AUTO' | 'RECOMMEND' | 'APPROVAL'>('RECOMMEND');

  // Department config
  const [itemIndex, setItemIndex] = useState(0);

  const filtered = tenants.filter(
    (t) =>
      !tenantSearch ||
      t.name.toLowerCase().includes(tenantSearch.toLowerCase()) ||
      (t.slug ?? '').toLowerCase().includes(tenantSearch.toLowerCase()),
  );

  const handleDeploy = useCallback(async () => {
    if (!tenantId) return;
    const config =
      deployType === 'agent'
        ? { name: agentName, budgetPerDay: budget, authorityLevel: authority }
        : { itemIndex };
    await onDeploy(tenantId, config);
  }, [tenantId, deployType, agentName, budget, authority, itemIndex, onDeploy]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ scale: 0.96 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.96 }}
            className="w-full max-w-md rounded-2xl border border-indigo-800/40 bg-surface-raised p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-base font-semibold text-zinc-100 mb-1">
              Deploy {deployType === 'agent' ? 'AI Employee' : 'Department'}
            </h3>
            <p className="text-sm text-zinc-400 mb-5">
              {itemName}{itemDescription ? ` — ${itemDescription}` : ''}
            </p>

            {result ? (
              <div className="rounded-lg bg-[color:var(--state-success)] border border-green-800 px-4 py-5 text-sm text-green-300 text-center">
                <div className="text-2xl mb-2">✓</div>
                {result.label}
                <button
                  onClick={onClose}
                  className="mt-3 text-xs text-[color:var(--accent-400)] hover:underline block mx-auto"
                >
                  Close
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Tenant picker */}
                <div>
                  <label className="text-xs text-zinc-500 mb-1.5 block">
                    Target Tenant
                  </label>
                  <input
                    type="search"
                    placeholder="Search tenants…"
                    value={tenantSearch}
                    onChange={(e) => setTenantSearch(e.target.value)}
                    className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-[color:var(--accent-500)] mb-2"
                    aria-label="Search tenants"
                  />
                  <select
                    value={tenantId}
                    onChange={(e) => setTenantId(e.target.value)}
                    size={Math.min(filtered.length + 1, 6)}
                    className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-[color:var(--accent-500)]"
                    aria-label="Target tenant"
                  >
                    <option value="">— select tenant —</option>
                    {filtered.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}{t.slug ? ` (${t.slug})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Agent-specific config */}
                {deployType === 'agent' && (
                  <>
                    <div>
                      <label htmlFor="deploy-agent-name" className="text-xs text-zinc-500 mb-1.5 block">
                        Agent Name
                      </label>
                      <input
                        id="deploy-agent-name"
                        value={agentName}
                        onChange={(e) => setAgentName(e.target.value)}
                        className="w-full rounded border border-surface-border bg-surface-overlay text-zinc-200 text-sm px-3 py-2 focus:outline-none focus:border-[color:var(--accent-500)]"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="deploy-budget" className="text-xs text-zinc-500 mb-1.5 block">
                          Daily Budget ($)
                        </label>
                        <input
                          id="deploy-budget"
                          type="number"
                          value={budget}
                          onChange={(e) => setBudget(Number(e.target.value))}
                          className="w-full rounded border border-surface-border bg-surface-overlay text-zinc-200 text-sm px-3 py-2 focus:outline-none focus:border-[color:var(--accent-500)]"
                        />
                      </div>
                      <div>
                        <label htmlFor="deploy-authority" className="text-xs text-zinc-500 mb-1.5 block">
                          Authority
                        </label>
                        <select
                          id="deploy-authority"
                          value={authority}
                          onChange={(e) => setAuthority(e.target.value as AgentDeployConfig['authorityLevel'])}
                          className="w-full rounded border border-surface-border bg-surface-overlay text-zinc-200 text-sm px-3 py-2 focus:outline-none focus:border-[color:var(--accent-500)]"
                        >
                          <option value="AUTO">AUTO</option>
                          <option value="RECOMMEND">RECOMMEND</option>
                          <option value="APPROVAL">APPROVAL</option>
                        </select>
                      </div>
                    </div>
                  </>
                )}

                {/* Department-specific config */}
                {deployType === 'department' && (
                  <div>
                    <label htmlFor="deploy-item-index" className="text-xs text-zinc-500 mb-1.5 block">
                      Structure Item Index (0-based)
                    </label>
                    <input
                      id="deploy-item-index"
                      type="number"
                      value={itemIndex}
                      onChange={(e) => setItemIndex(Number(e.target.value))}
                      min={0}
                      className="w-full rounded border border-surface-border bg-surface-overlay text-zinc-200 text-sm px-3 py-2 focus:outline-none focus:border-[color:var(--accent-500)]"
                    />
                    <p className="text-[10px] text-zinc-600 mt-1">
                      The index of the department in the template&apos;s structure array.
                    </p>
                  </div>
                )}

                {error && (
                  <div className="rounded-lg bg-[color:var(--state-danger)] border border-red-800 px-3 py-2 text-sm text-red-300">
                    {error}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={onClose}
                    disabled={busy}
                    className="flex-1 py-2 rounded-lg border border-surface-border text-sm text-zinc-400 hover:text-zinc-200 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeploy}
                    disabled={!tenantId || busy}
                    className="flex-1 py-2 rounded-lg bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-sm font-medium transition disabled:opacity-50"
                  >
                    {busy ? 'Deploying…' : 'Deploy'}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
