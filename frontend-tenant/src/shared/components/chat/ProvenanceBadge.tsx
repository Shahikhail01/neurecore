// ─── ProvenanceBadge.tsx ───────────────────────────────────────────────────────
// P1 — provenance display for assistant answers. Every claim is labelled
// with its origin so users can tell record data apart from generated
// narrative, predictions, retrieved knowledge, and uploaded files.
// LLM output is untrusted: the badge's source is server-attested via the
// citation envelope; the FE never accepts a provenance field from the
// model's free-text reply.

'use client';

export type ProvenanceSource =
  | 'record'
  | 'knowledge'
  | 'uploaded_file'
  | 'prediction'
  | 'generated';

export interface Citation {
  /** Stable identifier (record id, chunk id, file id, model version, etc.). */
  id: string;
  /** Human-readable label rendered to the user. */
  label: string;
  /** Where the citation came from. */
  source: ProvenanceSource;
  /** Optional URL/path the user can navigate to after re-authorization. */
  href?: string;
  /** Server-attested excerpt hash. The FE never re-derives this. */
  excerptHash?: string;
  /** Optional confidence 0..1. */
  confidence?: number;
}

export interface ProvenanceBadgeProps {
  source: ProvenanceSource;
  confidence?: number;
  excerptHash?: string;
  citations?: Citation[];
  onCitationClick?: (citation: Citation) => void;
}

const SOURCE_LABELS: Record<ProvenanceSource, string> = {
  record: 'Record data',
  knowledge: 'Knowledge base',
  uploaded_file: 'Uploaded file',
  prediction: 'Prediction',
  generated: 'Generated',
};

const SOURCE_STYLES: Record<ProvenanceSource, string> = {
  record: 'bg-blue-900/30 text-blue-200 border-blue-700/40',
  knowledge: 'bg-amber-900/30 text-amber-200 border-amber-700/40',
  uploaded_file: 'bg-rose-900/30 text-rose-200 border-rose-700/40',
  prediction: 'bg-violet-900/30 text-violet-200 border-violet-700/40',
  generated: 'bg-zinc-800 text-zinc-300 border-zinc-700',
};

export function ProvenanceBadge({
  source,
  confidence,
  excerptHash,
  citations,
  onCitationClick,
}: ProvenanceBadgeProps) {
  return (
    <div
      className="mt-2 space-y-1"
      data-testid="provenance-badge"
      aria-label={`Answer provenance: ${SOURCE_LABELS[source]}`}
    >
      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 border ${SOURCE_STYLES[source]}`}
        >
          <span aria-hidden="true">●</span>
          <span>{SOURCE_LABELS[source]}</span>
        </span>
        {typeof confidence === 'number' && (
          <span
            className="text-zinc-500"
            title="Server-attested retrieval confidence"
          >
            {(confidence * 100).toFixed(0)}% confidence
          </span>
        )}
        {excerptHash && (
          <span
            className="text-zinc-600 font-mono"
            title="Server-attested excerpt hash"
          >
            #{excerptHash.slice(0, 8)}
          </span>
        )}
      </div>
      {citations && citations.length > 0 && (
        <ul
          className="space-y-0.5"
          aria-label="Citations"
          data-testid="provenance-citations"
        >
          {citations.map((c) => (
            <li key={c.id} className="flex items-center gap-1 text-[10px]">
              <span
                className={`inline-block rounded-full px-1.5 py-0.5 border text-[9px] ${SOURCE_STYLES[c.source]}`}
              >
                {SOURCE_LABELS[c.source]}
              </span>
              {c.href && onCitationClick ? (
                <button
                  type="button"
                  onClick={() => onCitationClick(c)}
                  className="text-zinc-300 hover:text-white underline-offset-2 hover:underline focus:outline-none focus:ring-1 focus:ring-violet-500 rounded-sm"
                  aria-label={`Re-open ${c.label}`}
                >
                  {c.label}
                </button>
              ) : (
                <span className="text-zinc-400">{c.label}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
