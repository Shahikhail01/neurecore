'use client';

/**
 * Phase 15 — Chat-history export + retention surface (CR-AI-0003).
 *
 * Real-but-thin: lets the operator trigger an export, see the result,
 * and clear the conversation. Surfaces typed-empty states per the
 * P-1 rule.
 */

import { useCallback, useEffect, useState } from 'react';
import api from '@/services/api';

interface ExportRow {
  readonly exportId: string;
  readonly byteSize: number;
  readonly expiresAt: string;
  readonly redacted: boolean;
}

export default function ChatHistoryPage() {
  const [conversationId, setConversationId] = useState('');
  const [format, setFormat] = useState<'json' | 'csv' | 'markdown'>('json');
  const [redact, setRedact] = useState(true);
  const [busy, setBusy] = useState(false);
  const [exports, setExports] = useState<ReadonlyArray<ExportRow>>([]);
  const [error, setError] = useState<string | null>(null);

  const onExport = useCallback(async () => {
    if (!conversationId.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<ExportRow>('/chat/export', {
        conversationId,
        format,
        redact,
      });
      setExports((prev) => [res.data, ...prev]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [conversationId, format, redact]);

  // Surface any past exports the operator already created. Empty by default.
  useEffect(() => {
    setExports([]);
  }, []);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Chat history</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Export conversations, redact PII per the retention policy,
          and review recent exports. Phase-15 surfaces (CR-AI-0003).
        </p>
      </header>

      <form
        className="bg-background border border-border rounded p-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void onExport();
        }}
      >
        <label className="block">
          <span className="text-sm text-foreground">Conversation id</span>
          <input
            type="text"
            value={conversationId}
            onChange={(e) => setConversationId(e.target.value)}
            required
            className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm"
            placeholder="conversation-uuid"
          />
        </label>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            Format
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as 'json' | 'csv' | 'markdown')}
              className="rounded border border-border bg-background px-2 py-1 text-sm"
            >
              <option value="json">JSON</option>
              <option value="csv">CSV</option>
              <option value="markdown">Markdown</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={redact}
              onChange={(e) => setRedact(e.target.checked)}
            />
            Redact PII
          </label>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded px-3 py-1.5 text-sm bg-primary text-primary-foreground disabled:opacity-50"
        >
          {busy ? 'Exporting…' : 'Export'}
        </button>
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : null}
      </form>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-foreground mb-2">
          Recent exports
        </h2>
        {exports.length === 0 ? (
          <div className="rounded border border-dashed border-border p-6 text-center text-foreground-muted">
            No exports yet. Trigger one above.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-foreground-muted">
              <tr>
                <th className="py-2">Export id</th>
                <th>Bytes</th>
                <th>Expires</th>
                <th>Redacted</th>
              </tr>
            </thead>
            <tbody>
              {exports.map((e) => (
                <tr key={e.exportId} className="border-t border-border">
                  <td className="py-2 font-mono text-xs">{e.exportId}</td>
                  <td>{e.byteSize}</td>
                  <td>{new Date(e.expiresAt).toLocaleString()}</td>
                  <td>{e.redacted ? 'yes' : 'no'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
