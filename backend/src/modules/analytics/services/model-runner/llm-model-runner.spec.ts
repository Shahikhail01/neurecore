import { LlmModelRunner, LlmOptedOutError, LlmRunnerError } from './llm-model-runner';
import { LlmFeatureFlagService } from './llm-feature-flag.service';

function flag(opts: {
  enabled?: boolean;
  endpoint?: string;
  apiKey?: string;
  model?: string;
}): LlmFeatureFlagService {
  return {
    isEnabled: async () => opts.enabled ?? false,
    endpointFor: () => opts.endpoint ?? 'http://localhost:9999/llm',
    modelFor: () => opts.model ?? 'deepseek-chat',
    apiKeyFor: () => opts.apiKey ?? 'k-1',
  } as unknown as LlmFeatureFlagService;
}

describe('Phase 21 — LlmModelRunner', () => {
  it('throws LlmOptedOutError when the feature flag is OFF', async () => {
    const runner = new LlmModelRunner(flag({ enabled: false }));
    await expect(
      runner.run({
        tenantId: 'tenant-A',
        capability: 'lead',
        prompt: 'score this lead',
        features: {},
      }),
    ).rejects.toBeInstanceOf(LlmOptedOutError);
  });

  it('calls the LLM endpoint and parses the response when ON', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        content: '{"score":0.9}',
        tokensIn: 10,
        tokensOut: 5,
        model: 'deepseek-chat',
      }),
      text: async () => '',
    })) as unknown as typeof fetch;
    const runner = new LlmModelRunner(
      flag({ enabled: true, endpoint: 'http://llm/upstream', model: 'deepseek-chat' }),
      fetchMock,
    );
    const out = await runner.run({
      tenantId: 'tenant-A',
      capability: 'lead',
      prompt: 'score this lead',
      features: { requested_demo: 1 },
    });
    expect(out.content).toBe('{"score":0.9}');
    expect(out.model).toBe('deepseek-chat');
    expect(out.tokensIn).toBe(10);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws LlmRunnerError when the upstream returns non-2xx', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: false,
      status: 502,
      json: async () => ({}),
      text: async () => 'bad gateway',
    })) as unknown as typeof fetch;
    const runner = new LlmModelRunner(
      flag({ enabled: true }),
      fetchMock,
    );
    await expect(
      runner.run({
        tenantId: 'tenant-A',
        capability: 'lead',
        prompt: 'score',
        features: {},
      }),
    ).rejects.toBeInstanceOf(LlmRunnerError);
  });
});
