import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { TranscriptIngestionService } from '../../meetings/services/transcript-ingestion.service';
import { FileIngestionService } from '../../knowledge/services/file-ingestion.service';
import { MicrosoftGraphAuthService } from './microsoft-graph-auth.service';
import type {
  TeamsChatMessageInput,
  TeamsChatMessageReceipt,
  InboundTeamsMeetingTranscript,
  GraphChangeNotificationEnvelope,
} from './dto/microsoft-graph.dto';

interface GraphChatMessage {
  id: string;
  chatId?: string;
  createdDateTime?: string;
}

@Injectable()
export class TeamsAdapterService {
  private readonly logger = new Logger(TeamsAdapterService.name);

  constructor(
    private readonly auth: MicrosoftGraphAuthService,
    private readonly transcriptIngestion: TranscriptIngestionService,
    private readonly fileIngestion: FileIngestionService,
  ) {}

  /**
   * Send a chat message to an existing chat id (`/chats/{id}/messages`).
   * Graph does NOT support creating a new chat from scratch via the
   * delegated `Chat.ReadWrite` scope alone; the chat id must already
   * exist (e.g. created by the user in Teams).
   *
   * Throws on any non-2xx response so the channel adapter returns a
   * `DeliveryReceipt` with `success: false`.
   */
  async sendChatMessage(
    input: TeamsChatMessageInput,
  ): Promise<TeamsChatMessageReceipt> {
    const token = await this.auth.getAccessToken(input.tenantId);
    if (!token) {
      throw new BadRequestException(
        'Microsoft 365 is not connected for this tenant',
      );
    }
    if (!input.chatId || !input.bodyHtml) {
      throw new BadRequestException('Teams send requires chatId and bodyHtml');
    }

    if (input.attachments && input.attachments.length > 0) {
      for (const a of input.attachments) {
        const buffer = Buffer.from(a.contentBytesBase64, 'base64');
        await this.fileIngestion.ingest(
          input.tenantId,
          `teams:${input.tenantId}`,
          a.name,
          a.contentType ?? 'application/octet-stream',
          buffer,
        );
      }
    }

    const url = `https://graph.microsoft.com/v1.0/chats/${encodeURIComponent(input.chatId)}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        body: {
          contentType: 'html',
          content: input.bodyHtml,
          ...(input.bodyText ? { text: input.bodyText } : {}),
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => 'unknown');
      this.logger.error(
        `Teams sendMessage failed tenant=${input.tenantId} status=${res.status}: ${text}`,
      );
      throw new BadRequestException(`Teams send failed: ${text.slice(0, 200)}`);
    }

    const created = (await res.json()) as GraphChatMessage;
    return {
      messageId: created.id,
      chatId: input.chatId,
      threadCorrelationId: `teams:${input.tenantId}:${input.chatId}:${created.id}`,
      createdAt: created.createdDateTime ?? new Date().toISOString(),
    };
  }

  /**
   * Consume Teams meeting-transcript change notifications. The actual
   * transcript download + normalization is delegated to the canonical
   * P3 TranscriptIngestionService so transcript records land in the
   * `MeetingTranscript` store with one shape regardless of provider.
   */
  async ingestTranscriptNotification(input: {
    tenantId: string;
    actorId: string;
    rawBody: string;
    signature?: string;
    envelope: GraphChangeNotificationEnvelope;
  }): Promise<InboundTeamsMeetingTranscript[]> {
    const ingested: InboundTeamsMeetingTranscript[] = [];
    for (const notification of input.envelope.value ?? []) {
      if (notification.clientState) {
        if (
          !this.auth.verifyClientState(input.tenantId, notification.clientState)
        ) {
          throw new ForbiddenException('clientState signature mismatch');
        }
      }
      const data = notification.resourceData;
      const transcriptId = data?.id;
      if (!transcriptId) {
        this.logger.warn(
          `Teams transcript notification missing resourceData.id tenant=${input.tenantId}`,
        );
        continue;
      }
      // The meetingId is encoded in the resource path (e.g.
      // users/{userId}/onlineMeetings/{meetingId}/transcripts/{id}).
      const meetingIdMatch = /onlineMeetings\/([^/]+)\/transcripts/.exec(
        notification.resource,
      );
      const meetingId = meetingIdMatch?.[1] ?? 'unknown';

      await this.transcriptIngestion.ingest({
        tenantId: input.tenantId,
        actorId: input.actorId,
        provider: 'TEAMS',
        externalId: transcriptId,
        rawBody: input.rawBody,
        signature: input.signature,
        consent: {
          tenantId: input.tenantId,
          userId: input.actorId,
          scope: 'TRANSCRIPT_INGEST',
          jurisdiction: 'OTHER',
          grantedAt: new Date().toISOString(),
          provider: 'TEAMS',
        },
      });

      ingested.push({
        tenantId: input.tenantId,
        meetingId,
        transcriptId,
        createdAt: new Date().toISOString(),
        threadCorrelationId: `teams-transcript:${input.tenantId}:${meetingId}:${transcriptId}`,
      });
    }
    return ingested;
  }
}
