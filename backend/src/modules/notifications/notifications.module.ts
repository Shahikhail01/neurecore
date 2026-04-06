import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './services/notifications.service';
import { EventsModule } from '../events/events.module';
import { TelegramService } from './services/telegram.service';
import { TelegramController } from './telegram.controller';

@Module({
  imports: [EventsModule, ConfigModule],
  controllers: [NotificationsController, TelegramController],
  providers: [NotificationsService, TelegramService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
