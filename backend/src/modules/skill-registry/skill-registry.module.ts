/**
 * Phase 11 + Phase 12 — SkillRegistry module.
 *
 * SRP: this module owns wiring only. All implementations live in
 * the per-skill files alongside the executor and telemetry.
 *
 * DIP: every provider is consumed through its narrowest interface
 * (the executor's ISkill slot — Map<SkillId, ISkill>).
 *
 * Phase 12 — imports KnowledgeModule so SourceRefResolverRegistry
 * (record / thread / file resolvers) is available when the executor
 * routes non-text SourceRefs through.
 */

import { Global, Module, OnModuleInit, Logger } from '@nestjs/common';
import { AIGatewayModule } from '../ai-gateway/ai-gateway.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { MarketingModule } from '../marketing/marketing.module';
import { ServiceModule } from '../service/service.module';
import { ChannelsModule } from '../channels/channels.module';
import { CrmEventTriggerService } from '../channels/crm/crm-event-trigger.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { SkillExecutor } from './skill-executor.service';
import { SkillRegistry } from './skill-registry.service';
import { SkillTelemetry } from './skill-telemetry';
import {
  SummarizeSkill,
  RewriteSkill,
  TranslateSkill,
  ExtractSkill,
  CompareSkill,
  DraftReportSkill,
  DraftEmailSkill,
  ArticleDraftSkill,
  KnowledgeHealthSkill,
  NlDraftSkill,
  SegmentSkill,
  CampaignBriefSkill,
  CaseResolveSkill,
  CaseResponseSkill,
  CrmEventSkill,
  CrmWebhookSkill,
} from './skills';

const ALL_SKILLS_FACTORY = (prisma: PrismaService, crmTrigger: CrmEventTriggerService) => [
  new SummarizeSkill(),
  new RewriteSkill(),
  new TranslateSkill(),
  new ExtractSkill(),
  new CompareSkill(),
  new DraftReportSkill(),
  new DraftEmailSkill(),
  // Phase 12 — generative skills grounded in the knowledge corpus.
  new ArticleDraftSkill(),
  new KnowledgeHealthSkill(),
  // Phase 13 — NL-driven skill graph drafting (never activates).
  new NlDraftSkill(),
  // Phase 19 — Marketing skills.
  new SegmentSkill(prisma),
  new CampaignBriefSkill(),
  new CaseResponseSkill(),
  // Phase 20 — CRM event skills.
  new CrmEventSkill(crmTrigger),
  new CrmWebhookSkill(crmTrigger),
];

@Global()
@Module({
  imports: [AIGatewayModule, KnowledgeModule, MarketingModule, ServiceModule, ChannelsModule],
  providers: [
    SkillExecutor,
    SkillTelemetry,
    SkillRegistry,
    CaseResolveSkill,
    {
      provide: 'SKILL_FACTORY',
      useFactory: (prisma: PrismaService, crmTrigger: CrmEventTriggerService) =>
        ALL_SKILLS_FACTORY(prisma, crmTrigger),
      inject: [PrismaService, CrmEventTriggerService],
    },
  ],
  exports: [SkillRegistry, SkillExecutor, SkillTelemetry],
})
export class SkillRegistryModule implements OnModuleInit {
  private readonly logger = new Logger(SkillRegistryModule.name);

  constructor(
    private readonly registry: SkillRegistry,
    private readonly prisma: PrismaService,
    private readonly caseResolve: CaseResolveSkill,
    private readonly crmTrigger: CrmEventTriggerService,
  ) {}

  onModuleInit(): void {
    const all = ALL_SKILLS_FACTORY(this.prisma, this.crmTrigger);
    for (const skill of all) {
      this.registry.register(skill);
    }
    this.registry.register(this.caseResolve);
    this.logger.log(`skill-registry: registered ${all.length + 1} skills`);
  }
}
