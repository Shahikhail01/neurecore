/**
 * Channel Adapter Interfaces — Phase 6
 *
 * Omnichannel AI: same governed capability through supported channels.
 * Channel adapters translate inbound/outbound transport; they do not contain
 * business logic.
 *
 * Initial channels:
 * - Web chat (existing)
 * - Gmail/email via Google integration
 * - Google Calendar via integration services
 * - CRM/commerce via connector registry
 * - Brevo outbound notifications
 * - Teams/Outlook/Slack (after certified adapters)
 */

import type {
  IChannelReceiver,
  IChannelSender,
  InboundMessage,
  OutboundMessage,
  DeliveryReceipt,
} from '../interfaces';

export type ChannelType =
  | 'WEB_CHAT'
  | 'EMAIL'
  | 'CALENDAR'
  | 'CRM'
  | 'BREVO'
  | 'TEAMS'
  | 'SLACK';

export interface ChannelConfig {
  channel: ChannelType;
  tenantId: string;
  enabled: boolean;
  consentRequired: boolean;
  rateLimitPerHour: number;
}

/**
 * Web chat channel receiver — wraps existing chat service
 */
export class WebChatReceiver implements IChannelReceiver {
  async receive(input: unknown): Promise<InboundMessage> {
    const data = input as {
      tenantId: string;
      senderId: string;
      content: string;
      metadata?: Record<string, unknown>;
    };

    return {
      tenantId: data.tenantId,
      channel: 'WEB_CHAT',
      senderId: data.senderId,
      content: data.content,
      metadata: data.metadata ?? {},
    };
  }
}

/**
 * Web chat channel sender — wraps existing chat service
 */
export class WebChatSender implements IChannelSender {
  async send(message: OutboundMessage): Promise<DeliveryReceipt> {
    // Implementation would call chat service to send response
    return {
      success: true,
      deliveryId: `webchat-${Date.now()}`,
    };
  }
}

/**
 * Email channel receiver via Gmail integration
 */
export class EmailReceiver implements IChannelReceiver {
  constructor(private readonly integrationToken: unknown) {}

  async receive(input: unknown): Promise<InboundMessage> {
    const data = input as {
      tenantId: string;
      from: string;
      subject: string;
      body: string;
    };

    return {
      tenantId: data.tenantId,
      channel: 'EMAIL',
      senderId: data.from,
      content: `${data.subject}: ${data.body}`,
      metadata: { type: 'email' },
    };
  }
}

/**
 * Email channel sender via integration services
 */
export class EmailSender implements IChannelSender {
  constructor(private readonly integrationToken: unknown) {}

  async send(message: OutboundMessage): Promise<DeliveryReceipt> {
    // Implementation would call email integration service
    return {
      success: true,
      deliveryId: `email-${Date.now()}`,
    };
  }
}

/**
 * Calendar channel receiver via Google Calendar integration
 */
export class CalendarReceiver implements IChannelReceiver {
  constructor(private readonly integrationToken: unknown) {}

  async receive(input: unknown): Promise<InboundMessage> {
    const data = input as {
      tenantId: string;
      userId: string;
      eventTitle: string;
      eventBody: string;
    };

    return {
      tenantId: data.tenantId,
      channel: 'CALENDAR',
      senderId: data.userId,
      content: `Calendar event: ${data.eventTitle}`,
      metadata: { eventTitle: data.eventTitle, eventBody: data.eventBody },
    };
  }
}

/**
 * CRM channel receiver via connector registry
 */
export class CrmReceiver implements IChannelReceiver {
  constructor(private readonly connectorName: string) {}

  async receive(input: unknown): Promise<InboundMessage> {
    const data = input as {
      tenantId: string;
      contactId: string;
      message: string;
      metadata?: Record<string, unknown>;
    };

    return {
      tenantId: data.tenantId,
      channel: 'CRM',
      senderId: data.contactId,
      content: data.message,
      metadata: data.metadata ?? {},
    };
  }
}

/**
 * Brevo outbound notification sender
 */
export class BrevoSender implements IChannelSender {
  constructor(private readonly apiKey: string) {}

  async send(message: OutboundMessage): Promise<DeliveryReceipt> {
    // Implementation would call Brevo API
    return {
      success: true,
      deliveryId: `brevo-${Date.now()}`,
    };
  }
}
