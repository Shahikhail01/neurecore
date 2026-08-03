/**
 * NeureCore Harness - Phase 6 Adapter Conformance
 *
 * Document ID: NC-HARNESS-PHASE6-ADAPTER-CONFORMANCE-001
 * Version: 1.0
 */

import {
  FeFirstAdapter,
  FeFirstAdapterConfigSchema,
  InMemoryEvidenceSink,
  InMemoryToolEventSink,
  InMemoryDomainEventSink,
  InMemoryApiCallWatchdog,
  type IFeFirstBrowserLauncher,
  type IFeFirstBrowserContext,
  type IFeFirstBrowserPage,
  type BrowserContextOptions,
  StepOutcomeSchema,
  VIEWPORT_DIMENSIONS,
  BROWSER_PROFILE_MAP,
  PLAYWRIGHT_ADAPTER_VERSION,
  fingerprintStep,
} from './index';
import { buildSim04Manifest } from '../migration';

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';
const USER_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ============================================================
// FAKE BROWSER (no Playwright dependency)
// ============================================================

class FakePage implements IFeFirstBrowserPage {
  private _url = 'about:blank';
  private consoleLog: string[] = [];
  constructor(private readonly ctx: FakeContext) {}
  async goto(url: string) {
    this._url = url;
    this.ctx.calls.push({
      url,
      method: 'GET',
      initiatedBy: 'BROWSER' as const,
      ts: new Date().toISOString(),
    });
  }
  async fill(selector: string, value: string) {
    this.ctx.calls.push({
      url: selector,
      method: 'POST',
      initiatedBy: 'BROWSER' as const,
      ts: new Date().toISOString(),
    });
    void value;
  }
  async click(selector: string) {
    this.ctx.calls.push({
      url: selector,
      method: 'POST',
      initiatedBy: 'BROWSER' as const,
      ts: new Date().toISOString(),
    });
    if (selector === '#create-project') this._url = '/projects/123';
  }
  async select() {
    void 0;
  }
  async waitForSelector() {
    void 0;
  }
  async waitForText(text: string) {
    void text;
  }
  async textContent(sel: string) {
    return sel === '#state' ? 'COMPLETED' : null;
  }
  url(): string {
    return this._url;
  }
  async screenshot(): Promise<Buffer | null> {
    return null;
  }
  on(
    event: 'console' | 'pageerror' | 'requestfailed',
    handler: (e: unknown) => void,
  ) {
    this.consoleLog.push(event);
    handler(event);
  }
  async chatSend(text: string) {
    this.ctx.calls.push({
      url: '/chat',
      method: 'POST',
      initiatedBy: 'BROWSER' as const,
      ts: new Date().toISOString(),
    });
    void text;
  }
  async approveCard() {
    void 0;
  }
  async close() {
    void 0;
  }
}

class FakeContext implements IFeFirstBrowserContext {
  calls: Array<{
    url: string;
    method: string;
    initiatedBy: 'BROWSER' | 'TEST_API';
    ts: string;
  }> = [];
  options: BrowserContextOptions;
  constructor(opts: BrowserContextOptions) {
    this.options = opts;
  }
  async newPage(): Promise<IFeFirstBrowserPage> {
    return new FakePage(this);
  }
  async close() {
    void 0;
  }
}

class FakeLauncher implements IFeFirstBrowserLauncher {
  constructor(
    private readonly opts: (
      o: BrowserContextOptions,
    ) => BrowserContextOptions = (o) => o,
  ) {}
  async launch(o: BrowserContextOptions): Promise<IFeFirstBrowserContext> {
    return new FakeContext(this.opts(o));
  }
}

function makeDeps(launcher?: IFeFirstBrowserLauncher) {
  const evidence = new InMemoryEvidenceSink();
  const tools = new InMemoryToolEventSink();
  const events = new InMemoryDomainEventSink();
  const watchdog = new InMemoryApiCallWatchdog();
  const adapter = new FeFirstAdapter({
    launcher: launcher ?? new FakeLauncher(),
    evidence,
    tools,
    events,
    watchdog,
    config: {
      feFirstMode: 'STRICT',
      evidenceClassification: 'INTERNAL',
      tenantId: TENANT_A,
      actorId: 'actor-1',
      baseUrl: 'https://hq.neurecore.test',
      defaultTimeoutMs: 5_000,
    },
    manifest: buildSim04Manifest(),
  });
  return { adapter, evidence, tools, events, watchdog };
}

describe('Phase 6 / Adapter', () => {
  it('viewport dimensions cover all 6 profiles', () => {
    expect(Object.keys(VIEWPORT_DIMENSIONS)).toHaveLength(6);
    expect(VIEWPORT_DIMENSIONS.DESKTOP_1080P).toEqual({
      width: 1920,
      height: 1080,
    });
    expect(VIEWPORT_DIMENSIONS.MOBILE_PORTRAIT).toEqual({
      width: 375,
      height: 667,
    });
  });

  it('browser profile map covers all 4 profiles', () => {
    expect(BROWSER_PROFILE_MAP.CHROMIUM_DESKTOP).toBe('chromium');
    expect(BROWSER_PROFILE_MAP.CHROMIUM_MOBILE).toBe('chromium');
    expect(BROWSER_PROFILE_MAP.FIREFOX_DESKTOP).toBe('firefox');
    expect(BROWSER_PROFILE_MAP.WEBKIT_DESKTOP).toBe('webkit');
  });

  it('FeFirstAdapterConfigSchema rejects negative timeout', () => {
    const bad = FeFirstAdapterConfigSchema.safeParse({
      feFirstMode: 'STRICT',
      evidenceClassification: 'INTERNAL',
      tenantId: TENANT_A,
      actorId: 'a',
      baseUrl: 'https://example.test',
      defaultTimeoutMs: -1,
    });
    expect(bad.success).toBe(false);
  });

  it('FeFirstAdapterConfigSchema rejects unknown feFirst mode', () => {
    const bad = FeFirstAdapterConfigSchema.safeParse({
      feFirstMode: 'WILD',
      evidenceClassification: 'INTERNAL',
      tenantId: TENANT_A,
      actorId: 'a',
      baseUrl: 'https://example.test',
      defaultTimeoutMs: 5_000,
    });
    expect(bad.success).toBe(false);
  });

  it('StepOutcomeSchema has 7 outcomes', () => {
    expect(StepOutcomeSchema.options).toHaveLength(7);
  });

  it('manifestChecksum is stable', () => {
    const { adapter } = makeDeps();
    const c1 = adapter.manifestChecksumValue();
    const c2 = adapter.manifestChecksumValue();
    expect(c1).toBe(c2);
    expect(c1).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('PLAYWRIGHT_ADAPTER_VERSION is exposed', () => {
    expect(PLAYWRIGHT_ADAPTER_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('InMemoryEvidenceSink accumulates envelopes', async () => {
    const sink = new InMemoryEvidenceSink();
    expect(sink.count()).toBe(0);
    await sink.emit({
      schemaVersion: '1.0.0',
      evidenceId: '11111111-1111-1111-1111-111111111111',
      runId: TENANT_A,
      scenarioId: 's',
      capabilityId: 'c',
      tenantId: TENANT_A,
      producer: 'p',
      mediaType: 'application/json',
      classification: 'INTERNAL',
      retentionClass: 'LONG_TERM',
      redactionStatus: 'NOT_REQUIRED',
      correlationIds: ['11111111-1111-1111-1111-111111111111'],
      timestamp: new Date().toISOString(),
      checksum: 'sha256:' + 'a'.repeat(64),
      storageRef: 'evidence://x',
    });
    expect(sink.count()).toBe(1);
  });

  it('InMemoryToolEventSink records and retrieves', async () => {
    const sink = new InMemoryToolEventSink();
    await sink.record({
      toolId: 't1',
      toolVersion: '1.0.0',
      tenantId: TENANT_A,
      effect: 'INTERNAL_WRITE',
      startedAt: new Date().toISOString(),
      status: 'COMPLETED',
      correlationId: TENANT_A,
    });
    expect(sink.count()).toBe(1);
    const list = await sink.listForRun(TENANT_A);
    expect(list).toHaveLength(1);
    expect(list[0].toolId).toBe('t1');
  });

  it('InMemoryDomainEventSink records and retrieves', async () => {
    const sink = new InMemoryDomainEventSink();
    await sink.record({
      eventType: 'project.created',
      tenantId: TENANT_A,
      payload: { id: 'p1' },
      timestamp: new Date().toISOString(),
      correlationId: TENANT_A,
    });
    expect(sink.count()).toBe(1);
  });

  it('InMemoryApiCallWatchdog tracks TEST_API vs BROWSER separately', async () => {
    const w = new InMemoryApiCallWatchdog();
    await w.recordRequest('https://api/x', 'POST', 'TEST_API');
    await w.recordRequest('https://hq/y', 'GET', 'BROWSER');
    expect(w.testApiCount()).toBe(1);
    expect(w.browserCount()).toBe(1);
  });

  it('runJourney survives a launcher failure without crashing', async () => {
    class ThrowingLauncher implements IFeFirstBrowserLauncher {
      async launch(): Promise<IFeFirstBrowserContext> {
        throw new Error('launch boom');
      }
    }
    const { adapter } = makeDeps(new ThrowingLauncher());
    const m = buildSim04Manifest();
    await expect(
      adapter.runJourney(m, m.journeys[0], {
        tenantId: TENANT_A,
        userId: USER_A,
        email: 'a@example.test',
      }),
    ).rejects.toThrow('launch boom');
  });

  it('runJourney emits at least one evidence envelope', async () => {
    const { adapter, evidence } = makeDeps();
    const m = buildSim04Manifest();
    await adapter.runJourney(m, m.journeys[0], {
      tenantId: TENANT_A,
      userId: USER_A,
      email: 'a@example.test',
    });
    expect(evidence.count()).toBeGreaterThanOrEqual(1);
  });

  it('runJourney returns a uuid-shaped runId and correlationId', async () => {
    const { adapter } = makeDeps();
    const m = buildSim04Manifest();
    const r = await adapter.runJourney(m, m.journeys[0], {
      tenantId: TENANT_A,
      userId: USER_A,
      email: 'a@example.test',
    });
    expect(r.runId).toMatch(UUID_PATTERN);
    expect(r.correlationId).toMatch(UUID_PATTERN);
  });

  it('fingerprintStep is deterministic', () => {
    const a = fingerprintStep('j', 's', 'CLICK');
    const b = fingerprintStep('j', 's', 'CLICK');
    expect(a).toBe(b);
    expect(a).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('fingerprintStep differs per action', () => {
    expect(fingerprintStep('j', 's', 'CLICK')).not.toBe(
      fingerprintStep('j', 's', 'FILL'),
    );
  });

  it('evaluateAssertion URL_PATH passes when path includes expression', async () => {
    const { adapter } = makeDeps();
    const ctx = {
      runId: 'shared',
      correlationId: 'shared',
      tenantId: TENANT_A,
      actorId: 'a',
      startedAt: new Date().toISOString(),
    };
    const page = {
      url: () => 'https://hq.neurecore.test/projects/123',
      fill: async () => undefined,
      click: async () => undefined,
      select: async () => undefined,
      goto: async () => undefined,
      waitForSelector: async () => undefined,
      waitForText: async () => undefined,
      textContent: async () => null,
      screenshot: async () => null,
      on: () => undefined,
      chatSend: async () => undefined,
      approveCard: async () => undefined,
      close: async () => undefined,
    };
    const r = await adapter.evaluateAssertion(
      {
        assertionId: 'a',
        type: 'URL_PATH',
        expression: '/projects/',
        message: 'on project page',
      },
      page,
      ctx,
    );
    expect(r.passed).toBe(true);
  });

  it('evaluateAssertion TENANT_ISOLATION fails when a tool touches another tenant', async () => {
    const { adapter, tools } = makeDeps();
    const ctx = {
      runId: 'shared',
      correlationId: 'shared',
      tenantId: TENANT_A,
      actorId: 'a',
      startedAt: new Date().toISOString(),
    };
    await tools.record({
      toolId: 't',
      toolVersion: '1',
      tenantId: TENANT_B,
      effect: 'READ',
      startedAt: new Date().toISOString(),
      status: 'COMPLETED',
      correlationId: 'shared',
    });
    const page = {
      url: () => '',
      fill: async () => undefined,
      click: async () => undefined,
      select: async () => undefined,
      goto: async () => undefined,
      waitForSelector: async () => undefined,
      waitForText: async () => undefined,
      textContent: async () => null,
      screenshot: async () => null,
      on: () => undefined,
      chatSend: async () => undefined,
      approveCard: async () => undefined,
      close: async () => undefined,
    };
    const r = await adapter.evaluateAssertion(
      {
        assertionId: 'a',
        type: 'TENANT_ISOLATION',
        expression: '*',
        message: 'iso',
      },
      page,
      ctx,
    );
    expect(r.passed).toBe(false);
  });

  it('evaluateAssertion NO_API_FALLBACK fails when watchdog observed TEST_API', async () => {
    const { adapter, watchdog } = makeDeps();
    const ctx = {
      runId: 'shared',
      correlationId: 'shared',
      tenantId: TENANT_A,
      actorId: 'a',
      startedAt: new Date().toISOString(),
    };
    watchdog.bindRun('shared');
    await watchdog.recordRequest('https://api/x', 'POST', 'TEST_API');
    const page = {
      url: () => '',
      fill: async () => undefined,
      click: async () => undefined,
      select: async () => undefined,
      goto: async () => undefined,
      waitForSelector: async () => undefined,
      waitForText: async () => undefined,
      textContent: async () => null,
      screenshot: async () => null,
      on: () => undefined,
      chatSend: async () => undefined,
      approveCard: async () => undefined,
      close: async () => undefined,
    };
    const r = await adapter.evaluateAssertion(
      {
        assertionId: 'a',
        type: 'NO_API_FALLBACK',
        expression: 'TEST_API',
        message: 'no fb',
      },
      page,
      ctx,
    );
    expect(r.passed).toBe(false);
  });

  it('evaluateAssertion DOM_TEXT passes when expected substring is present', async () => {
    const { adapter } = makeDeps();
    const ctx = {
      runId: 'shared',
      correlationId: 'shared',
      tenantId: TENANT_A,
      actorId: 'a',
      startedAt: new Date().toISOString(),
    };
    const page = {
      url: () => '',
      fill: async () => undefined,
      click: async () => undefined,
      select: async () => undefined,
      goto: async () => undefined,
      waitForSelector: async () => undefined,
      waitForText: async () => undefined,
      textContent: async () => 'COMPLETED',
      screenshot: async () => null,
      on: () => undefined,
      chatSend: async () => undefined,
      approveCard: async () => undefined,
      close: async () => undefined,
    };
    const r = await adapter.evaluateAssertion(
      {
        assertionId: 'a',
        type: 'DOM_TEXT',
        expression: '#state',
        expected: 'COMP',
        message: 'state is completed',
      },
      page,
      ctx,
    );
    expect(r.passed).toBe(true);
  });

  it('evaluateAssertion TOOL_EXECUTED passes when the tool was called', async () => {
    const { adapter, tools } = makeDeps();
    const ctx = {
      runId: 'shared',
      correlationId: 'shared',
      tenantId: TENANT_A,
      actorId: 'a',
      startedAt: new Date().toISOString(),
    };
    await tools.record({
      toolId: 'projects.create',
      toolVersion: '1',
      tenantId: TENANT_A,
      effect: 'INTERNAL_WRITE',
      startedAt: new Date().toISOString(),
      status: 'COMPLETED',
      correlationId: 'shared',
    });
    const page = makeNoopPage();
    const r = await adapter.evaluateAssertion(
      {
        assertionId: 'a',
        type: 'TOOL_EXECUTED',
        expression: 'projects.create',
        message: 'x',
      },
      page,
      ctx,
    );
    expect(r.passed).toBe(true);
  });

  it('evaluateAssertion TOOL_NOT_EXECUTED passes when the tool was not called', async () => {
    const { adapter } = makeDeps();
    const ctx = {
      runId: 'shared',
      correlationId: 'shared',
      tenantId: TENANT_A,
      actorId: 'a',
      startedAt: new Date().toISOString(),
    };
    const page = makeNoopPage();
    const r = await adapter.evaluateAssertion(
      {
        assertionId: 'a',
        type: 'TOOL_NOT_EXECUTED',
        expression: 'projects.delete',
        message: 'x',
      },
      page,
      ctx,
    );
    expect(r.passed).toBe(true);
  });

  it('evaluateAssertion EVENT_EMITTED passes when the event was emitted', async () => {
    const { adapter, events } = makeDeps();
    const ctx = {
      runId: 'shared',
      correlationId: 'shared',
      tenantId: TENANT_A,
      actorId: 'a',
      startedAt: new Date().toISOString(),
    };
    await events.record({
      eventType: 'project.completed',
      tenantId: TENANT_A,
      payload: {},
      timestamp: new Date().toISOString(),
      correlationId: 'shared',
    });
    const page = makeNoopPage();
    const r = await adapter.evaluateAssertion(
      {
        assertionId: 'a',
        type: 'EVENT_EMITTED',
        expression: 'project.completed',
        message: 'x',
      },
      page,
      ctx,
    );
    expect(r.passed).toBe(true);
  });

  it('collectCorrelatedTrace returns all four channels', async () => {
    const { adapter } = makeDeps();
    const trace = await adapter.collectCorrelatedTrace(TENANT_A);
    expect(trace.evidence).toBeDefined();
    expect(trace.tools).toBeDefined();
    expect(trace.events).toBeDefined();
    expect(trace.apiCalls).toBeDefined();
  });
});

function makeNoopPage(): IFeFirstBrowserPage {
  return {
    url: () => '',
    fill: async () => undefined,
    click: async () => undefined,
    select: async () => undefined,
    goto: async () => undefined,
    waitForSelector: async () => undefined,
    waitForText: async () => undefined,
    textContent: async () => null,
    screenshot: async () => null,
    on: () => undefined,
    chatSend: async () => undefined,
    approveCard: async () => undefined,
    close: async () => undefined,
  };
}
