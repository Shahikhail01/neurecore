/**
 * NocoBase Module
 *
 * Integrates NocoBase plugin system and schema management
 * into the NestJS backend application
 */

import { Module, OnModuleInit } from '@nestjs/common';
import { NocoBaseInitService } from './nocobase-init.service';
import { NocoBaseController } from './nocobase.controller';
import { DatabaseModule } from '../../infrastructure/database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [NocoBaseInitService],
  controllers: [NocoBaseController],
  exports: [NocoBaseInitService],
})
export class NocoBaseModule implements OnModuleInit {
  constructor(private readonly nocobaseInit: NocoBaseInitService) {}

  /**
   * Initialize NocoBase on module startup
   */
  async onModuleInit() {
    // Service is available for manual initialization
    // Allows flexibility in startup sequence
  }
}
