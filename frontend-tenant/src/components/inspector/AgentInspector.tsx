'use client';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { STATUS_BADGE_CLASS, STATUS_COLOR_MAP } from '@/types/ui.types';
import api from '@/services/api';
import { unwrapItem, unwrapList } from '@/services/unwrap';
import { AgentAvatar } from '@/components/agents/AgentAvatar';
import { uploadsService, AGENT_AVATAR_UPLOAD } from '@/services/uploads.service';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';

const AI_MODELS = [
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4-turbo',
  'claude-3-5-sonnet-20241022',
  'claude-3-haiku-20240307',
  'deepseek-chat',
  'deepseek-reasoner',
  'MiniMax-M2.7-highspeed',
];

const PROFILE_COLORS = [
  { value: 'blue', label: 'Blue' },
  { value: 'purple', label: 'Purple' },
  { value: 'green', label: 'Green' },
  { value: 'red', label: 'Red' },
  { value: 'orange', label: 'Orange' },
  { value: 'pink', label: 'Pink' },
  { value: 'teal', label: 'Teal' },
  { value: 'indigo', label: 'Indigo' },
  { value: 'gray', label: 'Gray' },
];

interface AgentProfile {
  avatarUrl?: string | null;
  designation?: string | null;
  bio?: string | null;
  color?: string | null;
  emoji?: string | null;
}

interface AgentDetail {
  id: string;
  name: string;
  description?: string | null;
  type: string;
  status: string;
  model?: string | null;
  systemPrompt?: string | null;
  instructions?: string | null;
  budgetPerDay?: number | null;
  totalSpend?: string;
  permissions?: string[];
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown> | null;
  isActive?: boolean;
  tenantId?: string;
  departmentId?: string | null;
  templateId?: string;
  emailProvider?: string;
  isSelected?: boolean;
  createdAt?: string;
  updatedAt?: string;
  _count?: {
    tasks?: number;
    memoryEntries?: number;
    executionLogs?: number;
  };
  department?: { id?: string; name?: string };
}

interface Department {
  id: string;
  name: string;
}

function extractProfile(metadata?: Record<string, unknown> | null): AgentProfile {
  const p = (metadata?.profile as Record<string, unknown> | undefined) ?? {};
  return {
    avatarUrl: typeof p.avatarUrl === 'string' ? p.avatarUrl : null,
    designation: typeof p.designation === 'string' ? p.designation : null,
    bio: typeof p.bio === 'string' ? p.bio : null,
    color: typeof p.color === 'string' ? p.color : null,
    emoji: typeof p.emoji === 'string' ? p.emoji : null,
  };
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-surface-border last:border-0">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="text-xs text-zinc-300 font-medium text-right max-w-[60%]">{value}</span>
    </div>
  );
}

function SectionHeader({ title, onClick, expanded }: { title: string; onClick?: () => void; expanded?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 w-full text-left py-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider hover:text-zinc-300 transition-colors"
    >
      {expanded !== undefined && (
        expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />
      )}
      {title}
    </button>
  );
}

export function AgentInspector({ id }: { id: string }) {
  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Core agent fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [model, setModel] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [budgetPerDay, setBudgetPerDay] = useState('');
  const [instructions, setInstructions] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');

  // Profile fields
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [designation, setDesignation] = useState('');
  const [bio, setBio] = useState('');
  const [color, setColor] = useState<string | null>(null);
  const [emoji, setEmoji] = useState('');

  const loadDepartments = () => {
    setLoadingDepts(true);
    api.get('/departments?limit=100')
      .then((res) => {
        const data = unwrapList(res);
        setDepartments((data.items as Department[]) ?? []);
      })
      .catch(() => setDepartments([]))
      .finally(() => setLoadingDepts(false));
  };

  const load = () => {
    setLoading(true);
    api
      .get(`/agents/${id}`)
      .then((r) => {
        const data = unwrapItem(r) as AgentDetail | null;
        setAgent(data);
        if (data) {
          setName(data.name ?? '');
          setDescription(data.description ?? '');
          setModel(data.model ?? 'gpt-4o-mini');
          setDepartmentId(data.departmentId ?? '');
          setBudgetPerDay(data.budgetPerDay?.toString() ?? '');
          setInstructions(data.instructions ?? '');
          setSystemPrompt(data.systemPrompt ?? '');
          const p = extractProfile(data.metadata);
          setAvatarUrl(p.avatarUrl ?? null);
          setDesignation(p.designation ?? '');
          setBio(p.bio ?? '');
          setColor(p.color ?? null);
          setEmoji(p.emoji ?? '');
        }
      })
      .catch(() => setAgent(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const handleAvatarFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (file.size > AGENT_AVATAR_UPLOAD.maxBytes) {
      setError(`Avatar exceeds ${AGENT_AVATAR_UPLOAD.maxBytes / (1024 * 1024)} MB limit`);
      return;
    }
    if (!(AGENT_AVATAR_UPLOAD.allowedTypes as readonly string[]).includes(file.type)) {
      setError('Unsupported image type. Use PNG, JPEG, WEBP, or SVG.');
      return;
    }
    setUploading(true);
    try {
      const result = await uploadsService.uploadAgentAvatar(file);
      setAvatarUrl(result.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!agent) return;
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        name: name.trim() || undefined,
        description: description.trim() || null,
        model: model || undefined,
        departmentId: departmentId || null,
        budgetPerDay: budgetPerDay ? parseFloat(budgetPerDay) : undefined,
        instructions: instructions.trim() || null,
        systemPrompt: systemPrompt.trim() || null,
        avatarUrl: avatarUrl || null,
        designation: designation.trim() || null,
        bio: bio.trim() || null,
        color: color || null,
        emoji: emoji.trim() || null,
      };
      await api.patch(`/agents/${agent.id}`, payload);
      setEditing(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (!agent) return;
    const p = extractProfile(agent.metadata);
    setName(agent.name ?? '');
    setDescription(agent.description ?? '');
    setModel(agent.model ?? 'gpt-4o-mini');
    setDepartmentId(agent.departmentId ?? '');
    setBudgetPerDay(agent.budgetPerDay?.toString() ?? '');
    setInstructions(agent.instructions ?? '');
    setSystemPrompt(agent.systemPrompt ?? '');
    setAvatarUrl(p.avatarUrl ?? null);
    setDesignation(p.designation ?? '');
    setBio(p.bio ?? '');
    setColor(p.color ?? null);
    setEmoji(p.emoji ?? '');
    setError(null);
    setEditing(false);
  };

  if (loading) {
    return (
      <div className="p-6 flex flex-col gap-4 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-surface-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-surface-muted rounded w-1/2" />
            <div className="h-3 bg-surface-muted rounded w-1/3" />
          </div>
        </div>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-4 bg-surface-muted rounded" style={{ width: `${50 + i * 5}%` }} />
        ))}
      </div>
    );
  }

  if (!agent) {
    return <div className="p-6 text-zinc-500 text-sm">Agent not found.</div>;
  }

  const profile = extractProfile(agent.metadata);
  const statusColor = STATUS_COLOR_MAP[agent.status] ?? 'neutral';
  const totalSpendNum = parseFloat(agent.totalSpend ?? '0');
  const budgetPct =
    agent.budgetPerDay && totalSpendNum
      ? Math.min(100, Math.round((totalSpendNum / agent.budgetPerDay) * 100))
      : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col"
    >
      {/* Header */}
      <div className="p-6 pb-4 border-b border-surface-border">
        <div className="flex items-start gap-4">
          <AgentAvatar
            name={agent.name}
            avatarUrl={profile.avatarUrl}
            emoji={profile.emoji}
            color={profile.color}
            size={56}
          />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-zinc-100 truncate">{agent.name}</h2>
            {profile.designation && (
              <p className="text-xs text-zinc-400 truncate">{profile.designation}</p>
            )}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-xs text-zinc-500">{agent.type}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE_CLASS[statusColor]}`}
              >
                {agent.status}
              </span>
              {agent.isSelected && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-accent-500/20 text-accent-400 font-medium">
                  Selected
                </span>
              )}
            </div>
          </div>
        </div>
        {profile.bio && (
          <p className="text-xs text-zinc-400 leading-relaxed mt-3">{profile.bio}</p>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Edit Mode */}
        {editing ? (
          <div className="p-6 space-y-6">
            {/* Avatar Section */}
            <div className="flex items-center gap-4">
              <AgentAvatar
                name={name}
                avatarUrl={avatarUrl}
                emoji={emoji || null}
                color={color}
                size={64}
              />
              <div className="flex gap-2">
                <input
                  id="agent-avatar-file"
                  ref={fileInputRef}
                  type="file"
                  accept={AGENT_AVATAR_UPLOAD.allowedTypes.join(',')}
                  className="hidden"
                  onChange={(e) => void handleAvatarFile(e.target.files?.[0])}
                  disabled={uploading}
                />
                <button
                  type="button"
                  className="text-xs py-2 px-3 rounded-lg bg-surface-muted hover:bg-surface-overlay text-zinc-300 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : avatarUrl ? 'Replace' : 'Upload'}
                </button>
                {avatarUrl && (
                  <button
                    type="button"
                    className="text-xs py-2 px-3 rounded-lg hover:bg-surface-overlay text-zinc-400 transition-colors"
                    onClick={() => setAvatarUrl(null)}
                    disabled={uploading}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            {/* Identity Section */}
            <div className="space-y-3">
              <SectionHeader title="Identity" />
              <div className="space-y-3 pl-4">
                <div>
                  <label htmlFor="agent-edit-name" className="text-xs text-zinc-500 mb-1 block">Agent Name</label>
                  <input
                    id="agent-edit-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 text-sm text-zinc-200 bg-surface rounded-lg border border-surface-border focus:border-accent-500 outline-none transition"
                    placeholder="Agent name"
                    maxLength={100}
                  />
                </div>
                <div>
                  <label htmlFor="agent-edit-description" className="text-xs text-zinc-500 mb-1 block">Description</label>
                  <textarea
                    id="agent-edit-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 text-sm text-zinc-200 bg-surface rounded-lg border border-surface-border focus:border-accent-500 outline-none transition resize-y min-h-[60px]"
                    placeholder="Brief description of this agent's role"
                    maxLength={500}
                  />
                </div>
              </div>
            </div>

            {/* Profile Section */}
            <div className="space-y-3">
              <SectionHeader title="Profile" />
              <div className="space-y-3 pl-4">
                <div>
                  <label htmlFor="agent-edit-designation" className="text-xs text-zinc-500 mb-1 block">Designation</label>
                  <input
                    id="agent-edit-designation"
                    type="text"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="w-full px-3 py-2 text-sm text-zinc-200 bg-surface rounded-lg border border-surface-border focus:border-accent-500 outline-none transition"
                    placeholder="e.g. Senior Financial Analyst"
                    maxLength={100}
                  />
                </div>
                <div>
                  <label htmlFor="agent-edit-bio" className="text-xs text-zinc-500 mb-1 block">Bio</label>
                  <textarea
                    id="agent-edit-bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full px-3 py-2 text-sm text-zinc-200 bg-surface rounded-lg border border-surface-border focus:border-accent-500 outline-none transition resize-y min-h-[80px]"
                    placeholder="Short bio shown on hover and in inspector"
                    maxLength={1000}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="agent-edit-color" className="text-xs text-zinc-500 mb-1 block">Color</label>
                    <select
                      id="agent-edit-color"
                      value={color ?? ''}
                      onChange={(e) => setColor(e.target.value || null)}
                      className="w-full px-3 py-2 text-sm text-zinc-200 bg-surface rounded-lg border border-surface-border focus:border-accent-500 outline-none transition"
                    >
                      <option value="">Default</option>
                      {PROFILE_COLORS.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="agent-edit-emoji" className="text-xs text-zinc-500 mb-1 block">Emoji</label>
                    <input
                      id="agent-edit-emoji"
                      type="text"
                      value={emoji}
                      onChange={(e) => setEmoji(e.target.value)}
                      className="w-full px-3 py-2 text-sm text-zinc-200 bg-surface rounded-lg border border-surface-border focus:border-accent-500 outline-none transition"
                      placeholder="e.g. 💼"
                      maxLength={8}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Configuration Section */}
            <div className="space-y-3">
              <SectionHeader title="Configuration" />
              <div className="space-y-3 pl-4">
                <div>
                  <label htmlFor="agent-edit-model" className="text-xs text-zinc-500 mb-1 block">AI Model</label>
                  <select
                    id="agent-edit-model"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full px-3 py-2 text-sm text-zinc-200 bg-surface rounded-lg border border-surface-border focus:border-accent-500 outline-none transition"
                  >
                    {AI_MODELS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="agent-edit-dept" className="text-xs text-zinc-500 mb-1 block">Department</label>
                  <select
                    id="agent-edit-dept"
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    disabled={loadingDepts}
                    className="w-full px-3 py-2 text-sm text-zinc-200 bg-surface rounded-lg border border-surface-border focus:border-accent-500 outline-none transition disabled:opacity-50"
                  >
                    <option value="">— No department —</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="agent-edit-budget" className="text-xs text-zinc-500 mb-1 block">Daily Budget ($)</label>
                  <input
                    id="agent-edit-budget"
                    type="number"
                    value={budgetPerDay}
                    onChange={(e) => setBudgetPerDay(e.target.value)}
                    className="w-full px-3 py-2 text-sm text-zinc-200 bg-surface rounded-lg border border-surface-border focus:border-accent-500 outline-none transition"
                    placeholder="50"
                    min="0"
                    max="1000"
                    step="1"
                  />
                </div>
              </div>
            </div>

            {/* Instructions Section */}
            <div className="space-y-3">
              <SectionHeader title="Instructions" />
              <div className="space-y-3 pl-4">
                <div>
                  <label htmlFor="agent-edit-instructions" className="text-xs text-zinc-500 mb-1 block">Instructions</label>
                  <textarea
                    id="agent-edit-instructions"
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    className="w-full px-3 py-2 text-sm text-zinc-200 bg-surface rounded-lg border border-surface-border focus:border-accent-500 outline-none transition resize-y min-h-[80px]"
                    placeholder="Additional instructions for this agent..."
                  />
                </div>
              </div>
            </div>

            {/* Advanced Section */}
            <div className="space-y-3">
              <SectionHeader
                title="Advanced"
                onClick={() => setShowAdvanced(!showAdvanced)}
                expanded={showAdvanced}
              />
              {showAdvanced && (
                <div className="space-y-3 pl-4">
                  <div>
                    <label htmlFor="agent-edit-system-prompt" className="text-xs text-zinc-500 mb-1 block">System Prompt</label>
                    <textarea
                      id="agent-edit-system-prompt"
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      className="w-full px-3 py-2 text-sm text-zinc-200 bg-surface rounded-lg border border-surface-border focus:border-accent-500 outline-none transition resize-y min-h-[100px] font-mono text-xs"
                      placeholder="Custom system prompt (advanced)..."
                    />
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="text-xs text-state-danger bg-state-danger/10 border border-state-danger/30 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                className="flex-1 py-2.5 text-sm rounded-xl bg-accent-500 hover:bg-accent-600 text-white font-medium transition-colors disabled:opacity-50"
                onClick={handleSave}
                disabled={saving || uploading}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                className="flex-1 py-2.5 text-sm rounded-xl bg-surface-muted hover:bg-surface-overlay text-zinc-300 transition-colors disabled:opacity-50"
                onClick={handleCancel}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          /* View Mode */
          <div className="p-6 space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="card-surface p-3 text-center border border-surface-border">
                <p className="text-xs text-zinc-500">Tasks</p>
                <p className="text-lg font-bold text-zinc-100">{agent._count?.tasks ?? 0}</p>
              </div>
              <div className="card-surface p-3 text-center border border-surface-border">
                <p className="text-xs text-zinc-500">Budget Used</p>
                <p className="text-lg font-bold text-zinc-100">
                  {agent.budgetPerDay ? `${budgetPct ?? 0}%` : '—'}
                </p>
              </div>
            </div>

            {/* Details */}
            <div>
              <SectionHeader title="Details" />
              <div className="px-1">
                <Row label="Model" value={agent.model ?? 'gpt-4o-mini'} />
                <Row label="Department" value={agent.departmentId ? departments.find(d => d.id === agent.departmentId)?.name ?? agent.departmentId : '—'} />
                <Row label="Daily Budget" value={agent.budgetPerDay ? `$${agent.budgetPerDay}` : '—'} />
                <Row label="Total Spend" value={agent.totalSpend ? `$${parseFloat(agent.totalSpend).toFixed(4)}` : '$0'} />
                <Row label="Template" value={agent.templateId ?? '—'} />
                <Row label="Email Provider" value={agent.emailProvider ?? '—'} />
                <Row label="Active" value={agent.isActive ? 'Yes' : 'No'} />
                <Row label="Created" value={agent.createdAt ? new Date(agent.createdAt).toLocaleDateString() : '—'} />
                <Row label="Last Updated" value={agent.updatedAt ? new Date(agent.updatedAt).toLocaleDateString() : '—'} />
              </div>
            </div>

            {/* Description */}
            {agent.description && (
              <div>
                <SectionHeader title="Description" />
                <p className="text-xs text-zinc-400 leading-relaxed px-1">{agent.description}</p>
              </div>
            )}

            {/* Instructions */}
            {agent.instructions && (
              <div>
                <SectionHeader title="Instructions" />
                <p className="text-xs text-zinc-400 leading-relaxed px-1">{agent.instructions}</p>
              </div>
            )}

            {/* System Prompt */}
            {agent.systemPrompt && (
              <div>
                <SectionHeader title="System Prompt" />
                <pre className="text-xs text-zinc-400 bg-surface p-3 rounded-lg border border-surface-border leading-relaxed overflow-x-auto px-1">
                  {agent.systemPrompt}
                </pre>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-2 pt-4 border-t border-surface-border">
              <button className="w-full py-2.5 text-sm rounded-xl bg-status-ops/10 hover:bg-status-ops/20 text-status-ops border border-status-ops/20 transition-colors font-medium">
                View Execution Logs
              </button>
              <button
                className="w-full py-2.5 text-sm rounded-xl bg-surface-muted hover:bg-surface-overlay text-zinc-300 border border-surface-border transition-colors font-medium"
                onClick={() => { loadDepartments(); setEditing(true); }}
              >
                Edit Agent
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
