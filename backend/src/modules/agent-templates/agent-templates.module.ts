import { Module } from '@nestjs/common';
import { AgentTemplatesService } from './agent-templates.service';
import { AgentTemplatesController } from './agent-templates.controller';
import { AgentSkillsController } from './agent-skills.controller';
import { AgentTemplateVersionRepository } from './agent-template-version.repository';
import { AgentSkillDefinitionRepository } from './agent-skill-definition.repository';
import { AgentTemplateCertificationRepository } from './agent-template-certification.repository';
import { AgentLifecycleAuditRepository } from './agent-lifecycle-audit.repository';
import { AgentTemplateLifecycleService } from './agent-template-lifecycle.service';
import { AgentSkillBuilderService } from './agent-skill-builder.service';

@Module({
  controllers: [AgentTemplatesController, AgentSkillsController],
  providers: [
    AgentTemplatesService,
    AgentTemplateVersionRepository,
    AgentSkillDefinitionRepository,
    AgentTemplateCertificationRepository,
    AgentLifecycleAuditRepository,
    AgentTemplateLifecycleService,
    AgentSkillBuilderService,
  ],
  exports: [
    AgentTemplatesService,
    AgentTemplateLifecycleService,
    AgentSkillBuilderService,
    AgentTemplateVersionRepository,
    AgentSkillDefinitionRepository,
    AgentTemplateCertificationRepository,
    AgentLifecycleAuditRepository,
  ],
})
export class AgentTemplatesModule {}
