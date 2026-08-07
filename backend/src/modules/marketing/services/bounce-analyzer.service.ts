/**
 * Phase 19 — BounceAnalyzerService (CR-AI-0803).
 *
 * Source plan: IMPLEMENTATION-PLAN-PHASE-19-21.md §1.
 *
 * Categorises bounce events; explains the reason; recommends
 * remediation. The classifier is a typed regex-driven shim that
 * Phase 21 swaps for an LLM-backed path behind the same
 * `IBounceClassifier` interface.
 *
 * SRP — owns ONLY the bounce surface. Brevo integration is owned
 * by `BrevoWebhookService` which calls into us.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

export type BounceCategory =
  | 'HARD_BOUNCE'
  | 'SOFT_BOUNCE'
  | 'COMPLAINT'
  | 'BLOCK'
  | 'OTHER';

export interface BounceFinding {
  readonly recipientEmail: string;
  readonly tenantId: string;
  readonly category: BounceCategory;
  readonly explanation: string;
  readonly recommendedAction: string;
  readonly confidencePercent: number;
}

export interface BounceInput {
  readonly tenantId: string;
  readonly recipientEmail: string;
  readonly smtpStatus?: number;
  readonly smtpDiagnostic?: string;
  readonly reason?: string;
}

@Injectable()
export class BounceAnalyzerService {
  private readonly logger = new Logger(BounceAnalyzerService.name);

  constructor(private readonly prisma: PrismaService) {}

  async classify(input: BounceInput): Promise<BounceFinding> {
    if (!input.tenantId || input.tenantId === '*') {
      throw new ForbiddenError('tenantId required');
    }

    const reason = (input.reason ?? input.smtpDiagnostic ?? '').toLowerCase();
    const status = input.smtpStatus ?? 0;

    let category: BounceCategory = 'OTHER';
    let explanation = 'Unknown bounce reason.';
    let recommendedAction = 'investigate manually';
    let confidence = 50;

    // Reason-match first — explicit keywords beat ambiguous status codes.
    if (reason.includes('complain') || reason.includes('spam') || reason.includes('abuse')) {
      category = 'COMPLAINT';
      explanation = 'Recipient marked the message as spam.';
      recommendedAction = 'suppress recipient + add to complaint suppression list';
      confidence = 95;
    } else if (reason.includes('mailbox full') || reason.includes('quota')) {
      category = 'SOFT_BOUNCE';
      explanation = `Recipient mailbox temporarily unavailable (status=${status}, reason=${reason || 'n/a'}).`;
      recommendedAction = 'retry within 24h then suppress after 3 retries';
      confidence = 80;
    } else if (status === 421 || reason.includes('tls') || reason.includes('blocked')) {
      category = 'BLOCK';
      explanation = 'Recipient MTA blocked delivery.';
      recommendedAction = 'verify TLS / authentication / IP reputation';
      confidence = 75;
    } else if (status >= 500 || reason.includes('mailbox') || reason.includes('no such user')) {
      category = 'HARD_BOUNCE';
      explanation = `Recipient mailbox unavailable (status=${status}, reason=${reason || 'n/a'}).`;
      recommendedAction = 'suppress recipient from future campaigns';
      confidence = 90;
    } else if (status >= 400) {
      category = 'SOFT_BOUNCE';
      explanation = `Recipient mailbox temporarily unavailable (status=${status}, reason=${reason || 'n/a'}).`;
      recommendedAction = 'retry within 24h then suppress after 3 retries';
      confidence = 70;
    }

    return {
      recipientEmail: input.recipientEmail,
      tenantId: input.tenantId,
      category,
      explanation,
      recommendedAction,
      confidencePercent: confidence,
    };
  }
}

class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}
