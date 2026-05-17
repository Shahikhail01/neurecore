'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTenantAuth } from '@/hooks/useTenantAuth';
import TenantShell from '@/components/TenantShell';
import api from '../../../services/api';
import { unwrapArrayOrEmpty } from '@/services/unwrap';

interface AvailableModel {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
  costPer1kTokensInput: number;
  costPer1kTokensOutput: number;
  capabilities: string[];
}

type AgentType = 'GENERAL' | 'RESEARCH' | 'CODE' | 'ANALYSIS' | 'CREATIVE' | 'CUSTOMER_SERVICE';

const AGENT_TYPES: { value: AgentType; label: string; desc: string }[] = [
  { value: 'GENERAL', label: 'General', desc: 'Versatile assistant for various tasks' },
  { value: 'RESEARCH', label: 'Research', desc: 'Deep research and information gathering' },
  { value: 'CODE', label: 'Code', desc: 'Software development and code review' },
  { value: 'ANALYSIS', label: 'Analysis', desc: 'Data analysis and insights' },
  { value: 'CREATIVE', label: 'Creative', desc: 'Content creation and creative work' },
  { value: 'CUSTOMER_SERVICE', label: 'Customer Service', desc: 'Customer support interactions' },
];

const STEPS = ['Type', 'Model', 'Configure', 'Review'];

export default function NewAgentPage() {
  const user = useTenantAuth();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [models, setModels] = useState<AvailableModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    type: '' as AgentType | '',
    model: '',
    name: '',
    description: '',
    systemPrompt: '',
    maxRetries: 3,
    timeoutSeconds: 300,
    budgetPerDay: '',
    maxTokensPerDay: '',
  });

  useEffect(() => {
    async function loadModels() {
      try {
        const res = await api.get('/models/available');
        setModels(unwrapArrayOrEmpty(res));
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingModels(false);
      }
    }
    void loadModels();
  }, []);

  const canNext = () => {
    if (step === 0) return form.type !== '';
    if (step === 1) return form.model !== '';
    if (step === 2) return form.name.trim() !== '';
    return true;
  };

  const handleCreate = async () => {
    setSaving(true);
    setError('');
    try {
      // Map frontend agent types to backend enum values
      const typeMap: Record<AgentType, string> = {
        GENERAL: 'CORE',
        RESEARCH: 'FUNCTIONAL',
        CODE: 'FUNCTIONAL',
        ANALYSIS: 'FUNCTIONAL',
        CREATIVE: 'EXECUTIVE',
        CUSTOMER_SERVICE: 'FUNCTIONAL',
      };
      const mappedType = (form.type ? typeMap[form.type as AgentType] : undefined) as string | undefined;
      // Only send fields accepted by CreateAgentDto. Put runtime-only fields into `config`.
      await api.post('/agents', {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        type: mappedType,
        model: form.model || undefined,
        systemPrompt: form.systemPrompt.trim() || undefined,
        budgetPerDay: form.budgetPerDay ? parseFloat(form.budgetPerDay) : undefined,
        config: {
          maxRetries: form.maxRetries,
          timeoutSeconds: form.timeoutSeconds,
          maxTokensPerDay: form.maxTokensPerDay ? parseInt(form.maxTokensPerDay) : undefined,
        },
      });
      router.push('/agents');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message ?? 'Failed to create agent');
      setSaving(false);
    }
  };

  if (!user) return null;

  const selectedModel = models.find((m) => m.id === form.model);

  return (
    <TenantShell user={user}>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button onClick={() => router.push('/agents')} className="text-zinc-500 hover:text-zinc-300 text-sm mb-4 flex items-center gap-1 transition-colors">
            ← Back to Agents
          </button>
          <h1 className="text-2xl font-bold text-zinc-100">Create Agent</h1>
          <p className="text-sm text-zinc-500 mt-1">Configure a new AI agent for your workspace</p>
        </div>

        {/* Step Progress */}
        <div className="flex items-center gap-0 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center flex-1">
              <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 ${
                i < step ? 'bg-violet-600 text-white' : i === step ? 'bg-violet-500 text-white ring-2 ring-violet-300/30' : 'bg-zinc-800 text-zinc-500'
              }`}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className={`ml-2 text-xs font-medium ${i === step ? 'text-zinc-200' : 'text-zinc-600'}`}>{s}</span>
              {i < STEPS.length - 1 && <div className="flex-1 h-px bg-zinc-800 mx-3" />}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 min-h-[340px] flex flex-col">
          {/* Step 0 — Type */}
          {step === 0 && (
            <div className="flex-1 space-y-3">
              <h2 className="text-base font-semibold text-zinc-200 mb-4">What kind of agent do you need?</h2>
              {AGENT_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setForm({ ...form, type: t.value })}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                    form.type === t.value
                      ? 'border-violet-500 bg-violet-950 text-violet-200'
                      : 'border-zinc-800 bg-zinc-800/50 text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  <div className="font-medium text-sm">{t.label}</div>
                  <div className="text-xs opacity-60 mt-0.5">{t.desc}</div>
                </button>
              ))}
            </div>
          )}

          {/* Step 1 — Model */}
          {step === 1 && (
            <div className="flex-1">
              <h2 className="text-base font-semibold text-zinc-200 mb-4">Select a model</h2>
              {loadingModels ? (
                <p className="text-zinc-500 text-sm">Loading models…</p>
              ) : (
                <div className="space-y-3">
                  {models.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setForm({ ...form, model: m.id })}
                      className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                        form.model === m.id
                          ? 'border-violet-500 bg-violet-950 text-violet-200'
                          : 'border-zinc-800 bg-zinc-800/50 text-zinc-300 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">{m.name}</div>
                          <div className="text-xs opacity-60 mt-0.5">{m.provider} · {(m.contextWindow / 1000).toFixed(0)}K context</div>
                        </div>
                        <div className="text-right text-xs text-zinc-500">
                          <div>${m.costPer1kTokensInput}/1K in</div>
                          <div>${m.costPer1kTokensOutput}/1K out</div>
                        </div>
                      </div>
                      {m.capabilities.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {m.capabilities.map((c) => (
                            <span key={c} className="px-1.5 py-0.5 bg-zinc-700 text-zinc-400 text-xs rounded">{c}</span>
                          ))}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2 — Configure */}
          {step === 2 && (
            <div className="flex-1 space-y-4">
              <h2 className="text-base font-semibold text-zinc-200 mb-2">Configure your agent</h2>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Agent Name *</label>
                <input
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-600"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="My Research Agent"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Description</label>
                <input
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-600"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="What this agent does…"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">System Prompt</label>
                <textarea
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-600 resize-none"
                  rows={4}
                  value={form.systemPrompt}
                  onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
                  placeholder="You are a helpful assistant that…"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Daily Budget (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-600"
                    value={form.budgetPerDay}
                    onChange={(e) => setForm({ ...form, budgetPerDay: e.target.value })}
                    placeholder="5.00"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Max Tokens/Day</label>
                  <input
                    type="number"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-600"
                    value={form.maxTokensPerDay}
                    onChange={(e) => setForm({ ...form, maxTokensPerDay: e.target.value })}
                    placeholder="100000"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Max Retries</label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-600"
                    value={form.maxRetries}
                    onChange={(e) => setForm({ ...form, maxRetries: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Timeout (seconds)</label>
                  <input
                    type="number"
                    min={30}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-600"
                    value={form.timeoutSeconds}
                    onChange={(e) => setForm({ ...form, timeoutSeconds: parseInt(e.target.value) || 300 })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3 — Review */}
          {step === 3 && (
            <div className="flex-1 space-y-4">
              <h2 className="text-base font-semibold text-zinc-200 mb-2">Review & Create</h2>
              <div className="rounded-xl bg-zinc-800 divide-y divide-zinc-700">
                {[
                  ['Type', AGENT_TYPES.find((t) => t.value === form.type)?.label],
                  ['Model', selectedModel?.name],
                  ['Name', form.name],
                  ['Description', form.description || '—'],
                  ['Daily Budget', form.budgetPerDay ? `$${form.budgetPerDay}` : 'Unlimited'],
                  ['Max Tokens/Day', form.maxTokensPerDay || 'Unlimited'],
                  ['Max Retries', form.maxRetries],
                  ['Timeout', `${form.timeoutSeconds}s`],
                ].map(([label, value]) => (
                  <div key={String(label)} className="flex justify-between px-4 py-2.5 text-sm">
                    <span className="text-zinc-500">{label}</span>
                    <span className="text-zinc-200 font-medium">{String(value ?? '—')}</span>
                  </div>
                ))}
              </div>
              {form.systemPrompt && (
                <div>
                  <p className="text-xs text-zinc-500 mb-1">System Prompt</p>
                  <div className="text-sm text-zinc-300 bg-zinc-800 rounded-xl px-4 py-3 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
                    {form.systemPrompt}
                  </div>
                </div>
              )}
              {error && <p className="text-sm text-red-400">{error}</p>}
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-6 mt-auto">
            <button
              onClick={() => step > 0 ? setStep(step - 1) : router.push('/agents')}
              className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              {step === 0 ? 'Cancel' : '← Back'}
            </button>
            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={!canNext()}
                className="px-5 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-medium rounded-xl transition-colors"
              >
                Continue →
              </button>
            ) : (
              <button
                onClick={handleCreate}
                disabled={saving}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-medium rounded-xl transition-colors"
              >
                {saving ? 'Creating…' : 'Create Agent'}
              </button>
            )}
          </div>
        </div>
      </div>
    </TenantShell>
  );
}
