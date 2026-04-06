"use client";

import Link from "next/link";
import type { AuthUser } from "@/types/auth.types";
import React from "react";

type NavItem = { label: string; href: string; icon: string; group: string };

export function Sidebar({
  navItems,
  user,
  pathname,
  onLogout,
}: {
  navItems: NavItem[];
  user: AuthUser;
  pathname: string;
  onLogout: () => void;
}) {
  const GROUP_LABELS: Record<string, string> = {
    platform: "Platform",
    library: "Library",
    fleet: "Fleet",
    intelligence: "Intelligence",
    control: "Control",
    settings: "Settings",
  };

  const rendered: React.ReactNode[] = [];
  let lastGroup = "";
  for (const item of navItems) {
    if (item.group !== lastGroup) {
      rendered.push(
        <div
          key={`grp-${item.group}`}
          className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-600 select-none"
        >
          {GROUP_LABELS[item.group] ?? item.group}
        </div>,
      );
      lastGroup = item.group;
    }
    const active =
      pathname === item.href || pathname.startsWith(item.href + "/");
    rendered.push(
      <Link
        key={item.href}
        href={item.href}
        className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
          active
            ? "bg-indigo-600 text-white font-medium"
            : "text-zinc-400 hover:bg-surface-overlay hover:text-white"
        }`}
      >
        <span className="text-xs opacity-70">{item.icon}</span>
        {item.label}
      </Link>,
    );
  }

  return (
    <aside className="w-56 shrink-0 border-r border-surface-border flex flex-col bg-surface-raised">
      <div className="px-5 py-4 border-b border-surface-border">
        <span className="text-sm font-bold tracking-widest text-indigo-400 uppercase">
          NeureCore
        </span>
        <div className="text-xs text-zinc-500 mt-0.5">Admin Console</div>
      </div>

      <nav className="flex-1 py-3 flex flex-col gap-0.5 px-2 overflow-y-auto">
        {rendered}
      </nav>

      <div className="px-4 py-4 border-t border-surface-border">
        <div className="text-xs text-zinc-400 font-medium truncate mb-0.5">
          {user.firstName} {user.lastName}
        </div>
        <div className="text-xs text-zinc-500 truncate mb-2">{user.email}</div>
        <span className="inline-block rounded-full bg-indigo-900 text-indigo-300 text-xs px-2 py-0.5 font-medium mb-3">
          {user.role}
        </span>
        <button
          onClick={onLogout}
          className="w-full rounded-lg border border-surface-border px-3 py-1.5 text-xs text-zinc-400 hover:bg-surface-overlay hover:text-white transition"
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
