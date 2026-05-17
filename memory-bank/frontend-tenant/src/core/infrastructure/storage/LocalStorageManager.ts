// ─── LocalStorageManager.ts ──────────────────────────────────────────────────
// SRP: All localStorage operations piped through one typed utility.
// Safely handles SSR (Next.js) where window is undefined.

export class LocalStorageManager {
  private readonly prefix: string;

  constructor(prefix = 'hq') {
    this.prefix = prefix;
  }

  private key(k: string): string {
    return `${this.prefix}:${k}`;
  }

  private isAvailable(): boolean {
    return typeof window !== 'undefined';
  }

  get<T>(key: string): T | null {
    if (!this.isAvailable()) return null;
    try {
      const raw = localStorage.getItem(this.key(key));
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  set<T>(key: string, value: T): void {
    if (!this.isAvailable()) return;
    try {
      localStorage.setItem(this.key(key), JSON.stringify(value));
    } catch {
      // Quota exceeded — fail silently
    }
  }

  remove(key: string): void {
    if (!this.isAvailable()) return;
    localStorage.removeItem(this.key(key));
  }

  clear(allWithPrefix = false): void {
    if (!this.isAvailable()) return;
    if (!allWithPrefix) return;
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(`${this.prefix}:`)) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  }
}

export const localStore = new LocalStorageManager('hq');
