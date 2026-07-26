// src/modules/tenant-flags/tenant-flags.module.ts
import { Module, Global } from '@nestjs/common';
import { TenantFlagsService } from './tenant-flags.service';
import { TenantFlagsController } from './tenant-flags.controller';

@Global()
@Module({
  controllers: [TenantFlagsController],
  providers: [TenantFlagsService],
  exports: [TenantFlagsService],
})
export class TenantFlagsModule {}
