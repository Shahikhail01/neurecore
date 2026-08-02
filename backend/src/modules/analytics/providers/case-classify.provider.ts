/**
 * CaseClassifyProvider — Phase 5 P5
 *
 * Pluggable provider for case classification + urgency + sentiment.
 * The default model is a deterministic keyword-weighted scorer over
 * case text; the provider abstains when no case text features are
 * supplied. A trained classifier can be swapped in by overriding the
 * model in `AnalyticsModel.metadata.kind = 'case-classify'` with a
 * non-empty keyword map.
 *
 * Provider scope:
 *   - label: one of { billing, technical, account, shipping, other }
 *   - urgency: 0..1
 *   - sentiment: -1..1 (negative..positive)
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  IPredictionProvider,
  PredictionFactor,
  PredictionProviderInput,
  ProviderPrediction,
} from '../interfaces/IPredictionProvider';

interface CaseClassifyKeywords {
  billing?: number;
  technical?: number;
  account?: number;
  shipping?: number;
  other?: number;
}

@Injectable()
export class CaseClassifyProvider implements IPredictionProvider {
  readonly kind = 'case' as const;
  private readonly logger = new Logger(CaseClassifyProvider.name);

  constructor(private readonly prisma: PrismaService) {}

  async score(input: PredictionProviderInput): Promise<ProviderPrediction> {
    const model = await this.prisma.analyticsModel.findFirst({
      where: {
        id: input.modelId,
        OR: [{ tenantId: input.tenantId }, { tenantId: null }],
      },
    });
    const keywords = this.extractKeywords(model?.metadata);

    const text = String(input.features.text ?? '');
    if (text.trim().length === 0) {
      return {
        score: Number.NaN,
        confidence: 0,
        factors: [],
        limitations: [
          'case-classify provider requires non-empty text feature',
          'abstained',
        ],
      };
    }

    const urgency = clamp01(
      (this.num(input.features, 'priority_hint', 0) +
        this.keywordHits(text, [/urgent/, /immediate/, /asap/i]) * 0.3) /
        1.3,
    );
    const sentiment = clampSentiment(
      this.keywordHits(text, [/great/, /thanks/, /love/]) * 0.4 -
        this.keywordHits(text, [
          /broken/,
          /angry/,
          /frustrat/,
          /unacceptable/,
        ]) *
          0.5,
    );

    const labelScores: Record<keyof CaseClassifyKeywords, number> = {
      billing: this.keywordHits(text, [
        /invoice|billing|charge|refund|payment/i,
      ]),
      technical: this.keywordHits(text, [
        /error|broken|bug|crash|api|integration/i,
      ]),
      account: this.keywordHits(text, [/login|access|account|password|reset/i]),
      shipping: this.keywordHits(text, [
        /ship|deliver|tracking|courier|address/i,
      ]),
      other: 0,
    };
    labelScores.other =
      0.05 +
      1 /
        Math.max(
          1,
          Object.values(labelScores).reduce((a, b) => a + b, 0),
        );

    const factors: PredictionFactor[] = Object.entries(labelScores).map(
      ([label, contribution]) => ({
        name: `label:${label}`,
        value: contribution,
        contribution,
      }),
    );

    let bestLabel: string = 'other';
    let bestScore = -Infinity;
    for (const [label, score] of Object.entries(labelScores)) {
      const kw = keywords[label as keyof CaseClassifyKeywords] ?? 1;
      const weighted = score * kw;
      factors.push({
        name: `keyword-weight:${label}`,
        value: kw,
        contribution: weighted,
      });
      if (weighted > bestScore) {
        bestScore = weighted;
        bestLabel = label;
      }
    }
    const totalHits = Object.values(labelScores).reduce((a, b) => a + b, 0);
    const confidence =
      totalHits > 0 ? clamp(0.5 + Math.min(totalHits, 4) * 0.1, 0.4, 0.9) : 0;

    return {
      score: round(urgency, 4),
      confidence: round(confidence, 4),
      label: bestLabel,
      factors,
      limitations: [
        'keyword-weighted case classifier (deterministic)',
        `urgency=${round(urgency, 2)} sentiment=${round(sentiment, 2)}`,
      ],
    };
  }

  private extractKeywords(metadata: unknown): CaseClassifyKeywords {
    if (!metadata || typeof metadata !== 'object') return {};
    const meta = metadata as { keywords?: unknown };
    if (!meta.keywords || typeof meta.keywords !== 'object') return {};
    const out: CaseClassifyKeywords = {};
    for (const [k, v] of Object.entries(
      meta.keywords as Record<string, unknown>,
    )) {
      if (typeof v === 'number' && Number.isFinite(v)) {
        (out as Record<string, number>)[k] = v;
      }
    }
    return out;
  }

  private keywordHits(text: string, patterns: readonly RegExp[]): number {
    let n = 0;
    for (const p of patterns) {
      const matches = text.match(new RegExp(p.source, p.flags + 'g'));
      if (matches) n += matches.length;
    }
    return n;
  }

  private num(
    features: Record<string, unknown>,
    key: string,
    fallback: number,
  ): number {
    const v = features[key];
    return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  }
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
function clampSentiment(v: number): number {
  return Math.max(-1, Math.min(1, v));
}
function round(v: number, places: number): number {
  const p = 10 ** places;
  return Math.round(v * p) / p;
}
