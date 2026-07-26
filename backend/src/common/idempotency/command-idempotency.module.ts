// src/common/idempotency/command-idempotency.module.ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { PrismaIdempotencyRepository } from '../persistence/prisma-idempotency.repository';
import { CommandIdempotencyService } from './command-idempotency.service';

@Global()
@Module({
  providers: [
    PrismaService,
    PrismaIdempotencyRepository,
    CommandIdempotencyService,
  ],
  exports: [CommandIdempotencyService],
})
export class CommandIdempotencyModule {}
