/**
 * Phase 7 — Controller.
 *
 * Mounted under `/api/v1/phase7`:
 *   • Customer 360 (§5.9.1): /customer-360
 *   • Case triage (§5.9.2): /triage/*
 *   • Real-time agent guidance (§5.9.3): /guidance/*
 *   • Chatbot personas (§5.9.4): /chatbot-personas/*
 *   • Knowledge gaps (§5.9.8): /knowledge-gaps/*
 *   • Marketing extras (§5.10.4/5): /events/*, /partners/*
 *   • Customer intent (§5.10.1): /intent/*
 *   • Sales extras (§5.11.3/4/5): /quotes/*, /field-sales/*, /lead-routing/*
 *   • Governance authoring (§5.14.3): /governance/rules/*
 *   • Operational + Security + Internal (§5.14.8/9/12): /governance/probes/*
 *   • XAI explanations (§5.4.17): /xai/*
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Min,
  Max,
} from 'class-validator';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserRole, Prisma } from '@prisma/client';
import {
  CustomerTouchpointService,
  CaseTriageService,
  RealTimeGuidanceService,
  ChatbotPersonaService,
  KnowledgeGapService,
  QuoteService,
  FieldSalesAssignmentService,
  SalesLeadRoutingService,
  EventService,
  PartnerService,
  CustomerIntentService,
} from './service-ops-360.service';
import {
  CustomGovernanceControlService,
  OperationalGovernanceService,
  SecurityGovernanceService,
  InternalComplianceService,
} from '../governance/governance-authoring.service';
import { GovernanceCompositionService } from '../governance/governance-composition.service';
import { XaiService } from '../xai/xai.service';

class TouchpointIngestDto {
  @IsString() tenantId!: string;
  @IsString() customerId!: string;
  @IsString() channelKind!: string;
  @IsString() externalId!: string;
  @IsDateString() occurredAt!: string;
  @IsObject() @IsOptional() payload?: Record<string, unknown>;
  @IsArray() @IsOptional() tags?: string[];
}

class TriageRuleDto {
  @IsString() tenantId!: string;
  @IsString() @Length(1, 64) slug!: string;
  @IsString() displayName!: string;
  @IsString() @IsOptional() description?: string;
  @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']) priority!: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  @IsEnum(['AUTO_ROUTE_QUEUE', 'AUTO_ROUTE_OWNER', 'AUTO_PRIORITY', 'ESCALATE_HUMAN', 'REQUEST_INFO'])
  action!: 'AUTO_ROUTE_QUEUE' | 'AUTO_ROUTE_OWNER' | 'AUTO_PRIORITY' | 'ESCALATE_HUMAN' | 'REQUEST_INFO';
  @IsString() @IsOptional() targetQueue?: string;
  @IsString() @IsOptional() targetOwnerId?: string;
  @IsObject() @IsOptional() predicate?: Record<string, unknown>;
}

class TriageEvaluateDto {
  @IsString() tenantId!: string;
  @IsString() caseId!: string;
  @IsObject() payload!: Record<string, unknown>;
}

class GuidanceSuggestDto {
  @IsString() tenantId!: string;
  @IsString() caseId!: string;
  @IsString() agentId!: string;
}

class ChatbotPersonaDto {
  @IsString() tenantId!: string;
  @IsEnum(['SELF_SERVICE_24_7', 'SALES_ASSIST', 'SUPPORT_TIER_1', 'INTERNAL_HELPDESK'])
  kind!: 'SELF_SERVICE_24_7' | 'SALES_ASSIST' | 'SUPPORT_TIER_1' | 'INTERNAL_HELPDESK';
  @IsString() @Length(1, 64) slug!: string;
  @IsString() displayName!: string;
  @IsString() systemPrompt!: string;
  @IsArray() @IsOptional() allowedActionIds?: string[];
  @IsArray() @IsOptional() knowledgeCategories?: string[];
  @IsNumber() @Min(0) @Max(1) @IsOptional() escalationThreshold?: number;
}

class KnowledgeGapDto {
  @IsString() tenantId!: string;
  @IsArray() topics!: string[];
  @IsNumber() @Min(1) @IsOptional() caseCount?: number;
}

class QuoteDto {
  @IsString() tenantId!: string;
  @IsString() dealId!: string;
  @IsArray() items!: Array<{ sku: string; quantity: number; unitPrice: number }>;
  @IsNumber() @IsOptional() discountTotal?: number;
  @IsString() @IsOptional() currency?: string;
  @IsBoolean() @IsOptional() aiGenerated?: boolean;
  @IsString() @IsOptional() generatedByAgentId?: string;
}

class QuoteApproveDto {
  @IsString() tenantId!: string;
  @IsString() actorId!: string;
}

class FieldSalesDto {
  @IsString() tenantId!: string;
  @IsString() repId!: string;
  @IsEnum(['account', 'lead', 'deal']) subjectKind!: 'account' | 'lead' | 'deal';
  @IsString() subjectId!: string;
  @IsDateString() scheduledFor!: string;
  @IsNumber() @Min(-90) @Max(90) @IsOptional() latitude?: number;
  @IsNumber() @Min(-180) @Max(180) @IsOptional() longitude?: number;
  @IsString() @IsOptional() notes?: string;
}

class LeadRoutingDto {
  @IsString() tenantId!: string;
  @IsString() leadId!: string;
  @IsArray() candidateRepIds!: string[];
  @IsArray() @IsOptional() skills?: string[];
}

class EventDto {
  @IsString() tenantId!: string;
  @IsString() @Length(1, 64) slug!: string;
  @IsString() displayName!: string;
  @IsDateString() startsAt!: string;
  @IsDateString() endsAt!: string;
  @IsNumber() @IsOptional() capacity?: number;
  @IsString() @IsOptional() venue?: string;
  @IsObject() @IsOptional() metadata?: Record<string, unknown>;
}

class PartnerDto {
  @IsString() tenantId!: string;
  @IsString() @Length(1, 64) slug!: string;
  @IsString() displayName!: string;
  @IsString() contactEmail!: string;
  @IsObject() @IsOptional() metadata?: Record<string, unknown>;
}

class IntentDto {
  @IsString() tenantId!: string;
  @IsString() customerId!: string;
  @IsString() source!: string;
  @IsString() intentKind!: string;
  @IsNumber() @Min(0) @Max(1) confidence!: number;
  @IsObject() @IsOptional() features?: Record<string, unknown>;
}

class GovernanceRuleDto {
  @IsString() tenantId!: string;
  @IsString() @Length(1, 64) slug!: string;
  @IsString() displayName!: string;
  @IsString() description!: string;
  @IsEnum(['data', 'user-access', 'operational', 'security']) domain!: 'data' | 'user-access' | 'operational' | 'security';
  @IsArray() @IsOptional() standards?: string[];
  @IsObject() @IsOptional() predicate?: Record<string, unknown>;
}

class SecurityControlDto {
  @IsString() tenantId!: string;
  @IsString() controlKey!: string;
  @IsEnum(['enabled', 'disabled', 'misconfigured']) state!: 'enabled' | 'disabled' | 'misconfigured';
  @IsObject() @IsOptional() detail?: Record<string, unknown>;
}

class XaiRecordDto {
  @IsString() tenantId!: string;
  @IsString() executionId!: string;
  @IsString() reason!: string;
  @IsArray() factors!: Array<{ factor: string; value: number; weight: number }>;
  @IsObject() @IsOptional() decisionTrace?: Record<string, unknown>;
  @IsObject() @IsOptional() featureImportances?: Record<string, number>;
  @IsString() @IsOptional() modelId?: string;
}

class XaiWhyPanelDto {
  @IsString() tenantId!: string;
  @IsString() intent!: string;
  @IsArray() factors!: Array<{ factor: string; value: number }>;
}

@Controller({ path: 'phase7', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.AUDITOR,
  UserRole.PLATFORM_ADMIN,
  UserRole.SUPER_ADMIN,
)
export class Phase7Controller {
  constructor(
    private readonly touchpoints: CustomerTouchpointService,
    private readonly triage: CaseTriageService,
    private readonly guidance: RealTimeGuidanceService,
    private readonly personas: ChatbotPersonaService,
    private readonly gaps: KnowledgeGapService,
    private readonly quotes: QuoteService,
    private readonly field: FieldSalesAssignmentService,
    private readonly routing: SalesLeadRoutingService,
    private readonly events: EventService,
    private readonly partners: PartnerService,
    private readonly intents: CustomerIntentService,
    private readonly customGov: CustomGovernanceControlService,
    private readonly opsGov: OperationalGovernanceService,
    private readonly secGov: SecurityGovernanceService,
    private readonly intlComp: InternalComplianceService,
    private readonly composition: GovernanceCompositionService,
    private readonly xai: XaiService,
  ) {}

  // ─── Customer 360 (§5.9.1) ─────────────────────────────────────

  @Post('customer-360/ingest')
  @HttpCode(HttpStatus.CREATED)
  ingestTouchpoint(@Body() dto: TouchpointIngestDto) {
    return this.touchpoints.ingest({
      ...dto,
      occurredAt: new Date(dto.occurredAt),
      payload: (dto.payload ?? {}) as unknown as Prisma.InputJsonValue,
    });
  }

  @Get('customer-360')
  get360(
    @Query('tenantId') tenantId: string,
    @Query('customerId') customerId: string,
  ) {
    return this.touchpoints.get360View(tenantId, customerId);
  }

  // ─── Case triage / contact center (§5.9.2) ─────────────────

  @Post('triage/rules')
  @HttpCode(HttpStatus.CREATED)
  createRule(@Body() dto: TriageRuleDto) {
    return this.triage.createRule({
      ...dto,
      predicate: (dto.predicate ?? {}) as unknown as Prisma.InputJsonValue,
    });
  }

  @Get('triage/rules')
  listRules(@Query('tenantId') tenantId: string) {
    return this.triage.list(tenantId);
  }

  @Post('triage/evaluate')
  @HttpCode(HttpStatus.OK)
  evaluateTriage(@Body() dto: TriageEvaluateDto) {
    return this.triage.evaluate(dto);
  }

  // ─── Real-time agent guidance (§5.9.3) ─────────────────────

  @Post('guidance/suggest')
  @HttpCode(HttpStatus.CREATED)
  suggestGuidance(@Body() dto: GuidanceSuggestDto) {
    return this.guidance.suggest(dto);
  }

  @Post('guidance/:id/accept')
  @HttpCode(HttpStatus.OK)
  acceptGuidance(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: { tenantId: string },
  ) {
    return this.guidance.accept({ id, tenantId: dto.tenantId });
  }

  // ─── 24/7 self-service chatbot persona (§5.9.4) ───────────

  @Post('chatbot-personas')
  @HttpCode(HttpStatus.CREATED)
  createPersona(@Body() dto: ChatbotPersonaDto) {
    return this.personas.create(dto);
  }

  @Get('chatbot-personas')
  listPersonas(@Query('tenantId') tenantId: string) {
    return this.personas.list(tenantId);
  }

  @Get('chatbot-personas/resolve')
  resolvePersona(
    @Query('tenantId') tenantId: string,
    @Query('intentKind') intentKind?: string,
  ) {
    return this.personas.resolve({ tenantId, intentKind });
  }

  // ─── Knowledge self-curation (§5.9.8) ─────────────────────

  @Post('knowledge-gaps')
  @HttpCode(HttpStatus.CREATED)
  detectGaps(@Body() dto: KnowledgeGapDto) {
    return this.gaps.detect({ tenantId: dto.tenantId, topics: dto.topics, caseCount: dto.caseCount });
  }

  @Get('knowledge-gaps')
  listGaps(@Query('tenantId') tenantId: string, @Query('status') status?: string) {
    return this.gaps.list(tenantId, status);
  }

  // ─── Marketing extras (§5.10.4 / §5.10.5) ─────────────────

  @Post('events')
  @HttpCode(HttpStatus.CREATED)
  createEvent(@Body() dto: EventDto) {
    return this.events.create({
      ...dto,
      startsAt: new Date(dto.startsAt),
      endsAt: new Date(dto.endsAt),
      metadata: (dto.metadata ?? {}) as unknown as Prisma.InputJsonValue,
    });
  }

  @Get('events')
  listEvents(@Query('tenantId') tenantId: string) {
    return this.events.list(tenantId);
  }

  @Post('events/:id/invite')
  @HttpCode(HttpStatus.CREATED)
  inviteEvent(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { tenantId: string; contactId: string },
  ) {
    return this.events.invite({ tenantId: body.tenantId, eventId: id, contactId: body.contactId });
  }

  @Post('partners')
  @HttpCode(HttpStatus.CREATED)
  createPartner(@Body() dto: PartnerDto) {
    return this.partners.create({
      ...dto,
      metadata: (dto.metadata ?? {}) as unknown as Prisma.InputJsonValue,
    });
  }

  @Post('partners/:id/share-lead')
  @HttpCode(HttpStatus.CREATED)
  shareLead(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { tenantId: string; leadId: string; notes?: string },
  ) {
    return this.partners.shareLead({
      tenantId: body.tenantId,
      partnerId: id,
      leadId: body.leadId,
      notes: body.notes,
    });
  }

  // ─── Customer intent signals (§5.10.1) ────────────────────

  @Post('intent')
  @HttpCode(HttpStatus.CREATED)
  recordIntent(@Body() dto: IntentDto) {
    return this.intents.record({
      ...dto,
      features: (dto.features ?? {}) as unknown as Prisma.InputJsonValue,
    });
  }

  // ─── Sales extras (§5.11.3/4/5) ────────────────────────────

  @Post('quotes')
  @HttpCode(HttpStatus.CREATED)
  createQuote(@Body() dto: QuoteDto) {
    return this.quotes.createDraft(dto);
  }

  @Post('quotes/:id/approve')
  @HttpCode(HttpStatus.OK)
  approveQuote(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: QuoteApproveDto,
  ) {
    return this.quotes.approve({ id, tenantId: dto.tenantId, actorId: dto.actorId });
  }

  @Post('field-sales')
  @HttpCode(HttpStatus.CREATED)
  createFieldSales(@Body() dto: FieldSalesDto) {
    return this.field.create({
      ...dto,
      scheduledFor: new Date(dto.scheduledFor),
    });
  }

  @Get('field-sales')
  listFieldSales(@Query('tenantId') tenantId: string, @Query('repId') repId?: string) {
    return this.field.list(tenantId, repId);
  }

  @Post('lead-routing')
  @HttpCode(HttpStatus.CREATED)
  routeLead(@Body() dto: LeadRoutingDto) {
    return this.routing.route(dto);
  }

  // ─── Governance authoring (§5.14.3) ──────────────────────

  @Post('governance/rules')
  @HttpCode(HttpStatus.CREATED)
  createGovernanceRule(@Body() dto: GovernanceRuleDto) {
    return this.customGov.create({
      ...dto,
      predicate: (dto.predicate ?? {}) as unknown as Prisma.InputJsonValue,
    });
  }

  @Get('governance/rules')
  listGovRules(@Query('tenantId') tenantId: string, @Query('domain') domain?: string) {
    return this.customGov.list(tenantId, domain);
  }

  // ─── Operational (§5.14.8) ─────────────────────────────────

  @Post('governance/probes/operational/run')
  @HttpCode(HttpStatus.OK)
  runOperational(@Body() body: { tenantId: string }) {
    return this.opsGov.runAll(body.tenantId);
  }

  @Get('governance/probes/operational')
  listOperational(@Query('tenantId') tenantId: string, @Query('severity') severity?: string) {
    return this.opsGov.list(tenantId, severity);
  }

  // ─── Security (§5.14.9) ──────────────────────────────────

  @Post('governance/probes/security')
  @HttpCode(HttpStatus.OK)
  setSecurityControl(@Body() dto: SecurityControlDto) {
    return this.secGov.setState({
      ...dto,
      detail: (dto.detail ?? {}) as unknown as Prisma.InputJsonValue,
    });
  }

  @Get('governance/probes/security')
  listSecurityControls(@Query('tenantId') tenantId: string) {
    return this.secGov.list(tenantId);
  }

  // ─── Internal compliance (§5.14.12) ─────────────────────

  @Post('governance/probes/internal/run')
  @HttpCode(HttpStatus.OK)
  runInternal(@Body() body: { tenantId: string }) {
    return this.intlComp.runAll(body.tenantId);
  }

  @Get('governance/probes/internal')
  listInternal(@Query('tenantId') tenantId: string, @Query('category') category?: string) {
    return this.intlComp.list(tenantId, category);
  }

  // ─── XAI (§5.4.17) ──────────────────────────────────────

  @Post('xai/explanations')
  @HttpCode(HttpStatus.CREATED)
  recordExplanation(@Body() dto: XaiRecordDto) {
    return this.xai.record(dto);
  }

  @Post('xai/why-panel')
  @HttpCode(HttpStatus.OK)
  whyPanel(@Body() dto: XaiWhyPanelDto) {
    return this.xai.whyPanel(dto);
  }

  @Get('xai/explanations/:executionId')
  findExplanation(
    @Query('tenantId') tenantId: string,
    @Param('executionId') executionId: string,
  ) {
    return this.xai.findForExecution(tenantId, executionId);
  }

  // ─── No-code governance composition (§5.4.16) ─────────────

  @Get('governance/composition')
  governanceComposition(@Query('tenantId') tenantId: string) {
    return this.composition.compose(tenantId);
  }
}
