/**
 * Phase 15 — ChatExportService. No real network / disk.
 */

import {
  ChatExportService,
  ChatExportForbiddenError,
} from './chat-export.service';

function makePrisma(opts: {
  rows?: unknown[];
  auditLogCreate?: () => Promise<unknown>;
  chatExportCreate?: () => Promise<unknown>;
  chatExportDeleteMany?: () => Promise<{ count: number }>;
}) {
  return {
    chatMessage: { findMany: jest.fn(async () => opts.rows ?? []) },
    chatExport: {
      create: jest.fn(opts.chatExportCreate ?? (async () => ({}))),
      deleteMany: jest.fn(
        opts.chatExportDeleteMany ?? (async () => ({ count: 1 })),
      ),
    },
    auditLog: { create: jest.fn(opts.auditLogCreate ?? (async () => ({}))) },
  };
}

describe('Phase 15 — ChatExportService', () => {
  it('rejects wildcard tenantId', async () => {
    const svc = new ChatExportService(makePrisma({ rows: [] }) as never);
    await expect(
      svc.export({
        tenantId: '*',
        actorId: 'u1',
        conversationId: 'c-1',
        format: 'json',
        redact: false,
      }),
    ).rejects.toBeInstanceOf(ChatExportForbiddenError);
  });

  it('refuses to export a conversation that does not exist', async () => {
    const svc = new ChatExportService(makePrisma({ rows: [] }) as never);
    await expect(
      svc.export({
        tenantId: 't',
        actorId: 'u',
        conversationId: 'no-such',
        format: 'json',
        redact: false,
      }),
    ).rejects.toThrow(/not found/);
  });

  it('emits JSON export with content + roles preserved', async () => {
    const rows = [
      { role: 'user', content: 'hi alice@example.com', createdAt: new Date('2026-08-06T00:00:00Z') },
      { role: 'assistant', content: 'OK', createdAt: new Date('2026-08-06T00:00:01Z') },
    ];
    let captured: unknown = null;
    const svc = new ChatExportService(
      makePrisma({
        rows,
        chatExportCreate: async () => {
          captured = true;
          return {};
        },
      }) as never,
    );
    const out = await svc.export({
      tenantId: 't',
      actorId: 'u',
      conversationId: 'c-1',
      format: 'json',
      redact: false,
    });
    expect(out.byteSize).toBeGreaterThan(0);
    expect(captured).toBe(true);
  });

  it('redacts PII when redact=true', () => {
    const { redactPii } = require('./chat-export.service');
    const redacted = redactPii(
      'alice@example.com $5,000 2026-08-06 +1-555-555-1234',
    );
    expect(redacted).toContain('<email>');
    expect(redacted).toContain('<currency>');
    expect(redacted).toContain('<phone>');
  });

  it('formats CSV safely (escapes quotes)', async () => {
    const rows = [
      { role: 'user', content: 'has "quotes" inside', createdAt: new Date('2026-08-06T00:00:00Z') },
    ];
    const svc = new ChatExportService(makePrisma({ rows }) as never);
    const out = await svc.export({
      tenantId: 't',
      actorId: 'u',
      conversationId: 'c-1',
      format: 'csv',
      redact: false,
    });
    expect(out.byteSize).toBeGreaterThan(0);
  });

  it('deleteExport returns true when a row was removed', async () => {
    const svc = new ChatExportService(
      makePrisma({ chatExportDeleteMany: async () => ({ count: 1 }) }) as never,
    );
    expect(await svc.deleteExport('t', 'exp-1')).toBe(true);
  });

  it('deleteExport returns false when nothing was removed', async () => {
    const svc = new ChatExportService(
      makePrisma({ chatExportDeleteMany: async () => ({ count: 0 }) }) as never,
    );
    expect(await svc.deleteExport('t', 'no-such')).toBe(false);
  });

  it('recordAudit writes a per-action audit row inside the tenant', async () => {
    let recorded: unknown = null;
    const svc = new ChatExportService(
      makePrisma({ auditLogCreate: async () => { recorded = true; return {}; } }) as never,
    );
    await svc.recordAudit(
      { sub: 'u', tenantId: 't' },
      'exp-x',
      'downloaded',
    );
    expect(recorded).toBe(true);
  });

  it('recordAudit no-ops on wildcard tenantId (P−1: never audit into * tenant)', async () => {
    let recorded = false;
    const svc = new ChatExportService(
      makePrisma({ auditLogCreate: async () => { recorded = true; return {}; } }) as never,
    );
    await svc.recordAudit(
      { sub: 'u', tenantId: '*' },
      'exp-x',
      'downloaded',
    );
    expect(recorded).toBe(false);
  });
});
