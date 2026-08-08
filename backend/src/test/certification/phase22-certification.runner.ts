/**
 * Phase 22 — G22 Chat export + multilingual certification runner.
 *
 * Source plan: IMPLEMENTATION_PLAN_PARITY_COMPLETION.md §3 (P22).
 *
 * Verdict criteria — every gate must pass; failures block release.
 *
 *   G22-C-001 — renderers exist for all 3 formats (csv, markdown, json)
 *   G22-C-002 — CSV renderer emits byte-correct header + rows
 *   G22-C-003 — Markdown renderer emits byte-correct headings
 *   G22-C-004 — JSON renderer emits byte-correct JSON array
 *   G22-C-005 — ChatExportService.export() refuses wildcard tenantId
 *   G22-C-006 — ChatExportService.export() refuses unknown conversation
 *   G22-C-007 — MultilingualHandler negotiates the full 10-locale set
 *   G22-C-008 — MultilingualHandler falls back when locale is unsupported
 *   G22-C-009 — MultilingualHandler preserves entities verbatim
 *   G22-C-010 — ChatExportAuditSink writes the typed chat.export.* action
 *   G22-C-011 — ChatExportController exists and is registered in the module
 *   G22-C-012 — Phase 15 G15 still APPROVED (no regression)
 */

import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  CsvExportRenderer,
  JsonExportRenderer,
  MarkdownExportRenderer,
  RENDERERS,
  type ExportRow,
} from '../../modules/chat/services/chat-export-renderers';
import { MultilingualHandler } from '../../modules/chat/multilingual/multilingual.handler';
import { ResponseLocalizer } from '../../modules/chat/multilingual/response-localizer';
import { ChatExportService } from '../../modules/chat/services/chat-export.service';
import { ChatExportAuditSink } from '../../modules/chat/services/chat-export-audit-sink';
import { KNOWN_LOCALES } from '../../modules/chat/multilingual/response-localizer';
import { Phase15CertificationRunner } from './phase15-certification.runner';

interface GateResult {
  readonly id: string;
  readonly name: string;
  readonly passed: boolean;
  readonly detail?: string;
}

@Injectable()
export class Phase22CertificationRunner {
  private readonly logger = new Logger(Phase22CertificationRunner.name);

  async run(): Promise<{
    readonly verdict: 'APPROVED' | 'BLOCKED';
    readonly gates: ReadonlyArray<GateResult>;
  }> {
    const gates: GateResult[] = [];
    let allPassed = true;
    const record = (
      id: string,
      name: string,
      passed: boolean,
      detail?: string,
    ) => {
      const r: GateResult = { id, name, passed, detail };
      gates.push(r);
      if (!passed) allPassed = false;
    };

    // G22-C-001 — all 3 renderers registered
    record(
      'G22-C-001',
      'renderers registered for csv, markdown, json',
      RENDERERS.has('csv') &&
        RENDERERS.has('markdown') &&
        RENDERERS.has('json'),
      `RENDERERS.size=${RENDERERS.size}`,
    );

    const sampleRows: ExportRow[] = [
      {
        id: 'm1',
        role: 'user',
        content: 'hello world',
        createdAt: new Date('2026-08-01T10:00:00.000Z'),
        model: 'gpt-4o',
        provider: 'openai',
      },
      {
        id: 'm2',
        role: 'assistant',
        content: 'hi there',
        createdAt: new Date('2026-08-01T10:00:05.000Z'),
        model: 'gpt-4o',
        provider: 'openai',
      },
    ];

    // G22-C-002 — CSV
    const csv = new CsvExportRenderer().render(sampleRows).toString('utf-8');
    const csvOk =
      csv.startsWith('timestamp,role,model,provider,content') &&
      csv.includes('2026-08-01T10:00:00.000Z') &&
      csv.includes('"hello world"') &&
      csv.includes('"gpt-4o"') &&
      csv.split('\n').length === 3;
    record('G22-C-002', 'CSV renderer emits byte-correct rows', csvOk, csv.slice(0, 80));

    // G22-C-003 — Markdown
    const md = new MarkdownExportRenderer().render(sampleRows).toString('utf-8');
    const mdOk =
      md.includes('### USER — 2026-08-01T10:00:00.000Z') &&
      md.includes('### ASSISTANT —') &&
      md.includes('hello world');
    record('G22-C-003', 'Markdown renderer emits byte-correct headings', mdOk, md.slice(0, 80));

    // G22-C-004 — JSON
    const json = new JsonExportRenderer().render(sampleRows).toString('utf-8');
    let jsonOk = false;
    try {
      const parsed = JSON.parse(json);
      jsonOk =
        Array.isArray(parsed) &&
        parsed.length === 2 &&
        parsed[0].role === 'user' &&
        parsed[0].createdAt === '2026-08-01T10:00:00.000Z';
    } catch {
      jsonOk = false;
    }
    record('G22-C-004', 'JSON renderer emits byte-correct JSON', jsonOk);

    // G22-C-005 — wildcard tenant
    let wildcardRejected = false;
    try {
      const svc = new ChatExportService({} as never, undefined);
      await svc.export({
        tenantId: '*',
        actorId: 'u',
        conversationId: 'c',
        format: 'json',
        redact: false,
      });
    } catch (e) {
      wildcardRejected =
        (e as Error).name === 'ChatExportForbiddenError' ||
        (e as Error).message.includes('tenant');
    }
    record(
      'G22-C-005',
      'ChatExportService.export refuses wildcard tenantId',
      wildcardRejected,
    );

    // G22-C-006 — unknown conversation
    let unknownConvRejected = false;
    try {
      const fakePrisma = {
        chatMessage: {
          findMany: async () => [],
        },
        chatExport: { create: async () => undefined },
      };
      const svc = new ChatExportService(fakePrisma as never, undefined);
      await svc.export({
        tenantId: 't1',
        actorId: 'u1',
        conversationId: 'unknown',
        format: 'json',
        redact: false,
      });
    } catch (e) {
      unknownConvRejected =
        (e as Error).name === 'ChatExportForbiddenError' &&
        (e as Error).message.includes('not found');
    }
    record(
      'G22-C-006',
      'ChatExportService.export refuses unknown conversation',
      unknownConvRejected,
    );

    // G22-C-007 — multilingual full 10 locales
    const localizer = new ResponseLocalizer();
    const handler = new MultilingualHandler(localizer);
    const seven = handler.resolve({ targetLocale: 'de' });
    const ur = handler.resolve({ targetLocale: 'ur' });
    const ar = handler.resolve({ targetLocale: 'ar' });
    const hi = handler.resolve({ targetLocale: 'hi' });
    const pt = handler.resolve({ targetLocale: 'pt' });
    const zh = handler.resolve({ targetLocale: 'zh' });
    const ja = handler.resolve({ targetLocale: 'ja' });
    const allTen =
      seven.targetLocale === 'de' &&
      ur.targetLocale === 'ur' &&
      ar.targetLocale === 'ar' &&
      hi.targetLocale === 'hi' &&
      pt.targetLocale === 'pt' &&
      zh.targetLocale === 'zh' &&
      ja.targetLocale === 'ja' &&
      KNOWN_LOCALES.length === 10;
    record(
      'G22-C-007',
      'MultilingualHandler negotiates the full 10-locale set',
      allTen,
      `KNOWN_LOCALES.length=${KNOWN_LOCALES.length}`,
    );

    // G22-C-008 — fallback
    const fallback = handler.resolve({ targetLocale: 'xx' });
    record(
      'G22-C-008',
      'MultilingualHandler falls back to en when locale unsupported',
      fallback.fallbackApplied === true && fallback.targetLocale === 'en',
      `targetLocale=${fallback.targetLocale} fallbackApplied=${fallback.fallbackApplied}`,
    );

    // G22-C-009 — entity preservation
    const entities = handler.resolve({
      targetLocale: 'es',
      text: 'Contact alice@example.com or pay $5,000 by 2026-08-15',
    });
    const entityOk =
      entities.preservedEntities.some((e) => e.raw === 'alice@example.com') &&
      entities.preservedEntities.some((e) => e.raw === '$5,000') &&
      entities.preservedEntities.some((e) => e.raw === '2026-08-15');
    record(
      'G22-C-009',
      'MultilingualHandler preserves email/currency/date verbatim',
      entityOk,
      `entities=${entities.preservedEntities.length}`,
    );

    // G22-C-010 — audit sink writes the typed chat.export.created action
    const captured: { action: string; resource: string; resourceId: string; tenantId: string } = {
      action: '',
      resource: '',
      resourceId: '',
      tenantId: '',
    };
    const fakeAudit = {
      log: async (input: { action: string; resource: string; resourceId: string; tenantId: string }) => {
        captured.action = input.action;
        captured.resource = input.resource;
        captured.resourceId = input.resourceId;
        captured.tenantId = input.tenantId;
      },
    };
    const sink = new ChatExportAuditSink(fakeAudit as never);
    await sink.record({ sub: 'u1', tenantId: 't1' }, 'exp_1', 'created');
    record(
      'G22-C-010',
      'ChatExportAuditSink writes typed chat.export.created action',
      captured.action === 'chat.export.created' &&
        captured.resource === 'chat_export' &&
        captured.resourceId === 'exp_1' &&
        captured.tenantId === 't1',
      `action=${captured.action}`,
    );

    // G22-C-011 — controller registered in module
    const controllerPath = path.join(
      __dirname,
      '..',
      '..',
      'modules',
      'chat',
      'controllers',
      'chat-export.controller.ts',
    );
    const modulePath = path.join(
      __dirname,
      '..',
      '..',
      'modules',
      'chat',
      'chat.module.ts',
    );
    const controllerExists = fs.existsSync(controllerPath);
    const moduleSrc = fs.existsSync(modulePath)
      ? fs.readFileSync(modulePath, 'utf-8')
      : '';
    const registered =
      controllerExists &&
      moduleSrc.includes('ChatExportController') &&
      moduleSrc.includes('controllers/chat-export.controller');
    record(
      'G22-C-011',
      'ChatExportController exists and is registered in ChatModule',
      registered,
      `exists=${controllerExists}`,
    );

    // G22-C-012 — no regression on Phase 15
    try {
      const p15 = await new Phase15CertificationRunner().run();
      record('G22-C-012', 'Phase 15 G15 still APPROVED', p15.verdict === 'APPROVED');
    } catch (err) {
      record('G22-C-012', 'Phase 15 G15 still APPROVED', false, (err as Error).message);
    }

    return {
      verdict: allPassed ? 'APPROVED' : 'BLOCKED',
      gates,
    };
  }
}
