import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { AgentTemplatesService } from './agent-templates.service';
import { AgentTemplatesController } from './agent-templates.controller';
import { AgentSkillsController } from './agent-skills.controller';
import { AgentTemplateVersionRepository } from './agent-template-version.repository';
import { AgentSkillDefinitionRepository } from './agent-skill-definition.repository';
import { AgentTemplateCertificationRepository } from './agent-template-certification.repository';
import { AgentLifecycleAuditRepository } from './agent-lifecycle-audit.repository';
import { AgentTemplateLifecycleService } from './agent-template-lifecycle.service';
import { AgentSkillBuilderService } from './agent-skill-builder.service';
import { OobAgentRegistrationService } from './services/oob-agent-registration.service';
import { SkillGraphService } from './services/skill-graph.service';
import {
  NlDraftService,
  DeterministicDraftSynthesizer,
  DRAFT_SYNTHESIZER,
} from './services/nl-draft.service';
import { SkillSimulationService } from './services/skill-simulation.service';
import { SkillVersionDiffService } from './services/skill-version-diff.service';
import {
  SkillGraphRepository,
  SKILL_GRAPH_REPOSITORY,
} from './services/skill-graph.repository';
import {
  SkillPreviewService,
  SKILL_PREVIEW_SERVICE,
} from './services/skill-preview.service';
import { SkillComposerController } from './controllers/skill-composer.controller';
import { AgentCatalogController } from './controllers/agents.controller';
import { AgentRegistry } from './agents.registry';

@Module({
  imports: [DatabaseModule],
  controllers: [
    AgentTemplatesController,
    AgentSkillsController,
    SkillComposerController,
    AgentCatalogController,
  ],
  providers: [
    AgentRegistry,
    AgentTemplatesService,
    AgentTemplateVersionRepository,
    AgentSkillDefinitionRepository,
    AgentTemplateCertificationRepository,
    AgentLifecycleAuditRepository,
    AgentTemplateLifecycleService,
    AgentSkillBuilderService,
    OobAgentRegistrationService,
    SkillGraphService,
    NlDraftService,
    SkillSimulationService,
    SkillVersionDiffService,
    SkillGraphRepository,
    { provide: SKILL_GRAPH_REPOSITORY, useExisting: SkillGraphRepository },
    SkillPreviewService,
    { provide: SKILL_PREVIEW_SERVICE, useExisting: SkillPreviewService },
    DeterministicDraftSynthesizer,
    { provide: DRAFT_SYNTHESIZER, useExisting: DeterministicDraftSynthesizer },
  ],
  exports: [
    AgentRegistry,
    AgentTemplatesService,
    AgentTemplateLifecycleService,
    AgentSkillBuilderService,
    OobAgentRegistrationService,
    SkillGraphService,
    NlDraftService,
    SkillSimulationService,
    SkillVersionDiffService,
    SkillGraphRepository,
    SkillPreviewService,
    AgentTemplateVersionRepository,
    AgentSkillDefinitionRepository,
    AgentTemplateCertificationRepository,
    AgentLifecycleAuditRepository,
  ],
})
export class AgentTemplatesModule {}
