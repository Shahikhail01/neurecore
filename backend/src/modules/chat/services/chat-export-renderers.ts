/**
 * Phase 22 — Chat export byte renderers (CR-AI-0003).
 *
 * Source plan: IMPLEMENTATION_PLAN_PARITY_COMPLETION.md §3 (P22).
 *
 * SOLID — OCP: renderers are a `Map<ExportFormat, IFileRenderer>` so a
 * new format (e.g. PDF) is added by appending one renderer + one enum
 * member, without touching the orchestrator.
 *
 * LSP: every renderer substitutes `IFileRenderer { render(rows): Buffer }`;
 * the caller is format-agnostic.
 *
 * SRP: each renderer owns ONLY the byte-encoding of conversation
 * rows. Audit, persistence, and tenant scoping live elsewhere.
 *
 * The renderer is pure (no Prisma, no LLM) — given rows, return bytes.
 */

import type { ExportFormat } from '../dto/chat-export.dto';

export interface ExportRow {
  readonly id: string;
  readonly role: string;
  readonly content: string;
  readonly createdAt: Date;
  readonly model?: string;
  readonly provider?: string;
}

export interface IFileRenderer {
  readonly format: ExportFormat;
  render(rows: ReadonlyArray<ExportRow>): Buffer;
}

function escapeCsvCell(s: string): string {
  return `"${s.replace(/"/g, '""')}"`;
}

export class CsvExportRenderer implements IFileRenderer {
  readonly format: ExportFormat = 'csv';
  render(rows: ReadonlyArray<ExportRow>): Buffer {
    const header = 'timestamp,role,model,provider,content';
    const lines = rows.map((r) =>
      [
        r.createdAt.toISOString(),
        escapeCsvCell(r.role),
        escapeCsvCell(r.model ?? ''),
        escapeCsvCell(r.provider ?? ''),
        escapeCsvCell(r.content),
      ].join(','),
    );
    return Buffer.from([header, ...lines].join('\n'), 'utf-8');
  }
}

export class MarkdownExportRenderer implements IFileRenderer {
  readonly format: ExportFormat = 'markdown';
  render(rows: ReadonlyArray<ExportRow>): Buffer {
    const body = rows
      .map(
        (r) =>
          `### ${r.role.toUpperCase()} — ${r.createdAt.toISOString()}\n\n${r.content}\n`,
      )
      .join('\n');
    return Buffer.from(body, 'utf-8');
  }
}

export class JsonExportRenderer implements IFileRenderer {
  readonly format: ExportFormat = 'json';
  render(rows: ReadonlyArray<ExportRow>): Buffer {
    const json = JSON.stringify(
      rows.map((r) => ({
        id: r.id,
        role: r.role,
        content: r.content,
        createdAt: r.createdAt.toISOString(),
        model: r.model ?? null,
        provider: r.provider ?? null,
      })),
      null,
      2,
    );
    return Buffer.from(json, 'utf-8');
  }
}

/**
 * Renderer registry. Adding a new format = one renderer + one entry.
 * Pure data — no DI, no Prisma. The export service looks up by format.
 */
export const RENDERERS: ReadonlyMap<ExportFormat, IFileRenderer> = new Map<
  ExportFormat,
  IFileRenderer
>([
  ['csv', new CsvExportRenderer()],
  ['markdown', new MarkdownExportRenderer()],
  ['json', new JsonExportRenderer()],
]);

export function getRenderer(format: ExportFormat): IFileRenderer {
  const r = RENDERERS.get(format);
  if (!r) {
    throw new Error(`No renderer registered for format="${format}"`);
  }
  return r;
}
