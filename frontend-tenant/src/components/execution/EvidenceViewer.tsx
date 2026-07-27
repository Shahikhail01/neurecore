// src/components/execution/EvidenceViewer.tsx
//
// Phase 7 (§9.1) — Evidence viewer. Renders a card for each
// EvidenceArtifact with a preview link and a download button. The
// preview/download endpoints are scoped to the tenant that owns the
// artifact (see ExecutionController).

'use client';

import { useState } from 'react';
import { Download, ExternalLink, FileText, Loader2 } from 'lucide-react';
import { executionService, EvidenceArtifact } from '@/services/execution.service';
import { cn } from '@/lib/utils';

export interface EvidenceViewerProps {
  evidence: EvidenceArtifact;
  className?: string;
}

export function EvidenceViewer({ evidence, className }: EvidenceViewerProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePreview = async () => {
    setLoadingPreview(true);
    setError(null);
    try {
      const url = executionService.evidencePreviewUrl(evidence.id);
      const res = await fetch(url, {
        credentials: 'include',
        headers: { Accept: 'text/plain,application/json,text/*' },
      });
      if (!res.ok) {
        throw new Error(`preview failed: ${res.status}`);
      }
      const text = await res.text();
      setPreview(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'preview failed');
    } finally {
      setLoadingPreview(false);
    }
  };

  return (
    <article
      className={cn(
        'flex flex-col gap-2 rounded-md border border-slate-200 bg-slate-50 p-3',
        className,
      )}
      data-testid={`evidence-${evidence.id}`}
    >
      <header className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-slate-500" aria-hidden />
        <span className="text-sm font-semibold text-slate-900">
          {evidence.artifactType}
        </span>
        <span className="text-xs text-slate-500">{evidence.mimeType}</span>
      </header>

      <dl className="grid grid-cols-2 gap-2 text-xs text-slate-600">
        <div>
          <dt className="uppercase text-slate-500">Source</dt>
          <dd>{evidence.source}</dd>
        </div>
        <div>
          <dt className="uppercase text-slate-500">Checksum</dt>
          <dd className="font-mono">{evidence.checksum.slice(0, 12)}…</dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handlePreview}
          disabled={loadingPreview}
          className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          data-testid={`evidence-preview-${evidence.id}`}
        >
          {loadingPreview ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          ) : (
            <ExternalLink className="h-3 w-3" aria-hidden />
          )}
          Preview
        </button>
        <a
          href={executionService.evidenceDownloadUrl(evidence.id)}
          className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
          data-testid={`evidence-download-${evidence.id}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Download className="h-3 w-3" aria-hidden />
          Download
        </a>
      </div>

      {error ? (
        <p role="alert" className="text-xs text-rose-700">
          {error}
        </p>
      ) : null}

      {preview ? (
        <pre
          className="max-h-64 overflow-auto rounded border border-slate-200 bg-white p-2 text-xs text-slate-800"
          aria-label={`Preview of ${evidence.artifactType}`}
        >
          {preview}
        </pre>
      ) : null}
    </article>
  );
}

export default EvidenceViewer;
