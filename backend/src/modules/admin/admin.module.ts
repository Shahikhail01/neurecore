/**
 * AdminModule — platform-admin-only endpoints.
 *
 * Currently hosts:
 *   - AdminSidecarsController → GET /api/v1/admin/sidecars/status
 *
 * Plan ref: NC-ACCT-IMP-1 §10 (cert gate). Restricted to PLATFORM_ADMIN /
 * SUPER_ADMIN roles via the global RolesGuard + @Roles decorator.
 */

import { Module } from '@nestjs/common';
import { AdminSidecarsController } from './admin-sidecars.controller';

@Module({
  controllers: [AdminSidecarsController],
})
export class AdminModule {}