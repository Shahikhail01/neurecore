/**
 * Localization — Module.
 */

import { Module } from '@nestjs/common';
import { LocalizationService } from './localization.service';
import { LocalizationController } from './localization.controller';
import { UserLocaleService } from './user-locale.service';

@Module({
  controllers: [LocalizationController],
  providers: [LocalizationService, UserLocaleService],
  exports: [LocalizationService, UserLocaleService],
})
export class LocalizationModule {}
