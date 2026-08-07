/**
 * Microsoft Teams — Channel Client.
 *
 * Source plan: IMPL_PLAN §R4 §4.7 — replaces MsTeamsAdapter.dispatch() stub.
 *
 * SRP: protocol-level request building for Microsoft Graph `chatMessage`
 * endpoint. The MicrosoftGraphAuthService provides tokens at runtime;
 * we expect the caller (channel adapter) to inject a token provider.
 *
 * Endpoints:
 *   POST https://graph.microsoft.com/v1.0/teams/{teamId}/channels/{channelId}/messages
 *   POST https://graph.microsoft.com/v1.0/chats/{chatId}/messages
 */

import {
  Injectable,
  Logger,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';

export interface MsTeamsChatMessageParams {
  tenantId: string;
  /** Either chatId OR (teamId + channelId) must be present. */
  chatId?: string;
  teamId?: string;
  channelId?: string;
  message: string;
  idempotencyKey: string;
}

export interface MsTeamsChatMessageResult {
  id: string;
  createdDateTime: string;
}

export class MsGraphAuthException extends Error {
  constructor(public readonly inner: unknown) {
    super('MS Graph access token invalid — refresh and retry');
    this.name = 'MsGraphAuthException';
  }
}

export interface IMicrosoftGraphTokenProvider {
  /** Returns a valid bearer token for the tenant; refreshes if needed. */
  getAccessToken(tenantId: string): Promise<string>;
}

@Injectable()
export class MsTeamsClient {
  private readonly logger = new Logger(MsTeamsClient.name);

  constructor(
    private readonly tokenProvider: IMicrosoftGraphTokenProvider,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async sendChatMessage(
    params: MsTeamsChatMessageParams,
  ): Promise<MsTeamsChatMessageResult> {
    const token = await this.tokenProvider.getAccessToken(params.tenantId);
    let url: string;
    if (params.chatId) {
      url = `https://graph.microsoft.com/v1.0/chats/${encodeURIComponent(params.chatId)}/messages`;
    } else if (params.teamId && params.channelId) {
      url = `https://graph.microsoft.com/v1.0/teams/${encodeURIComponent(params.teamId)}/channels/${encodeURIComponent(params.channelId)}/messages`;
    } else {
      throw new BadRequestException(
        'MsTeamsClient.sendChatMessage requires either chatId OR (teamId + channelId)',
      );
    }
    const body = {
      body: { content: params.message, contentType: 'text' },
    };
    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': params.idempotencyKey,
        // ClientRequestId is honoured by Graph for dedup on retry.
        'client-request-id': params.idempotencyKey,
      },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      return (await res.json()) as MsTeamsChatMessageResult;
    }
    const text = await res.text().catch(() => '');
    if (res.status === 401) {
      throw new MsGraphAuthException({ status: 401, body: text });
    }
    if (res.status >= 500) {
      throw new ServiceUnavailableException({
        code: 'MS_GRAPH_TRANSIENT',
        status: res.status,
        body: text,
        idempotencyKey: params.idempotencyKey,
      });
    }
    throw new BadRequestException({
      code: 'MS_GRAPH_BAD_REQUEST',
      status: res.status,
      body: text,
      idempotencyKey: params.idempotencyKey,
    });
  }
}
