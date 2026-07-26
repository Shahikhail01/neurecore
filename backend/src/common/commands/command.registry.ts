// src/common/commands/command.registry.ts
import { Injectable, Logger, Inject } from '@nestjs/common';
import type { CommandMetadata } from '../correlation/correlation.interface';
import type { IIdempotencyRepository } from '../idempotency/idempotency-repository.port';
import { IDEMPOTENCY_REPOSITORY } from '../ports/di-tokens';
import type {
  CommandDefinition,
  CommandHandlerFn,
  CommandResult,
} from './command.interface';

@Injectable()
export class CommandRegistry {
  private readonly logger = new Logger(CommandRegistry.name);
  private definitions: Map<string, CommandDefinition<any, any, any>> = new Map();

  constructor(@Inject(IDEMPOTENCY_REPOSITORY) private readonly idempotency: IIdempotencyRepository) {}

  register<TInput, TResult, TError>(
    definition: CommandDefinition<TInput, TResult, TError>,
  ): void {
    const key = this.buildKey(definition.commandType, definition.version);
    if (this.definitions.has(key)) {
      throw new Error(`Command ${key} already registered`);
    }
    this.definitions.set(key, definition);
    this.logger.log(`Registered command ${key}`);
  }

  getRegisteredCount(): number {
    return this.definitions.size;
  }

  getRegisteredCommands(): string[] {
    return Array.from(this.definitions.keys());
  }

  hasCommand(commandType: string, version: string): boolean {
    return this.definitions.has(this.buildKey(commandType, version));
  }

  async execute<TInput, TResult, TError>(
    commandType: string,
    version: string,
    input: TInput,
    metadata: CommandMetadata,
  ): Promise<CommandResult<TResult, TError>> {
    const key = this.buildKey(commandType, version);
    const definition = this.definitions.get(key);
    if (!definition) {
      throw new Error(`No handler for command ${key}`);
    }

    const idempotencyKey = definition.buildIdempotencyKey(input);
    const requestHash = definition.buildRequestHash(input);

    const idempotencyResult = await this.idempotency.checkAndReserve({
      tenantId: metadata.tenantId,
      scope: `${commandType}:${version}`,
      idempotencyKey,
      requestHash,
    });

    if (idempotencyResult.replayed && idempotencyResult.existing) {
      return {
        success: true,
        data: idempotencyResult.existing.responseBody as TResult,
        correlationId: metadata.correlationId,
        occurredAt: idempotencyResult.existing.completedAt ?? new Date(),
        deduplicated: true,
      };
    }

    try {
      const result = await definition.handler(input, metadata);

      await this.idempotency.complete({
        tenantId: metadata.tenantId,
        scope: `${commandType}:${version}`,
        idempotencyKey,
        resultData: result.data,
        resultEntityType: commandType,
        resultEntityId: (result.data as any)?.id,
        correlationId: metadata.correlationId,
        responseStatus: 200,
      });

      return result;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      await this.idempotency.fail(
        metadata.tenantId,
        `${commandType}:${version}`,
        idempotencyKey,
        err.name,
        err.message,
      );
      throw e;
    }
  }

  private buildKey(commandType: string, version: string): string {
    return `${commandType}:${version}`;
  }
}
