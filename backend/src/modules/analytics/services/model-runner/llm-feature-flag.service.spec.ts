import { LlmFeatureFlagService } from './llm-feature-flag.service';

describe('Phase 21 — LlmFeatureFlagService', () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it('returns false by default for any tenant', async () => {
    delete process.env['LLM_DEFAULT_ENABLED'];
    delete process.env['LLM_FEATURE_FLAGS'];
    const svc = new LlmFeatureFlagService();
    expect(await svc.isEnabled('tenant-A', 'lead')).toBe(false);
    expect(await svc.isEnabled('tenant-A', 'forecast')).toBe(false);
  });

  it('returns false when tenantId is wildcard', async () => {
    const svc = new LlmFeatureFlagService();
    expect(await svc.isEnabled('*', 'lead')).toBe(false);
  });

  it('honours LLM_DEFAULT_ENABLED=true globally', async () => {
    process.env['LLM_DEFAULT_ENABLED'] = 'true';
    delete process.env['LLM_FEATURE_FLAGS'];
    const svc = new LlmFeatureFlagService();
    expect(await svc.isEnabled('tenant-A', 'lead')).toBe(true);
  });

  it('honours per-tenant override LLM_FEATURE_FLAGS', async () => {
    process.env['LLM_DEFAULT_ENABLED'] = 'false';
    process.env['LLM_FEATURE_FLAGS'] =
      'tenant-A:lead=true,tenant-A:forecast=false';
    const svc = new LlmFeatureFlagService();
    expect(await svc.isEnabled('tenant-A', 'lead')).toBe(true);
    expect(await svc.isEnabled('tenant-A', 'forecast')).toBe(false);
    expect(await svc.isEnabled('tenant-A', 'opportunity-win')).toBe(false);
  });

  it('endpointFor / modelFor / apiKeyFor return env defaults', () => {
    process.env['LLM_ENDPOINT'] = 'http://llm/upstream';
    process.env['LLM_DEFAULT_MODEL'] = 'm-1';
    process.env['LLM_API_KEY'] = 'k-1';
    const svc = new LlmFeatureFlagService();
    expect(svc.endpointFor('tenant-A')).toBe('http://llm/upstream');
    expect(svc.modelFor('tenant-A', 'lead')).toBe('m-1');
    expect(svc.apiKeyFor('tenant-A')).toBe('k-1');
  });
});
