import React, { useState } from 'react';
import { Sidebar, KPIWidget, RightInsights } from '../../../../components';

const sampleData = {
  header: { timestamp: '2026-04-06T10:15:00Z', greeting: 'Welcome back, Alex.' },
  kpis: { taskCompletion: 88, activeProjects: 14 },
  insights: {
    projects: [
      { id: 'p-1', name: 'NeoCore Deployment', progress: 67, color: '#38E0E9' },
      { id: 'p-2', name: 'Market Expansion Plan', progress: 35, color: '#7DE7FF' },
      { id: 'p-3', name: 'Security Audit', progress: 91, color: '#5EFFB3' },
    ],
    teamActivity: [
      { id: 'a-1', name: 'Chloe', action: 'commented on Task X', time: '2026-04-06T09:55:00Z' },
      { id: 'a-2', name: 'Ben', action: 'created a new report', time: '2026-04-06T09:10:00Z' },
      { id: 'a-3', name: 'System', action: 'update complete', time: '2026-04-06T08:40:00Z' },
    ],
    tasks: [
      { id: 't-1', label: 'Finalize Q3 Goals', dueIn: '3d', completed: false },
      { id: 't-2', label: 'Prepare for Team Meeting', dueIn: '1h', completed: false },
      { id: 't-3', label: 'Review feedback on Proposal V2', dueIn: 'Tomorrow', completed: false },
    ],
  },
};

export default function DashboardV2Page() {
  const backgrounds = [
    '/memory-bank/ui/Images/Home_screenx.png.webp',
    '/memory-bank/ui/Images/03-manufacturing-base-screen@1x.png.webp',
    '/memory-bank/ui/Images/05-marketing-screen-01_1x.png.webp',
  ];

  const [backgroundImage, setBackgroundImage] = useState<string>(backgrounds[0]);

  const cycleBackground = () => {
    const idx = backgrounds.indexOf(backgroundImage);
    const next = backgrounds[(idx + 1) % backgrounds.length];
    setBackgroundImage(next);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundImage: `linear-gradient(135deg, rgba(6,12,24,0.60) 0%, rgba(5,26,38,0.40) 60%), radial-gradient(ellipse at center, rgba(0,0,0,0.12), rgba(0,0,0,0.55)), url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center 38%',
      }}
      className="p-6"
    >
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 360px', gap: 24, alignItems: 'start' }}>
        <aside>
          <Sidebar />
        </aside>

        <main>
          <div style={{ marginBottom: 24 }}>
            <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 16, fontWeight: 500 }}>&gt; Tuesday, 10:15 AM</div>
            <h1 style={{ fontSize: 48, fontWeight: 600, color: 'var(--text-primary)', marginTop: 8 }}>{sampleData.header.greeting}</h1>
          </div>

          <div style={{ maxWidth: 720 }}>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={cycleBackground} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', color: 'var(--text-primary)' }}>
                Change Background
              </button>
            </div>

            <KPIWidget data={{ taskCompletion: sampleData.kpis.taskCompletion, activeProjects: sampleData.kpis.activeProjects, sparkline: [45, 60, 72, 81, 88] }} />
          </div>
        </main>

        <aside>
          <RightInsights projects={sampleData.insights.projects} teamActivity={sampleData.insights.teamActivity} tasks={sampleData.insights.tasks} />
        </aside>
      </div>
    </div>
  );
}
