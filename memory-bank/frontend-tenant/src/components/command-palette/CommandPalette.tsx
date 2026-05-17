'use client';
// ─── Command Palette ──────────────────────────────────────────────────────────
// S — Single Responsibility: renders palette UI and keyboard handling only
// D — Dependency Inversion: commands come from CommandRegistry, not hardcoded
import { useEffect, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Command } from 'cmdk';
import { useCommandStore } from '@/stores/commandStore';
import { commandRegistry } from '@/services/command-registry';
import type { Command as AppCommand } from '@/types/ui.types';

export function CommandPalette() {
  const { open, closePalette } = useCommandStore();
  const [commands, setCommands] = useState<AppCommand[]>(() => commandRegistry.getAll());

  // Sync with registry changes (O — registry updates palette without palette knowing source)
  useEffect(() => {
    const unsub = commandRegistry.subscribe(() => {
      setCommands(commandRegistry.getAll());
    });
    return unsub;
  }, []);

  // Keyboard shortcut to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        useCommandStore.getState().openPalette();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleSelect = useCallback(
    (commandId: string) => {
      const cmd = commands.find((c) => c.id === commandId);
      if (cmd) {
        cmd.action();
        closePalette();
      }
    },
    [commands, closePalette],
  );

  // Group commands
  const grouped = commands.reduce<Record<string, AppCommand[]>>((acc, cmd) => {
    (acc[cmd.group] ??= []).push(cmd);
    return acc;
  }, {});

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60" onClick={closePalette} />

          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.15 }}
            className="relative w-full max-w-xl bg-surface-overlay border border-surface-border rounded-2xl shadow-2xl overflow-hidden"
          >
            <Command className="flex flex-col" onKeyDown={(e: React.KeyboardEvent) => e.key === 'Escape' && closePalette()}>
              <div className="border-b border-surface-border px-4 py-3 flex items-center gap-2">
                <span className="text-zinc-500 text-sm">⌘</span>
                <Command.Input
                  placeholder="Search commands, pages, agents…"
                  className="flex-1 bg-transparent text-zinc-100 placeholder-zinc-600 outline-none text-sm"
                  autoFocus
                />
                <kbd
                  className="text-[10px] text-zinc-600 bg-surface-muted border border-surface-border px-1.5 py-0.5 rounded cursor-pointer"
                  onClick={closePalette}
                >
                  ESC
                </kbd>
              </div>

              <Command.List className="max-h-80 overflow-y-auto p-2">
                <Command.Empty className="py-8 text-center text-sm text-zinc-500">
                  No results found.
                </Command.Empty>

                {Object.entries(grouped).map(([group, cmds]) => (
                  <Command.Group key={group} heading={group} className="mb-2">
                    <div className="px-2 py-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                        {group}
                      </span>
                    </div>
                    {cmds.map((cmd) => (
                      <Command.Item
                        key={cmd.id}
                        value={`${cmd.label} ${cmd.group}`}
                        onSelect={() => handleSelect(cmd.id)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-zinc-300 cursor-pointer hover:bg-surface-raised data-[selected]:bg-surface-raised data-[selected]:text-zinc-100 transition-colors"
                      >
                        {cmd.icon && <span className="flex-shrink-0">{cmd.icon}</span>}
                        <span className="flex-1">{cmd.label}</span>
                        {cmd.shortcut && (
                          <kbd className="text-[10px] text-zinc-600 bg-surface-muted border border-surface-border px-1.5 py-0.5 rounded">
                            {cmd.shortcut}
                          </kbd>
                        )}
                      </Command.Item>
                    ))}
                  </Command.Group>
                ))}
              </Command.List>
            </Command>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
