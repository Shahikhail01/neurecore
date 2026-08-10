import {
  Injectable,
  Inject,
  OnApplicationBootstrap,
  Logger,
} from '@nestjs/common';
import { TOOL_REGISTRY, type IToolRegistry } from '../../work-runtime/contracts/work-runtime.interface';
import { SkillRegistry } from '../../skill-registry/skill-registry.service';
import { SummarizeSkillTool } from './skill-summarize.adapter';
import { ExtractSkillTool } from './skill-extract.adapter';
import { CompareSkillTool } from './skill-compare.adapter';
import { DraftReportSkillTool } from './skill-draft-report.adapter';
import { ReportSaveDraftTool } from './report-save-draft.adapter';
import { ARTIFACT_STORAGE, type IArtifactStorage } from '../contracts/artifact-storage.interface';

/**
 * Registers read-only skill-backed RuntimeTools at bootstrap so the planner
 * can reference them without touching legacy tool dispatch.
 *
 * Each adapter wraps one SkillRegistry entry, validates typed input, builds
 * tenant-scoped SourceRefs, and returns content, confidence, citations, and
 * limits — all without any external side effect.
 */
@Injectable()
export class SkillRuntimeToolsProvider implements OnApplicationBootstrap {
  private readonly logger = new Logger(SkillRuntimeToolsProvider.name);

  constructor(
    @Inject(TOOL_REGISTRY) private readonly tools: IToolRegistry,
    private readonly registry: SkillRegistry,
    @Inject(ARTIFACT_STORAGE) private readonly storage: IArtifactStorage,
  ) {}

  onApplicationBootstrap(): void {
    const skillTools = [
      new SummarizeSkillTool(this.registry),
      new ExtractSkillTool(this.registry),
      new CompareSkillTool(this.registry),
      new DraftReportSkillTool(this.registry),
      new ReportSaveDraftTool(this.storage),
    ];

    for (const tool of skillTools) {
      this.tools.register(tool);
      this.logger.log(
        `Registered skill tool: ${tool.name} (${tool.capability}, ${tool.effect})`,
      );
    }

    this.logger.log(
      `Skill tools registered: ${skillTools.map((t) => t.name).join(', ')}`,
    );
  }
}
