'use client';

import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'high-contrast';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'dark';
    const saved = localStorage.getItem('theme') as Theme | null;
    if (saved) return saved;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
    return 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-light', 'theme-dark', 'theme-high-contrast');
    if (theme === 'light') root.classList.add('theme-light');
    else if (theme === 'high-contrast') root.classList.add('theme-high-contrast');
    else root.classList.add('theme-dark');
    try { localStorage.setItem('theme', theme); } catch {}
  }, [theme]);

  return { theme, setTheme } as { theme: Theme; setTheme: (t: Theme) => void };
}

export default useTheme;
