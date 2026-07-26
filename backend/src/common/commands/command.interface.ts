// src/common/commands/command.interface.ts
import { CommandMetadata } from '../correlation/correlation.interface';

export interface CommandResult<TData, TError = undefined> {
  success: boolean;
  data?: TData;
  error?: TError;
  correlationId: string;
  occurredAt: Date;
  deduplicated?: boolean;
}

export type CommandHandlerFn<TInput, TResult, TError = undefined> = (
  input: TInput,
  metadata: CommandMetadata,
) => Promise<CommandResult<TResult, TError>>;

export interface ICommand<TResult = void, TError = undefined> {
  readonly commandType: string;
  readonly version: string;
  readonly idempotencyKey: string;
  execute(metadata: CommandMetadata): Promise<CommandResult<TResult, TError>>;
}

export interface CommandDefinition<TInput, TResult, TError = undefined> {
  commandType: string;
  version: string;
  handler: CommandHandlerFn<TInput, TResult, TError>;
  buildIdempotencyKey: (input: TInput) => string;
  buildRequestHash: (input: TInput) => string;
}

export const COMMAND_METADATA_KEY = 'COMMAND_METADATA';
