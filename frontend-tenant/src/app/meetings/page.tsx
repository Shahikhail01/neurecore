'use client';

/**
 * Phase 16 — Meetings catalog (CR-AI-0401..0404).
 *
 * Lists transcripts, links to detail. Surfaces typed-empty state
 * when no transcripts have been ingested yet.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Transcript {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly languageCode: string;
  readonly jurisdiction: string | null;
  readonly linkedRecordType: string | null;
  readonly linkedRecordId: string | null;
}

export default function MeetingsPage() {
  const [rows, setRows] = useState<ReadonlyArray<Transcript>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        // Phase 16: read all transcripts through the ingestion service
        // for now. Future PR adds a /meetings/transcripts list route.
        const list = await import('@/services/api');
        const api = (list as { default?: unknown }).default ?? list;
        const res = await (
          api as { get<T>(url: string): Promise<{ data: { data: Transcript[] } }> }
        ).get<{ data: { data: Transcript[] } }>('/chat-history/transcripts');
        setRows(res.data?.data ?? []);
      } catch {
        // Empty state — backend endpoint may not be exposed yet.
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Meetings</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Transcripts ingested with jurisdiction-aware consent.
          Phase-16 surface (CR-AI-0401..0404).
        </p>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded bg-surface-muted animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded border border-dashed border-border p-8 text-center text-foreground-muted">
          No transcripts yet. Connect Microsoft Teams / Outlook / Zoom
          from Settings → Integrations to start ingesting meetings.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rows.map((t) => (
            <Link
              key={t.id}
              href={`/meetings/${t.id}`}
              className="block rounded border border-border bg-background p-4 hover:shadow-sm transition-shadow"
            >
              <h3 className="font-medium text-foreground">{t.title}</h3>
              <p className="mt-1 text-xs text-foreground-muted">
                {t.status} · {t.languageCode} · {t.jurisdiction ?? 'unscoped'}
              </p>
              {t.linkedRecordType ? (
                <p className="mt-1 text-xs text-foreground-muted">
                  Linked to {t.linkedRecordType}:{t.linkedRecordId}
                </p>
              ) : null}
            </Link>
          ))}
        </div>
      )}
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
