import { Injectable } from '@nestjs/common';
import { SkillRuntimeToolAdapter } from './skill-runtime-tool.adapter';
import { SkillRegistry } from '../../skill-registry/skill-registry.service';

@Injectable()
export class CompareSkillTool extends SkillRuntimeToolAdapter {
  constructor(registry: SkillRegistry) {
    super(
      'skill.compare',
      'skills',
      'Compare two documents, records, threads, or inline texts. Requires left and right SourceRefs, optional dimensions and locale.',
      'compare',
      registry,
    );
  }

  validateInput(input: Record<string, unknown>): void {
    const left = input['left'];
    const right = input['right'];
    if (!left || typeof left !== 'object') {
      throw new Error(
        'skill.compare requires "left": { kind: "file"|"record"|"thread"|"text", ... }',
      );
    }
    if (!right || typeof right !== 'object') {
      throw new Error(
        'skill.compare requires "right": { kind: "file"|"record"|"thread"|"text", ... }',
      );
    }
    const validateSource = (side: string, src: Record<string, unknown>) => {
      if (!src['kind'] || typeof src['kind'] !== 'string') {
        throw new Error(`skill.compare ${side} must include "kind" (file|record|thread|text)`);
      }
      if (src['kind'] === 'file' && typeof src['fileId'] !== 'string') {
        throw new Error(`skill.compare ${side} kind=file requires "fileId" string`);
      }
      if (src['kind'] === 'record') {
        if (typeof src['recordType'] !== 'string' || typeof src['recordId'] !== 'string') {
          throw new Error(`skill.compare ${side} kind=record requires "recordType" and "recordId"`);
        }
      }
      if (src['kind'] === 'thread' && typeof src['threadId'] !== 'string') {
        throw new Error(`skill.compare ${side} kind=thread requires "threadId" string`);
      }
      if (src['kind'] === 'text' && typeof src['text'] !== 'string') {
        throw new Error(`skill.compare ${side} kind=text requires "text" string`);
      }
    };
    validateSource('left', left as Record<string, unknown>);
    validateSource('right', right as Record<string, unknown>);
  }
}
