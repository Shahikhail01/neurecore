/**
 * Service Operations — 360 / contact-center / agent guidance / self-service.
 *
 * Source plan: §5.9.1/2/3/4/8, §5.10.4/5, §5.11.3/4/5.
 *
 * Solid:
 *   • SRP — service-business rules only. The contact-center / lead-routing
 *     runner is composed from this service.
 *   • OCP — adding a new triage rule or chatbot persona = new entry.
 *   • Append-only audit: CustomerTouchpointEvent, CaseEscalation,
 *     KnowledgeGap, RealTimeAgentGuidance, CustomerIntentSignal.
 */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { KnowledgeGap } from '@prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';

// ─── Customer 360 (§5.9.1) ──────────────────────────────────────────

@Injectable()
export class CustomerTouchpointService {
  private readonly logger = new Logger(CustomerTouchpointService.name);
  constructor(private readonly prisma: PrismaService) {}

  async ingest(args: {
    tenantId: string;
    customerId: string;
    channelKind: string;
    externalId: string;
    occurredAt: Date;
    payload?: Prisma.InputJsonValue;
    tags?: string[];
  }) {
    if (!args.tenantId || args.tenantId === '*') {
      throw new ForbiddenException('tenantId "*" is forbidden');
    }
    // Idempotent on (tenantId, channelKind, externalId).
    return this.prisma.customerTouchpointEvent.upsert({
      where: {
        tenantId_channelKind_externalId: {
          tenantId: args.tenantId,
          channelKind: args.channelKind,
          externalId: args.externalId,
        },
      },
      create: {
        tenantId: args.tenantId,
        customerId: args.customerId,
        channelKind: args.channelKind,
        externalId: args.externalId,
        occurredAt: args.occurredAt,
        payload: args.payload ?? {},
        tags: args.tags ?? [],
      },
      update: {
        payload: args.payload ?? {},
        tags: args.tags ?? [],
      },
    });
  }

  /**
   * 360° customer view — append-only touchpoints projected into a
   * timeline. Computed on read, never persisted.
   */
  async get360View(tenantId: string, customerId: string) {
    if (!tenantId || tenantId === '*') {
      throw new ForbiddenException('tenantId "*" is forbidden');
    }
    const events = await this.prisma.customerTouchpointEvent.findMany({
      where: { tenantId, customerId },
      orderBy: { occurredAt: 'desc' },
      take: 200,
    });
    const signals = await this.prisma.customerIntentSignal.findMany({
      where: { tenantId, customerId },
      orderBy: { detectedAt: 'desc' },
      take: 50,
    });
    return {
      tenantId,
      customerId,
      timeline: events,
      intentSignals: signals,
      summary: {
        totalTouchpoints: events.length,
        channelsTouched: Array.from(new Set(events.map((e) => e.channelKind))),
        lastTouchpointAt: events[0]?.occurredAt ?? null,
        activeIntent: signals.find((s) => s.confidence >= 0.6)?.intentKind ?? null,
      },
    };
  }
}

// ─── Case triage / contact-center (§5.9.2) ─────────────────────────

export type TriageResult =
  | { matched: true; ruleId: string; priority: string; action: string; target: string | null }
  | { matched: false };

@Injectable()
export class CaseTriageService {
  private readonly logger = new Logger(CaseTriageService.name);
  constructor(private readonly prisma: PrismaService) {}

  async createRule(args: {
    tenantId: string;
    slug: string;
    displayName: string;
    description?: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    action:
      | 'AUTO_ROUTE_QUEUE'
      | 'AUTO_ROUTE_OWNER'
      | 'AUTO_PRIORITY'
      | 'ESCALATE_HUMAN'
      | 'REQUEST_INFO';
    targetQueue?: string;
    targetOwnerId?: string;
    predicate?: Prisma.InputJsonValue;
  }) {
    if (!args.tenantId || args.tenantId === '*') {
      throw new ForbiddenException('tenantId "*" is forbidden');
    }
    const existing = await this.prisma.caseTriageRule.findUnique({
      where: { tenantId_slug: { tenantId: args.tenantId, slug: args.slug } },
    });
    if (existing) {
      throw new ConflictException(
        `triage rule slug "${args.slug}" already exists for tenant`,
      );
    }
    return this.prisma.caseTriageRule.create({
      data: {
        tenantId: args.tenantId,
        slug: args.slug,
        displayName: args.displayName,
        description: args.description,
        priority: args.priority,
        action: args.action,
        targetQueue: args.targetQueue,
        targetOwnerId: args.targetOwnerId,
        predicate: args.predicate ?? {},
      },
    });
  }

  list(tenantId: string) {
    return this.prisma.caseTriageRule.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Evaluate every enabled rule against a case payload. Returns the
   * first match (priority-weighted). If no rule matches, returns
   * { matched: false }.
   */
  async evaluate(args: {
    tenantId: string;
    caseId: string;
    payload: Record<string, unknown>;
  }): Promise<TriageResult> {
    if (!args.tenantId || args.tenantId === '*') {
      throw new ForbiddenException('tenantId "*" is forbidden');
    }
    const rules = await this.prisma.caseTriageRule.findMany({
      where: { tenantId: args.tenantId, enabled: true },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });
    const priorityWeight: Record<string, number> = {
      URGENT: 4,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1,
    };
    let best: TriageResult | null = null;
    let bestScore = -1;
    for (const rule of rules) {
      if (!matchesPredicate(rule.predicate as Record<string, unknown>, args.payload)) {
        continue;
      }
      const score = priorityWeight[rule.priority] ?? 0;
      if (score > bestScore) {
        bestScore = score;
        best = {
          matched: true,
          ruleId: rule.id,
          priority: rule.priority,
          action: rule.action,
          target: rule.targetQueue ?? rule.targetOwnerId ?? null,
        };
      }
    }
    if (!best) return { matched: false };
    await this.prisma.caseEscalation.create({
      data: {
        tenantId: args.tenantId,
        caseId: args.caseId,
        ruleId: best.ruleId,
        fromStatus: 'NEW',
        toStatus: best.action,
        reason: `triage rule matched: ${best.action}`,
        actorId: 'system:triage',
      },
    });
    return best;
  }
}

function matchesPredicate(
  predicate: Record<string, unknown>,
  payload: Record<string, unknown>,
): boolean {
  for (const [key, expected] of Object.entries(predicate)) {
    const actual = payload[key];
    if (typeof expected === 'object' && expected !== null) {
      // Operator map: { eq, ne, in, contains, gt, lt }.
      const ops = expected as Record<string, unknown>;
      if ('eq' in ops && actual !== ops.eq) return false;
      if ('ne' in ops && actual === ops.ne) return false;
      if ('in' in ops && Array.isArray(ops.in) && !ops.in.includes(actual)) return false;
      if ('contains' in ops && typeof actual === 'string' && !actual.includes(String(ops.contains))) return false;
      if ('gt' in ops && typeof actual === 'number' && !(actual > (ops.gt as number))) return false;
      if ('lt' in ops && typeof actual === 'number' && !(actual < (ops.lt as number))) return false;
    } else if (actual !== expected) {
      return false;
    }
  }
  return true;
}

// ─── Real-time agent guidance (§5.9.3) ───────────────────────────

@Injectable()
export class RealTimeGuidanceService {
  private readonly logger = new Logger(RealTimeGuidanceService.name);
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Suggest a hint to an agent working a case. The deterministic
   * stub uses the caseId + tenantId hash to pick a stable hint from
   * the rule set; a real implementation reads from KB + similar cases.
   */
  async suggest(args: {
    tenantId: string;
    caseId: string;
    agentId: string;
  }) {
    if (!args.tenantId || args.tenantId === '*') {
      throw new ForbiddenException('tenantId "*" is forbidden');
    }
    // Phase 7.1 deterministic stub: rotate through 3 hint templates.
    const templates = [
      { hint: 'Check the customer\'s last 3 touchpoints before responding.', trigger: 'kb:general-handling', confidence: 0.82 },
      { hint: 'This looks like a billing question — verify the invoice id before replying.', trigger: 'kb:billing-classifier', confidence: 0.74 },
      { hint: 'High-value case — consider escalating to tier 2 support.', trigger: 'heuristic:high-value', confidence: 0.66 },
    ];
    const idx = simpleHash(`${args.tenantId}:${args.caseId}`) % templates.length;
    const row = await this.prisma.realTimeAgentGuidance.create({
      data: {
        tenantId: args.tenantId,
        caseId: args.caseId,
        agentId: args.agentId,
        hint: templates[idx].hint,
        confidence: templates[idx].confidence,
        trigger: templates[idx].trigger,
      },
    });
    return row;
  }

  async accept(args: { tenantId: string; id: string }) {
    if (!args.tenantId || args.tenantId === '*') {
      throw new ForbiddenException('tenantId "*" is forbidden');
    }
    return this.prisma.realTimeAgentGuidance.update({
      where: { id: args.id },
      data: { acceptedAt: new Date() },
    });
  }
}

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

// ─── 24/7 self-service chatbot persona (§5.9.4) ─────────────────

@Injectable()
export class ChatbotPersonaService {
  private readonly logger = new Logger(ChatbotPersonaService.name);
  constructor(private readonly prisma: PrismaService) {}

  async create(args: {
    tenantId: string;
    kind: 'SELF_SERVICE_24_7' | 'SALES_ASSIST' | 'SUPPORT_TIER_1' | 'INTERNAL_HELPDESK';
    slug: string;
    displayName: string;
    systemPrompt: string;
    allowedActionIds?: string[];
    knowledgeCategories?: string[];
    escalationThreshold?: number;
  }) {
    if (!args.tenantId || args.tenantId === '*') {
      throw new ForbiddenException('tenantId "*" is forbidden');
    }
    if (args.escalationThreshold !== undefined &&
        (args.escalationThreshold < 0 || args.escalationThreshold > 1)) {
      throw new BadRequestException('escalationThreshold must be in [0, 1]');
    }
    return this.prisma.chatbotPersona.create({
      data: {
        tenantId: args.tenantId,
        kind: args.kind,
        slug: args.slug,
        displayName: args.displayName,
        systemPrompt: args.systemPrompt,
        allowedActionIds: args.allowedActionIds ?? [],
        knowledgeCategories: args.knowledgeCategories ?? [],
        escalationThreshold: args.escalationThreshold ?? 0.6,
      },
    });
  }

  list(tenantId: string) {
    return this.prisma.chatbotPersona.findMany({
      where: { tenantId, enabled: true },
      orderBy: { displayName: 'asc' },
    });
  }

  /**
   * Pick the active persona for a tenant + intent kind. Returns null
   * if no persona matches.
   */
  async resolve(args: { tenantId: string; intentKind?: string }) {
    if (!args.tenantId || args.tenantId === '*') {
      throw new ForbiddenException('tenantId "*" is forbidden');
    }
    // Intent → persona kind mapping (deterministic; future Phase wires
    // ML classifier).
    const map: Record<string, 'SELF_SERVICE_24_7' | 'SALES_ASSIST' | 'SUPPORT_TIER_1' | 'INTERNAL_HELPDESK'> = {
      purchase: 'SALES_ASSIST',
      support: 'SUPPORT_TIER_1',
      demo: 'SALES_ASSIST',
      howto: 'SELF_SERVICE_24_7',
      password: 'SELF_SERVICE_24_7',
      hr: 'INTERNAL_HELPDESK',
      default: 'SUPPORT_TIER_1',
    };
    const kind = map[args.intentKind ?? 'default'] ?? 'SUPPORT_TIER_1';
    return this.prisma.chatbotPersona.findFirst({
      where: { tenantId: args.tenantId, kind, enabled: true },
    });
  }
}

// ─── Knowledge self-curation (§5.9.8) ──────────────────────────

@Injectable()
export class KnowledgeGapService {
  private readonly logger = new Logger(KnowledgeGapService.name);
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Scan recent cases and cluster recurring topics that lack KB
   * coverage. Phase 7.1 ships the deterministic stub: the topic
   * hash is the topic itself; the runner emits one gap row per
   * unique topic encountered.
   */
  async detect(args: { tenantId: string; topics: string[]; caseCount?: number }) {
    if (!args.tenantId || args.tenantId === '*') {
      throw new ForbiddenException('tenantId "*" is forbidden');
    }
    const created: KnowledgeGap[] = [];
    for (const topic of args.topics) {
      const topicHash = simpleHash(topic).toString(16);
      const existing = await this.prisma.knowledgeGap.findUnique({
        where: { tenantId_topicHash: { tenantId: args.tenantId, topicHash } },
      });
      if (existing) continue;
      const row = await this.prisma.knowledgeGap.create({
        data: {
          tenantId: args.tenantId,
          topic,
          topicHash,
          caseCount: args.caseCount ?? 1,
          suggestedTitle: `How to handle: ${topic}`,
          suggestedBody: `(auto-curated draft — needs human review)`,
        },
      });
      created.push(row);
    }
    return created;
  }

  list(tenantId: string, status?: string) {
    return this.prisma.knowledgeGap.findMany({
      where: { tenantId, ...(status ? { status } : {}) },
      orderBy: { detectedAt: 'desc' },
    });
  }
}

// ─── Quote generation (§5.11.3) ───────────────────────────────

@Injectable()
export class QuoteService {
  private readonly logger = new Logger(QuoteService.name);
  constructor(private readonly prisma: PrismaService) {}

  async createDraft(args: {
    tenantId: string;
    dealId: string;
    items: Array<{ sku: string; quantity: number; unitPrice: number }>;
    discountTotal?: number;
    currency?: string;
    aiGenerated?: boolean;
    generatedByAgentId?: string;
  }) {
    if (!args.tenantId || args.tenantId === '*') {
      throw new ForbiddenException('tenantId "*" is forbidden');
    }
    let subtotal = 0;
    for (const i of args.items) subtotal += i.quantity * i.unitPrice;
    const discount = args.discountTotal ?? 0;
    const total = subtotal - discount;
    const quoteNumber = `Q-${Date.now()}-${simpleHash(args.dealId).toString(16).slice(0, 6)}`;
    return this.prisma.quote.create({
      data: {
        tenantId: args.tenantId,
        dealId: args.dealId,
        quoteNumber,
        items: args.items as unknown as Prisma.InputJsonValue,
        subtotal: new Prisma.Decimal(subtotal),
        discountTotal: new Prisma.Decimal(discount),
        total: new Prisma.Decimal(total),
        currency: args.currency ?? 'USD',
        aiGenerated: args.aiGenerated ?? false,
        generatedByAgentId: args.generatedByAgentId,
      },
    });
  }

  async approve(args: { tenantId: string; id: string; actorId: string }) {
    const quote = await this.prisma.quote.findUnique({ where: { id: args.id } });
    if (!quote) throw new NotFoundException('quote not found');
    if (quote.tenantId !== args.tenantId) {
      throw new ForbiddenException('quote belongs to a different tenant');
    }
    return this.prisma.quote.update({
      where: { id: args.id },
      data: {
        status: 'SENT',
        approvedByActorId: args.actorId,
        approvedAt: new Date(),
      },
    });
  }
}

// ─── Field sales assignments (§5.11.4) ─────────────────────────

@Injectable()
export class FieldSalesAssignmentService {
  private readonly logger = new Logger(FieldSalesAssignmentService.name);
  constructor(private readonly prisma: PrismaService) {}

  create(args: {
    tenantId: string;
    repId: string;
    subjectKind: 'account' | 'lead' | 'deal';
    subjectId: string;
    scheduledFor: Date;
    latitude?: number;
    longitude?: number;
    notes?: string;
  }) {
    return this.prisma.fieldSalesAssignment.create({
      data: {
        tenantId: args.tenantId,
        repId: args.repId,
        subjectKind: args.subjectKind,
        subjectId: args.subjectId,
        scheduledFor: args.scheduledFor,
        latitude: args.latitude,
        longitude: args.longitude,
        notes: args.notes,
      },
    });
  }

  list(tenantId: string, repId?: string) {
    return this.prisma.fieldSalesAssignment.findMany({
      where: { tenantId, ...(repId ? { repId } : {}) },
      orderBy: { scheduledFor: 'asc' },
    });
  }
}

// ─── Lead routing (§5.11.5) ───────────────────────────────────

@Injectable()
export class SalesLeadRoutingService {
  private readonly logger = new Logger(SalesLeadRoutingService.name);
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Pick a rep for a new lead using a deterministic skill match.
   * Phase 7.1 ships the stub: assign to the rep whose id hash is
   * closest to the lead id hash. Phase 7.5 wires the real ML scoring.
   */
  async route(args: {
    tenantId: string;
    leadId: string;
    candidateRepIds: string[];
    skills?: string[];
  }) {
    if (!args.tenantId || args.tenantId === '*') {
      throw new ForbiddenException('tenantId "*" is forbidden');
    }
    if (args.candidateRepIds.length === 0) return null;
    const leadHash = simpleHash(args.leadId);
    const chosen = args.candidateRepIds[leadHash % args.candidateRepIds.length];
    return this.prisma.salesLeadRoutingDecision.create({
      data: {
        tenantId: args.tenantId,
        leadId: args.leadId,
        chosenRepId: chosen,
        chosenQueue: null,
        score: 0.7,
        reason: `deterministic skill match (Phase 7.1 stub)`,
      },
    });
  }
}

// ─── Marketing events (§5.10.4) ──────────────────────────────

@Injectable()
export class EventService {
  private readonly logger = new Logger(EventService.name);
  constructor(private readonly prisma: PrismaService) {}

  create(args: {
    tenantId: string;
    slug: string;
    displayName: string;
    startsAt: Date;
    endsAt: Date;
    capacity?: number;
    venue?: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    if (!args.tenantId || args.tenantId === '*') {
      throw new ForbiddenException('tenantId "*" is forbidden');
    }
    return this.prisma.event.create({
      data: {
        tenantId: args.tenantId,
        slug: args.slug,
        displayName: args.displayName,
        startsAt: args.startsAt,
        endsAt: args.endsAt,
        capacity: args.capacity,
        venue: args.venue,
        metadata: args.metadata ?? {},
      },
    });
  }

  list(tenantId: string) {
    return this.prisma.event.findMany({
      where: { tenantId },
      orderBy: { startsAt: 'asc' },
    });
  }

  invite(args: { tenantId: string; eventId: string; contactId: string }) {
    return this.prisma.eventInvitation.create({
      data: {
        tenantId: args.tenantId,
        eventId: args.eventId,
        contactId: args.contactId,
      },
    });
  }
}

// ─── Marketing partners (§5.10.5) ──────────────────────────

@Injectable()
export class PartnerService {
  private readonly logger = new Logger(PartnerService.name);
  constructor(private readonly prisma: PrismaService) {}

  create(args: {
    tenantId: string;
    slug: string;
    displayName: string;
    contactEmail: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    if (!args.tenantId || args.tenantId === '*') {
      throw new ForbiddenException('tenantId "*" is forbidden');
    }
    return this.prisma.partner.create({
      data: {
        tenantId: args.tenantId,
        slug: args.slug,
        displayName: args.displayName,
        contactEmail: args.contactEmail,
        metadata: args.metadata ?? {},
      },
    });
  }

  shareLead(args: { tenantId: string; partnerId: string; leadId: string; notes?: string }) {
    return this.prisma.partnerLeadShare.create({
      data: {
        tenantId: args.tenantId,
        partnerId: args.partnerId,
        leadId: args.leadId,
        notes: args.notes,
      },
    });
  }
}

// ─── Customer intent signals (§5.10.1) ──────────────────────

@Injectable()
export class CustomerIntentService {
  private readonly logger = new Logger(CustomerIntentService.name);
  constructor(private readonly prisma: PrismaService) {}

  async record(args: {
    tenantId: string;
    customerId: string;
    source: string;
    intentKind: string;
    confidence: number;
    features?: Prisma.InputJsonValue;
  }) {
    if (!args.tenantId || args.tenantId === '*') {
      throw new ForbiddenException('tenantId "*" is forbidden');
    }
    if (args.confidence < 0 || args.confidence > 1) {
      throw new BadRequestException('confidence must be in [0, 1]');
    }
    return this.prisma.customerIntentSignal.create({
      data: {
        tenantId: args.tenantId,
        customerId: args.customerId,
        source: args.source,
        intentKind: args.intentKind,
        confidence: args.confidence,
        features: args.features ?? {},
      },
    });
  }
}
