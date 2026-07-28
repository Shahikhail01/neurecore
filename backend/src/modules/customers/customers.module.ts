/**
 * Customers Module — Wires up dependencies.
 */

import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { PrismaCustomerRepository } from './repositories/prisma-customer.repository';
import { CUSTOMER_REPOSITORY } from './interfaces/customer.interface';
// SIM-04 G-07 — TimelineService is required by the lifecycle subroute.
// We import TimelineModule so the TimelineService provider is available
// in the customers DI graph; the service itself resolves it lazily through
// ModuleRef to avoid a circular dep.
import { TimelineModule } from '../timeline/timeline.module';

@Module({
  imports: [TimelineModule],
  controllers: [CustomersController],
  providers: [
    CustomersService,
    {
      provide: CUSTOMER_REPOSITORY,
      useClass: PrismaCustomerRepository,
    },
  ],
  exports: [CustomersService, CUSTOMER_REPOSITORY],
})
export class CustomersModule {}
