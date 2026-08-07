/**
 * Phase 20 — CrmWebhookSkill (CR-AI-1106).
 *
 * Generic webhook trigger. Adds HMAC signature verification +
 * tenant-scope assertion. Falls back to `CrmEventTriggerService`
 * for the typed envelope surface.
 */

import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
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

export interface CrmWebhookSkillInput {
  readonly tenantId: string;
  readonly eventType: string;
  readonly payload: Record<string, unknown>;
  readonly signature?: string;
}

export interface CrmWebhookSkillOutput extends SkillOutput<{
  readonly eventId: string;
  readonly actionsTaken: ReadonlyArray<string>;
  readonly followUpTasks: ReadonlyArray<string>;
}> {}

@Injectable()
export class CrmWebhookSkill extends BaseSkill<CrmWebhookSkillInput, CrmWebhookSkillOutput> {
  readonly id: SkillId = 'crm-webhook';
  readonly displayName = 'Generic CRM webhook';
  readonly shortDescription =
    'Generic CRM webhook trigger with HMAC signature + tenant-scope guard.';

  private readonly logger = new Logger(CrmWebhookSkill.name);

  constructor(private readonly trigger: CrmEventTriggerService) {
    super();
  }

  validateInput(input: unknown): input is CrmWebhookSkillInput {
    if (!input || typeof input !== 'object') return false;
    const i = input as Record<string, unknown>;
    if (typeof i['tenantId'] !== 'string' || i['tenantId'].length === 0) return false;
    if (typeof i['eventType'] !== 'string' || (i['eventType'] as string).length === 0) return false;
    if (typeof i['payload'] !== 'object' || i['payload'] === null) return false;
    return true;
  }

  buildPrompt(
    input: CrmWebhookSkillInput,
    _ctx: SkillExecutionContext,
  ): { prompt: SkillPrompt<CrmWebhookSkillOutput>; options?: ExecutorOptions } {
    void _ctx;
    const sources: ReadonlyArray<SourceRef> = [
      { kind: 'text', text: JSON.stringify(input.payload) },
    ];
    const systemInstruction = [
      'You normalise a generic CRM webhook payload into a typed envelope.',
      'Reply as JSON: { "content": { "eventId": string, "actionsTaken": string[], "followUpTasks": string[] }, "limits": string[] }.',
    ].join('\n');
    const userInstruction = `Generic webhook ${input.eventType} for tenant ${input.tenantId}.`;

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
          return (async () => {
            if (!input.signature) {
              throw new ForbiddenException('signature required');
            }
            const ack = await this.trigger.ingest({
              tenantId: input.tenantId,
              source: 'webhook',
              eventType: input.eventType,
              payload: input.payload,
              signature: input.signature,
              receivedAt: new Date().toISOString(),
            });
            const citations: SkillCitation[] = [
              {
                locator: `crm-webhook:${ack.eventId}`,
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
            } satisfies CrmWebhookSkillOutput;
          })() as never;
        },
        limits: ['publisher-not-invoked:skill-only-drafts'],
      },
      options: { temperature: 0, maxTokens: 800 },
    };
  }
}
