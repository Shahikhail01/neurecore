/**
 * TeamsCallGraphClient — live Microsoft Graph transcript client.
 *
 * Source plan: IMPLEMENTATION-PLAN-PARITY-COMPLETION.md §6 (P25).
 *
 * Closes the P25 gap: `ITeamsCallGraphClient` was declared by
 * `TeamsCallGraphProvider` but never implemented. This is the real
 * HTTP client behind that interface.
 *
 * Fetches a Teams meeting transcript via Graph
 * `users/{userId}/onlineMeetings/{meetingId}/transcripts/{id}/content`.
 * Access is a tenant-scoped OAuth bearer token from `IOAuthTokenStore`
 * (refreshed via the token endpoint when expired).
 *
 * Fail-closed: no token → `TranscriptProviderUnavailableError`; no
 * transcripts → the same. Never fabricates content.
 *
 * SOLID — SRP: HTTP + token refresh only.
 * SOLID — DIP: depends on `IHTTPClient` + `IOAuthTokenStore`.
 * SOLID — ISP: a single `fetchTranscriptBlob` method on the port.
 */

import { Injectable, Logger } from '@nestjs/common';
import type { IHTTPClient } from '../../connectors/adapters/live/http-client';
import type { IOAuthTokenStore } from '../../connectors/interfaces/IOAuthTokenStore';
import {
  I_TEAMS_CALL_GRAPH_CLIENT,
  type ITeamsCallGraphClient,
  type TeamsTranscriptPayload,
} from './teams-call-graph.provider';
import { TranscriptProviderUnavailableError } from './transcript-provider.errors';

export const TEAMS_GRAPH_PROVIDER = 'teams-graph';
export const TEAMS_GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';
export const TEAMS_GRAPH_TOKEN_URL =
  'https://login.microsoftonline.com/common/oauth2/v2.0/token';

@Injectable()
export class TeamsCallGraphClient implements ITeamsCallGraphClient {
  private readonly logger = new Logger(TeamsCallGraphClient.name);

  constructor(
    private readonly http: IHTTPClient,
    private readonly tokenStore: IOAuthTokenStore,
  ) {}

  async fetchTranscriptBlob(params: {
    tenantId: string;
    userId: string;
    onlineMeetingId: string;
  }): Promise<TeamsTranscriptPayload> {
    const accessToken = await this.accessToken(params.tenantId);
    if (!accessToken) {
      throw new TranscriptProviderUnavailableError(
        'Teams Graph token not provisioned for tenant',
        'TEAMS',
        'fetchTranscript',
      );
    }

    const listUrl = `${TEAMS_GRAPH_API_BASE}/users/${encodeURIComponent(
      params.userId,
    )}/onlineMeetings/${encodeURIComponent(params.onlineMeetingId)}/transcripts`;
    const listRes = await this.http.request({
      url: listUrl,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });
    if (listRes.status !== 200) {
      throw this.unavailable('Teams transcripts list non-200', listRes.status);
    }
    const listBody = this.safeJson(listRes.body);
    const transcripts = Array.isArray(listBody?.value) ? listBody.value : [];
    const first = transcripts[0];
    if (!first?.id) {
      throw new TranscriptProviderUnavailableError(
        'Teams meeting has no transcripts',
        'TEAMS',
        'fetchTranscript',
      );
    }

    const contentUrl = `${TEAMS_GRAPH_API_BASE}/users/${encodeURIComponent(
      params.userId,
    )}/onlineMeetings/${encodeURIComponent(
      params.onlineMeetingId,
    )}/transcripts/${encodeURIComponent(first.id)}/content`;
    const contentRes = await this.http.request({
      url: contentUrl,
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (contentRes.status !== 200) {
      throw this.unavailable(
        'Teams transcript content non-200',
        contentRes.status,
      );
    }

    return {
      id: first.id,
      subject: first.subject,
      startDateTime: first.startDateTime,
      endDateTime: first.endDateTime,
      language: first.language,
      transcript: contentRes.body,
      attendees: Array.isArray(first.attendees) ? first.attendees : undefined,
    };
  }

  private async accessToken(tenantId: string): Promise<string | null> {
    try {
      const token = await this.tokenStore.get(tenantId, TEAMS_GRAPH_PROVIDER);
      if (!token?.accessToken) return null;
      const expired = await this.tokenStore.isExpired(
        tenantId,
        TEAMS_GRAPH_PROVIDER,
      );
      if (!expired) return token.accessToken;
      if (!token.refreshToken) return null;
      return this.refreshToken(tenantId, token.refreshToken);
    } catch (err: unknown) {
      this.logger.warn(
        `Teams token lookup failed: ${
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
        url: TEAMS_GRAPH_TOKEN_URL,
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          scope: 'OnlineMeetings.Read.All CallRecords.Read.All Transcript.Read.All Chat.Read.All offline_access',
        }).toString(),
      });
      if (res.status !== 200) {
        this.logger.warn(`Teams token refresh non-200: ${res.status}`);
        return null;
      }
      const body = this.safeJson(res.body);
      const accessToken = body?.access_token;
      if (typeof accessToken !== 'string') return null;
      const nextRefreshToken = body?.refresh_token;
      await this.tokenStore.save(tenantId, TEAMS_GRAPH_PROVIDER, {
        accessToken,
        refreshToken:
          typeof nextRefreshToken === 'string' ? nextRefreshToken : refreshToken,
        expiresAt: body?.expires_in
          ? new Date(Date.now() + Number(body.expires_in) * 1000)
          : undefined,
        scopes: [
          'OnlineMeetings.Read.All',
          'CallRecords.Read.All',
          'Transcript.Read.All',
          'Chat.Read.All',
        ],
      });
      return accessToken;
    } catch (err: unknown) {
      this.logger.warn(
        `Teams token refresh failed: ${
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
    const msg = status ? `${message} (HTTP ${status})` : message;
    return new TranscriptProviderUnavailableError(msg, 'TEAMS', 'fetchTranscript');
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
