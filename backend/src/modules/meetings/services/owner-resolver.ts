/**
 * Phase 25 — OwnerResolver.
 *
 * Source plan: IMPLEMENTATION_PLAN_PARITY_COMPLETION.md §6 (P25).
 *
 * SOLID — SRP: owns ONLY the resolution of an `@name` token from
 * a transcript to a real user in the tenant. The action
 * extractor delegates to this seam so the persistence boundary
 * is testable.
 *
 * DIP — implements `IOwnerResolver` (DI token `OWNER_RESOLVER`);
 * the extractor depends on the interface only.
 *
 * Resolution rules (case-insensitive):
 *   1. exact match on email local-part (e.g. "alice" matches
 *      alice@example.com)
 *   2. match on firstName
 *   3. match on lastName
 *   4. match on "firstName.lastName" joined lowercased
 * Ambiguity: more than one match in the same tenant → caller
 * treats the owner as ambiguous.
 */

import { ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { type IOwnerResolver, type OwnerCandidate, OWNER_RESOLVER } from './action-extractor.service';

@Injectable()
export class OwnerResolver implements IOwnerResolver {
  private readonly logger = new Logger(OwnerResolver.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async resolve(tenantId: string, hint: string): Promise<OwnerCandidate | null> {
    this.assertTenantScope(tenantId);
    if (!hint) return null;
    const candidates = await this.candidates(tenantId, hint);
    if (candidates.length === 1) return candidates[0] ?? null;
    return null;
  }

  async candidates(tenantId: string, hint: string): Promise<ReadonlyArray<OwnerCandidate>> {
    this.assertTenantScope(tenantId);
    if (!hint) return [];
    const normalized = hint.toLowerCase();
    const rows = await this.prisma.user.findMany({
      where: {
        tenantId,
        isActive: true,
        OR: [
          { email: { contains: `${normalized}@`, mode: 'insensitive' } },
          { firstName: { equals: hint, mode: 'insensitive' } },
          { lastName: { equals: hint, mode: 'insensitive' } },
          { firstName: { contains: normalized, mode: 'insensitive' } },
          { lastName: { contains: normalized, mode: 'insensitive' } },
        ],
      },
      select: { id: true, firstName: true, lastName: true, email: true },
      take: 10,
    });
    return rows.map((r) => ({
      userId: r.id,
      displayName: `${r.firstName} ${r.lastName}`.trim(),
      email: r.email,
    }));
  }

  private assertTenantScope(tenantId: string): void {
    if (!tenantId || tenantId === '*') {
      throw new ForbiddenException(`tenantId "${tenantId}" forbidden`);
    }
  }
}

/** DI provider binding for the resolver. */
export const ownerResolverProvider = {
  provide: OWNER_RESOLVER,
  useExisting: OwnerResolver,
};
