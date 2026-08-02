'use client';

/**
 * NlDraftPanel — natural-language drafting input for the composer.
 * Sends the prompt to the canonical SkillComposerController
 * /draft endpoint. Never activates — only produces a draft + diff.
 */

import { useState, useCallback } from 'react';
import { Loader2, PencilLine } from 'lucide-react';

interface DraftResponse {
  draft: {
    rationale: string;
    nodes: Array<{ id: string; kind: string; label: string }>;
  };
  diff: Array<{
    op: 'add' | 'remove' | 'modify';
    target: 'node' | 'edge' | 'port' | 'mode';
    id: string;
  }>;
  warnings: string[];
  notes: string[];
}

interface NlDraftPanelProps {
  onApply?: (response: DraftResponse) => void;
}

export default function NlDraftPanel({ onApply }: NlDraftPanelProps) {
  const [prompt, setPrompt] = useState(
    'When a lead is added, score it and draft a follow-up email.',
  );
  const [running, setRunning] = useState(false);
  const [response, setResponse] = useState<DraftResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/skill-composer/draft', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const body = (await res.json()) as DraftResponse;
      setResponse(body);
      onApply?.(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'draft failed');
    } finally {
      setRunning(false);
    }
  }, [prompt, onApply]);

  return (
    <section
      aria-label="Natural-language drafting panel"
      style={{
        background: 'rgba(17,19,26,0.92)',
        border: '1px solid #27272a',
        borderRadius: 12,
        padding: 14,
        color: '#e4e4e7',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h3 style={{ fontSize: 13, fontWeight: 600 }}>Draft with natural language</h3>
        <button
          type="button"
          aria-label="Run NL draft"
          onClick={() => void submit()}
          disabled={running || prompt.trim().length < 4}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            border: '1px solid #06b6d4',
            background: '#06b6d422',
            color: '#e4e4e7',
            padding: '6px 10px',
            borderRadius: 6,
            cursor: running ? 'progress' : 'pointer',
            fontSize: 12,
          }}
        >
          {running ? (
            <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
          ) : (
            <PencilLine className="w-3 h-3" aria-hidden="true" />
          )}
          Draft
        </button>
      </header>
      <label
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          fontSize: 11,
          color: '#a1a1aa',
        }}
      >
        Describe the workflow
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          aria-label="NL draft prompt"
          style={{
            background: '#0f1014',
            border: '1px solid #27272a',
            borderRadius: 6,
            color: '#e4e4e7',
            padding: '6px 8px',
            fontFamily: 'Inter, sans-serif',
            fontSize: 13,
          }}
        />
      </label>
      {error ? (
        <div
          role="alert"
          style={{
            background: '#7f1d1d33',
            border: '1px solid #ef4444',
            borderRadius: 6,
            padding: 8,
            fontSize: 12,
            color: '#fca5a5',
          }}
        >
          {error}
        </div>
      ) : null}
      {response ? (
        <div style={{ fontSize: 12 }}>
          <div style={{ color: '#a1a1aa', marginBottom: 4 }}>Draft nodes</div>
          <ul style={{ paddingLeft: 18, color: '#d4d4d8' }}>
            {response.draft.nodes.map((n) => (
              <li key={n.id}>
                <strong>{n.kind}</strong> — {n.label}
              </li>
            ))}
          </ul>
          {response.warnings.length > 0 ? (
            <div
              style={{
                marginTop: 8,
                padding: 8,
                border: '1px solid #f59e0b',
                background: '#f59e0b22',
                borderRadius: 6,
                color: '#fde68a',
              }}
            >
              <strong>Restrictions:</strong>
              <ul style={{ paddingLeft: 18 }}>
                {response.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <p style={{ color: '#a1a1aa', marginTop: 8 }}>
            Drafts never activate. Promote via the certify workflow after validation.
          </p>
        </div>
      ) : null}
    </section>
  );
}
