// ─── TenantSlashCommands.test.ts ────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { TenantSlashCommands } from '@/core/services/chat/slash-commands/TenantSlashCommands';

const sc = new TenantSlashCommands();

describe('TenantSlashCommands.getSuggestions', () => {
  it('returns matching commands by trigger prefix', () => {
    const matches = sc.getSuggestions('/a');
    const triggers = matches.map((m) => m.trigger);
    expect(triggers).toContain('/agents');
    expect(triggers).toContain('/approvals');
  });

  it('returns empty for non-matching input', () => {
    expect(sc.getSuggestions('/xyz')).toEqual([]);
  });

  it('is case-insensitive', () => {
    const matches = sc.getSuggestions('/AGENTS');
    expect(matches.map((m) => m.trigger)).toContain('/agents');
  });

  it('returns exact match for full trigger', () => {
    const matches = sc.getSuggestions('/tasks');
    expect(matches).toHaveLength(1);
    expect(matches[0].context).toBe('task');
  });
});

describe('TenantSlashCommands.getContextForTrigger', () => {
  it('maps /agents → agent context', () => {
    expect(sc.getContextForTrigger('/agents')).toBe('agent');
  });

  it('maps /tasks → task context', () => {
    expect(sc.getContextForTrigger('/tasks')).toBe('task');
  });

  it('maps /workflows → workflow context', () => {
    expect(sc.getContextForTrigger('/workflows')).toBe('workflow');
  });

  it('maps /costs and /approvals → system context', () => {
    expect(sc.getContextForTrigger('/costs')).toBe('system');
    expect(sc.getContextForTrigger('/approvals')).toBe('system');
  });

  it('returns undefined for unknown trigger', () => {
    expect(sc.getContextForTrigger('/unknown')).toBeUndefined();
  });

  it('is case-insensitive', () => {
    expect(sc.getContextForTrigger('/AGENTS')).toBe('agent');
  });
});

describe('TenantSlashCommands.command integrity', () => {
  it('every command has a non-empty trigger, label, context, and suggestions array', () => {
    for (const c of sc.commands) {
      expect(c.trigger).toMatch(/^\//);
      expect(c.label.length).toBeGreaterThan(0);
      expect(['agent', 'task', 'workflow', 'system', 'lead', 'deal', 'forecast', 'quote', 'case', 'kb', 'customer', 'twin', 'channel']).toContain(c.context);
      expect(c.suggestions.length).toBeGreaterThan(0);
    }
  });
});
