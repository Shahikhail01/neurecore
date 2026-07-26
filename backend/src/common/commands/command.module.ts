// src/common/commands/command.module.ts
import { Global, Module } from '@nestjs/common';
import { CommandRegistry } from './command.registry';
import { CommandIdempotencyModule } from '../idempotency/command-idempotency.module';

@Global()
@Module({
  imports: [CommandIdempotencyModule],
  providers: [CommandRegistry],
  exports: [CommandRegistry],
})
export class CommandModule {}
