import { Injectable } from '@nestjs/common';
import { SkillRuntimeToolAdapter } from './skill-runtime-tool.adapter';
import { SkillRegistry } from '../../skill-registry/skill-registry.service';

@Injectable()
export class DraftReportSkillTool extends SkillRuntimeToolAdapter {
  constructor(registry: SkillRegistry) {
    super(
      'skill.draft_report',
      'skills',
      'Draft a structured report on a topic backed by source references. Requires topic and sources (array of SourceRefs), optional sections, format (markdown|html|plain), and locale.',
      'draft-report',
      registry,
    );
  }

  validateInput(input: Record<string, unknown>): void {
    const topic = input['topic'];
    if (typeof topic !== 'string' || topic.trim() === '') {
      throw new Error('skill.draft_report requires non-empty string "topic"');
    }
    const sources = input['sources'];
    if (!Array.isArray(sources) || sources.length === 0) {
      throw new Error(
        'skill.draft_report requires non-empty array "sources" of SourceRef objects',
      );
    }
    for (let i = 0; i < sources.length; i++) {
      const s = sources[i] as Record<string, unknown> | undefined;
      if (!s || typeof s !== 'object' || !s['kind'] || typeof s['kind'] !== 'string') {
        throw new Error(
          `skill.draft_report sources[${i}] must be an object with "kind" (file|record|thread|text)`,
        );
      }
    }
  }
}
