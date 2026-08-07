/**
 * Deal — Service.
 *
 * Source plan: IMPL_PLAN §R3 (Add Deal model + Deal-stage forecast).
 *
 * Responsibilities (SRP):
 *   - Transition matrix enforcement (LEAD → QUALIFIED → PROPOSAL → NEGOTIATION → WON | LOST,
 *     and any stage → LOST).
 *   - Stage-default probability assignment (LEAD:0.10, QUALIFIED:0.25,
 *     PROPOSAL:0.50, NEGOTIATION:0.75, WON:1.00, LOST:0.00).
 *   - Required `expectedCloseDate` for stages ≥ PROPOSAL.
 *   - Customer / project / contact ownership checks (no cross-tenant FK writes).
 *   - Audit log emission per state transition.
 *
 * Does NOT own:
 *   - Storage (DealRepository).
 *   - HTTP shape (DealsController).
 *   - LLM scoring (analytics providers).
 */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Deal, DealStage, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import {
  CreateDealInput,
  DealRepository,
  ListDealsFilter,
  UpdateDealInput,
} from './repositories/deal.repository';

export const INVALID_DEAL_TRANSITION = 'INVALID_DEAL_TRANSITION';

/** Stage-default probability — used to seed when caller doesn't override. */
const STAGE_DEFAULT_PROBABILITY: Record<DealStage, number> = {
  LEAD: 0.1,
  QUALIFIED: 0.25,
  PROPOSAL: 0.5,
  NEGOTIATION: 0.75,
  WON: 1.0,
  LOST: 0.0,
};

/** Allowed forward edges. Any → LOST is also allowed (handled separately). */
const ALLOWED_TRANSITIONS: Record<DealStage, ReadonlySet<DealStage>> = {
  LEAD: new Set<DealStage>(['QUALIFIED', 'LOST']),
  QUALIFIED: new Set<DealStage>(['PROPOSAL', 'LOST']),
  PROPOSAL: new Set<DealStage>(['NEGOTIATION', 'LOST']),
  NEGOTIATION: new Set<DealStage>(['WON', 'LOST']),
  WON: new Set<DealStage>([]),
  LOST: new Set<DealStage>([]),
};

export interface AuthedActor {
  sub: string;
  tenantId: string;
  role: UserRole;
}

@Injectable()
export class DealsService {
  private readonly logger = new Logger(DealsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: DealRepository,
  ) {}

  // ─── Listing ────────────────────────────────────────────────────────────

  async list(
    actor: AuthedActor,
    filter: ListDealsFilter,
    page: number,
    limit: number,
    sort: 'updatedAt' | 'amount' | 'expectedCloseDate' | 'createdAt',
    sortDir: 'asc' | 'desc',
  ): Promise<{ rows: Deal[]; total: number }> {
    return this.repo.findAll(actor.tenantId, filter, page, limit, sort, sortDir);
  }

  async get(actor: AuthedActor, id: string): Promise<Deal> {
    const deal = await this.repo.findById(actor.tenantId, id);
    if (!deal) {
      throw new NotFoundException(`deal ${id} not found in tenant ${actor.tenantId}`);
    }
    return deal;
  }

  // ─── Create ─────────────────────────────────────────────────────────────

  async create(actor: AuthedActor, input: CreateDealInput): Promise<Deal> {
    if (actor.role !== UserRole.OWNER && actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException('only OWNER/ADMIN can create deals');
    }
    this.validateTenantScope(actor.tenantId);
    await this.assertCustomerBelongsToTenant(input.tenantId, input.customerId);
    await this.assertContactBelongsToCustomer(input.tenantId, input.contactId, input.customerId);

    const stage = input.stage ?? 'LEAD';
    const probability =
      input.probability ?? STAGE_DEFAULT_PROBABILITY[stage];
    this.requireExpectedCloseDateForStage(stage, input.expectedCloseDate);

    const created = await this.repo.create({
      ...input,
      tenantId: actor.tenantId,
      probability,
    });
    await this.recordAudit(created.id, 'CREATED', actor, { stage, amount: input.amount });
    return created;
  }

  // ─── Update ─────────────────────────────────────────────────────────────

  async update(
    actor: AuthedActor,
    id: string,
    input: UpdateDealInput,
  ): Promise<Deal> {
    const existing = await this.get(actor, id);
    if (input.stage && input.stage !== existing.stage) {
      // Bypass the matrix via direct PATCH — force callers to use
      // transitionTo() instead. We DO allow WON/LOST reverse to undo
      // (admin override) via the dedicated endpoint.
      throw new BadRequestException(
        'use POST /deals/:id/transitions to change stage; direct PATCH only updates metadata',
      );
    }
    if (input.customerId !== undefined) {
      await this.assertCustomerBelongsToTenant(actor.tenantId, input.customerId);
    }
    if (input.contactId !== undefined) {
      await this.assertContactBelongsToCustomer(actor.tenantId, input.contactId, input.customerId);
    }
    const updated = await this.repo.update(actor.tenantId, id, input);
    await this.recordAudit(updated.id, 'UPDATED', actor, input as unknown as Record<string, unknown>);
    return updated;
  }

  // ─── Transitions (state machine) ────────────────────────────────────────

  async transitionTo(
    actor: AuthedActor,
    id: string,
    toStage: DealStage,
    reason?: string,
  ): Promise<Deal> {
    const existing = await this.get(actor, id);
    this.assertTransitionAllowed(existing.stage, toStage);
    // Probability auto-updates on stage change unless caller already set one.
    const probability = STAGE_DEFAULT_PROBABILITY[toStage];
    if (toStage !== 'LOST') {
      this.requireExpectedCloseDateForStage(toStage, existing.expectedCloseDate);
    }
    const updated = await this.repo.update(actor.tenantId, id, {
      stage: toStage,
      probability,
    });
    await this.recordAudit(updated.id, 'TRANSITIONED', actor, {
      from: existing.stage,
      to: toStage,
      reason,
    });
    return updated;
  }

  // ─── Soft delete ────────────────────────────────────────────────────────

  async softDelete(actor: AuthedActor, id: string): Promise<Deal> {
    const existing = await this.get(actor, id);
    const updated = await this.repo.softDelete(actor.tenantId, id);
    await this.recordAudit(existing.id, 'DELETED', actor, { from: existing.stage });
    return updated;
  }

  // ─── Forecast aggregation (drives nc.forecast_pipeline) ────────────────

  /**
   * Returns the deal-stage forecast for `nc.forecast_pipeline`.
   * The chat tool layer composes this with the Quote aggregation
   * already in production.
   */
  async forecastForTenant(tenantId: string): Promise<{
    byStage: Array<{
      stage: DealStage;
      count: number;
      sumAmount: number;
      sumWeightedAmount: number;
    }>;
    weightedTotal: number;
    committedTotal: number;
    bestCaseTotal: number;
    totalAmount: number;
    dealsCount: number;
  }> {
    this.validateTenantScope(tenantId);
    const groups = await this.repo.aggregateForecast(tenantId);

    let weightedTotal = 0;
    let committedTotal = 0;
    let bestCaseTotal = 0;
    let totalAmount = 0;
    let dealsCount = 0;

    // For weighted total we need the probability per row, not just
    // groupBy stage. We re-read by stage in one fetch and combine.
    const rows = await this.prisma.deal.findMany({
      where: { tenantId, deletedAt: null },
      select: { stage: true, amount: true, probability: true },
    });

    for (const r of rows) {
      const amt = Number(r.amount);
      const pr = Number(r.probability);
      weightedTotal += amt * pr;
      if (r.stage === 'NEGOTIATION' || r.stage === 'WON') {
        committedTotal += amt;
      }
      if (r.stage !== 'LOST') {
        bestCaseTotal += amt;
      }
      totalAmount += amt;
      dealsCount += 1;
    }

    const byStage = groups.map((g) => {
      const rowsForStage = rows.filter((r) => r.stage === g.stage);
      const sumWeighted = rowsForStage.reduce(
        (acc, r) => acc + Number(r.amount) * Number(r.probability),
        0,
      );
      return {
        stage: g.stage,
        count: Number(g.count),
        sumAmount: g.sumAmount ? Number(g.sumAmount) : 0,
        sumWeightedAmount: sumWeighted,
      };
    });

    return {
      byStage,
      weightedTotal,
      committedTotal,
      bestCaseTotal,
      totalAmount,
      dealsCount,
    };
  }

  // ─── Tenant-scope helpers ───────────────────────────────────────────────

  private validateTenantScope(tenantId: string): void {
    if (!tenantId || tenantId === '*') {
      throw new ForbiddenException('tenantId "*" or empty is forbidden');
    }
  }

  private requireExpectedCloseDateForStage(
    stage: DealStage,
    expectedCloseDate?: Date | string | null,
  ): void {
    if (stage === 'PROPOSAL' || stage === 'NEGOTIATION' || stage === 'WON') {
      if (!expectedCloseDate) {
        throw new BadRequestException(
          `expectedCloseDate is required for stage ${stage}`,
        );
      }
    }
  }

  private assertTransitionAllowed(from: DealStage, to: DealStage): void {
    if (from === to) return;
    if (to === 'LOST') return; // any → LOST
    const allowed = ALLOWED_TRANSITIONS[from];
    if (!allowed.has(to)) {
      throw new BadRequestException({
        code: INVALID_DEAL_TRANSITION,
        message: `cannot transition deal from ${from} to ${to}`,
        allowed: Array.from(allowed),
      });
    }
  }

  private async assertCustomerBelongsToTenant(
    tenantId: string,
    customerId?: string | null,
  ): Promise<void> {
    if (!customerId) return;
    const c = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId },
      select: { id: true },
    });
    if (!c) {
      throw new BadRequestException(
        `customer ${customerId} does not belong to tenant ${tenantId}`,
      );
    }
  }

  private async assertContactBelongsToCustomer(
    tenantId: string,
    contactId?: string | null,
    customerId?: string | null,
  ): Promise<void> {
    if (!contactId) return;
    if (!customerId) {
      throw new BadRequestException(
        'contactId requires customerId to enforce scope',
      );
    }
    const ct = await this.prisma.customerContact.findFirst({
      where: { id: contactId, customerId, customer: { tenantId } },
      select: { id: true },
    });
    if (!ct) {
      throw new BadRequestException(
        `contact ${contactId} does not belong to customer ${customerId} in tenant ${tenantId}`,
      );
    }
  }

  private async recordAudit(
    dealId: string,
    action: 'CREATED' | 'UPDATED' | 'TRANSITIONED' | 'DELETED',
    actor: AuthedActor,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actor: actor.sub,
        tenantId: actor.tenantId,
        action: `deal.${action.toLowerCase()}`,
        resource: 'deal',
        resourceId: dealId,
        result: 'success',
        details: metadata as Prisma.InputJsonValue,
      },
    });
  }
}
