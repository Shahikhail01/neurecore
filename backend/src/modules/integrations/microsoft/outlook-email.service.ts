import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { FileIngestionService } from '../../knowledge/services/file-ingestion.service';
import { MicrosoftGraphAuthService } from './microsoft-graph-auth.service';
import type {
  SendOutlookMailInput,
  OutlookDeliveryReceipt,
  InboundOutlookMessage,
  OutlookAttachment,
} from './dto/microsoft-graph.dto';

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const INBOUND_PAGE_SIZE = 25;

interface GraphMessage {
  id: string;
  conversationId?: string;
  subject?: string;
  receivedDateTime?: string;
  sentDateTime?: string;
  bodyPreview?: string;
  body?: { contentType?: string; content?: string };
  from?: { emailAddress?: { name?: string; address?: string } };
  toRecipients?: { emailAddress?: { name?: string; address?: string } }[];
  ccRecipients?: { emailAddress?: { name?: string; address?: string } }[];
  hasAttachments?: boolean;
  internetMessageId?: string;
}

interface GraphMessageList {
  value: GraphMessage[];
  '@odata.nextLink'?: string;
}

interface GraphAttachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
  isInline: boolean;
  contentId?: string;
  contentBytes?: string;
  '@odata.type'?: string;
}

@Injectable()
export class OutlookEmailService {
  private readonly logger = new Logger(OutlookEmailService.name);

  constructor(
    private readonly auth: MicrosoftGraphAuthService,
    private readonly fileIngestion: FileIngestionService,
  ) {}

  /**
   * Send an email via Microsoft Graph `/me/sendMail`.
   *
   * Returns the Graph messageId for the sent message along with the
   * thread-correlation id (conversationId). On failure throws — the
   * channel adapter is responsible for translating the exception into
   * a `DeliveryReceipt` with `success: false`.
   *
   * Every attachment is run through the canonical file-ingestion
   * pipeline (knowledge/services/file-ingestion.service.ts from P2)
   * BEFORE it is sent, so that malware scanning, hashing and dedupe
   * are applied uniformly regardless of the inbound channel.
   */
  async send(input: SendOutlookMailInput): Promise<OutlookDeliveryReceipt> {
    const token = await this.auth.getAccessToken(input.tenantId);
    if (!token) {
      throw new BadRequestException(
        'Microsoft 365 is not connected for this tenant',
      );
    }
    if (!input.to || input.to.length === 0) {
      throw new BadRequestException(
        'Outlook send requires at least one recipient',
      );
    }
    if (!input.subject || input.subject.trim().length === 0) {
      throw new BadRequestException('Outlook send requires a subject');
    }

    const sanitizedAttachments = input.attachments
      ? await this.preflightAttachments(input.tenantId, input.attachments)
      : undefined;

    const message: Record<string, unknown> = {
      subject: input.subject,
      body: {
        contentType: 'HTML',
        content: input.bodyHtml,
      },
      toRecipients: input.to.map((addr) => ({
        emailAddress: { address: addr },
      })),
      ...(input.cc && input.cc.length > 0
        ? {
            ccRecipients: input.cc.map((addr) => ({
              emailAddress: { address: addr },
            })),
          }
        : {}),
      ...(input.bcc && input.bcc.length > 0
        ? {
            bccRecipients: input.bcc.map((addr) => ({
              emailAddress: { address: addr },
            })),
          }
        : {}),
      ...(sanitizedAttachments && sanitizedAttachments.length > 0
        ? {
            attachments: sanitizedAttachments.map((a) => ({
              '@odata.type': '#microsoft.graph.fileAttachment',
              name: a.name,
              contentType: a.contentType,
              contentBytes: a.contentBytesBase64,
              isInline: a.isInline ?? false,
            })),
          }
        : {}),
    };

    const endpoint = input.fromUpn
      ? `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(input.fromUpn)}/sendMail`
      : 'https://graph.microsoft.com/v1.0/me/sendMail';

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        saveToSentItems: input.saveToSentItems ?? true,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => 'unknown');
      this.logger.error(
        `Outlook sendMail failed tenant=${input.tenantId} status=${res.status}: ${text}`,
      );
      throw new BadRequestException(
        `Outlook send failed: ${text.slice(0, 200)}`,
      );
    }

    // /me/sendMail returns 202 Accepted with no body. Look up the
    // sent message id via the SentItems folder so the caller has a
    // stable messageId for receipts / correlation.
    const sentMessage = await this.lookupSentMessage(
      input.tenantId,
      token,
      input.subject,
    ).catch(() => undefined);

    const messageId = sentMessage?.id ?? `outlook-pending-${Date.now()}`;
    const conversationId =
      sentMessage?.conversationId ??
      input.conversationId ??
      input.replyToConversationId;

    return {
      messageId,
      conversationId,
      threadCorrelationId: deriveThreadCorrelationId(
        input.tenantId,
        input.replyToConversationId,
        conversationId,
      ),
    };
  }

  /**
   * Poll inbound messages via delta query so previously seen ids are
   * never re-delivered. Returns the deltas since the last invocation
   * when `deltaLink` is provided; otherwise a fresh page.
   *
   * Every attachment is fetched and forwarded through the file-
   * ingestion service so we don't store raw email attachments in the
   * knowledge index without scanning.
   */
  async receive(input: {
    tenantId: string;
    deltaLink?: string;
    folderId?: string;
    top?: number;
  }): Promise<{
    messages: InboundOutlookMessage[];
    nextDeltaLink?: string;
  }> {
    const token = await this.auth.getAccessToken(input.tenantId);
    if (!token) {
      throw new BadRequestException(
        'Microsoft 365 is not connected for this tenant',
      );
    }

    const top = clampTop(input.top);
    const path = input.deltaLink
      ? input.deltaLink
      : `https://graph.microsoft.com/v1.0/me/${
          input.folderId
            ? `mailFolders/${encodeURIComponent(input.folderId)}/messages/delta`
            : 'messages/delta'
        }?$top=${top}`;

    const list = await this.fetchJson<GraphMessageList>(path, token);

    const messages: InboundOutlookMessage[] = [];
    for (const msg of list.value ?? []) {
      if (!msg.id) continue;
      const attachments =
        msg.hasAttachments === true
          ? await this.fetchAttachments(input.tenantId, token, msg.id)
          : [];
      const threadCorrelationId = deriveThreadCorrelationId(
        input.tenantId,
        msg.conversationId,
        msg.id,
      );
      messages.push({
        tenantId: input.tenantId,
        messageId: msg.id,
        conversationId: msg.conversationId,
        threadCorrelationId,
        from: msg.from?.emailAddress?.address ?? '',
        to: (msg.toRecipients ?? []).map((r) => r.emailAddress?.address ?? ''),
        subject: msg.subject ?? '',
        bodyHtml:
          msg.body?.contentType === 'html' ? (msg.body.content ?? '') : '',
        bodyText:
          msg.body?.contentType === 'text'
            ? (msg.body.content ?? '')
            : (msg.bodyPreview ?? ''),
        receivedAt:
          msg.receivedDateTime ?? msg.sentDateTime ?? new Date().toISOString(),
        attachments,
      });
    }

    return {
      messages,
      nextDeltaLink: list['@odata.nextLink'],
    };
  }

  private async lookupSentMessage(
    tenantId: string,
    token: string,
    subject: string,
  ): Promise<GraphMessage | undefined> {
    const safeSubject = subject.replace(/'/g, "''");
    const url = `https://graph.microsoft.com/v1.0/me/mailFolders/SentItems/messages?$filter=subject eq '${safeSubject}'&$top=1&$orderby=sentDateTime desc`;
    const list = await this.fetchJson<GraphMessageList>(url, token);
    return list.value?.[0];
  }

  private async fetchAttachments(
    tenantId: string,
    token: string,
    messageId: string,
  ): Promise<OutlookAttachment[]> {
    const url = `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(messageId)}/attachments`;
    const list = await this.fetchJson<{ value: GraphAttachment[] }>(url, token);
    const out: OutlookAttachment[] = [];
    for (const a of list.value ?? []) {
      const size = a.size ?? 0;
      if (size > MAX_ATTACHMENT_BYTES) {
        this.logger.warn(
          `Skipping oversized Outlook attachment (${a.name}, ${size} bytes) tenant=${tenantId}`,
        );
        continue;
      }
      const contentBytes = a.contentBytes
        ? Buffer.from(a.contentBytes, 'base64')
        : undefined;
      if (contentBytes && contentBytes.length > 0) {
        try {
          await this.fileIngestion.ingest(
            tenantId,
            `microsoft:${tenantId}`,
            a.name,
            a.contentType ?? 'application/octet-stream',
            contentBytes,
          );
        } catch (err) {
          this.logger.error(
            `Failed to ingest Outlook attachment ${a.id} (${a.name}) tenant=${tenantId}: ${(err as Error).message}`,
          );
          // Do NOT silently drop — keep the attachment out of the
          // returned message so the caller does not ingest
          // uninspected content into the knowledge index.
          continue;
        }
      }
      out.push({
        id: a.id,
        name: a.name,
        contentType: a.contentType,
        size,
        contentBytes,
        contentId: a.contentId,
        isInline: a.isInline ?? false,
      });
    }
    return out;
  }

  private async preflightAttachments(
    tenantId: string,
    attachments: ReadonlyArray<{
      name: string;
      contentType: string;
      contentBytesBase64: string;
      sourceUrl?: string;
      isInline?: boolean;
    }>,
  ): Promise<
    Array<{
      name: string;
      contentType: string;
      contentBytesBase64: string;
      isInline?: boolean;
    }>
  > {
    const safe: Array<{
      name: string;
      contentType: string;
      contentBytesBase64: string;
      isInline?: boolean;
    }> = [];
    for (const a of attachments) {
      if (!a.name || !a.contentType || !a.contentBytesBase64) continue;
      const buffer = Buffer.from(a.contentBytesBase64, 'base64');
      if (buffer.length === 0 || buffer.length > MAX_ATTACHMENT_BYTES) {
        throw new BadRequestException(
          `Attachment ${a.name} exceeds size limits or is empty`,
        );
      }
      try {
        await this.fileIngestion.ingest(
          tenantId,
          `microsoft:${tenantId}`,
          a.name,
          a.contentType ?? 'application/octet-stream',
          buffer,
        );
      } catch (err) {
        // Outbound attachments MUST also pass the scan; if not,
        // refuse to send to avoid leaking unscanned bytes through
        // Graph.
        throw new BadRequestException(
          `Attachment ${a.name} failed ingestion: ${(err as Error).message}`,
        );
      }
      safe.push({
        name: a.name,
        contentType: a.contentType,
        contentBytesBase64: a.contentBytesBase64,
        isInline: a.isInline,
      });
    }
    return safe;
  }

  private async fetchJson<T>(url: string, token: string): Promise<T> {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => 'unknown');
      throw new BadRequestException(
        `Graph request failed (${res.status}): ${text.slice(0, 200)}`,
      );
    }
    return (await res.json()) as T;
  }
}

function deriveThreadCorrelationId(
  tenantId: string,
  conversationId: string | undefined,
  messageId: string | undefined,
): string {
  const basis = conversationId ?? messageId ?? 'unknown';
  return `outlook:${tenantId}:${basis}`;
}

function clampTop(top: number | undefined): number {
  if (!top || !Number.isInteger(top)) return INBOUND_PAGE_SIZE;
  return Math.min(Math.max(top, 1), 100);
}
