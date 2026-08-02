// ─── TableRenderer.tsx ─────────────────────────────────────────────────────────
// Extracted from UnifiedChatMessage.tsx with no behavioural changes.

'use client';

export interface TableRendererProps {
  headers: string[];
  rows: Array<Record<string, string | number | boolean>>;
}

export function TableRenderer({ headers, rows }: TableRendererProps) {
  return (
    <div className="mt-2 overflow-x-auto" data-component="table">
      <table className="text-[10px] w-full border-collapse">
        <thead>
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className="text-left text-zinc-500 px-1.5 py-0.5 border-b border-surface-border"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-surface-border/50">
              {headers.map((h) => (
                <td key={h} className="px-1.5 py-0.5 text-zinc-300">
                  {String(row[h] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
