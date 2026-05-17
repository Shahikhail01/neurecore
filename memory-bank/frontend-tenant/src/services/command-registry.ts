// ─── Command Registry ─────────────────────────────────────────────────────────
// O — Open/Closed: any module can register commands without modifying CommandPalette
// S — Single Responsibility: only manages command registration and lookup

import type { Command } from '@/types/ui.types';

class CommandRegistry {
  private commands = new Map<string, Command>();
  private listeners: Array<() => void> = [];

  register(command: Command): void {
    this.commands.set(command.id, command);
    this.notify();
  }

  unregister(id: string): void {
    this.commands.delete(id);
    this.notify();
  }

  registerMany(commands: Command[]): () => void {
    commands.forEach((c) => this.commands.set(c.id, c));
    this.notify();
    return () => {
      commands.forEach((c) => this.commands.delete(c.id));
      this.notify();
    };
  }

  getAll(): Command[] {
    return [...this.commands.values()];
  }

  search(query: string): Command[] {
    if (!query.trim()) return this.getAll();
    const q = query.toLowerCase();
    return this.getAll().filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.group.toLowerCase().includes(q),
    );
  }

  // Observer pattern for reactivity
  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((l) => l());
  }
}

// Singleton — one registry per portal
export const commandRegistry = new CommandRegistry();
