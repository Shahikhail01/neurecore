'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import api from '@/services/api';
import { unwrapItem, unwrapList } from '@/services/unwrap';
import { deptTemplatesService, type DepartmentTemplate, type BulkAgentDeployItem } from '@/services/deptTemplates.service';
import { agentTemplatesService, type AgentTemplate } from '@/services/agentTemplates.service';
import { packagesService, type Package, type DeployPackagePreview, type DeployPackageOutcome, type PackageDeploymentHistoryItem } from '@/services/packages.service';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import type { Tenant } from '@/types/api.types';

interface Department { id: string; name: string; description?: string; createdAt: string; }
interface Agent { id: string; name: string; type: string; model: string; status: string; createdAt: string; }

type Tab = 'overview' | 'departments' | 'agents' | 'deploy';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'departments', label: 'Departments' },
  { id: 'agents', label: 'Employees' },
  { id: 'deploy', label: 'Deploy' },
];

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-[color:var(--state-success)]/70 text-green-300',
  TRIAL: 'bg-[color:var(--state-info)]/70 text-blue-300',
  SUSPENDED: 'bg-yellow-900/70 text-yellow-300',
  CANCELLED: 'bg-[color:var(--state-danger)]/70 text-red-300',
};

const AGENT_TYPE_BADGE: Record<string, string> = {
  EXECUTIVE: 'bg-purple-900/70 text-purple-300',
  CORE: 'bg-[color:var(--accent-500)]/70 text-indigo-300',
  FUNCTIONAL: 'bg-teal-900/70 text-teal-300',
  META: 'bg-orange-900/70 text-orange-300',
};

export default function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: tenantId } = use(params);
  const router = useRouter();
  const user = useAdminAuth();

  const [tab, setTab] = useState<Tab>('overview');
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loadingTenant, setLoadingTenant] = useState(true);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);

  const [deptTemplates, setDeptTemplates] = useState<DepartmentTemplate[]>([]);
  const [selectedDeptTmpl, setSelectedDeptTmpl] = useState('');
  const [withAgents, setWithAgents] = useState(true);
  const [deployingDept, setDeployingDept] = useState(false);
  const [deptDeployResult, setDeptDeployResult] = useState<{ departments: number; agents: number } | null>(null);
  const [deptDeployError, setDeptDeployError] = useState<string | null>(null);

  const [agentTemplateList, setAgentTemplateList] = useState<AgentTemplate[]>([]);
  const [agentRows, setAgentRows] = useState<BulkAgentDeployItem[]>([]);
  const [deployingAgents, setDeployingAgents] = useState(false);
  const [agentDeployResult, setAgentDeployResult] = useState<number | null>(null);
  const [agentDeployError, setAgentDeployError] = useState<string | null>(null);
  const [addTemplateId, setAddTemplateId] = useState('');

  const [packages, setPackages] = useState<Package[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [pkgWithAgents, setPkgWithAgents] = useState(true);
  const [pkgAuthority, setPkgAuthority] = useState<'AUTO' | 'RECOMMEND' | 'APPROVAL'>('RECOMMEND');
  const [pkgIdempotent, setPkgIdempotent] = useState(true);
  const [pkgPreview, setPkgPreview] = useState<DeployPackagePreview | null>(null);
  const [pkgPreviewing, setPkgPreviewing] = useState(false);
  const [pkgDeploying, setPkgDeploying] = useState(false);
  const [pkgDeployResult, setPkgDeployResult] = useState<DeployPackageOutcome | null>(null);
  const [pkgDeployError, setPkgDeployError] = useState<string | null>(null);
  const [pkgDeployHistory, setPkgDeployHistory] = useState<PackageDeploymentHistoryItem[]>([]);
  const selectedPackage = packages.find((pkg) => pkg.id === selectedPackageId) ?? null;

  const [singleDeptTemplateId, setSingleDeptTemplateId] = useState('');
  const [singleDeptItemIndex, setSingleDeptItemIndex] = useState(0);
  const [singleDeptWithAgent, setSingleDeptWithAgent] = useState(false);
  const [deployingSingleDept, setDeployingSingleDept] = useState(false);
  const [singleDeptResult, setSingleDeptResult] = useState<{ id: string; name: string; agents?: number } | null>(null);
  const [singleDeptError, setSingleDeptError] = useState<string | null>(null);

  const [suspendOpen, setSuspendOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    (async () => {
      setLoadingTenant(true);
      try { const res = await api.get(`/tenants/${tenantId}`); setTenant(unwrapItem(res) as Tenant); }
      catch { } finally { setLoadingTenant(false); }
    })();
  }, [tenantId]);

  const loadDepts = useCallback(async () => {
    if (!tenantId) return; setLoadingDepts(true);
    try { const res = await api.get(`/departments?tenantId=${tenantId}&limit=100`); setDepartments(unwrapList(res).items as Department[]); }
    finally { setLoadingDepts(false); }
  }, [tenantId]);

  const loadAgents = useCallback(async () => {
    if (!tenantId) return; setLoadingAgents(true);
    try { const res = await api.get(`/agents?tenantId=${tenantId}&limit=100`); setAgents(unwrapList(res).items as Agent[]); }
    finally { setLoadingAgents(false); }
  }, [tenantId]);

  const loadDeployAssets = useCallback(async () => {
    const [dtRes, atRes, pkgRes, pkgHistoryRes] = await Promise.all([
      deptTemplatesService.list({ limit: 100 }), agentTemplatesService.list({ limit: 100 }),
      packagesService.list({ limit: 100 }), packagesService.deployHistory(tenantId, 8),
    ]);
    setDeptTemplates(dtRes.items); setAgentTemplateList(atRes.items);
    setPackages(pkgRes.items); setPkgDeployHistory(pkgHistoryRes);
  }, [tenantId]);

  useEffect(() => {
    if (tab === 'departments') void loadDepts();
    if (tab === 'agents') void loadAgents();
    if (tab === 'deploy') void loadDeployAssets();
  }, [tab, loadDepts, loadAgents, loadDeployAssets]);

  async function handleDeployDeptTemplate() {
    if (!selectedDeptTmpl) return; setDeployingDept(true); setDeptDeployError(null); setDeptDeployResult(null);
    try { const result = await deptTemplatesService.deployToTenant(tenantId, selectedDeptTmpl, withAgents); setDeptDeployResult(result); }
    catch (err: unknown) { setDeptDeployError(err instanceof Error ? err.message : 'Deployment failed'); }
    finally { setDeployingDept(false); }
  }

  function addAgentRow() {
    if (!addTemplateId) return; const tmpl = agentTemplateList.find((t) => t.id === addTemplateId);
    if (!tmpl) return; setAgentRows((rows) => [...rows, { templateId: tmpl.id, name: tmpl.name, budgetPerDay: 100, authorityLevel: 'RECOMMEND' }]); setAddTemplateId('');
  }

  function updateAgentRow(i: number, patch: Partial<BulkAgentDeployItem>) { setAgentRows((rows) => rows.map((r, idx) => idx === i ? { ...r, ...patch } : r)); }
  function removeAgentRow(i: number) { setAgentRows((rows) => rows.filter((_, idx) => idx !== i)); }

  async function handleBulkDeploy() {
    if (agentRows.length === 0) return; setDeployingAgents(true); setAgentDeployError(null); setAgentDeployResult(null);
    try { await deptTemplatesService.bulkDeployAgents(tenantId, agentRows); setAgentDeployResult(agentRows.length); setAgentRows([]); }
    catch (err: unknown) { setAgentDeployError(err instanceof Error ? err.message : 'Deployment failed'); }
    finally { setDeployingAgents(false); }
  }

  async function handlePackagePreview() {
    if (!selectedPackageId) return; setPkgPreviewing(true); setPkgDeployError(null); setPkgPreview(null); setPkgDeployResult(null);
    try { const result = await packagesService.deployPreview(selectedPackageId, tenantId, pkgWithAgents); setPkgPreview(result); }
    catch (err: unknown) { setPkgDeployError(err instanceof Error ? err.message : 'Preview failed'); }
    finally { setPkgPreviewing(false); }
  }

  async function handlePackageDeploy() {
    if (!selectedPackageId) return; setPkgDeploying(true); setPkgDeployError(null); setPkgDeployResult(null);
    try { const result = await packagesService.deploy(selectedPackageId, tenantId, { withAgents: pkgWithAgents, authorityLevel: pkgAuthority, idempotent: pkgIdempotent }); setPkgDeployResult(result); setPkgPreview(null); const refreshedHistory = await packagesService.deployHistory(tenantId, 8); setPkgDeployHistory(refreshedHistory); }
    catch (err: unknown) { setPkgDeployError(err instanceof Error ? err.message : 'Deployment failed'); }
    finally { setPkgDeploying(false); }
  }

  async function handleDeploySingleDepartment() {
    if (!singleDeptTemplateId) return; setDeployingSingleDept(true); setSingleDeptError(null); setSingleDeptResult(null);
    try { const result = await deptTemplatesService.deploySingleDepartment(tenantId, singleDeptTemplateId, singleDeptItemIndex, undefined, singleDeptWithAgent); setSingleDeptResult(result); }
    catch (err: unknown) { setSingleDeptError(err instanceof Error ? err.message : 'Deployment failed'); }
    finally { setDeployingSingleDept(false); }
  }

  async function handleSuspend() { setActionBusy(true); try { await api.patch(`/tenants/${tenantId}/suspend`); setTenant((prev) => prev ? { ...prev, status: 'SUSPENDED' } : prev); setSuspendOpen(false); } catch { } finally { setActionBusy(false); } }
  async function handleActivate() { setActionBusy(true); try { await api.patch(`/tenants/${tenantId}/activate`); setTenant((prev) => prev ? { ...prev, status: 'ACTIVE' } : prev); } catch { } finally { setActionBusy(false); } }
  async function handleDelete() { setActionBusy(true); try { await api.delete(`/tenants/${tenantId}`); router.push('/tenants'); } catch { setDeleteOpen(false); } finally { setActionBusy(false); } }

  if (!user) return null;

  return (
    <AdminShell user={user}>
      <div className="max-w-5xl mx-auto space-y-5">
        <button onClick={() => router.push('/tenants')} className="text-xs text-zinc-500 hover:text-zinc-300 transition flex items-center gap-1">← All Tenants</button>

        {loadingTenant ? (<div className="h-20 rounded-xl bg-surface-raised animate-pulse" />) : tenant ? (
          <div className="rounded-xl border border-surface-border bg-surface-raised p-5 flex flex-wrap gap-6 items-start">
            <div className="flex items-start gap-4">
              {tenant.logoUrl && (<img src={tenant.logoUrl} alt="" className="h-12 w-12 rounded-xl object-cover border border-surface-border flex-shrink-0" />)}
              <div>
                <h1 className="text-xl font-semibold text-zinc-100">{tenant.name}</h1>
                <div className="text-sm text-zinc-500 mt-0.5 font-mono">{tenant.slug}</div>
                {tenant.industry && (<div className="text-xs text-zinc-600 mt-1">{tenant.industry}</div>)}
                {tenant.website && (<a href={tenant.website} target="_blank" rel="noopener noreferrer" className="text-xs text-[color:var(--accent-400)] hover:text-indigo-300 underline underline-offset-2 mt-0.5 inline-block">{tenant.website.replace(/^https?:\/\//, '')}</a>)}
              </div>
            </div>
            <div className="flex flex-wrap gap-3 items-center ml-auto">
              <Stat label="Plan" value={tenant.tier?.name ?? tenant.tier?.slug ?? tenant.plan ?? '—'} />
              <Stat label="Employee Limit" value={String(tenant.tier?.maxAgents ?? tenant.agentLimit ?? '—')} />
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[tenant.status] ?? 'bg-zinc-800 text-zinc-400'}`}>{tenant.status}</span>
            </div>
          </div>
        ) : (<div className="py-10 text-center text-zinc-500">Tenant not found.</div>)}

        {tenant && (
          <div className="flex items-center justify-end gap-2">
            {tenant.status === 'SUSPENDED' ? (<button onClick={handleActivate} disabled={actionBusy} className="px-3 py-1.5 rounded-lg border border-green-800/40 text-xs text-[color:var(--state-success)] hover:bg-[color:var(--state-success)]/30 transition disabled:opacity-50">Activate</button>) : (<button onClick={() => setSuspendOpen(true)} disabled={actionBusy} className="px-3 py-1.5 rounded-lg border border-amber-800/40 text-xs text-[color:var(--state-warning)] hover:bg-[color:var(--state-warning)]/30 transition disabled:opacity-50">Suspend</button>)}
            <button onClick={() => setDeleteOpen(true)} disabled={actionBusy} className="px-3 py-1.5 rounded-lg border border-red-800/40 text-xs text-[color:var(--state-danger)] hover:bg-[color:var(--state-danger)]/30 transition disabled:opacity-50">Delete</button>
          </div>
        )}

        <div className="flex gap-1 border-b border-surface-border/50">
          {TABS.map((t) => (<button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${tab === t.id ? 'border-[color:var(--accent-500)] text-indigo-300' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>{t.label}</button>))}
        </div>

        <AnimatePresence mode="wait">
          {tab === 'overview' && tenant && (
            <motion.div key="overview" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <Section title="Identity">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <InfoCard label="ID" value={tenant.id.slice(0, 8) + '…'} />
                  <InfoCard label="Status" value={tenant.status}><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[tenant.status] ?? 'bg-zinc-800 text-zinc-400'}`}>{tenant.status}</span></InfoCard>
                  <InfoCard label="Created" value={new Date(tenant.createdAt).toLocaleDateString()} />
                  <InfoCard label="Updated" value={new Date(tenant.updatedAt).toLocaleDateString()} />
                </div>
              </Section>

              <Section title="Branding &amp; Contact">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <InfoCard label="Website" value={tenant.website ?? '—'} href={tenant.website ?? undefined} />
                  <div className="relative"><InfoCard label="Industry" value={tenant.industry ?? '—'} /><a href={`/tenants/${tenant.id}/industry`} className="absolute top-3 right-3 text-[10px] uppercase tracking-wider text-[color:var(--accent-400)] hover:text-indigo-300">Change</a></div>
                  <InfoCard label="Phone" value={tenant.phone ?? '—'} />
                  <InfoCard label="Support Email" value={tenant.supportEmail ?? '—'} href={tenant.supportEmail ? `mailto:${tenant.supportEmail}` : undefined} />
                </div>
              </Section>

              <Section title="Company Profile">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <InfoCard label="Size" value={tenant.sizeBucket ? tenant.sizeBucket.charAt(0) + tenant.sizeBucket.slice(1).toLowerCase() : '—'} />
                  <InfoCard label="Founded" value={tenant.foundedYear ? String(tenant.foundedYear) : '—'} />
                  <InfoCard label="Business Type" value={tenant.businessType ?? '—'} />
                </div>
              </Section>

              <Section title="Localization">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <InfoCard label="Locale" value={tenant.locale ?? '—'} /><InfoCard label="Timezone" value={tenant.timezone ?? '—'} />
                  <InfoCard label="Currency" value={tenant.currency ?? '—'} /><InfoCard label="Date Format" value={tenant.dateFormat ?? '—'} />
                  <InfoCard label="Time Format" value={tenant.timeFormat ?? '—'} /><InfoCard label="Fiscal Year Start" value={tenant.fiscalYearStart ?? '—'} />
                </div>
              </Section>

              <Section title="Onboarding">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <InfoCard label="Step" value={tenant.onboardingStep ? tenant.onboardingStep.charAt(0).toUpperCase() + tenant.onboardingStep.slice(1) : '—'} />
                  <InfoCard label="Completed" value={tenant.onboardingCompletedAt ? new Date(tenant.onboardingCompletedAt).toLocaleDateString() : '—'} />
                  <InfoCard label="Checklist Dismissed" value={tenant.checklistDismissedAt ? new Date(tenant.checklistDismissedAt).toLocaleDateString() : '—'} />
                </div>
              </Section>

              {tenant.tier && (
                <Section title="Tier Details">
                  <div className="rounded-xl border border-[color:var(--accent-500)]/20 bg-[color:var(--accent-500)]/20 p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div><h3 className="text-lg font-semibold text-zinc-100">{tenant.tier.name}</h3>{tenant.tier.description && (<p className="text-sm text-zinc-500 mt-0.5">{tenant.tier.description}</p>)}</div>
                      <div className="text-right"><div className="text-xl font-bold text-zinc-100">{tenant.tier.monthlyPrice && Number(tenant.tier.monthlyPrice) > 0 ? `${tenant.tier.currency ?? '$'}${tenant.tier.monthlyPrice}/mo` : 'Free'}</div></div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <TierStat label="Max Employees" value={String(tenant.tier.maxAgents)} /><TierStat label="Max Departments" value={String(tenant.tier.maxDepartments)} />
                      <TierStat label="Max Users" value={String(tenant.tier.maxUsers)} /><TierStat label="Storage" value={tenant.tier.maxStorageGB ? `${tenant.tier.maxStorageGB} GB` : '—'} />
                    </div>
                    <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-[color:var(--accent-500)]/10">
                      <FeatureTag enabled={tenant.tier.allowCustomBranding} label="Custom Branding" /><FeatureTag enabled={tenant.tier.allowApiAccess} label="API Access" />
                      <FeatureTag enabled={tenant.tier.allowSso} label="SSO" /><FeatureTag enabled={tenant.tier.allowAuditExport} label="Audit Export" />
                    </div>
                  </div>
                </Section>
              )}

              {(tenant.googleDriveRootFolderId || tenant.googleCalendarId) && (
                <Section title="Google Workspace">
                  <div className="grid grid-cols-2 gap-4"><InfoCard label="Drive Root Folder ID" value={tenant.googleDriveRootFolderId ?? '—'} /><InfoCard label="Calendar ID" value={tenant.googleCalendarId ?? '—'} /></div>
                </Section>
              )}

              <Section title="System">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <InfoCard label="Retention" value={tenant.retentionDays ? `${tenant.retentionDays} days` : '—'} />
                  <InfoCard label="Settings Keys" value={tenant.settings ? `${Object.keys(tenant.settings).length}` : '0'} />
                  <InfoCard label="Metadata Keys" value={tenant.metadata ? `${Object.keys(tenant.metadata).length}` : '0'} />
                </div>
              </Section>
            </motion.div>
          )}

          {tab === 'departments' && (
            <motion.div key="departments" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {loadingDepts ? (<div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 rounded-lg bg-surface-raised animate-pulse" />)}</div>) : departments.length === 0 ? (<Empty message="No departments yet." action="Deploy Org Structure" onAction={() => setTab('deploy')} />) : (
                <div className="rounded-xl border border-surface-border overflow-hidden">
                  <table className="w-full text-sm"><thead><tr className="border-b border-surface-border bg-surface-raised"><Th>Name</Th><Th>Description</Th><Th>Created</Th></tr></thead>
                    <tbody>{departments.map((d, i) => (<tr key={d.id} className={`border-b border-surface-border/50 hover:bg-surface-raised/50 transition ${i % 2 === 0 ? '' : 'bg-surface-overlay/20'}`}><Td className="font-medium text-zinc-200">{d.name}</Td><Td className="text-zinc-500">{d.description ?? '—'}</Td><Td className="text-zinc-600 text-xs">{new Date(d.createdAt).toLocaleDateString()}</Td></tr>))}</tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}

          {tab === 'agents' && (
            <motion.div key="agents" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {loadingAgents ? (<div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 rounded-lg bg-surface-raised animate-pulse" />)}</div>) : agents.length === 0 ? (<Empty message="No employees deployed." action="Deploy Employees" onAction={() => setTab('deploy')} />) : (
                <div className="rounded-xl border border-surface-border overflow-hidden">
                  <table className="w-full text-sm"><thead><tr className="border-b border-surface-border bg-surface-raised"><Th>Name</Th><Th>Type</Th><Th>Model</Th><Th>Status</Th><Th>Created</Th></tr></thead>
                    <tbody>{agents.map((a, i) => (<tr key={a.id} className={`border-b border-surface-border/50 hover:bg-surface-raised/50 transition ${i % 2 === 0 ? '' : 'bg-surface-overlay/20'}`}><Td className="font-medium text-zinc-200">{a.name}</Td><Td><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${AGENT_TYPE_BADGE[a.type] ?? 'bg-zinc-800 text-zinc-400'}`}>{a.type}</span></Td><Td className="text-zinc-400 text-xs font-mono">{a.model}</Td><Td className="text-zinc-400 text-xs capitalize">{a.status}</Td><Td className="text-zinc-600 text-xs">{new Date(a.createdAt).toLocaleDateString()}</Td></tr>))}</tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}

          {tab === 'deploy' && (
            <motion.div key="deploy" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <DeployCard title="Deploy Org Structure" subtitle="Instantly create all departments for this tenant from a pre-built blueprint.">
                  {deptDeployResult ? (
                    <SuccessBox>Created <strong>{deptDeployResult.departments}</strong> departments{deptDeployResult.agents > 0 && <> and <strong>{deptDeployResult.agents}</strong> agents</>}.<button onClick={() => { setDeptDeployResult(null); setSelectedDeptTmpl(''); }} className="mt-3 text-xs text-[color:var(--accent-400)] hover:underline block">Deploy another →</button></SuccessBox>
                  ) : (<>
                    <div className="mb-3"><label htmlFor="deploy-dept-tmpl" className="text-xs text-zinc-500 mb-1.5 block">Select Template</label>
                      <select id="deploy-dept-tmpl" value={selectedDeptTmpl} onChange={(e) => setSelectedDeptTmpl(e.target.value)} className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-[color:var(--accent-500)]"><option value="">— choose a template —</option>{deptTemplates.map((t) => (<option key={t.id} value={t.id}>{t.name} ({t.structure.length} depts)</option>))}</select>
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer mb-4">
                      <div onClick={() => setWithAgents((v) => !v)} role="switch" aria-checked={withAgents} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setWithAgents((v) => !v); } }} className={`relative w-9 h-5 rounded-full transition cursor-pointer ${withAgents ? 'bg-[color:var(--accent-500)]' : 'bg-zinc-700'}`}><div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${withAgents ? 'translate-x-4' : 'translate-x-0.5'}`} /></div>
                      <span className="text-sm text-zinc-300">Auto-create head agents</span>
                    </label>
                    {deptDeployError && <ErrorBox>{deptDeployError}</ErrorBox>}
                    <button onClick={handleDeployDeptTemplate} disabled={!selectedDeptTmpl || deployingDept} className="w-full py-2 rounded-lg bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-sm font-medium transition disabled:opacity-50">{deployingDept ? 'Deploying…' : 'Deploy Structure'}</button>
                  </>)}
                </DeployCard>

                <DeployCard title="Deploy Employees" subtitle="Pick agent templates, configure each one, then bulk-deploy to this tenant.">
                  {agentDeployResult !== null ? (<SuccessBox><strong>{agentDeployResult}</strong> agent{agentDeployResult !== 1 ? 's' : ''} deployed.<button onClick={() => setAgentDeployResult(null)} className="mt-3 text-xs text-[color:var(--accent-400)] hover:underline block">Deploy more →</button></SuccessBox>) : (<>
                    <div className="flex gap-2 mb-3">
                      <select aria-label="Pick template to add" value={addTemplateId} onChange={(e) => setAddTemplateId(e.target.value)} className="flex-1 rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-[color:var(--accent-500)]"><option value="">— pick template to add —</option>{agentTemplateList.map((t) => (<option key={t.id} value={t.id}>[{t.type}] {t.name}</option>))}</select>
                      <button onClick={addAgentRow} disabled={!addTemplateId} className="px-4 py-2 rounded-lg bg-surface-raised border border-surface-border text-sm text-zinc-300 hover:text-indigo-300 hover:border-[color:var(--accent-500)] transition disabled:opacity-40">+ Add</button>
                    </div>
                    {agentRows.length > 0 && (<div className="space-y-2 mb-3 max-h-64 overflow-y-auto">
                      {agentRows.map((row, i) => {
                        const tmpl = agentTemplateList.find((t) => t.id === row.templateId);
                        return (<div key={i} className="rounded-lg border border-surface-border bg-surface-overlay p-3 space-y-2">
                          <div className="flex items-center justify-between"><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${AGENT_TYPE_BADGE[tmpl?.type ?? ''] ?? 'bg-zinc-800 text-zinc-400'}`}>{tmpl?.type ?? 'AGENT'}</span><button onClick={() => removeAgentRow(i)} className="text-zinc-600 hover:text-[color:var(--state-danger)] transition text-xs">✕</button></div>
                          <input aria-label="Agent display name" value={row.name} onChange={(e) => updateAgentRow(i, { name: e.target.value })} className="w-full rounded border border-surface-border bg-surface text-zinc-200 text-sm px-2 py-1.5 focus:outline-none focus:border-[color:var(--accent-500)]" placeholder="Agent display name" />
                          <div className="grid grid-cols-2 gap-2">
                            <div><label htmlFor={`agent-budget-${i}`} className="text-[10px] text-zinc-600 mb-0.5 block">Daily Budget ($)</label><input id={`agent-budget-${i}`} type="number" value={row.budgetPerDay ?? 100} onChange={(e) => updateAgentRow(i, { budgetPerDay: Number(e.target.value) })} className="w-full rounded border border-surface-border bg-surface text-zinc-300 text-sm px-2 py-1.5 focus:outline-none focus:border-[color:var(--accent-500)]" /></div>
                            <div><label htmlFor={`agent-auth-${i}`} className="text-[10px] text-zinc-600 mb-0.5 block">Authority</label><select id={`agent-auth-${i}`} value={row.authorityLevel ?? 'RECOMMEND'} onChange={(e) => updateAgentRow(i, { authorityLevel: e.target.value as BulkAgentDeployItem['authorityLevel'] })} className="w-full rounded border border-surface-border bg-surface text-zinc-300 text-sm px-2 py-1.5 focus:outline-none focus:border-[color:var(--accent-500)]"><option value="AUTO">AUTO</option><option value="RECOMMEND">RECOMMEND</option><option value="APPROVAL">APPROVAL</option></select></div>
                          </div>
                        </div>);
                      })}
                    </div>)}
                    {agentDeployError && <ErrorBox>{agentDeployError}</ErrorBox>}
                    <button onClick={handleBulkDeploy} disabled={agentRows.length === 0 || deployingAgents} className="w-full py-2 rounded-lg bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-sm font-medium transition disabled:opacity-50 mt-2">{deployingAgents ? 'Deploying…' : `Deploy ${agentRows.length || ''} Agent${agentRows.length !== 1 ? 's' : ''}`}</button>
                  </>)}
                </DeployCard>
              </div>

              <DeployCard title="Deploy Package" subtitle="Apply a package composition to this tenant in one transaction.">
                {pkgDeployResult ? (<SuccessBox>Package <strong>{pkgDeployResult.package.name}</strong> deployed.<button onClick={() => { setPkgDeployResult(null); setSelectedPackageId(''); setPkgPreview(null); }} className="mt-3 text-xs text-[color:var(--accent-400)] hover:underline block">Deploy another →</button></SuccessBox>) : (
                  <div className="space-y-4">
                    <div><label htmlFor="deploy-pkg" className="text-xs text-zinc-500 mb-1.5 block">Select Package ({packages.length} available)</label>
                      <select id="deploy-pkg" value={selectedPackageId} onChange={(e) => { setSelectedPackageId(e.target.value); setPkgPreview(null); setPkgDeployError(null); }} className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-[color:var(--accent-500)]"><option value="">— choose a package —</option>{packages.map((pkg) => (<option key={pkg.id} value={pkg.id}>[{pkg.status}] {pkg.name} ({pkg.departments?.length ?? 0}D / {pkg.aiAgents?.length ?? 0}A)</option>))}</select>
                    </div>
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-400">
                        <div onClick={() => setPkgWithAgents((v) => !v)} role="switch" aria-checked={pkgWithAgents} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPkgWithAgents((v) => !v); } }} className="relative w-8 rounded-full transition cursor-pointer" style={{ height: '18px', backgroundColor: pkgWithAgents ? 'var(--accent-500)' : '#3f3f46' }}><div className="absolute top-0.5 rounded-full bg-white shadow transition-transform" style={{ width: '14px', height: '14px', transform: pkgWithAgents ? 'translateX(16px)' : 'translateX(2px)' }} /></div>Agents
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-400">
                        <div onClick={() => setPkgIdempotent((v) => !v)} role="switch" aria-checked={pkgIdempotent} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPkgIdempotent((v) => !v); } }} className="relative w-8 rounded-full transition cursor-pointer" style={{ height: '18px', backgroundColor: pkgIdempotent ? 'var(--accent-500)' : '#3f3f46' }}><div className="absolute top-0.5 rounded-full bg-white shadow transition-transform" style={{ width: '14px', height: '14px', transform: pkgIdempotent ? 'translateX(16px)' : 'translateX(2px)' }} /></div>Idempotent
                      </label>
                      <div><label htmlFor="pkg-authority" className="text-[10px] text-zinc-600 block mb-0.5">Authority</label>
                        <select id="pkg-authority" value={pkgAuthority} onChange={(e) => setPkgAuthority(e.target.value as typeof pkgAuthority)} className="rounded border border-surface-border bg-surface-overlay text-zinc-200 text-xs px-2 py-1 focus:outline-none focus:border-[color:var(--accent-500)]"><option value="AUTO">AUTO</option><option value="RECOMMEND">RECOMMEND</option><option value="APPROVAL">APPROVAL</option></select>
                      </div>
                    </div>
                    {pkgDeployError && <ErrorBox>{pkgDeployError}</ErrorBox>}
                    <div className="flex gap-3">
                      <button onClick={handlePackagePreview} disabled={!selectedPackageId || pkgPreviewing} className="flex-1 py-2 rounded-lg border border-surface-border text-sm text-zinc-300 hover:text-indigo-300 hover:border-[color:var(--accent-500)] transition disabled:opacity-50">{pkgPreviewing ? 'Checking…' : 'Preview'}</button>
                      <button onClick={handlePackageDeploy} disabled={!selectedPackageId || pkgDeploying || (pkgPreview !== null && !pkgPreview.feasible)} className="flex-1 py-2 rounded-lg bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-sm font-medium transition disabled:opacity-50">{pkgDeploying ? 'Deploying…' : 'Deploy Package'}</button>
                    </div>
                  </div>
                )}
              </DeployCard>

              <DeployCard title="Deploy Single Department" subtitle="Deploy one department from a template.">
                {singleDeptResult ? (<SuccessBox>Created <strong>{singleDeptResult.name}</strong>.<button onClick={() => { setSingleDeptResult(null); setSingleDeptTemplateId(''); }} className="mt-3 text-xs text-[color:var(--accent-400)] hover:underline block">Deploy another →</button></SuccessBox>) : (
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="flex-1 min-w-[200px]"><label htmlFor="single-dept-tmpl" className="text-xs text-zinc-500 mb-1.5 block">Department Template</label>
                      <select id="single-dept-tmpl" value={singleDeptTemplateId} onChange={(e) => setSingleDeptTemplateId(e.target.value)} className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-[color:var(--accent-500)]"><option value="">— choose template —</option>{deptTemplates.map((t) => (<option key={t.id} value={t.id}>{t.name} ({t.structure.length} items)</option>))}</select>
                    </div>
                    <div className="w-24"><label htmlFor="single-dept-idx" className="text-xs text-zinc-500 mb-1.5 block">Item Index</label>
                      <input id="single-dept-idx" type="number" value={singleDeptItemIndex} min={0} onChange={(e) => setSingleDeptItemIndex(Math.max(0, Number(e.target.value)))} className="w-full rounded border border-surface-border bg-surface-overlay text-zinc-200 text-sm px-3 py-2 focus:outline-none focus:border-[color:var(--accent-500)]" />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-400">
                      <div onClick={() => setSingleDeptWithAgent((v) => !v)} role="switch" aria-checked={singleDeptWithAgent} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSingleDeptWithAgent((v) => !v); } }} className="relative w-8 cursor-pointer rounded-full" style={{ height: '18px', width: '32px', backgroundColor: singleDeptWithAgent ? 'var(--accent-500)' : '#3f3f46' }}><div className="absolute top-0.5 bg-white shadow transition-transform rounded-full" style={{ width: '14px', height: '14px', transform: singleDeptWithAgent ? 'translateX(16px)' : 'translateX(2px)' }} /></div>
                      <span>Head Agent</span>
                    </label>
                    {singleDeptError && <ErrorBox>{singleDeptError}</ErrorBox>}
                    <button onClick={handleDeploySingleDepartment} disabled={!singleDeptTemplateId || deployingSingleDept} className="py-2 px-4 rounded-lg bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-sm font-medium transition disabled:opacity-50">{deployingSingleDept ? 'Deploying…' : 'Deploy'}</button>
                  </div>
                )}
              </DeployCard>
            </motion.div>
          )}
        </AnimatePresence>

        <ConfirmDialog open={suspendOpen} variant="warning" title={tenant?.status === 'SUSPENDED' ? 'Activate tenant?' : 'Suspend tenant?'} description={<span>This will <strong>{tenant?.status === 'SUSPENDED' ? 'reactivate' : 'suspend'}</strong> <strong>{tenant?.name}</strong>.</span>} confirmLabel={tenant?.status === 'SUSPENDED' ? 'Activate' : 'Suspend'} busy={actionBusy} onCancel={() => setSuspendOpen(false)} onConfirm={handleSuspend} />
        <ConfirmDialog open={deleteOpen} variant="danger" title="Delete tenant?" description={<span>This will permanently delete <strong>{tenant?.name}</strong> and <strong>all</strong> associated data.</span>} confirmLabel="Delete Everything" busy={actionBusy} onCancel={() => setDeleteOpen(false)} onConfirm={handleDelete} />
      </div>
    </AdminShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) { return (<div className="text-center"><div className="text-xs text-zinc-500">{label}</div><div className="text-sm font-medium text-zinc-200">{value}</div></div>); }

function Section({ title, children }: { title: string; children: React.ReactNode }) { return (<div><h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">{title}</h2>{children}</div>); }

function InfoCard({ label, value, children, href }: { label: string; value?: string; children?: React.ReactNode; href?: string }) { const content = children ?? (href ? (<a href={href} target="_blank" rel="noopener noreferrer" className="text-[color:var(--accent-400)] hover:text-indigo-300 underline underline-offset-2 truncate block">{value}</a>) : (<span className="text-zinc-100 truncate block">{value}</span>)); return (<div className="rounded-xl border border-surface-border bg-surface-raised p-4 min-w-0"><div className="text-xs text-zinc-500 mb-1">{label}</div><div className="text-sm font-medium">{content}</div></div>); }

function TierStat({ label, value }: { label: string; value: string }) { return (<div><div className="text-xs text-zinc-500">{label}</div><div className="text-sm font-semibold text-zinc-100 mt-0.5">{value}</div></div>); }

function FeatureTag({ enabled, label }: { enabled?: boolean; label: string }) { return (<div className={`flex items-center gap-1.5 text-xs ${enabled ? 'text-indigo-300' : 'text-zinc-600'}`}><span className={`w-1.5 h-1.5 rounded-full ${enabled ? 'bg-indigo-400' : 'bg-zinc-700'}`} />{label}</div>); }

function Th({ children }: { children: React.ReactNode }) { return <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">{children}</th>; }
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) { return <td className={`px-4 py-3 ${className}`}>{children}</td>; }

function Empty({ message, action, onAction }: { message: string; action: string; onAction: () => void }) { return (<div className="py-16 text-center text-zinc-500 text-sm">{message} <button onClick={onAction} className="text-[color:var(--accent-400)] hover:underline">{action}</button></div>); }

function DeployCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) { return (<div className="rounded-xl border border-surface-border bg-surface-raised p-5 flex flex-col gap-1"><h2 className="text-sm font-semibold text-zinc-100">{title}</h2><p className="text-xs text-zinc-500 mb-4">{subtitle}</p>{children}</div>); }

function SuccessBox({ children }: { children: React.ReactNode }) { return (<div className="rounded-lg bg-[color:var(--state-success)] border border-green-800 px-4 py-5 text-sm text-green-300 text-center"><div className="text-2xl mb-2">✓</div>{children}</div>); }

function ErrorBox({ children }: { children: React.ReactNode }) { return (<div className="rounded-lg bg-[color:var(--state-danger)] border border-red-800 px-3 py-2 text-sm text-red-300 mb-3">{children}</div>); }
