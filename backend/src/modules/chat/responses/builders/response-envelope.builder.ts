import { Injectable } from '@nestjs/common';
import type {
  IEnvelopeComponent,
  IResponseEnvelope,
  ToolResultShape,
} from '../interfaces/response-envelope.interface';

/**
 * ResponseEnvelopeBuilder — Wraps tool results and final LLM text in a typed
 * envelope that the frontend's existing inline renderers consume natively.
 *
 * Wire format (existing SSE `event: delta` data field carries an optional
 * `envelope` sibling to `text`):
 *
 *   {
 *     "text": "Here are your active projects:",
 *     "envelope": {
 *       "text": "(20 total)",
 *       "components": [
 *         { "type": "table",  "props": { "headers": [...], "rows": [...] } },
 *         { "type": "metrics","props": { "items": [...] } }
 *       ]
 *     }
 *   }
 *
 * Component inference rules (for a single-tool run):
 *   - Array payload                  → table component
 *   - Object with named array key    → table component (uses total if present)
 *   - Scalar / flat object           → metrics component (string|number leaves)
 *   - Empty array                    → text-only ("No results.")
 *   - null / undefined data          → text-only ("Executed <tool>")
 */
@Injectable()
export class ResponseEnvelopeBuilder {
  private readonly preferredTableFields = [
    'id',
    'name',
    'title',
    'status',
    'priority',
    'industry',
    'lifecycleStage',
    'riskRating',
    'targetDate',
    'startDate',
    'createdAt',
  ];

  /**
   * Build an envelope from a tool result. Infers the component type from
   * the result shape.
   */
  buildToolResponse(
    toolName: string,
    toolResult: unknown,
  ): IResponseEnvelope {
    const shaped = (toolResult ?? null) as ToolResultShape | null;
    if (!shaped) return { text: `Executed ${toolName}` };
    if (shaped.success === false) {
      return { text: `Failed: ${shaped.error ?? 'unknown error'}` };
    }

    const data = shaped.data;
    if (data === undefined || data === null) {
      return { text: `Executed ${toolName}` };
    }

    // Many service methods return `{ data: [...], total }` — unwrap one
    // level so the rest of the logic sees the bare array / object. The
    // outer `total` is captured BEFORE the unwrap so it survives.
    let siblingTotal: unknown;
    let payload: unknown = data;
    if (
      typeof data === 'object' &&
      data !== null &&
      'data' in (data as object) &&
      typeof (data as { data: unknown }).data !== 'undefined'
    ) {
      const outer = data as { data: unknown; total?: unknown };
      siblingTotal = outer.total;
      payload = outer.data;
    }

    if (Array.isArray(payload)) {
      const meta =
        siblingTotal !== undefined ? { total: siblingTotal } : undefined;
      return this.buildTable(payload, meta);
    }

    if (typeof payload === 'object' && payload !== null) {
      const p = payload as Record<string, unknown>;
      const arrayKey = Object.keys(p).find((k) => Array.isArray(p[k]));
      if (arrayKey) {
        return this.buildTable(p[arrayKey] as unknown[], {
          total: p.total,
        });
      }
      return this.buildMetrics(p);
    }

    if (typeof payload === 'string' || typeof payload === 'number') {
      return { text: String(payload) };
    }

    return { text: `Result: ${JSON.stringify(payload)}` };
  }

  /**
   * Merge LLM conversational text with a tool-response envelope. The
   * envelope's `text` is preserved (used for "(N total)" suffixes) and
   * its components ride alongside.
   */
  merge(text: string, toolEnvelope?: IResponseEnvelope): IResponseEnvelope {
    if (!toolEnvelope) {
      return text ? { text } : {};
    }
    const textParts: string[] = [];
    if (text) textParts.push(text);
    if (toolEnvelope.text) textParts.push(toolEnvelope.text);
    return {
      text: textParts.join(' ').trim() || undefined,
      components: toolEnvelope.components,
    };
  }

  /** Build a table component from an array of objects. */
  private buildTable(
    rows: unknown[],
    meta?: { total?: unknown },
  ): IResponseEnvelope {
    if (rows.length === 0) return { text: 'No results.' };
    const first = rows[0];
    if (!first || typeof first !== 'object') {
      return { text: `Result: ${JSON.stringify(rows)}` };
    }
    const objects = rows.filter(
      (row): row is Record<string, unknown> => !!row && typeof row === 'object',
    );
    const available = new Set(objects.flatMap((row) => Object.keys(row)));
    let headers = this.preferredTableFields.filter((key) => available.has(key));
    if (headers.length === 0) {
      headers = Object.keys(first as object).filter(
        (key) => !/tenant|metadata|password|secret|token|billing/i.test(key),
      );
    }
    const safeRows = objects.slice(0, 20).map((row) =>
      Object.fromEntries(headers.map((header) => [header, this.toDisplayValue(row[header])])),
    );
    const components: IEnvelopeComponent[] = [
      { type: 'table', props: { headers, rows: safeRows } },
    ];
    const total =
      typeof meta?.total === 'number'
        ? meta.total
        : typeof meta?.total === 'string'
          ? Number(meta.total)
          : undefined;
    return {
      text: total !== undefined && !Number.isNaN(total) ? `(${total} total)` : undefined,
      components,
    };
  }

  /** Build a metrics component from nested summary objects. */
  private buildMetrics(data: Record<string, unknown>): IResponseEnvelope {
    const items: Array<{ label: string; value: string | number }> = [];
    const visit = (value: unknown, path: string[], depth: number): void => {
      if (items.length >= 20 || depth > 3 || value === null || value === undefined) return;
      if (typeof value === 'number') {
        items.push({ label: this.humanize(path), value });
        return;
      }
      if (typeof value === 'string') {
        if (!/generatedAt$/i.test(path.join('.')) && value.length <= 40) {
          items.push({ label: this.humanize(path), value });
        }
        return;
      }
      if (typeof value === 'object' && !Array.isArray(value)) {
        for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
          visit(child, [...path, key], depth + 1);
        }
      }
    };
    visit(data, [], 0);
    if (items.length === 0) {
      return { text: JSON.stringify(data) };
    }
    return {
      components: [{ type: 'metrics', props: { items } }],
    };
  }

  private toDisplayValue(value: unknown): string | number | boolean {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
    if (value instanceof Date) return value.toISOString();
    return '';
  }

  private humanize(path: string[]): string {
    return path
      .join(' ')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
}
