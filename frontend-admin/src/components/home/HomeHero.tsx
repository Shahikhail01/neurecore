'use client';

import React from 'react';
import Link from 'next/link';

export function HomeHero({ userName = 'User' }: { userName?: string }) {
  const QUICK_LINKS = [
    { label: 'Tenants', href: '/tenants', icon: '⬟' },
    { label: 'Agents', href: '/agents', icon: '◈' },
    { label: 'Agent Templates', href: '/agent-templates', icon: '◈' },
    { label: 'Billing', href: '/billing', icon: '⬡' },
    { label: 'Chat', href: '/chat', icon: '💬' },
    { label: 'Settings', href: '/settings', icon: '⚙' },
  ];

  return (
    <div className="relative w-full h-[420px] rounded-xl overflow-hidden text-center">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-700 via-sky-600 to-rose-500 opacity-20" />
      <div className="absolute inset-0 bg-[url('/images/hero-default.jpg')] bg-cover bg-center opacity-30" />

      <div className="relative z-10 flex flex-col items-center justify-center h-full px-6">
        <div className="text-2xl font-semibold text-white/95 mb-2">Hello {userName}!</div>
        <div className="text-sm text-white/70 mb-6">Message to NeureCore.ai</div>

        <div className="w-full max-w-2xl">
          <div className="mx-auto rounded-2xl bg-[rgba(0,0,0,0.45)] border border-[rgba(255,255,255,0.06)] p-3 flex items-center gap-3">
            <input placeholder="Message to NeureCore.ai" className="flex-1 bg-transparent text-sm text-white placeholder-white/60 outline-none px-2 py-2" />
            <button className="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 text-sm">Send</button>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            {QUICK_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="rounded-lg bg-surface-raised px-4 py-3 flex items-center gap-3 justify-center text-xs text-zinc-200 hover:opacity-90">
                <span className="text-lg">{l.icon}</span>
                <span>{l.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomeHero;
