/**
 * Phase 11 — Extract structured fields skill.
 *
 * Source plan: IMPLEMENTATION_PLAN_PHASE11.md. CR-AI-0104 / GEN-004.
 *
 * Extracts typed fields from free text or a document. The output
 * shape is a JSON object whose keys mirror the input schema. The
 * skill must REFUSE to coerce if the model's value does not match
 * the declared type — it surfaces an `abstained: type-mismatch`
 * limit instead.
 */

import { Injectable } from '@nestjs/common';
import { BaseSkill } from './base.skill';
import { SkillId, SkillExecutionContext } from '../interfaces/skill.interface';
import {
  ExtractField,
  SourceRef,
  SkillOutput,
} from '../interfaces/skill.types';
import { SkillPrompt, parseTextReply } from '../skill-prompt';
import { ExecutorOptions } from '../skill-executor.service';

export interface ExtractInput {
  readonly source: SourceRef;
  readonly schema: Readonly<Record<string, ExtractField>>;
  readonly locale?: string;
}

export interface ExtractOutput extends SkillOutput<Record<string, unknown>> {}

interface FieldResult {
  value: unknown;
  abstained: boolean;
  reason?: 'type-mismatch' | 'missing-required' | 'low-confidence';
}

@Injectable()
export class ExtractSkill extends BaseSkill<ExtractInput, ExtractOutput> {
  readonly id: SkillId = 'extract';
  readonly displayName = 'Extract structured fields';
  readonly shortDescription =
    'Extract a typed schema from unstructured text or a document.';

  validateInput(input: unknown): input is ExtractInput {
    if (!input || typeof input !== 'object') return false;
    const i = input as Record<string, unknown>;
    if (!('source' in i)) return false;
    const schema = i['schema'];
    if (!schema || typeof schema !== 'object') return false;
    const s = schema as Record<string, unknown>;
    if (Object.keys(s).length === 0) return false;
    return Object.values(s).every((f) => this.isValidFieldShape(f));
  }

  private isValidFieldShape(field: unknown): boolean {
    if (!field || typeof field !== 'object') return false;
    const f = field as Record<string, unknown>;
    return (
      f['type'] === 'string' ||
      f['type'] === 'number' ||
      f['type'] === 'date' ||
      f['type'] === 'currency' ||
      f['type'] === 'enum' ||
      f['type'] === 'boolean'
    );
  }

  buildPrompt(
    input: ExtractInput,
    _ctx: SkillExecutionContext,
  ): { prompt: SkillPrompt<ExtractOutput>; options?: ExecutorOptions } {
    const fieldList = Object.entries(input.schema)
      .map(([name, f]) => {
        const enumRule = Array.isArray(f.enum) ? ` (allowed values: ${f.enum.join(' | ')})` : '';
        return `  - ${name} : ${f.type}${enumRule}${f.required ? ' [REQUIRED]' : ''}`;
      })
      .join('\n');

    const systemInstruction = [
      'You extract typed fields from text.',
      'Reply as JSON: {"values": Record<string, {"value": any, "confidence": number}>, "limits": string[]}.',
      'If a value cannot be coerced to the requested type, omit it AND add a `limits` entry.',
    ].join(' ');
    const userInstruction =
      `Extract the following fields from the source:\n${fieldList}\n` +
      `Reply strictly as JSON with a "values" object and an optional "limits" array.`;

    return {
      prompt: {
        skillId: this.id,
        capability: 'reasoning',
        systemInstruction,
        userInstruction,
        sources: [input.source],
        responseJsonRequired: true,
        parse: (raw: string) => {
          const { content, limits } = parseTextReply(raw);
          const parsed = this.tryParseJson(content);
          const extracted: Record<string, FieldResult> = {};
          const finalLimits: string[] = [...limits];
          if (parsed && typeof parsed === 'object') {
            const values = (parsed as Record<string, unknown>)['values'];
            if (values && typeof values === 'object') {
              for (const [k, f] of Object.entries(input.schema)) {
                const entry = (values as Record<string, unknown>)[k] as
                  | { value?: unknown; confidence?: number }
                  | undefined;
                if (!entry || entry.value === undefined || entry.value === null) {
                  if (f.required) {
                    extracted[k] = {
                      value: null,
                      abstained: true,
                      reason: 'missing-required',
                    };
                    finalLimits.push(`extract:${k}:abstained-required-missing`);
                  }
                  continue;
                }
                const coerced = this.coerceValue(f, entry.value);
                if (coerced.ok) {
                  extracted[k] = { value: coerced.value, abstained: false };
                } else {
                  extracted[k] = {
                    value: null,
                    abstained: true,
                    reason: 'type-mismatch',
                  };
                  finalLimits.push(`extract:${k}:abstained-${coerced.reason}`);
                }
              }
            }
          } else {
            finalLimits.push('extract:response-not-json');
          }
          const flat: Record<string, unknown> = {};
          for (const [k, r] of Object.entries(extracted)) {
            flat[k] = r.abstained ? null : r.value;
          }
          return {
            content: flat,
            citations: [],
            limits: finalLimits,
            confidence: this.aggregateConfidence(extracted),
            durationMs: 0,
            skillId: this.id,
          } satisfies ExtractOutput;
        },
      },
      options: { temperature: 0, maxTokens: 1024 },
    };
  }

  private tryParseJson(text: string): unknown {
    const trimmed = text.trim();
    // Strip markdown fences if present.
    const fenced = trimmed.startsWith('```')
      ? trimmed.replace(/^```(?:json)?\s*/, '').replace(/```$/, '')
      : trimmed;
    try {
      return JSON.parse(fenced);
    } catch {
      return null;
    }
  }

  private coerceValue(
    field: ExtractField,
    raw: unknown,
  ): { ok: true; value: unknown } | { ok: false; reason: string } {
    switch (field.type) {
      case 'string':
        if (typeof raw === 'string') return { ok: true, value: raw };
        return { ok: false, reason: 'not-a-string' };
      case 'number': {
        const n = typeof raw === 'number' ? raw : Number(raw);
        return Number.isFinite(n)
          ? { ok: true, value: n }
          : { ok: false, reason: 'not-a-number' };
      }
      case 'boolean':
        return typeof raw === 'boolean'
          ? { ok: true, value: raw }
          : { ok: false, reason: 'not-a-boolean' };
      case 'date': {
        if (typeof raw !== 'string') return { ok: false, reason: 'not-a-date' };
        const d = new Date(raw);
        return Number.isNaN(d.getTime())
          ? { ok: false, reason: 'invalid-date' }
          : { ok: true, value: d.toISOString() };
      }
      case 'currency': {
        const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/[^0-9.\-]/g, ''));
        return Number.isFinite(n)
          ? { ok: true, value: n }
          : { ok: false, reason: 'not-a-currency' };
      }
      case 'enum': {
        if (typeof raw !== 'string') return { ok: false, reason: 'enum-not-string' };
        const allowed = field.enum ?? [];
        return allowed.includes(raw)
          ? { ok: true, value: raw }
          : { ok: false, reason: 'enum-not-allowed' };
      }
    }
    return { ok: false, reason: 'unknown-type' };
  }

  private aggregateConfidence(results: Record<string, FieldResult>): number {
    const all = Object.values(results);
    if (all.length === 0) return 0;
    const abstained = all.filter((r) => r.abstained).length;
    return (all.length - abstained) / all.length;
  }
}
