/**
 * Phase 15 — G15 Core UX certification runner.
 *
 * Verdict criteria — every gate must pass; failures block release.
 *
 *   G15-C-001 — Phase 14 G14 still APPROVED
 *   G15-C-002 — Phase 13 G13 still APPROVED
 *   G15-C-003 — PageContext accepts every supported entityType
 *   G15-C-004 — PageContext rejects unknown entityType
 *   G15-C-005 — ResponseLocalizer preserves email/currency/date verbatim
 *   G15-C-006 — ResponseLocalizer negotiates locale (en/es/fr fallback)
 *   G15-C-007 — ChatExportService refuses wildcard tenantId
 *   G15-C-008 — ChatExportService audit row carries the right tenantId
 */

import { Injectable, Logger } from '@nestjs/common';
import { Phase13CertificationRunner } from './phase13-certification.runner';
import { Phase14CertificationRunner } from './phase14-certification.runner';
import {
  SUPPORTED_ENTITY_TYPES,
  PageContextDto,
  validatePageContext,
} from '../../modules/chat/page-context.dto';
import { ResponseLocalizer } from '../../modules/chat/multilingual/response-localizer';
import {
  ChatExportService,
  ChatExportForbiddenError,
} from '../../modules/chat/services/chat-export.service';

interface GateResult {
  readonly id: string;
  readonly name: string;
  readonly passed: boolean;
  readonly detail?: string;
}

@Injectable()
export class Phase15CertificationRunner {
  private readonly logger = new Logger(Phase15CertificationRunner.name);

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

    try {
      const p14 = await new Phase14CertificationRunner().run();
      record('G15-C-001', 'Phase 14 G14 still APPROVED', p14.verdict === 'APPROVED');
    } catch (err) {
      record('G15-C-001', 'Phase 14 G14 still APPROVED', false, (err as Error).message);
    }

    try {
      const p13 = await new Phase13CertificationRunner().run();
      record('G15-C-002', 'Phase 13 G13 still APPROVED', p13.verdict === 'APPROVED');
    } catch (err) {
      record('G15-C-002', 'Phase 13 G13 still APPROVED', false, (err as Error).message);
    }

    {
      let failures: string[] = [];
      for (const t of SUPPORTED_ENTITY_TYPES) {
        if (!validatePageContext({ entityType: t, entityId: 'id' })) {
          failures.push(t);
        }
      }
      record(
        'G15-C-003',
        'PageContext accepts every supported entityType',
        failures.length === 0,
        failures.length === 0 ? undefined : 'rejected: ' + failures.join(', '),
      );
    }

    {
      const ok = validatePageContext({ entityType: 'bogus', entityId: 'x' }) === null;
      record('G15-C-004', 'PageContext rejects unknown entityType', ok);
    }

    {
      const svc = new ResponseLocalizer();
      const preserved = svc.extract('alice@example.com $5,000 2026-08-06');
      const raws = preserved.map((p) => p.raw);
      const hasEmail = raws.some((r) => r === 'alice@example.com');
      const hasCurrency = raws.some((r) => r === '$5,000');
      const hasDate = raws.some((r) => r === '2026-08-06');
      record(
        'G15-C-005',
        'ResponseLocalizer preserves email/currency/date verbatim',
        hasEmail && hasCurrency && hasDate,
        `raws=[${raws.join(',')}]`,
      );
    }

    {
      const svc = new ResponseLocalizer();
      const cases: Array<{ input: { targetLocale?: string; acceptLanguage?: string }; expect: string }> = [
        { input: { targetLocale: 'es' }, expect: 'es' },
        { input: { targetLocale: undefined, acceptLanguage: 'en-US,en;q=0.9' }, expect: 'en' },
        { input: {}, expect: 'en' },
      ];
      const failures: string[] = [];
      for (const c of cases) {
        const got = svc.negotiate(c.input.targetLocale, c.input.acceptLanguage);
        if (got !== c.expect) failures.push(`expected ${c.expect} got ${got}`);
      }
      record(
        'G15-C-006',
        'ResponseLocalizer negotiates locale',
        failures.length === 0,
        failures.length === 0 ? undefined : failures.join('; '),
      );
    }

    {
      try {
        const svc = new ChatExportService({} as never);
        await svc.export({
          tenantId: '*',
          actorId: 'u',
          conversationId: 'c',
          format: 'json',
          redact: false,
        });
        record('G15-C-007', 'ChatExportService refuses wildcard tenantId', false, 'did not throw');
      } catch (err) {
        record(
          'G15-C-007',
          'ChatExportService refuses wildcard tenantId',
          err instanceof ChatExportForbiddenError,
        );
      }
    }

    {
      try {
        let recordedTenantId: string | null = null;
        const svc = new ChatExportService({
          auditLog: {
            create: async (input: unknown) => {
              const d = (input ?? {}) as { data?: { tenantId?: string } };
              const tenantId = d.data?.tenantId;
              if (typeof tenantId === 'string') recordedTenantId = tenantId;
              return {};
            },
          },
        } as never);
        await svc.recordAudit(
          { sub: 'u', tenantId: 'tenant-A' },
          'exp-1',
          'downloaded',
        );
        record(
          'G15-C-008',
          'ChatExportService audit row carries the right tenantId',
          recordedTenantId === 'tenant-A',
        );
      } catch (err) {
        record('G15-C-008', 'ChatExportService audit row carries the right tenantId', false, (err as Error).message);
      }
    }

    void PageContextDto; // type-side export reference so unused-import lints do not strip it

    this.logger.log(
      `Phase 15 certification: ${gates.filter((g) => g.passed).length}/${gates.length} passed`,
    );
    return {
      verdict: allPassed ? 'APPROVED' : 'BLOCKED',
      gates,
    };
  }
}
