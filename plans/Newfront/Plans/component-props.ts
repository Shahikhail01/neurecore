// Component props and data shapes (TypeScript)
// Generated from home-analysis

export type IconName = string;

export interface AppItem {
  id: string;
  label: string;
  icon: IconName;
  route: string;
  badge?: number;
  visible?: boolean;
}

export interface User {
  id: string;
  name: string;
  avatarUrl?: string;
  role?: string;
}

export interface ActionItem {
  id: string;
  label: string;
  icon?: IconName;
  route?: string;
}

export interface LeftNavProps {
  apps: AppItem[];
  collapsed?: boolean;
  width?: string | number;
  onNavigate: (route: string) => void;
  onToggle?: () => void;
}

export interface TopBarProps {
  user: User;
  onSearch: (query: string) => void;
  onQuickCreate: (type: string) => void;
  notificationsCount?: number;
  onOpenSettings?: () => void;
}

export interface GreetingCardProps {
  user: User;
  message?: string;
  onSendMessage: (text: string) => void;
  quickActions?: ActionItem[];
}

export interface QuickActionTileProps {
  action: ActionItem;
  size?: "sm" | "md" | "lg";
}

export interface KPI {
  id: string;
  title: string;
  value: number | string;
  delta?: number;
  trend?: number[];
  unit?: string;
  icon?: IconName;
}

export interface KPIWidgetProps extends KPI {
  onClick?: () => void;
}

export type ActivityType = "note" | "call" | "meeting" | "task" | "email";

export interface ActivityItem {
  id: string;
  type: ActivityType;
  actor: User;
  target?: { id: string; type: string };
  message?: string;
  time: string; // ISO
}

export interface ActivityFeedProps {
  items: ActivityItem[];
  onOpenItem?: (id: string) => void;
}

export interface ForecastItem {
  id?: string;
  heading: string;
  details: string;
  score?: number;
}

export interface RightPanelProps {
  open: boolean;
  title?: string;
  forecast: ForecastItem[];
  onClose: () => void;
  onOpenForecast?: (id: string) => void;
  onMessage?: (text: string) => void;
}

export interface BackgroundOption {
  id: string;
  type: "image" | "gradient" | "color" | "none";
  thumbnailUrl?: string;
  url?: string;
  overlayOpacity?: number; // 0-1
  uploadedBy?: string;
}

export interface BackgroundSelectorProps {
  options: BackgroundOption[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onUpload?: (file: File) => Promise<string>;
  onOpacityChange?: (id: string, opacity: number) => void;
}

export interface DashboardData {
  kpis: KPI[];
  quickActions: ActionItem[];
  recentActivities: ActivityItem[];
  forecast: ForecastItem[];
}

// sample fixture
export const sampleDashboardData: DashboardData = {
  kpis: [{ id: "leads", title: "Leads", value: 124, delta: 5 }],
  quickActions: [{ id: "create-lead", label: "Create Lead", icon: "plus" }],
  recentActivities: [
    {
      id: "a1",
      type: "email",
      actor: { id: "u1", name: "Audrey" },
      time: "2026-04-07T09:40:00Z",
      message: "Follow up on prospect",
    },
  ],
  forecast: [
    { heading: "Lead Generation", details: "48 new in 24h, 24% conversion" },
  ],
};
