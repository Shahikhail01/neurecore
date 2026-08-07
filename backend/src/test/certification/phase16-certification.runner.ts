/**
 * Phase 16 — G16 Meetings certification runner.
 *
 * Verdict criteria — every gate must pass; failures block release.
 *
 *   G16-M-001 — Phase 15 G15 still APPROVED
 *   G16-M-002 — Phase 14 G14 still APPROVED
 *   G16-M-003 — TranscriptIngestionService refuses wildcard tenantId
 *   G16-M-004 — TranscriptIngestionService refuses ingestion without consent
 *   G16-M-005 — TranscriptIngestionService jurisdiction honours explicit + locale
 *   G16-M-006 — SummaryTemplatesService has 4 default templates
 *   G16-M-007 — ActionExtractorService extracts action verbs + flags ambiguous owners
 *   G16-M-008 — CrmLinkerService refuses cross-tenant target record
 */

import { Injectable, Logger } from '@nestjs/common';
import { Phase14CertificationRunner } from './phase14-certification.runner';
import { Phase15CertificationRunner } from './phase15-certification.runner';
import {
  TranscriptIngestionService,
  MeetingConsentRequiredError,
} from '../../modules/meetings/services/transcript-ingestion.service';
import { SummaryTemplatesService } from '../../modules/meetings/services/summary-templates.service';
import { ActionExtractorService } from '../../modules/meetings/services/action-extractor.service';
import { CrmLinkerService } from '../../modules/meetings/services/crm-linker.service';

interface GateResult {
  readonly id: string;
  readonly name: string;
  readonly passed: boolean;
  readonly detail?: string;
}

@Injectable()
export class Phase16CertificationRunner {
  private readonly logger = new Logger(Phase16CertificationRunner.name);

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
      const p15 = await new Phase15CertificationRunner().run();
      record('G16-M-001', 'Phase 15 G15 still APPROVED', p15.verdict === 'APPROVED');
    } catch (err) {
      record('G16-M-001', 'Phase 15 G15 still APPROVED', false, (err as Error).message);
    }

    try {
      const p14 = await new Phase14CertificationRunner().run();
      record('G16-M-002', 'Phase 14 G14 still APPROVED', p14.verdict === 'APPROVED');
    } catch (err) {
      record('G16-M-002', 'Phase 14 G14 still APPROVED', false, (err as Error).message);
    }

    // G16-M-003 — refuse wildcard
    {
      const svc = new TranscriptIngestionService({
        meetingProviderConsent: {
          findFirst: async () => ({ id: 'c-1', jurisdiction: 'EU-GDPR', scopes: [] }),
          upsert: async () => ({}),
        },
        meetingTranscript: { upsert: async () => ({ id: 'mt-1', provider: 'TEAMS', jurisdiction: 'EU-GDPR', status: 'TRANSCRIBED' }) },
      } as never);
      try {
        await svc.ingest({
          tenantId: '*',
          userId: 'u',
          provider: 'TEAMS',
          providerMeetingId: 'm',
          title: 't',
          scheduledAt: new Date(),
          durationSeconds: 0,
          transcriptText: 'x',
        });
        record('G16-M-003', 'TranscriptIngestionService refuses wildcard tenantId', false);
      } catch {
        record('G16-M-003', 'TranscriptIngestionService refuses wildcard tenantId', true);
      }
    }

    // G16-M-004 — refuse without consent
    {
      const svc = new TranscriptIngestionService({
        meetingProviderConsent: {
          findFirst: async () => null,
          upsert: async () => ({}),
        },
        meetingTranscript: { upsert: async () => ({ id: 'mt-1', provider: 'TEAMS', jurisdiction: 'EU-GDPR', status: 'TRANSCRIBED' }) },
      } as never);
      try {
        await svc.ingest({
          tenantId: 'tenant-A',
          userId: 'u',
          provider: 'TEAMS',
          providerMeetingId: 'm',
          title: 't',
          scheduledAt: new Date(),
          durationSeconds: 0,
          transcriptText: 'x',
        });
        record('G16-M-004', 'TranscriptIngestionService refuses ingestion without consent', false);
      } catch (err) {
        record(
          'G16-M-004',
          'TranscriptIngestionService refuses ingestion without consent',
          err instanceof MeetingConsentRequiredError,
        );
      }
    }

    // G16-M-005 — jurisdiction precedence
    {
      const svc = new TranscriptIngestionService({
        meetingProviderConsent: {
          findFirst: async () => ({ id: 'c-1', jurisdiction: 'EU-GDPR', scopes: [] }),
          upsert: async () => ({}),
        },
        meetingTranscript: {
          upsert: async (args: { create: { jurisdiction: string } }) => ({
            id: 'mt-1',
            provider: 'TEAMS',
            jurisdiction: args.create.jurisdiction,
            status: 'TRANSCRIBED',
          }),
        },
      } as never);
      try {
        const a = await svc.ingest({
          tenantId: 't',
          userId: 'u',
          provider: 'TEAMS',
          providerMeetingId: 'm-1',
          title: 't',
          scheduledAt: new Date(),
          durationSeconds: 0,
          transcriptText: 'x',
          jurisdiction: 'US-CA',
          languageCode: 'en',
        });
        const b = await svc.ingest({
          tenantId: 't',
          userId: 'u',
          provider: 'TEAMS',
          providerMeetingId: 'm-2',
          title: 't',
          scheduledAt: new Date(),
          durationSeconds: 0,
          transcriptText: 'x',
          languageCode: 'de',
        });
        const passed = a.jurisdiction === 'US-CA' && b.jurisdiction === 'EU-GDPR';
        record(
          'G16-M-005',
          'TranscriptIngestionService jurisdiction honours explicit + locale',
          passed,
          passed ? undefined : `a=${a.jurisdiction} b=${b.jurisdiction}`,
        );
      } catch (err) {
        record('G16-M-005', 'TranscriptIngestionService jurisdiction honours explicit + locale', false, (err as Error).message);
      }
    }

    // G16-M-006 — 4 default templates
    {
      const svc = new SummaryTemplatesService({
        meetingSummaryTemplate: {
          findMany: async () => [],
          upsert: async (args: { create: { name: string; meetingType: string; sections: unknown; isDefault: boolean } }) => ({
            ...args.create,
            id: `t-${args.create.name}`,
            tenantId: 'tenant-A',
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
          findFirst: async () => null,
        },
      } as never);
      try {
        const out = await svc.ensureDefaults('tenant-A');
        const ok =
          out.length === 4 &&
          out.map((t) => t.name).join(',') === '1:1,Discovery,Standup,Kickoff';
        record('G16-M-006', 'SummaryTemplatesService has 4 default templates', ok);
      } catch (err) {
        record('G16-M-006', 'SummaryTemplatesService has 4 default templates', false, (err as Error).message);
      }
    }

    // G16-M-007 — extractor surfaces owners + ambiguity
    {
      const svc = new ActionExtractorService();
      try {
        const owned = svc.extract({
          tenantId: 't',
          transcriptId: 't-1',
          transcriptText: '@alice will follow up by 2026-09-12.',
        });
        const ambig = svc.extract({
          tenantId: 't',
          transcriptId: 't-2',
          transcriptText: '@charlie and @dana will close this out.',
        });
        const ok =
          owned[0]?.ownerHint === 'alice' &&
          owned[0]?.dueDate === '2026-09-12' &&
          ambig[0]?.ambiguousOwner === true;
        record(
          'G16-M-007',
          'ActionExtractorService extracts action verbs + flags ambiguous owners',
          ok,
          ok
            ? undefined
            : `owned ownerHint=${owned[0]?.ownerHint} due=${owned[0]?.dueDate}; ambig=${ambig[0]?.ambiguousOwner}`,
        );
      } catch (err) {
        record('G16-M-007', 'ActionExtractorService extracts action verbs + flags ambiguous owners', false, (err as Error).message);
      }
    }

    // G16-M-008 — refuse cross-tenant target record
    {
      const svc = new CrmLinkerService({
        meetingTranscript: {
          findFirst: async () => ({ id: 'mt-1' }),
          update: async () => ({}),
        },
        customer: { findFirst: async () => null },
        customerContact: { findFirst: async () => null },
        deal: { findFirst: async () => null },
        meetingActionItem: { create: async () => ({ id: 'a-1' }) },
      } as never);
      try {
        await svc.link({
          tenantId: 't',
          transcriptId: 'mt-1',
          recordType: 'account',
          recordId: 'c-foreign',
        });
        record('G16-M-008', 'CrmLinkerService refuses cross-tenant target record', false);
      } catch (err) {
        record(
          'G16-M-008',
          'CrmLinkerService refuses cross-tenant target record',
          (err as Error).name === 'CrmLinkerForbiddenError' ||
            (err as Error).message?.includes('does not belong'),
        );
      }
    }

    this.logger.log(
      `Phase 16 certification: ${gates.filter((g) => g.passed).length}/${gates.length} passed`,
    );
    return {
      verdict: allPassed ? 'APPROVED' : 'BLOCKED',
      gates,
    };
  }
}
