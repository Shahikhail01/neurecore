/**
 * Microsoft Graph DTOs — P7 Channels.
 *
 * DTOs are intentionally narrow, validated payloads (no class-validator
 * decorators; the controller checks required fields and throws
 * BadRequestException) so they remain usable from server-to-server
 * callers and unit tests without Nest's ValidationPipe.
 */

export interface SendOutlookMailInput {
  tenantId: string;
  fromUpn?: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  attachments?: OutlookAttachmentInput[];
  replyToConversationId?: string;
  /** Tenant conversation id used to thread outbound replies. */
  conversationId?: string;
  /** Whether to save to Sent Items (default true). */
  saveToSentItems?: boolean;
}

export interface OutlookAttachmentInput {
  /** Display filename. */
  name: string;
  /** MIME type — must be one we allow through the file-ingestion pipeline. */
  contentType: string;
  /** Base64-encoded raw bytes. */
  contentBytesBase64: string;
  /** Optional source URI for audit / knowledge index. */
  sourceUrl?: string;
  isInline?: boolean;
}

export interface OutlookDeliveryReceipt {
  messageId: string;
  conversationId?: string;
  threadCorrelationId: string;
}

export interface InboundOutlookMessage {
  tenantId: string;
  messageId: string;
  conversationId?: string;
  threadCorrelationId: string;
  from: string;
  to: string[];
  subject: string;
  bodyHtml: string;
  bodyText: string;
  receivedAt: string;
  attachments: OutlookAttachment[];
}

export interface OutlookAttachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
  contentBytes?: Buffer;
  contentId?: string;
  isInline: boolean;
}

export interface OutlookCalendarEventInput {
  subject: string;
  bodyHtml?: string;
  bodyText?: string;
  startIso: string;
  endIso: string;
  timeZone?: string;
  location?: string;
  attendees?: { email: string; type?: 'required' | 'optional' }[];
  isOnline?: boolean;
}

export interface OutlookCalendarEvent {
  id: string;
  subject: string;
  startIso: string;
  endIso: string;
  timeZone: string;
  attendees: { email: string; responseStatus?: string }[];
  webLink?: string;
  isCancelled: boolean;
}

export interface TeamsChatMessageInput {
  tenantId: string;
  /** Target chat id (Graph /chats/{id}/messages) or a UPN (resolved to existing chat). */
  chatId: string;
  bodyHtml: string;
  bodyText?: string;
  attachments?: OutlookAttachmentInput[];
  /** Tenant conversation id used for correlation. */
  conversationId?: string;
}

export interface TeamsChatMessageReceipt {
  messageId: string;
  chatId: string;
  threadCorrelationId: string;
  createdAt: string;
}

export interface GraphChangeNotification {
  subscriptionId: string;
  subscriptionExpirationDateTime: string;
  tenantId: string;
  clientState?: string;
  resource: string;
  resourceData?: {
    id: string;
    '@odata.type'?: string;
    '@odata.id'?: string;
    [k: string]: unknown;
  };
  changeType: 'created' | 'updated' | 'deleted';
}

export interface GraphChangeNotificationEnvelope {
  value: GraphChangeNotification[];
}

export interface InboundTeamsMeetingTranscript {
  tenantId: string;
  meetingId: string;
  transcriptId: string;
  createdAt: string;
  threadCorrelationId: string;
}
