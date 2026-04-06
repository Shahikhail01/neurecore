import React from 'react';
import GlassPanel from './GlassPanel';
import { Circle } from 'lucide-react';

type Project = { id: string; name: string; progress: number; color?: string };
type TeamActivity = { id: string; name: string; action: string; time: string; avatarUrl?: string };
type TaskItem = { id: string; label: string; dueIn?: string; completed: boolean };

interface RightInsightsProps {
  projects?: Project[];
  teamActivity?: TeamActivity[];
  tasks?: TaskItem[];
}

const ProgressBar: React.FC<{ value: number; color?: string }> = ({ value, color }) => {
  return (
    <div style={{ width: '100%' }}>
      <div style={{ background: 'var(--progress-bg)', height: 8, borderRadius: 6, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: `linear-gradient(90deg, ${color ?? 'var(--accent-cyan)'}, var(--accent-cyan-2))`, boxShadow: '0 4px 10px rgba(56,224,233,0.12)' }} />
      </div>
    </div>
  );
};

export const RightInsights: React.FC<RightInsightsProps> = ({ projects = [], teamActivity = [], tasks = [] }) => {
  return (
    <GlassPanel header={<div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Insights & Performance</div>} className="flex flex-col">
      <div className="space-y-4">
        {/* Tabs (visual only) */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ padding: '6px 10px', borderBottom: '2px solid var(--accent-cyan)', color: 'var(--accent-cyan)' }}>Chat</div>
          <div style={{ padding: '6px 10px', color: 'rgba(255,255,255,0.7)' }}>Reports</div>
          <div style={{ padding: '6px 10px', color: 'rgba(255,255,255,0.7)' }}>Tasks</div>
        </div>

        {/* Project progress */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Project Progress:</div>
          <div className="space-y-3 mt-3">
            {projects.map((p) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{p.name}</div>
                    <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>{p.progress}%</div>
                  </div>
                  <ProgressBar value={p.progress} color={p.color} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Team Activity Feed */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Team Activity Feed</div>
          <div className="space-y-2">
            {teamActivity.map((t) => (
              <div key={t.id} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ width: 36, height: 36, borderRadius: 18, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {t.avatarUrl ? <img src={t.avatarUrl} alt={t.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Circle size={16} color="var(--accent-cyan)" />}
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{t.name}</div>
                  <div style={{ fontSize: 13 }}>{t.action}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Key Task List */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Key Task List</div>
          <div className="space-y-3">
            {tasks.map((task) => (
              <div key={task.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 18, height: 18, borderRadius: 9, border: '2px solid rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {task.completed ? '✓' : ''}
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-primary)' }}>{task.label}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Due: {task.dueIn ?? 'n/a'}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </GlassPanel>
  );
};

export default RightInsights;
