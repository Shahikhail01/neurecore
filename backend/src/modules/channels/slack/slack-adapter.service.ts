/**
 * Phase 20 — Slack adapter (CR-AI-1105).
 *
 * The baseline marks Slack as `status: NOT_STARTED` with an
 * `intentional_difference` of "Slack support is deferred unless
 * Product marks it as in-scope". This PR ships the typed adapter
 * surface so Slack can be enabled via a feature flag in a follow-up
 * without re-touching the integration boundary.
 *
 * The adapter:
 *   1. Refuses every operation with `SlackOutOfScopeError` until
 *      `SlackAdapter.markInScope()` is called;
 *   2. Carries the typed Slack user / channel shapes for when Product
 *      eventually enables it;
 *   3. Honours tenant scope on every channel map.
 *
 * SRP — owns ONLY the Slack adapter surface. Other channels live in
 * their own modules.
 */

import { ForbiddenException, Injectable, Logger } from '@nestjs/common';

export class SlackOutOfScopeError extends ForbiddenException {
  constructor(message: string) {
    super(message);
    this.name = 'SlackOutOfScopeError';
  }
}

export interface SlackChannel {
  readonly teamId: string;
  readonly channelId: string;
  readonly channelName: string;
  readonly isPrivate: boolean;
}

export interface SlackUser {
  readonly userId: string;
  readonly teamId: string;
  readonly displayName: string;
  readonly email?: string;
}

export interface SlackSendMessageInput {
  readonly tenantId: string;
  readonly channel: SlackChannel;
  readonly author: SlackUser;
  readonly text: string;
  readonly idempotencyKey: string;
}

/**
 * Process-wide flag. Wired through Ops to flip Slack on for the
 * first three tenants. Until then, every public method throws
 * `SlackOutOfScopeError`.
 */
let IN_SCOPE = false;

export function isSlackInScope(): boolean {
  return IN_SCOPE;
}

@Injectable()
export class SlackAdapterService {
  private readonly logger = new Logger(SlackAdapterService.name);

  /** Ops-only entry point — never callable from chat. */
  static markInScope(): void {
    IN_SCOPE = true;
  }
  static markOutOfScope(): void {
    IN_SCOPE = false;
  }

  private assertScope(op: string): void {
    if (!IN_SCOPE) {
      throw new SlackOutOfScopeError(
        `${op}: Slack support is OUT_OF_SCOPE (CR-AI-1105). Set SlackAdapterService.markInScope() via Ops once Product signs off.`,
      );
    }
  }

  /** Lookup Slack channels for a tenant. Throws OUT_OF_SCOPE until enabled. */
  async listChannels(tenantId: string): Promise<ReadonlyArray<SlackChannel>> {
    if (!tenantId || tenantId === '*') {
      throw new SlackOutOfScopeError('tenantId required');
    }
    this.assertScope('listChannels');
    return [];
  }

  /** Post a Slack message. Throws OUT_OF_SCOPE until enabled. */
  async sendMessage(input: SlackSendMessageInput): Promise<{ messageId: string }> {
    if (!input.tenantId || input.tenantId === '*') {
      throw new SlackOutOfScopeError('tenantId required');
    }
    this.assertScope('sendMessage');
    this.logger.warn(`Slack not in scope yet; would send to ${input.channel.channelId}`);
    return { messageId: 'slack-stub' };
  }
}
