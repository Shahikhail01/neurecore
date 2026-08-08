/**
 * Phase 25 — MeetingConsentService.
 *
 * Source plan: IMPLEMENTATION_PLAN_PARITY_COMPLETION.md §6 (P25).
 *
 * SOLID — SRP: owns ONLY the consent row (grant / revoke / verify).
 * Transcript ingestion, action extraction, and CRM linkage are
 * separate services. The consent row is the gate that the
 * ingestion service checks before calling the live transcript
 * provider.
 *
 * DIP — uses the injected `PrismaService` only; consumers
 * (`TranscriptIngestionService`, `LiveTranscriptIngestionService`)
 * depend on the abstract surface (`IMeetingConsentService`).
 */

import { ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import { MeetingProvider } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

export const MEETING_CONSENT_SERVICE = Symbol('MeetingConsentService');

export interface IMeetingConsentService {
  isGranted(tenantId: string, userId: string, provider: MeetingProvider): Promise<boolean>;
  grant(params: {
    tenantId: string;
    userId: string;
    provider: MeetingProvider;
    scopes: ReadonlyArray<string>;
    jurisdiction?: string;
  }): Promise<{ consentId: string }>;
  revoke(params: {
    tenantId: string;
    userId: string;
    provider: MeetingProvider;
  }): Promise<{ revoked: boolean }>;
}

export class MeetingConsentRequiredError extends ForbiddenException {
  constructor(message: string) {
    super(message);
    this.name = 'MeetingConsentRequiredError';
  }
}

export class MeetingConsentRevokedError extends ForbiddenException {
  constructor(message: string) {
    super(message);
    this.name = 'MeetingConsentRevokedError';
  }
}

export class MeetingTenantForbiddenError extends ForbiddenException {
  constructor(message: string) {
    super(message);
    this.name = 'MeetingTenantForbiddenError';
  }
}

@Injectable()
export class MeetingConsentService implements IMeetingConsentService {
  private readonly logger = new Logger(MeetingConsentService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Verify a live, non-revoked consent row exists for
   * (tenantId, userId, provider).
   */
  async isGranted(tenantId: string, userId: string, provider: MeetingProvider): Promise<boolean> {
    this.assertTenantScope(tenantId, 'isGranted');
    if (!userId) return false;
    const row = await this.prisma.meetingProviderConsent.findFirst({
      where: {
        tenantId,
        userId,
        provider,
        revokedAt: null,
      },
      select: { id: true },
    });
    return Boolean(row);
  }

  async grant(params: {
    tenantId: string;
    userId: string;
    provider: MeetingProvider;
    scopes: ReadonlyArray<string>;
    jurisdiction?: string;
  }): Promise<{ consentId: string }> {
    this.assertTenantScope(params.tenantId, 'grant');
    if (!params.userId) {
      throw new ForbiddenException('userId required');
    }
    const row = await this.prisma.meetingProviderConsent.upsert({
      where: {
        tenantId_userId_provider: {
          tenantId: params.tenantId,
          userId: params.userId,
          provider: params.provider,
        },
      },
      create: {
        tenantId: params.tenantId,
        userId: params.userId,
        provider: params.provider,
        scopes: params.scopes as unknown as string[],
        jurisdiction: params.jurisdiction,
        grantedAt: new Date(),
        revokedAt: null,
      },
      update: {
        scopes: params.scopes as unknown as string[],
        jurisdiction: params.jurisdiction,
        revokedAt: null,
        grantedAt: new Date(),
      },
      select: { id: true },
    });
    return { consentId: row.id };
  }

  async revoke(params: {
    tenantId: string;
    userId: string;
    provider: MeetingProvider;
  }): Promise<{ revoked: boolean }> {
    this.assertTenantScope(params.tenantId, 'revoke');
    if (!params.userId) return { revoked: false };
    const updated = await this.prisma.meetingProviderConsent.updateMany({
      where: {
        tenantId: params.tenantId,
        userId: params.userId,
        provider: params.provider,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
    return { revoked: updated.count > 0 };
  }

  private assertTenantScope(tenantId: string, op: string): void {
    if (!tenantId || tenantId === '*') {
      throw new MeetingTenantForbiddenError(`tenantId required for ${op}`);
    }
  }
}
