/**
 * Logger Implementation
 * SOLID: Dependency Inversion - Services depend on ILogger, not this class
 * Location: src/infrastructure/logger.ts
 */

import { Injectable, Logger } from '@nestjs/common';
import { ILogger } from '../domain/interfaces';

@Injectable()
export class NestJSLogger implements ILogger {
  private logger = new Logger();

  info(message: string, context?: Record<string, unknown>): void {
    this.logger.log(message, JSON.stringify(context || {}));
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.logger.warn(message, JSON.stringify(context || {}));
  }

  error(
    message: string,
    error: Error,
    context?: Record<string, unknown>,
  ): void {
    this.logger.error(message, error.stack);
    if (context) {
      this.logger.error('Context:', JSON.stringify(context));
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.logger.debug(message, JSON.stringify(context || {}));
  }
}
