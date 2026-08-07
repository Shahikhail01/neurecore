/**
 * Channel dispatch — real outbound dispatcher.
 *
 * Source plan: IMPL_PLAN §R4 §4.7.
 *
 * Resolves credentials per tenant (via integration_credential.store)
 * and delegates outbound calls to the typed channel clients:
 *   - TwilioClient        (sms-send, voice-call)
 *   - ZoomClient          (zoom-meeting-create)
 *   - MsTeamsClient       (teams-message-send)
 *   - MsOutlookClient     (outlook-mail-send)
 *
 * SRP: dispatcher owns ONLY the credential → client glue + result
 * envelope. The clients own protocol-level HTTP. The auth clients
 * own OAuth token acquisition / refresh. Each piece is independently
 * testable.
 *
 * Idempotency: every outbound request is tagged with a UUID v4
 * Idempotency-Key derived from (tenantId, connectionId, actionName,
 * payload-hash). Replays within the receiver's dedup window return
 * the original provider id without re-sending.
 */

import { Injectable, Logger } from '@nestjs/common';
import { IntegrationProvider } from '@prisma/client';
import { randomUUID, createHash } from 'node:crypto';
import { PrismaIntegrationCredentialStore } from '../integrations/services/integration-credential.store';
import { MicrosoftGraphAuthService } from '../integrations/microsoft/microsoft-graph-auth.service';
import {
  TwilioClient,
  TwilioSmsParams,
  TwilioVoiceParams,
} from './clients/twilio.client';
import { ZoomClient, ZoomCreateMeetingParams } from './clients/zoom.client';
import {
  MsTeamsClient,
  MsTeamsChatMessageParams,
  IMicrosoftGraphTokenProvider,
} from './clients/ms-teams.client';
import { MsOutlookClient, MsOutlookMailParams } from './clients/ms-outlook.client';
import type {
  ChannelOutboundRequest,
  ChannelOutboundResult,
} from './channel-adapter.registry';
import type {
  ZoomCredentials,
} from '../integrations/zoom/zoom-auth.client';
import type {
  TwilioCredentials,
} from '../integrations/twilio/twilio-auth.client';

/**
 * Minimal Microsoft Graph token adapter — wraps the existing
 * MicrosoftGraphAuthService to satisfy IMicrosoftGraphTokenProvider.
 */
class MsGraphTokenAdapter implements IMicrosoftGraphTokenProvider {
  constructor(private readonly svc: MicrosoftGraphAuthService) {}
  async getAccessToken(tenantId: string): Promise<string> {
    // MicrosoftGraphAuthService.getAccessToken returns string | null; the
    // IMicrosoftGraphTokenProvider contract requires non-null. In
    // production, the credential store should have already been
    // populated by the /authorize + /callback flow.
    const token = await this.svc.getAccessToken(tenantId);
    if (!token) {
      throw new Error(
        `MS Graph access token not available for tenant ${tenantId} — connect via /integrations/microsoft/authorize`,
      );
    }
    return token;
  }
}

@Injectable()
export class ChannelDispatchService {
  private readonly logger = new Logger(ChannelDispatchService.name);

  constructor(
    private readonly credentials: PrismaIntegrationCredentialStore,
    private readonly msGraph: MicrosoftGraphAuthService,
  ) {}

  /**
   * Hash the payload to produce a stable, deterministic idempotency
   * key for replay dedup. Same tenant + connection + action + payload
   * => same key.
   */
  private idempotencyKey(req: ChannelOutboundRequest): string {
    const payloadHash = createHash('sha256')
      .update(JSON.stringify(req.payload ?? {}))
      .digest('hex')
      .slice(0, 16);
    return `${req.tenantId}:${req.connectionId}:${req.actionName}:${payloadHash}`;
  }

  async dispatch(req: ChannelOutboundRequest): Promise<ChannelOutboundResult> {
    const idemKey = this.idempotencyKey(req);

    // The action name determines which provider + client.
    // The kind is provided by the adapter; we resolve provider
    // from the actionName prefix.
    switch (req.kind) {
      case 'SMS':
        return this.dispatchSms(req, idemKey);
      case 'VOICE':
        return this.dispatchVoice(req, idemKey);
      case 'ZOOM':
        return this.dispatchZoom(req, idemKey);
      case 'MS_TEAMS':
        return this.dispatchMsTeams(req, idemKey);
      case 'MS_OUTLOOK':
        return this.dispatchMsOutlook(req, idemKey);
      default:
        return {
          ok: false,
          error: `ChannelDispatchService: real dispatch not implemented for kind=${req.kind}`,
        };
    }
  }

  private async dispatchSms(
    req: ChannelOutboundRequest,
    idemKey: string,
  ): Promise<ChannelOutboundResult> {
    const creds = await this.loadTwilioCredentials(req.tenantId);
    if (!creds) return this.credentialsRequired('TWILIO');
    const client = new TwilioClient(creds);
    const params: TwilioSmsParams = {
      tenantId: req.tenantId,
      to: String(req.payload['to'] ?? ''),
      body: String(req.payload['body'] ?? ''),
      from: req.payload['from'] as string | undefined,
      idempotencyKey: idemKey,
    };
    const result = await client.sendSms(params);
    return { ok: true, providerId: result.sid, response: { ...result } };
  }

  private async dispatchVoice(
    req: ChannelOutboundRequest,
    idemKey: string,
  ): Promise<ChannelOutboundResult> {
    const creds = await this.loadTwilioCredentials(req.tenantId);
    if (!creds) return this.credentialsRequired('TWILIO');
    const client = new TwilioClient(creds);
    const params: TwilioVoiceParams = {
      tenantId: req.tenantId,
      to: String(req.payload['to'] ?? ''),
      twiml: String(req.payload['twiml'] ?? ''),
      from: req.payload['from'] as string | undefined,
      idempotencyKey: idemKey,
    };
    const result = await client.placeCall(params);
    return { ok: true, providerId: result.sid, response: { ...result } };
  }

  private async dispatchZoom(
    req: ChannelOutboundRequest,
    idemKey: string,
  ): Promise<ChannelOutboundResult> {
    const creds = await this.loadZoomCredentials(req.tenantId);
    if (!creds) return this.credentialsRequired('ZOOM');
    const client = new ZoomClient(creds);
    const params: ZoomCreateMeetingParams = {
      tenantId: req.tenantId,
      topic: String(req.payload['topic'] ?? 'Meeting'),
      startTime: String(req.payload['startTime'] ?? new Date().toISOString()),
      durationMinutes: Number(req.payload['durationMinutes'] ?? 30),
      agenda: req.payload['agenda'] as string | undefined,
      idempotencyKey: idemKey,
    };
    const result = await client.createMeeting(params);
    return {
      ok: true,
      providerId: String(result.id),
      response: { ...result },
    };
  }

  private async dispatchMsTeams(
    req: ChannelOutboundRequest,
    idemKey: string,
  ): Promise<ChannelOutboundResult> {
    const tokenProvider = new MsGraphTokenAdapter(this.msGraph);
    const client = new MsTeamsClient(tokenProvider);
    const params: MsTeamsChatMessageParams = {
      tenantId: req.tenantId,
      chatId: req.payload['chatId'] as string | undefined,
      teamId: req.payload['teamId'] as string | undefined,
      channelId: req.payload['channelId'] as string | undefined,
      message: String(req.payload['message'] ?? ''),
      idempotencyKey: idemKey,
    };
    const result = await client.sendChatMessage(params);
    return {
      ok: true,
      providerId: result.id,
      response: { ...result },
    };
  }

  private async dispatchMsOutlook(
    req: ChannelOutboundRequest,
    idemKey: string,
  ): Promise<ChannelOutboundResult> {
    const tokenProvider = new MsGraphTokenAdapter(this.msGraph);
    const client = new MsOutlookClient(tokenProvider);
    const params: MsOutlookMailParams = {
      tenantId: req.tenantId,
      userId: req.payload['userId'] as string | undefined,
      subject: String(req.payload['subject'] ?? ''),
      body: {
        contentType: (req.payload['contentType'] as 'Text' | 'HTML') ?? 'Text',
        content: String(req.payload['body'] ?? ''),
      },
      toRecipients: (req.payload['toRecipients'] as MsOutlookMailParams['toRecipients']) ?? [],
      idempotencyKey: idemKey,
    };
    const result = await client.sendMail(params);
    return {
      ok: true,
      providerId: result.deliveryId,
      response: { ...result },
    };
  }

  private async loadTwilioCredentials(
    tenantId: string,
  ): Promise<TwilioCredentials | null> {
    const stored = await this.credentials.get(tenantId, IntegrationProvider.TWILIO);
    if (!stored) return null;
    const parsed = stored as Partial<TwilioCredentials>;
    if (!parsed?.accountSid || !parsed?.apiKey || !parsed?.apiSecret) return null;
    return parsed as TwilioCredentials;
  }

  private async loadZoomCredentials(
    tenantId: string,
  ): Promise<ZoomCredentials | null> {
    const stored = await this.credentials.get(tenantId, IntegrationProvider.ZOOM);
    if (!stored) return null;
    const parsed = stored as Partial<ZoomCredentials>;
    if (!parsed?.accessToken) return null;
    return parsed as ZoomCredentials;
  }

  private credentialsRequired(provider: string): ChannelOutboundResult {
    return {
      ok: false,
      error: `${provider} credentials not configured for this tenant — connect via /settings/integrations`,
    };
  }
}
