// ─── Shared Agent Color Utilities ─────────────────────────────────────────────
// Single source of truth for department avatar colors + helper functions.
// Used by AgentTeamRoster, ActivityFeed, LeftPanel, and any future component.

export interface AvatarColors {
  bg: string;
  text: string;
  ring: string;
}

export const DEPT_COLORS: Record<string, AvatarColors> = {
  Sales: { bg: "bg-blue-500", text: "text-white", ring: "ring-blue-400/40" },
  Marketing: {
    bg: "bg-pink-500",
    text: "text-white",
    ring: "ring-pink-400/40",
  },
  Finance: {
    bg: "bg-amber-500",
    text: "text-white",
    ring: "ring-amber-400/40",
  },
  HR: { bg: "bg-teal-500", text: "text-white", ring: "ring-teal-400/40" },
  Operations: {
    bg: "bg-cyan-500",
    text: "text-white",
    ring: "ring-cyan-400/40",
  },
  Research: {
    bg: "bg-purple-500",
    text: "text-white",
    ring: "ring-purple-400/40",
  },
  default: {
    bg: "bg-violet-500",
    text: "text-white",
    ring: "ring-violet-400/40",
  },
};

export const PALETTE: AvatarColors[] = [
  { bg: "bg-blue-500", text: "text-white", ring: "ring-blue-400/40" },
  { bg: "bg-green-500", text: "text-white", ring: "ring-green-400/40" },
  { bg: "bg-amber-500", text: "text-white", ring: "ring-amber-400/40" },
  { bg: "bg-pink-500", text: "text-white", ring: "ring-pink-400/40" },
  { bg: "bg-purple-500", text: "text-white", ring: "ring-purple-400/40" },
  { bg: "bg-cyan-500", text: "text-white", ring: "ring-cyan-400/40" },
];

export function getAvatarColors(dept?: string, index = 0): AvatarColors {
  if (dept && DEPT_COLORS[dept]) return DEPT_COLORS[dept];
  return PALETTE[index % PALETTE.length];
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
