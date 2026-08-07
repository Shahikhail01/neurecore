/**
 * Phase 20 — Channels module.
 *
 * Composes the typed channel surfaces:
 *   - SlackAdapterService          (CR-AI-1105 — typed OUT_OF_SCOPE)
 *   - CrmEventTriggerService       (CR-AI-1106)
 *
 * The Outlook / Teams / Gmail / Google Calendar adapters are already
 * mounted via existing modules (Phase 4-5 P5). This module is the
 * home for new channels as they come in scope.
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { SlackAdapterService } from './slack/slack-adapter.service';
import { CrmEventTriggerService } from './crm/crm-event-trigger.service';

@Module({
  imports: [DatabaseModule],
  providers: [SlackAdapterService, CrmEventTriggerService],
  exports: [SlackAdapterService, CrmEventTriggerService],
})
export class ChannelsModule {}
