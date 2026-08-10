import { CommandRegistry } from './command.registry';
import type {
  CommandDefinition,
  CommandResult,
} from './command.interface';
import type { IIdempotencyRepository } from '../idempotency/idempotency-repository.port';
import type { CommandMetadata } from '../correlation/correlation.interface';

describe('CommandRegistry', () => {
  let idempotency: jest.Mocked<IIdempotencyRepository>;
  let registry: CommandRegistry;
  let metadata: CommandMetadata;

  beforeEach(() => {
    idempotency = {
      checkAndReserve: jest.fn().mockResolvedValue({
        existing: null,
        reserved: true,
        replayed: false,
      }),
      complete: jest.fn().mockResolvedValue(undefined),
      fail: jest.fn().mockResolvedValue(undefined),
      purgeOldFailedRecords: jest.fn().mockResolvedValue(0),
    };

    registry = new CommandRegistry(idempotency);
    metadata = {
      correlationId: 'corr-1',
      tenantId: 'tenant-1',
      actorId: 'actor-1',
      actorType: 'HUMAN',
      causationId: 'cause-1',
      timestamp: new Date('2026-08-09T00:00:00.000Z'),
    };
  });

  function registerDefinition(
    handler: jest.MockedFunction<
      (input: { entityId: string }, metadata: CommandMetadata) => Promise<CommandResult<{ id: string }>>
    >,
  ): CommandDefinition<{ entityId: string }, { id: string }> {
    const definition = {
      commandType: 'TestCommand',
      version: '1.0',
      handler,
      buildIdempotencyKey: (input: { entityId: string }) =>
        `test-command:${input.entityId}`,
      buildRequestHash: (input: { entityId: string }) => JSON.stringify(input),
    };

    registry.register(definition);
    return definition;
  }

  it('registers versioned command definitions and executes the matching handler', async () => {
    const handler = jest.fn().mockResolvedValue({
      success: true,
      data: { id: 'entity-1' },
      correlationId: metadata.correlationId,
      occurredAt: metadata.timestamp,
    });

    registerDefinition(handler);

    expect(registry.hasCommand('TestCommand', '1.0')).toBe(true);
    expect(registry.getRegisteredCommands()).toEqual(['TestCommand:1.0']);

    const result = await registry.execute(
      'TestCommand',
      '1.0',
      { entityId: 'entity-1' },
      metadata,
    );

    expect(handler).toHaveBeenCalledWith(
      { entityId: 'entity-1' },
      expect.objectContaining({
        tenantId: 'tenant-1',
        correlationId: 'corr-1',
      }),
    );
    expect(idempotency.checkAndReserve).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      scope: 'TestCommand:1.0',
      idempotencyKey: 'test-command:entity-1',
      requestHash: JSON.stringify({ entityId: 'entity-1' }),
    });
    expect(idempotency.complete).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      scope: 'TestCommand:1.0',
      idempotencyKey: 'test-command:entity-1',
      resultData: { id: 'entity-1' },
      resultEntityType: 'TestCommand',
      resultEntityId: 'entity-1',
      correlationId: 'corr-1',
      responseStatus: 200,
    });
    expect(result.data).toEqual({ id: 'entity-1' });
  });

  it('replays cached responses without invoking the handler twice', async () => {
    const handler = jest.fn().mockResolvedValue({
      success: true,
      data: { id: 'entity-1' },
      correlationId: metadata.correlationId,
      occurredAt: metadata.timestamp,
    });

    registerDefinition(handler);

    idempotency.checkAndReserve
      .mockResolvedValueOnce({
        existing: null,
        reserved: true,
        replayed: false,
      })
      .mockResolvedValueOnce({
        existing: {
          responseBody: { id: 'entity-1' },
          completedAt: new Date('2026-08-09T00:01:00.000Z'),
        },
        reserved: false,
        replayed: true,
      });

    await registry.execute(
      'TestCommand',
      '1.0',
      { entityId: 'entity-1' },
      metadata,
    );
    const replayed = await registry.execute(
      'TestCommand',
      '1.0',
      { entityId: 'entity-1' },
      metadata,
    );

    expect(handler).toHaveBeenCalledTimes(1);
    expect(replayed.deduplicated).toBe(true);
    expect(replayed.data).toEqual({ id: 'entity-1' });
    expect(idempotency.complete).toHaveBeenCalledTimes(1);
  });

  it('marks the idempotency record as failed when the handler throws', async () => {
    const handler = jest
      .fn()
      .mockRejectedValue(new Error('handler exploded'));

    registerDefinition(handler);

    await expect(
      registry.execute('TestCommand', '1.0', { entityId: 'entity-1' }, metadata),
    ).rejects.toThrow('handler exploded');

    expect(idempotency.fail).toHaveBeenCalledWith(
      'tenant-1',
      'TestCommand:1.0',
      'test-command:entity-1',
      'Error',
      'handler exploded',
    );
  });

  it('rejects execution for an unregistered version', async () => {
    await expect(
      registry.execute('TestCommand', '2.0', { entityId: 'entity-1' }, metadata),
    ).rejects.toThrow('No handler for command TestCommand:2.0');
  });
});
