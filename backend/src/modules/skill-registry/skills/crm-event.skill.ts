/**
 * Phase 20 — CrmEventSkill (CR-AI-1106).
 *
 * Wraps CrmEventTriggerService into the SkillRegistry pipeline so
 * chat dispatch can trigger CRM-event actions via /crm-event.
 */

import { Injectable, Logger } from '@nestjs/common';
import { BaseSkill } from '../../skill-registry/skills/base.skill';
import { SkillId, SkillExecutionContext } from '../../skill-registry/interfaces/skill.interface';
import {
  SourceRef,
  SkillCitation,
  SkillOutput,
} from '../../skill-registry/interfaces/skill.types';
import { SkillPrompt, parseTextReply } from '../../skill-registry/skill-prompt';
import { ExecutorOptions } from '../../skill-registry/skill-executor.service';
import { CrmEventTriggerService } from '../../channels/crm/crm-event-trigger.service';

export interface CrmEventSkillInput {
  readonly tenantId: string;
  readonly source: 'hubspot' | 'salesforce' | 'webhook';
  readonly eventType: string;
  readonly payload: Record<string, unknown>;
}

export interface CrmEventSkillOutput extends SkillOutput<{
  readonly eventId: string;
  readonly actionsTaken: ReadonlyArray<string>;
  readonly followUpTasks: ReadonlyArray<string>;
}> {}

@Injectable()
export class CrmEventSkill extends BaseSkill<CrmEventSkillInput, CrmEventSkillOutput> {
  readonly id: SkillId = 'crm-event';
  readonly displayName = 'CRM event trigger';
  readonly shortDescription =
    'CRM event-driven skill (HubSpot / Salesforce / generic webhook) — emits actions + follow-up tasks.';

  private readonly logger = new Logger(CrmEventSkill.name);

  constructor(private readonly trigger: CrmEventTriggerService) {
    super();
  }

  validateInput(input: unknown): input is CrmEventSkillInput {
    if (!input || typeof input !== 'object') return false;
    const i = input as Record<string, unknown>;
    if (typeof i['tenantId'] !== 'string' || i['tenantId'].length === 0) return false;
    if (
      i['source'] !== 'hubspot' &&
      i['source'] !== 'salesforce' &&
      i['source'] !== 'webhook'
    ) {
      return false;
    }
    if (typeof i['eventType'] !== 'string' || (i['eventType'] as string).length === 0) return false;
    if (typeof i['payload'] !== 'object' || i['payload'] === null) return false;
    return true;
  }

  buildPrompt(
    input: CrmEventSkillInput,
    _ctx: SkillExecutionContext,
  ): { prompt: SkillPrompt<CrmEventSkillOutput>; options?: ExecutorOptions } {
    void _ctx;
    const sources: ReadonlyArray<SourceRef> = [
      { kind: 'text', text: JSON.stringify(input.payload) },
    ];
    const systemInstruction = [
      'You normalise a CRM event payload into a typed actions envelope.',
      'Reply as JSON: { "content": { "eventId": string, "actionsTaken": string[], "followUpTasks": string[] }, "limits": string[] }.',
    ].join('\n');
    const userInstruction = `CRM event ${input.source}/${input.eventType} for tenant ${input.tenantId}.`;

    return {
      prompt: {
        skillId: this.id,
        capability: 'reasoning',
        systemInstruction,
        userInstruction,
        sources,
        responseJsonRequired: true,
        parse: (raw: string) => {
          const { content: text, limits } = parseTextReply(raw);
          // Always delegate to the trigger for the canonical envelope —
          // the model may *augment* the surface but cannot invent ids
          // that conflict with the typed eventId contract.
          return (async () => {
            const ack = await this.trigger.ingest({
              tenantId: input.tenantId,
              source: input.source,
              eventType: input.eventType,
              payload: input.payload,
              receivedAt: new Date().toISOString(),
            });
            const citations: SkillCitation[] = [
              {
                locator: `crm-event:${ack.eventId}`,
                quote: text.slice(0, 200),
              },
            ];
            return {
              content: {
                eventId: ack.eventId,
                actionsTaken: ack.actionsTaken,
                followUpTasks: ack.followUpTasks,
              },
              citations,
              limits,
              confidence: 0.9,
              durationMs: 0,
              skillId: this.id,
            } satisfies CrmEventSkillOutput;
          })() as never;
        },
        limits: ['publisher-not-invoked:skill-only-drafts'],
      },
      options: { temperature: 0, maxTokens: 800 },
    };
  }
}
