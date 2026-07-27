// src/common/logging/logging.module.ts
import { Global, Module } from '@nestjs/common';
import { CorrelationLogger } from './correlation-logger.service';
import { Phase8CorrelationLogger } from './phase8-correlation-logger';

@Global()
@Module({
  providers: [CorrelationLogger, Phase8CorrelationLogger],
  exports: [CorrelationLogger, Phase8CorrelationLogger],
})
export class LoggingModule {}
