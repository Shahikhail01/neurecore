import { Injectable } from '@nestjs/common';
import { SkillRuntimeToolAdapter } from './skill-runtime-tool.adapter';
import { SkillRegistry } from '../../skill-registry/skill-registry.service';

@Injectable()
export class ExtractSkillTool extends SkillRuntimeToolAdapter {
  constructor(registry: SkillRegistry) {
    super(
      'skill.extract',
      'skills',
      'Extract structured fields from a document, record, thread, or inline text. Requires source and schema (map of field names to { type, enum?, required?, pattern? }).',
      'extract',
      registry,
    );
  }

  validateInput(input: Record<string, unknown>): void {
    // Must have a source
    const source = input['source'];
    if (!source || typeof source !== 'object') {
      throw new Error(
        'skill.extract requires "source": { kind: "file"|"record"|"thread"|"text", ... }',
      );
    }
    const src = source as Record<string, unknown>;
    if (!src['kind'] || typeof src['kind'] !== 'string') {
      throw new Error(
        'skill.extract source must include "kind" (file|record|thread|text)',
      );
    }
    if (src['kind'] === 'file' && typeof src['fileId'] !== 'string') {
      throw new Error('skill.extract source kind=file requires "fileId" string');
    }
    if (src['kind'] === 'record') {
      if (typeof src['recordType'] !== 'string' || typeof src['recordId'] !== 'string') {
        throw new Error('skill.extract source kind=record requires "recordType" and "recordId"');
      }
    }
    if (src['kind'] === 'thread' && typeof src['threadId'] !== 'string') {
      throw new Error('skill.extract source kind=thread requires "threadId" string');
    }
    if (src['kind'] === 'text' && typeof src['text'] !== 'string') {
      throw new Error('skill.extract source kind=text requires "text" string');
    }
    // schema is technically optional — SkillRegistry will handle missing schema
  }
}
