// src/common/logging/logging.module.ts
import { Global, Module } from '@nestjs/common';
import { CorrelationLogger } from './correlation-logger.service';

@Global()
@Module({
  providers: [CorrelationLogger],
  exports: [CorrelationLogger],
})
export class LoggingModule {}
