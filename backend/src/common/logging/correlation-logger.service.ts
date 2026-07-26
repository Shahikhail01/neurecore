// src/common/logging/correlation-logger.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { CorrelationContext } from '../correlation/correlation.interface';

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

@Injectable()
export class CorrelationLogger {
  private readonly logger = new Logger(CorrelationLogger.name);

  logWithCorrelation(
    level: LogLevel,
    message: string,
    correlation: CorrelationContext,
    extra?: Record<string, unknown>,
  ): void {
    const logData = {
      level,
      message,
      tenantId: correlation.tenantId,
      correlationId: correlation.correlationId,
      causationId: correlation.causationId,
      actorId: correlation.actorId,
      actorType: correlation.actorType,
      searchableBy: [
        correlation.tenantId,
        correlation.correlationId,
        correlation.actorId,
      ],
      ...extra,
    };

    switch (level) {
      case LogLevel.DEBUG:
        this.logger.debug(JSON.stringify(logData));
        break;
      case LogLevel.INFO:
        this.logger.log(JSON.stringify(logData));
        break;
      case LogLevel.WARN:
        this.logger.warn(JSON.stringify(logData));
        break;
      case LogLevel.ERROR:
        this.logger.error(JSON.stringify(logData));
        break;
    }
  }
}
