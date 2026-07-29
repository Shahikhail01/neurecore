import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { GoogleAuthClient } from './google-auth.client';

export interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  date: string;
  isUnread: boolean;
  labels: string[];
}

export interface GmailDraft {
  id: string;
  to: string;
  subject: string;
  body: string;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  html?: boolean;
}

@Injectable()
export class GoogleGmailService {
  private readonly logger = new Logger(GoogleGmailService.name);
  private readonly GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';

  constructor(private readonly authClient: GoogleAuthClient) {}

  private async authFetch(
    url: string,
    options: RequestInit = {},
    tenantId: string,
  ): Promise<Response> {
    const accessToken = await this.authClient.getAccessToken(tenantId);
    if (!accessToken) {
      throw new BadRequestException('Google is not connected for this tenant');
    }

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    };

    return fetch(url, { ...options, headers });
  }

  /**
   * List inbox messages
   */
  async listInbox(
    tenantId: string,
    options: {
      maxResults?: number;
      labelIds?: string[];
      pageToken?: string;
      q?: string;
    } = {},
  ): Promise<{ messages: GmailMessage[]; nextPageToken?: string }> {
    const { maxResults = 20, labelIds = ['INBOX'], pageToken, q } = options;
    const params = new URLSearchParams();
    params.set('maxResults', String(maxResults));
    labelIds.forEach((label) => params.append('labelIds', label));
    if (pageToken) params.set('pageToken', pageToken);
    if (q) params.set('q', q);

    const listRes = await this.authFetch(
      `${this.GMAIL_API}/messages?${params.toString()}`,
      {},
      tenantId,
    );

    if (!listRes.ok) {
      const errText = await listRes.text().catch(() => 'unknown');
      this.logger.error(`Gmail inbox fetch failed: ${listRes.status} ${errText}`);
      throw new BadRequestException(`Gmail inbox failed (${listRes.status}): ${errText.slice(0, 200)}`);
    }

    const listData = (await listRes.json()) as {
      messages?: { id: string; threadId: string }[];
      nextPageToken?: string;
    };

    if (!listData.messages || listData.messages.length === 0) {
      return { messages: [], nextPageToken: listData.nextPageToken };
    }

    const detailPromises = listData.messages.map((m) =>
      this.getMessage(tenantId, m.id, m.threadId),
    );
    const messages = await Promise.all(detailPromises);

    return { messages, nextPageToken: listData.nextPageToken };
  }

  /**
   * Get a single message with parsed headers and snippet.
   * @param tenantId The tenant whose Google credentials to use (required).
   * @param messageId Gmail message ID.
   * @param threadId Optional thread ID (only used as a fallback if the
   *                 response omits it).
   */
  async getMessage(
    tenantId: string,
    messageId: string,
    threadId?: string,
  ): Promise<GmailMessage> {
    const res = await this.authFetch(
      `${this.GMAIL_API}/messages/${messageId}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
      {},
      tenantId,
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => 'unknown');
      this.logger.error(`Gmail get message failed: ${res.status} ${errText}`);
      throw new BadRequestException(`Gmail get message failed (${res.status}): ${errText.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      id: string;
      threadId: string;
      snippet: string;
      labelIds: string[];
      payload: { headers: { name: string; value: string }[] };
    };

    const getHeader = (name: string): string =>
      data.payload.headers.find(
        (h) => h.name.toLowerCase() === name.toLowerCase(),
      )?.value ?? '';

    return {
      id: data.id,
      threadId: data.threadId || threadId || '',
      from: getHeader('From'),
      to: getHeader('To'),
      subject: getHeader('Subject'),
      snippet: data.snippet,
      date: getHeader('Date'),
      isUnread: data.labelIds.includes('UNREAD'),
      labels: data.labelIds,
    };
  }

  /**
   * Get the full body of a message (plain text or HTML)
   */
  async getMessageBody(
    messageId: string,
    tenantId: string,
  ): Promise<{ plainText: string; html: string }> {
    const res = await this.authFetch(
      `${this.GMAIL_API}/messages/${messageId}?format=full`,
      {},
      tenantId,
    );

    if (!res.ok) {
      throw new BadRequestException(
        `Failed to fetch message body for ${messageId}`,
      );
    }

    const data = (await res.json()) as {
      payload: {
        mimeType?: string;
        parts?: { mimeType: string; body: { data?: string } }[];
        body?: { data?: string };
      };
    };

    let plainText = '';
    let html = '';

    const decode = (b64: string): string =>
      Buffer.from(b64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(
        'utf-8',
      );

    if (data.payload.parts) {
      for (const part of data.payload.parts) {
        if (part.mimeType === 'text/plain' && part.body.data) {
          plainText = decode(part.body.data);
        } else if (part.mimeType === 'text/html' && part.body.data) {
          html = decode(part.body.data);
        }
      }
    } else if (data.payload.body?.data) {
      const decoded = decode(data.payload.body.data);
      if (data.payload.mimeType === 'text/html') html = decoded;
      else plainText = decoded;
    }

    return { plainText, html };
  }

  /**
   * Send an email via Gmail
   */
  async sendEmail(
    tenantId: string,
    input: SendEmailInput,
  ): Promise<{ messageId: string; threadId: string }> {
    const headers = [
      `To: ${input.to}`,
      `Subject: ${input.subject}`,
      'Content-Type: ' + (input.html ? 'text/html' : 'text/plain'),
    ];
    if (input.cc) headers.push(`Cc: ${input.cc}`);
    if (input.bcc) headers.push(`Bcc: ${input.bcc}`);

    const raw = Buffer.from(
      headers.join('\r\n') + '\r\n\r\n' + input.body,
    ).toString('base64url');

    const res = await this.authFetch(
      `${this.GMAIL_API}/messages/send`,
      {
        method: 'POST',
        body: JSON.stringify({ raw }),
      },
      tenantId,
    );

    if (!res.ok) {
      const err = await res.text().catch(() => 'unknown');
      this.logger.error(`Gmail send failed: ${res.status} ${err}`);
      throw new BadRequestException(`Gmail send failed (${res.status}): ${err.slice(0, 200)}`);
    }

    const data = (await res.json()) as { id: string; threadId: string };
    this.logger.log(`Email sent for tenant ${tenantId}: ${data.id}`);
    return { messageId: data.id, threadId: data.threadId };
  }

  /**
   * List Gmail labels/folders
   */
  async listLabels(
    tenantId: string,
  ): Promise<{ id: string; name: string; type: string }[]> {
    const res = await this.authFetch(`${this.GMAIL_API}/labels`, {}, tenantId);
    if (!res.ok) {
      throw new BadRequestException('Failed to fetch Gmail labels');
    }
    const data = (await res.json()) as {
      labels: { id: string; name: string; type: string }[];
    };
    return data.labels ?? [];
  }

  /**
   * Expose the underlying access token for tool callers (e.g. flag action)
   * that need an Authorization bearer header for ad-hoc Gmail REST calls.
   * Returns null when the tenant has not connected Google.
   */
  async getAccessToken(tenantId: string): Promise<string | null> {
    return this.authClient.getAccessToken(tenantId);
  }
}
