/**
 * OutlookCallGraphClient — live Microsoft Graph transcript client.
 *
 * Source plan: IMPLEMENTATION-PLAN-PARITY-COMPLETION.md §6 (P25).
 *
 * Closes the P25 gap: `IOutlookCallGraphClient` was declared by
 * `OutlookCallGraphProvider` but never implemented, so live pull threw
 * `TranscriptProviderUnavailableError`. This is the real HTTP client
 * behind that interface.
 *
 * It fetches a finalized transcript blob for a Microsoft Teams/Outlook
 * online meeting via Graph `communications/onlineMeetings/{id}/transcripts`.
 * Access is a tenant-scoped OAuth bearer token obtained from
 * `IOAuthTokenStore` (refreshing via the token endpoint when expired).
 *
 * Fail-closed: if no tenant-scoped token is available (credentials not
 * provisioned) it throws `TranscriptProviderUnavailableError` — it
 * never fabricates a transcript or proxies to nothing.
 *
 * SOLID — SRP: HTTP + token refresh only; no Prisma, no consent.
 * SOLID — DIP: depends on `IHTTPClient` + `IOAuthTokenStore`.
 * SOLID — ISP: a single `fetchTranscriptBlob` method on the port.
 */

import { Injectable, Logger } from '@nestjs/common';
import type { IHTTPClient } from '../../connectors/adapters/live/http-client';
import type { IOAuthTokenStore } from '../../connectors/interfaces/IOAuthTokenStore';
import {
  I_OUTLOOK_CALL_GRAPH_CLIENT,
  type IOutlookCallGraphClient,
  type OutlookTranscriptPayload,
} from './outlook-call-graph.provider';
import { TranscriptProviderUnavailableError } from './transcript-provider.errors';

export const OUTLOOK_GRAPH_PROVIDER = 'outlook-graph';
export const OUTLOOK_GRAPH_API_BASE =
  'https://graph.microsoft.com/v1.0';
export const OUTLOOK_GRAPH_TOKEN_URL =
  'https://login.microsoftonline.com/common/oauth2/v2.0/token';

@Injectable()
export class OutlookCallGraphClient implements IOutlookCallGraphClient {
  private readonly logger = new Logger(OutlookCallGraphClient.name);

  constructor(
    private readonly http: IHTTPClient,
    private readonly tokenStore: IOAuthTokenStore,
  ) {}

  async fetchTranscriptBlob(params: {
    tenantId: string;
    userId: string;
    onlineMeetingId: string;
  }): Promise<OutlookTranscriptPayload> {
    const accessToken = await this.accessToken(params.tenantId);
    if (!accessToken) {
      throw new TranscriptProviderUnavailableError(
        'Outlook Graph token not provisioned for tenant',
        'OUTLOOK',
        'fetchTranscript',
      );
    }

    // Graph returns a list of transcript metadata under
    // onlineMeetings/{id}/transcripts; we fetch the content of the
    // first available transcript.
    const listUrl = `${OUTLOOK_GRAPH_API_BASE}/communications/onlineMeetings/${encodeURIComponent(
      params.onlineMeetingId,
    )}/transcripts`;
    const listRes = await this.http.request({
      url: listUrl,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });
    if (listRes.status !== 200) {
      throw this.unavailable(
        'Outlook transcripts list returned non-200',
        listRes.status,
      );
    }
    const listBody = this.safeJson(listRes.body);
    const transcripts = Array.isArray(listBody?.value) ? listBody.value : [];
    const first = transcripts[0];
    if (!first?.id) {
      throw new TranscriptProviderUnavailableError(
        'Outlook meeting has no transcripts',
        'OUTLOOK',
        'fetchTranscript',
      );
    }

    // Content fetch: GET /communications/onlineMeetings/{id}/transcripts/{tid}/content
    const contentUrl = `${OUTLOOK_GRAPH_API_BASE}/communications/onlineMeetings/${encodeURIComponent(
      params.onlineMeetingId,
    )}/transcripts/${encodeURIComponent(first.id)}/content`;
    const contentRes = await this.http.request({
      url: contentUrl,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (contentRes.status !== 200) {
      throw this.unavailable(
        'Outlook transcript content returned non-200',
        contentRes.status,
      );
    }

    return {
      id: first.id,
      meetingTitle: first.meetingTitle ?? first.subject,
      startDateTime: first.startDateTime,
      endDateTime: first.endDateTime,
      languageCode: first.language,
      content: contentRes.body,
      participants: Array.isArray(first.participants)
        ? first.participants
        : undefined,
    };
  }

  private async accessToken(tenantId: string): Promise<string | null> {
    try {
      const token = await this.tokenStore.get(tenantId, OUTLOOK_GRAPH_PROVIDER);
      if (!token?.accessToken) return null;
      const expired = await this.tokenStore.isExpired(
        tenantId,
        OUTLOOK_GRAPH_PROVIDER,
      );
      if (!expired) return token.accessToken;
      if (!token.refreshToken) return null;
      const refreshed = await this.refreshToken(tenantId, token.refreshToken);
      return refreshed;
    } catch (err: unknown) {
      this.logger.warn(
        `Outlook token lookup failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return null;
    }
  }

  private async refreshToken(
    tenantId: string,
    refreshToken: string,
  ): Promise<string | null> {
    try {
      const res = await this.http.request({
        url: OUTLOOK_GRAPH_TOKEN_URL,
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          scope: 'OnlineMeetings.Read.All CallRecords.Read.All Transcript.Read.All offline_access',
        }).toString(),
      });
      if (res.status !== 200) {
        this.logger.warn(`Outlook token refresh non-200: ${res.status}`);
        return null;
      }
      const body = this.safeJson(res.body);
      const accessToken = body?.access_token;
      if (typeof accessToken !== 'string') return null;
      const nextRefreshToken = body?.refresh_token;
      await this.tokenStore.save(tenantId, OUTLOOK_GRAPH_PROVIDER, {
        accessToken,
        refreshToken:
          typeof nextRefreshToken === 'string' ? nextRefreshToken : refreshToken,
        expiresAt: body?.expires_in
          ? new Date(Date.now() + Number(body.expires_in) * 1000)
          : undefined,
        scopes: ['OnlineMeetings.Read.All', 'CallRecords.Read.All', 'Transcript.Read.All'],
      });
      return accessToken;
    } catch (err: unknown) {
      this.logger.warn(
        `Outlook token refresh failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return null;
    }
  }

  private unavailable(
    message: string,
    status?: number,
  ): TranscriptProviderUnavailableError {
    const msg = status
      ? `${message} (HTTP ${status})`
      : message;
    return new TranscriptProviderUnavailableError(msg, 'OUTLOOK', 'fetchTranscript');
  }

  private safeJson(body: string): Record<string, unknown> {
    try {
      const parsed: unknown = JSON.parse(body);
      return parsed && typeof parsed === 'object'
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
}
