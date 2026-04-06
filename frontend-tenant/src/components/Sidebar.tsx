import React from 'react';
import GlassPanel from './GlassPanel';
import {
  Home,
  Activity,
  Folder,
  Clipboard,
  Users,
  BarChart2,
  FileText,
  MessageSquare,
  Settings,
} from 'lucide-react';

const navItems = [
  { key: 'home', label: 'Home', Icon: Home },
  { key: 'activity', label: 'Activity', Icon: Activity },
  { key: 'projects', label: 'Projects', Icon: Folder },
  { key: 'tasks', label: 'Tasks', Icon: Clipboard },
  { key: 'team', label: 'Team', Icon: Users },
  { key: 'reports', label: 'Reports', Icon: BarChart2 },
  { key: 'documents', label: 'Documents', Icon: FileText },
  { key: 'messages', label: 'Messages', Icon: MessageSquare },
  { key: 'admin', label: 'Admin', Icon: Settings },
];

export const Sidebar: React.FC = () => {
  const active = 'home';

  return (
    <GlassPanel className="flex flex-col" style={{ width: 260, height: 'calc(100vh - 48px)', padding: 16 }}>
      <div className="mb-4 flex items-center h-14">
        <div className="w-10 h-10 rounded-md bg-[rgba(255,255,255,0.04)] flex items-center justify-center text-white font-semibold">NC</div>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const ItemIcon = item.Icon;
          const isActive = item.key === active;
          return (
            <button
              key={item.key}
              className="w-full relative flex items-center gap-3 text-left rounded-md px-3 py-3"
              style={{
                borderLeft: isActive ? `4px solid var(--accent-cyan)` : '4px solid transparent',
                background: isActive ? 'rgba(255,255,255,0.03)' : 'transparent',
              }}
            >
              <ItemIcon size={20} color={isActive ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.9)'} />
              <span style={{ color: 'var(--text-primary)' }} className="font-medium text-base">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="mt-4 text-sm text-[rgba(255,255,255,0.55)]">v2.1</div>
    </GlassPanel>
  );
};

export default Sidebar;
