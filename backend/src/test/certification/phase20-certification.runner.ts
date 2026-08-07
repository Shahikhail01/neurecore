/**
 * Phase 20 — G20 Channels + Mobile certification runner.
 *
 * Verdict criteria — every gate must pass; failures block release.
 *
 *   G20-C-001 — Phase 19 G19 still APPROVED
 *   G20-C-002 — SlackAdapterService rejects wildcard tenantId
 *   G20-C-003 — SlackAdapterService throws SlackOutOfScopeError when OUT_OF_SCOPE
 *   G20-C-004 — SlackAdapterService.sendMessage succeeds when IN_SCOPE
 *   G20-C-005 — CrmEventTriggerService refuses wildcard tenantId
 *   G20-C-006 — CrmEventTriggerService refuses unsupported source
 *   G20-C-007 — CrmEventTriggerService.ingest returns idempotent eventId
 *   G20-C-008 — MobileSupportMatrix declares typed actions + viewport
 */

import { Injectable, Logger } from '@nestjs/common';
import { Phase19CertificationRunner } from './phase19-certification.runner';
import {
  SlackAdapterService,
  isSlackInScope,
  SlackOutOfScopeError,
} from '../../modules/channels/slack/slack-adapter.service';
import { CrmEventTriggerService } from '../../modules/channels/crm/crm-event-trigger.service';
import {
  MOBILE_SUPPORT_MATRIX_V1,
  mobileSupportFor,
} from '../../modules/integrations/mobile/mobile-support-matrix';

interface GateResult {
  readonly id: string;
  readonly name: string;
  readonly passed: boolean;
  readonly detail?: string;
}

@Injectable()
export class Phase20CertificationRunner {
  private readonly logger = new Logger(Phase20CertificationRunner.name);

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
      const p19 = await new Phase19CertificationRunner().run();
      record('G20-C-001', 'Phase 19 G19 still APPROVED', p19.verdict === 'APPROVED');
    } catch (err) {
      record('G20-C-001', 'Phase 19 G19 still APPROVED', false, (err as Error).message);
    }

    // Slack
    {
      SlackAdapterService.markOutOfScope();
      const svc = new SlackAdapterService();
      let rejectedWildcard = false;
      try {
        await svc.listChannels('*');
      } catch (e) {
        rejectedWildcard = e instanceof SlackOutOfScopeError;
      }
      record('G20-C-002', 'SlackAdapterService rejects wildcard tenantId', rejectedWildcard);

      let rejectedOutOfScope = false;
      try {
        await svc.listChannels('tenant-A');
      } catch (e) {
        rejectedOutOfScope = e instanceof SlackOutOfScopeError;
      }
      record(
        'G20-C-003',
        'SlackAdapterService throws SlackOutOfScopeError when OUT_OF_SCOPE',
        rejectedOutOfScope && !isSlackInScope(),
      );

      SlackAdapterService.markInScope();
      const inScopeSvc = new SlackAdapterService();
      const out = await inScopeSvc.sendMessage({
        tenantId: 'tenant-A',
        channel: {
          teamId: 'T1',
          channelId: 'C1',
          channelName: 'general',
          isPrivate: false,
        },
        author: {
          userId: 'U1',
          teamId: 'T1',
          displayName: 'Alice',
        },
        text: 'hi',
        idempotencyKey: 'k-1',
      });
      record(
        'G20-C-004',
        'SlackAdapterService.sendMessage succeeds when IN_SCOPE',
        out.messageId === 'slack-stub',
      );
      SlackAdapterService.markOutOfScope();
    }

    // CRM event trigger
    {
      const makePrisma = (opts: { tenantFound?: boolean } = {}) => ({
        prisma: {
          tenant: {
            findFirst: async () => (opts.tenantFound === false ? null : { id: 'tenant-A' }),
          },
        },
      });
      const baseEnvelope = {
        tenantId: 'tenant-A',
        source: 'hubspot' as const,
        eventType: 'lead.created',
        payload: { id: 'lead-1' },
        receivedAt: new Date().toISOString(),
      };

      let rejectedWildcard = false;
      const svc1 = new CrmEventTriggerService(makePrisma().prisma as never);
      try {
        await svc1.ingest({ ...baseEnvelope, tenantId: '*' });
      } catch {
        rejectedWildcard = true;
      }
      record('G20-C-005', 'CrmEventTriggerService refuses wildcard tenantId', rejectedWildcard);

      let rejectedUnsupported = false;
      const svc2 = new CrmEventTriggerService(makePrisma().prisma as never);
      try {
        await svc2.ingest({ ...baseEnvelope, source: 'jira' as never });
      } catch {
        rejectedUnsupported = true;
      }
      record('G20-C-006', 'CrmEventTriggerService refuses unsupported source', rejectedUnsupported);

      const svc3 = new CrmEventTriggerService(makePrisma().prisma as never);
      const a = await svc3.ingest(baseEnvelope);
      const b = await svc3.ingest(baseEnvelope);
      record(
        'G20-C-007',
        'CrmEventTriggerService.ingest returns idempotent eventId',
        a.eventId === b.eventId,
        `a=${a.eventId} b=${b.eventId}`,
      );
    }

    // Mobile support matrix
    {
      const chatOk = mobileSupportFor(MOBILE_SUPPORT_MATRIX_V1, 'send-chat-message')?.status === 'SUPPORTED';
      const forecastDesktopOnly =
        mobileSupportFor(MOBILE_SUPPORT_MATRIX_V1, 'view-forecast')?.minimumViewport === 'desktop';
      const everyAction = MOBILE_SUPPORT_MATRIX_V1.actions.every(
        (a) => ['mobile', 'tablet', 'desktop'].includes(a.minimumViewport),
      );
      record(
        'G20-C-008',
        'MobileSupportMatrix declares typed actions + viewport',
        chatOk && forecastDesktopOnly && everyAction,
        `chatOk=${chatOk} forecastDesktopOnly=${forecastDesktopOnly} every=${everyAction}`,
      );
    }

    this.logger.log(
      `Phase 20 certification: ${gates.filter((g) => g.passed).length}/${gates.length} passed`,
    );
    return {
      verdict: allPassed ? 'APPROVED' : 'BLOCKED',
      gates,
    };
  }
}
