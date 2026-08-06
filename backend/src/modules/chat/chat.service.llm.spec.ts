/**
 * Chat query path — tenant LLM gateway override tests.
 *
 * Verifies that `resolvePreferredModelIdSafe` is called before the
 * gateway invoke/stream call and the result is forwarded as `modelId`.
 * The harness bypasses the full SendChatMessageDto (the focus is the
 * modelId override wiring).
 */
import { ChatService } from './chat.service';
import type { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import type { TenantLlmGateway } from '../llm-registry/tenant-llm.gateway';

function makeChatService(opts: {
  preferredModelId?: string | null;
  preferredResolveThrows?: boolean;
}) {
  const invokeCalls: Array<Record<string, unknown>> = [];
  const streamCalls: Array<Record<string, unknown>> = [];

  const aiGateway = {
    invoke: jest.fn(async (call: Record<string, unknown>) => {
      invokeCalls.push(call);
      return { content: 'ok', model: 'gateway', provider: 'gateway' };
    }),
    stream: jest.fn(async function* (call: Record<string, unknown>) {
      streamCalls.push(call);
      yield { delta: '', done: true };
    }),
  } as unknown as AiGatewayService;

  const tenantLlmGateway = {
    resolvePreferredModelId: jest.fn(async () =>
      opts.preferredResolveThrows ? Promise.reject(new Error('boom')) : opts.preferredModelId ?? null,
    ),
  } as unknown as TenantLlmGateway;

  const stub = (name: string): never => ({ name } as never);
  const chatHistoryStub = { saveMessage: jest.fn(async () => undefined) };
  const prismaStub = { auditLog: { create: jest.fn(async () => ({})) } } as never;
  const activityStub = { record: jest.fn(async () => undefined) };
  const featureFlagsStub = { isEnabled: jest.fn(() => true) };

  const svc = new ChatService(
    stub('minimax'),
    prismaStub,
    stub('agentGraph'),
    activityStub as never,
    featureFlagsStub as never,
    aiGateway,
    chatHistoryStub as never,
    stub('autonomousWork'),
    stub('tenantFlags'),
    stub('intentClassifier'),
    stub('intentRegistry'),
    stub('typingExtractor'),
    stub('routingDecisions'),
    tenantLlmGateway,
  );

  return {
    svc,
    aiGateway,
    tenantLlmGateway,
    invokeCalls,
    streamCalls,
    featureFlagsStub,
  };
}

describe('ChatService — TenantLlmGateway override', () => {
  it('forwards modelId when the tenant has a preferred model', async () => {
    const { svc, aiGateway, tenantLlmGateway } = makeChatService({
      preferredModelId: 'minimax-text-01',
    });

    await svc.send(
      {
        message: 'hello',
        conversationId: 'conv-1',
      } as never,
      'tenant-1',
      'user-1',
    );

    expect(tenantLlmGateway.resolvePreferredModelId).toHaveBeenCalledWith('tenant-1');
    expect(aiGateway.invoke).toHaveBeenCalled();
    const callArg = (aiGateway.invoke as jest.Mock).mock.calls[0][0];
    expect(callArg['modelId']).toBe('minimax-text-01');
  });

  it('omits modelId when the tenant has no binding (resolver returns null)', async () => {
    const { svc, aiGateway } = makeChatService({ preferredModelId: null });

    await svc.send(
      {
        message: 'hello',
        conversationId: 'conv-1',
      } as never,
      'tenant-1',
      'user-1',
    );

    const callArg = (aiGateway.invoke as jest.Mock).mock.calls[0][0];
    expect('modelId' in callArg).toBe(false);
  });

  it('does NOT throw when the resolver rejects (defensive)', async () => {
    const { svc } = makeChatService({ preferredResolveThrows: true });

    await expect(
      svc.send(
        {
          message: 'hello',
          conversationId: 'conv-1',
        } as never,
        'tenant-1',
        'user-1',
      ),
    ).resolves.toBeDefined();
  });
});