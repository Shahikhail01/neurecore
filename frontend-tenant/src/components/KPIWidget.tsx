import React from 'react';
import GlassPanel from './GlassPanel';
import { Grid, Search, Send } from 'lucide-react';

const Sparkline: React.FC<{ data?: number[]; width?: number; height?: number }> = ({ data = [45, 60, 72, 81, 88], width = 200, height = 48 }) => {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / (max - min || 1)) * height;
    return `${x},${y}`;
  });
  const d = `M ${pts.join(' L ')}`;
  const gradId = 'sparkGrad';

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="block">
      <defs>
        <linearGradient id={gradId} x1="0" x2="1">
          <stop offset="0%" stopColor="#3EE7FF" />
          <stop offset="100%" stopColor="#7DE7FF" />
        </linearGradient>
      </defs>
      <path d={d} stroke={`url(#${gradId})`} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export const KPIWidget: React.FC = () => {
  return (
    <GlassPanel
      header={
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-[rgba(255,255,255,0.02)]">
            <Grid size={18} color="var(--text-primary)" />
          </div>
          <div className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            Hub
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Search & Launch */}
        <div>
          <div className="text-sm font-medium text-[rgba(255,255,255,0.78)] mb-2">1. Search & Launch</div>
          <div className="flex gap-3">
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <input
                    aria-label="Search"
                    placeholder="Find projects, tasks, or team members..."
                    className="w-full text-sm"
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      padding: '10px 12px',
                      borderRadius: 10,
                      color: 'var(--text-primary)'
                    }}
                  />
                </div>
                <div style={{ width: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Search size={16} color="rgba(255,255,255,0.7)" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div>
          <div className="text-sm font-medium text-[rgba(255,255,255,0.78)] mb-2">2. Key Metrics</div>
          <div className="flex items-center justify-between gap-6">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 220 }}>
                <Sparkline />
              </div>
              <div>
                <div className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>88%</div>
                <div className="text-xs font-medium text-[rgba(255,255,255,0.7)]">Task Completion</div>
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>14</div>
              <div className="text-xs font-medium text-[rgba(255,255,255,0.7)]">Active Projects</div>
            </div>
          </div>
        </div>

        {/* Collaboration */}
        <div>
          <div className="text-sm font-medium text-[rgba(255,255,255,0.78)] mb-2">3. Collaboration</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              aria-label="Message to Team"
              placeholder="Message to Team"
              className="flex-1 text-sm"
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                padding: '10px 12px',
                borderRadius: 10,
                color: 'var(--text-primary)'
              }}
            />
            <button aria-label="Send" className="p-2 rounded-md" style={{ background: 'linear-gradient(90deg,#3EE7FF,#7DE7FF)' }}>
              <Send size={16} color="#022" />
            </button>
          </div>
        </div>
      </div>
    </GlassPanel>
  );
};

export default KPIWidget;
