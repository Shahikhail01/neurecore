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
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { SlackAdapterService } from './slack/slack-adapter.service';
import { CrmEventTriggerService } from './crm/crm-event-trigger.service';
import { PrismaCrmEventStore } from './crm/prisma-crm-event.store';

@Module({
  imports: [DatabaseModule],
  providers: [
    SlackAdapterService,
    PrismaCrmEventStore,
    // DIP: the trigger depends on the ICrmEventStore port; production
    // wires the durable Prisma store (CR-AI-1106 persistence + replay).
    {
      provide: CrmEventTriggerService,
      useFactory: (
        prisma: PrismaService,
        store: PrismaCrmEventStore,
      ) => new CrmEventTriggerService(prisma, store),
      inject: [PrismaService, PrismaCrmEventStore],
    },
  ],
  exports: [SlackAdapterService, CrmEventTriggerService],
})
export class ChannelsModule {}
