/**
 * Inbox Module
 *
 * Unified inbox notifications for Paperclip integration
 * Following SOLID principles with proper dependency injection
 */

import { Module } from '@nestjs/common';
import { InboxController } from './inbox.controller';
import { InboxService } from './inbox.service';
import { PrismaInboxRepository } from './repositories/prisma-inbox.repository';
import { OpenClawInboxNotifier } from './notifiers/openclaw-inbox.notifier';
import { AIGatewayModule } from '../ai-gateway/ai-gateway.module';

@Module({
  imports: [AIGatewayModule],
  controllers: [InboxController],
  providers: [
    // Main service
    InboxService,

    // Repository
    PrismaInboxRepository,

    // Notifier (concrete)
    OpenClawInboxNotifier,

    // Notifier array token expected by InboxService
    {
      provide: 'INBOX_NOTIFIERS',
      useFactory: (openclaw: OpenClawInboxNotifier) => [openclaw],
      inject: [OpenClawInboxNotifier],
    },
  ],
  exports: [InboxService],
})
export class InboxModule {}
