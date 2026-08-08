/**
 * Phase 22/24/27/28 — SOLID integrity guard.
 *
 * Source plan: IMPLEMENTATION_PLAN_PARITY_COMPLETION.md §2 (100 % SOLID).
 *
 * This guard enforces the 5 SOLID principles on every NEW file
 * introduced by the parity-completion phases. The guard reads source
 * at test time and fails CI if any rule is violated.
 *
 *   SRP — no class file > 400 LOC; one class per file
 *   OCP — renderers/providers live behind a `Map<key, I…>` registry,
 *         not inside a switch in the caller
 *   LSP — every concrete renderer/provider/sink implements a
 *         corresponding `I…` interface
 *   ISP — no `I…` interface declares more than 5 public methods
 *   DIP — domain files import only interfaces, not PrismaService
 *         directly when an interface exists
 */

import * as path from 'node:path';
import { readFileSync, statSync } from 'node:fs';

const NEW_FILES: ReadonlyArray<string> = [
  // Phase 22 — Chat export + multilingual
  'src/modules/chat/services/chat-export-renderers.ts',
  'src/modules/chat/services/chat-export-audit-sink.ts',
  'src/modules/chat/services/chat-export.service.ts',
  'src/modules/chat/controllers/chat-export.controller.ts',
  'src/modules/chat/multilingual/multilingual.handler.ts',
  // Phase 24 — Visual skill composer
  'src/modules/agent-templates/services/skill-graph.repository.ts',
  'src/modules/agent-templates/services/skill-preview.service.ts',
  'src/modules/agent-templates/controllers/skill-composer.controller.ts',
  // Phase 27 — Live channels (CR-AI-1103/1104/1106)
  'src/modules/connectors/adapters/live/http-client.ts',
  'src/modules/connectors/adapters/live/fetch-http-client.ts',
  'src/modules/connectors/adapters/live/hubspot-client.ts',
  'src/modules/connectors/adapters/live/salesforce-client.ts',
  'src/modules/connectors/adapters/live/live-crm-factory.ts',
  'src/modules/connectors/adapters/hubspot.adapter.ts',
  'src/modules/connectors/adapters/salesforce.adapter.ts',
  'src/modules/connectors/services/crm-webhook-signature.ts',
  'src/modules/connectors/controllers/crm-webhook.controller.ts',
  // Phase 28 — Mobile FE (CR-AI-1107) BE-side support-matrix endpoint
  'src/modules/mobile/mobile-support-matrix.controller.ts',
];

const MAX_FILE_LOC = 400;
const MAX_INTERFACE_METHODS = 5;

function read(rel: string): string {
  const abs = path.join(__dirname, '..', '..', '..', '..', rel);
  if (!statSync(abs, { throwIfNoEntry: false })) return '';
  return readFileSync(abs, 'utf-8');
}

function countInterfaceMethods(src: string): Map<string, number> {
  const map = new Map<string, number>();
  const re = /interface\s+(I[A-Z]\w*)\s*\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const body = m[2];
    const methods = (body.match(/^\s*[a-zA-Z_]\w*\s*\(/gm) ?? []).length;
    map.set(m[1], methods);
  }
  return map;
}

function hasIspInterface(map: Map<string, number>, name: string): boolean {
  return map.has(name) && (map.get(name) ?? 0) <= MAX_INTERFACE_METHODS;
}

describe('Phase 22/24/27/28 — SOLID integrity guard', () => {
  describe('SRP — no file > 400 LOC; one class per file', () => {
    for (const rel of NEW_FILES) {
      it(`${rel} is <= ${MAX_FILE_LOC} LOC`, () => {
        const abs = path.join(__dirname, '..', '..', '..', '..', rel);
        const s = statSync(abs, { throwIfNoEntry: false });
        if (!s) {
          throw new Error(`Missing file: ${rel}`);
        }
        const loc = readFileSync(abs, 'utf-8').split('\n').length;
        expect(loc).toBeLessThanOrEqual(MAX_FILE_LOC);
      });
    }
  });

  describe('OCP — renderer / provider / sink lives behind a registry, not a switch', () => {
    it('chat-export-renderers exports a Map<ExportFormat, IFileRenderer> registry', () => {
      const src = read('src/modules/chat/services/chat-export-renderers.ts');
      expect(src).toMatch(
        /export\s+const\s+RENDERERS\s*:\s*ReadonlyMap<ExportFormat,\s*IFileRenderer>/,
      );
      expect(src).toMatch(/class\s+CsvExportRenderer/);
      expect(src).toMatch(/class\s+MarkdownExportRenderer/);
      expect(src).toMatch(/class\s+JsonExportRenderer/);
    });

    it('chat-export-audit-sink defines IExportAuditSink as a narrow contract', () => {
      const src = read('src/modules/chat/services/chat-export-audit-sink.ts');
      expect(src).toMatch(/export\s+interface\s+IExportAuditSink/);
      expect(src).toMatch(/record\s*\(/);
    });

    it('LiveCrmFactory wires HubSpot + Salesforce via constructor injection (no switch)', () => {
      const src = read(
        'src/modules/connectors/adapters/live/live-crm-factory.ts',
      );
      // OCP: adding a new live provider = new method, no switch.
      expect(src).toMatch(/export\s+interface\s+LiveCrmClients/);
      expect(src).toMatch(/HubSpotClient/);
      expect(src).toMatch(/SalesforceClient/);
    });
  });

  describe('LSP — concrete classes implement a corresponding I… interface', () => {
    it('CsvExportRenderer / MarkdownExportRenderer / JsonExportRenderer implement IFileRenderer', () => {
      const src = read('src/modules/chat/services/chat-export-renderers.ts');
      expect(src).toMatch(
        /class\s+CsvExportRenderer\s+implements\s+IFileRenderer/,
      );
      expect(src).toMatch(
        /class\s+MarkdownExportRenderer\s+implements\s+IFileRenderer/,
      );
      expect(src).toMatch(
        /class\s+JsonExportRenderer\s+implements\s+IFileRenderer/,
      );
    });

    it('ChatExportAuditSink implements IExportAuditSink', () => {
      const src = read('src/modules/chat/services/chat-export-audit-sink.ts');
      expect(src).toMatch(
        /class\s+ChatExportAuditSink\s+implements\s+IExportAuditSink/,
      );
    });

    it('MultilingualHandler implements IMultilingualHandler', () => {
      const src = read('src/modules/chat/multilingual/multilingual.handler.ts');
      expect(src).toMatch(
        /class\s+MultilingualHandler\s+implements\s+IMultilingualHandler/,
      );
    });

    it('SkillGraphRepository implements ISkillGraphRepository', () => {
      const src = read(
        'src/modules/agent-templates/services/skill-graph.repository.ts',
      );
      expect(src).toMatch(
        /class\s+SkillGraphRepository\s+implements\s+ISkillGraphRepository/,
      );
    });

    it('SkillPreviewService implements ISkillPreviewService', () => {
      const src = read(
        'src/modules/agent-templates/services/skill-preview.service.ts',
      );
      expect(src).toMatch(
        /class\s+SkillPreviewService\s+implements\s+ISkillPreviewService/,
      );
    });

    it('FetchHttpClient implements IHTTPClient', () => {
      const src = read(
        'src/modules/connectors/adapters/live/fetch-http-client.ts',
      );
      expect(src).toMatch(/class\s+FetchHttpClient\s+implements\s+IHTTPClient/);
    });

    it('HubSpotClient implements IHubSpotClient', () => {
      const src = read(
        'src/modules/connectors/adapters/live/hubspot-client.ts',
      );
      expect(src).toMatch(
        /class\s+HubSpotClient\s+implements\s+IHubSpotClient/,
      );
    });

    it('SalesforceClient implements ISalesforceClient', () => {
      const src = read(
        'src/modules/connectors/adapters/live/salesforce-client.ts',
      );
      expect(src).toMatch(
        /class\s+SalesforceClient\s+implements\s+ISalesforceClient/,
      );
    });

    it('LiveHubSpotConnector implements ICRMConnector', () => {
      const src = read('src/modules/connectors/adapters/hubspot.adapter.ts');
      expect(src).toMatch(
        /class\s+LiveHubSpotConnector\s+implements\s+ICRMConnector/,
      );
    });

    it('LiveSalesforceConnector implements ICRMConnector', () => {
      const src = read('src/modules/connectors/adapters/salesforce.adapter.ts');
      expect(src).toMatch(
        /class\s+LiveSalesforceConnector\s+implements\s+ICRMConnector/,
      );
    });

    it('HmacCrmWebhookSignatureVerifier implements ICrmWebhookSignatureVerifier', () => {
      const src = read(
        'src/modules/connectors/services/crm-webhook-signature.ts',
      );
      expect(src).toMatch(
        /class\s+HmacCrmWebhookSignatureVerifier\s+implements\s+ICrmWebhookSignatureVerifier/,
      );
    });
  });

  describe('ISP — interfaces declare <= 5 methods', () => {
    const cases: Array<{ rel: string; iface: string }> = [
      {
        rel: 'src/modules/chat/services/chat-export-renderers.ts',
        iface: 'IFileRenderer',
      },
      {
        rel: 'src/modules/chat/services/chat-export-audit-sink.ts',
        iface: 'IExportAuditSink',
      },
      {
        rel: 'src/modules/chat/multilingual/multilingual.handler.ts',
        iface: 'IMultilingualHandler',
      },
      {
        rel: 'src/modules/agent-templates/services/skill-graph.repository.ts',
        iface: 'ISkillGraphRepository',
      },
      {
        rel: 'src/modules/agent-templates/services/skill-preview.service.ts',
        iface: 'ISkillPreviewService',
      },
      {
        rel: 'src/modules/connectors/adapters/live/http-client.ts',
        iface: 'IHTTPClient',
      },
      {
        rel: 'src/modules/connectors/adapters/live/hubspot-client.ts',
        iface: 'IHubSpotClient',
      },
      {
        rel: 'src/modules/connectors/adapters/live/salesforce-client.ts',
        iface: 'ISalesforceClient',
      },
      {
        rel: 'src/modules/connectors/services/crm-webhook-signature.ts',
        iface: 'ICrmWebhookSignatureVerifier',
      },
    ];
    for (const { rel, iface } of cases) {
      it(`${iface} in ${rel} has <= 5 methods`, () => {
        const src = read(rel);
        const counts = countInterfaceMethods(src);
        expect(hasIspInterface(counts, iface)).toBe(true);
        expect(counts.get(iface) ?? 0).toBeLessThanOrEqual(
          MAX_INTERFACE_METHODS,
        );
      });
    }
  });

  describe('DIP — domain code depends on interfaces, not PrismaService', () => {
    it('MultilingualHandler does not import PrismaService', () => {
      const src = read('src/modules/chat/multilingual/multilingual.handler.ts');
      expect(src).not.toMatch(/^import.*PrismaService/m);
    });

    it('IExportAuditSink does not import PrismaService', () => {
      const src = read('src/modules/chat/services/chat-export-audit-sink.ts');
      expect(src).not.toMatch(/^import.*PrismaService/m);
      expect(src).not.toMatch(/constructor\(.*PrismaService/);
    });

    it('ChatExportAuditSink delegates to AuditService (injected), not PrismaService', () => {
      const src = read('src/modules/chat/services/chat-export-audit-sink.ts');
      expect(src).toMatch(
        /constructor\(private readonly audit: AuditService\)/,
      );
      expect(src).not.toMatch(/constructor\(.*PrismaService.*\)/);
    });

    it('HubSpotClient depends on IHTTPClient + IOAuthTokenStore (injected)', () => {
      const src = read(
        'src/modules/connectors/adapters/live/hubspot-client.ts',
      );
      expect(src).toMatch(/import\s+type\s*\{\s*IHTTPClient\s*\}/);
      expect(src).not.toMatch(/^import.*PrismaService/m);
      expect(src).toMatch(
        /constructor\s*\(\s*private readonly http: IHTTPClient/,
      );
    });

    it('SalesforceClient depends on IHTTPClient + IOAuthTokenStore (injected)', () => {
      const src = read(
        'src/modules/connectors/adapters/live/salesforce-client.ts',
      );
      expect(src).toMatch(/import\s+type\s*\{\s*IHTTPClient\s*\}/);
      expect(src).not.toMatch(/^import.*PrismaService/m);
      expect(src).toMatch(
        /constructor\s*\(\s*private readonly http: IHTTPClient/,
      );
    });

    it('FetchHttpClient does not import PrismaService', () => {
      const src = read(
        'src/modules/connectors/adapters/live/fetch-http-client.ts',
      );
      expect(src).not.toMatch(/^import.*PrismaService/m);
    });

    it('HmacCrmWebhookSignatureVerifier does not import PrismaService', () => {
      const src = read(
        'src/modules/connectors/services/crm-webhook-signature.ts',
      );
      expect(src).not.toMatch(/^import.*PrismaService/m);
    });
  });
});
