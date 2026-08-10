import { Injectable } from '@nestjs/common';
import { SkillRuntimeToolAdapter } from './skill-runtime-tool.adapter';
import { SkillRegistry } from '../../skill-registry/skill-registry.service';

@Injectable()
export class SummarizeSkillTool extends SkillRuntimeToolAdapter {
  constructor(registry: SkillRegistry) {
    super(
      'skill.summarize',
      'skills',
      'Summarize a document, thread, record, or inline text. Accepts source, optional maxLength, tone (bullets|narrative), and locale.',
      'summarize',
      registry,
    );
  }

  validateInput(input: Record<string, unknown>): void {
    // Must have a source (file, record, thread, or inline text).
    const source = input['source'];
    if (!source || typeof source !== 'object') {
      throw new Error(
        'skill.summarize requires "source": { kind: "file"|"record"|"thread"|"text", ... }',
      );
    }
    const src = source as Record<string, unknown>;
    if (!src['kind'] || typeof src['kind'] !== 'string') {
      throw new Error(
        'skill.summarize source must include "kind" (file|record|thread|text)',
      );
    }
    // Validate id fields per kind
    if (src['kind'] === 'file' && typeof src['fileId'] !== 'string') {
      throw new Error('skill.summarize source kind=file requires "fileId" string');
    }
    if (src['kind'] === 'record') {
      if (typeof src['recordType'] !== 'string' || typeof src['recordId'] !== 'string') {
        throw new Error('skill.summarize source kind=record requires "recordType" and "recordId"');
      }
    }
    if (src['kind'] === 'thread' && typeof src['threadId'] !== 'string') {
      throw new Error('skill.summarize source kind=thread requires "threadId" string');
    }
    if (src['kind'] === 'text' && typeof src['text'] !== 'string') {
      throw new Error('skill.summarize source kind=text requires "text" string');
    }
    // Optional fields are passed through to SkillRegistry — it validates them.
  }
}
