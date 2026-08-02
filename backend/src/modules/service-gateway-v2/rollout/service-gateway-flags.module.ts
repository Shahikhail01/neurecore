/**
 * ServiceGatewayFlagsModule — wires SloCounters + the flags service +
 * the admin controller.
 *
 * Phase 8 (NC-AWL-IMP-1 §11.3). Imported once from AppModule.
 *
 * Why this is its own module:
 *   - It exposes a /admin/service-gateway-v2/* surface that should be
 *     visible to platform-admins without dragging the full Service
 *     Gateway V2 router on the boot path of the admin tools.
 *   - It is the only place that holds the SLO counters; callers inject
 *     SloCounters via DI rather than reaching into module-private state.
 *
 * Dependencies:
 *   - DatabaseModule (Prisma) — optional. Without it the service runs
 *     in-memory only; tenant overrides become ephemeral and a warning
 *     is logged on every write. This keeps the module testable without
 *     a database fixture.
 *   - CacheModule (RedisService) — optional. When present, scalar
 *     counters are mirrored to Redis under `slo:gw-v2:*`.
 */

import { Module, Optional } from '@nestjs/common';
import { SloCounters } from './slo-counters';
import { ServiceGatewayFlagsService } from './service-gateway-flags';
import { ServiceGatewayFlagsController } from './service-gateway-flags.controller';
import { DatabaseModule } from '../../../infrastructure/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [ServiceGatewayFlagsController],
  providers: [
    SloCounters,
    ServiceGatewayFlagsService,
    {
      provide: 'SERVICE_GATEWAY_V2_FLAGS',
      useExisting: ServiceGatewayFlagsService,
    },
    {
      provide: 'SLO_COUNTERS',
      useExisting: SloCounters,
    },
  ],
  exports: [
    ServiceGatewayFlagsService,
    SloCounters,
    'SERVICE_GATEWAY_V2_FLAGS',
    'SLO_COUNTERS',
  ],
})
export class ServiceGatewayFlagsModule {
  constructor(
    @Optional() private readonly flags?: ServiceGatewayFlagsService,
  ) {}
}
