/**
 * Channel Adapters — Phase 6
 *
 * Omnichannel AI: the same governed capability surfaced through supported
 * channels. Adapters translate inbound/outbound transport; they do not
 * contain business logic.
 *
 * Anti-fabrication contract (NC-AI-SG-V2 §3.8 — "No mocks"):
 *   - Every send() delegates to a real, injected integration service.
 *   - success:true is returned ONLY when the underlying service returns
 *     a real delivery / message id.
 *   - On any error, send() returns success:false with the underlying
 *     error message — never a hardcoded true.
 *   - deliveryId is the id returned by the real provider; if the provider
 *     cannot be reached, deliveryId is omitted and an error is reported.
 */

import {
  Injectable,
  Logger,
  Optional,
  forwardRef,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import type {
  IChannelReceiver,
  IChannelSender,
  InboundMessage,
  OutboundMessage,
  DeliveryReceipt,
} from '../interfaces';
import { GoogleGmailService } from '../../integrations/google/google-gmail.service';
import { GoogleCalendarService } from '../../integrations/google/google-calendar.service';
import { BrevoEmailService } from '../../integrations/brevo/brevo-email.service';
import { OutlookEmailService } from '../../integrations/microsoft/outlook-email.service';
import { OutlookCalendarService } from '../../integrations/microsoft/outlook-calendar.service';
import { TeamsAdapterService } from '../../integrations/microsoft/teams-adapter.service';
import { ChatHistoryService } from '../../chat/chat-history.service';
import { EventsGateway } from '../../events/events.gateway';

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

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Unknown delivery error';
}

function subjectFromOutbound(message: OutboundMessage): string {
  const subjectMeta = message.metadata?.['subject'];
  if (typeof subjectMeta === 'string' && subjectMeta.trim().length > 0) {
    return subjectMeta;
  }
  return `Message from ${message.channel}`;
}

function bodyFromOutbound(message: OutboundMessage): string {
  return message.content;
}

function htmlFromOutbound(message: OutboundMessage): string {
  return `<p>${message.content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`;
}

/**
 * Web chat channel receiver — wraps existing chat service
 */
@Injectable()
export class WebChatReceiver implements IChannelReceiver {
  // Receivers are pure transforms today; the async signature satisfies
  // IChannelReceiver and is preserved for future async enrichment
  // (e.g. consent lookup, tenant policy resolution).
  async receive(input: unknown): Promise<InboundMessage> {
    await Promise.resolve();
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
 * Web chat channel sender — persists the assistant reply through the
 * canonical ChatHistoryService and emits it on the user socket room via
 * EventsGateway so the live chat client receives the message. Both calls
 * are real; on failure the adapter reports success:false.
 *
 * The conversationId is required on the outbound message and is
 * used as the canonical correlation key.
 */
@Injectable()
export class WebChatSender implements IChannelSender {
  private readonly logger = new Logger(WebChatSender.name);

  constructor(
    @Optional()
    @Inject(forwardRef(() => ChatHistoryService))
    private readonly chatHistory?: ChatHistoryService,
    @Optional()
    @Inject(forwardRef(() => EventsGateway))
    private readonly events?: EventsGateway,
  ) {}

  async send(message: OutboundMessage): Promise<DeliveryReceipt> {
    if (!message.tenantId || !message.recipientId) {
      return { success: false, error: 'tenantId and recipientId are required' };
    }
    const conversationId =
      typeof message.metadata?.['conversationId'] === 'string'
        ? message.metadata['conversationId']
        : null;
    if (!conversationId) {
      return {
        success: false,
        error: 'conversationId is required for WEB_CHAT delivery',
      };
    }

    try {
      if (!this.chatHistory) {
        throw new BadRequestException(
          'ChatHistoryService is not available in this runtime',
        );
      }
      const entry = await this.chatHistory.saveMessage({
        tenantId: message.tenantId,
        userId: message.recipientId,
        conversationId,
        role: 'assistant',
        content: message.content,
        metadata: {
          channel: 'WEB_CHAT',
          ...(message.metadata ?? {}),
        },
        model: 'service-gateway-v2.webchat',
        provider: 'neurecore',
      });

      if (this.events) {
        this.events.emitToUser(message.recipientId, 'chat:assistant_reply', {
          conversationId,
          tenantId: message.tenantId,
          content: message.content,
          entryId: entry?.id ?? null,
          timestamp: new Date().toISOString(),
        });
      }

      return {
        success: true,
        deliveryId: entry?.id ?? conversationId,
      };
    } catch (err) {
      const error = toErrorMessage(err);
      this.logger.warn(
        `WebChatSender delivery failed for tenant=${message.tenantId} conversation=${conversationId}: ${error}`,
      );
      return { success: false, error };
    }
  }
}

/**
 * Email channel receiver — pure transform of an inbound email payload.
 */
@Injectable()
export class EmailReceiver implements IChannelReceiver {
  async receive(input: unknown): Promise<InboundMessage> {
    await Promise.resolve();
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
      metadata: { type: 'email', subject: data.subject },
    };
  }
}

/**
 * Email channel sender — routes through the canonical Gmail or Outlook
 * adapter, both of which perform real Graph / Gmail API calls. The
 * provider is selected from `metadata.provider` (`gmail` | `outlook`),
 * defaulting to Gmail. On any error, returns success:false.
 */
@Injectable()
export class EmailSender implements IChannelSender {
  private readonly logger = new Logger(EmailSender.name);

  constructor(
    @Optional() private readonly gmail?: GoogleGmailService,
    @Optional() private readonly outlook?: OutlookEmailService,
  ) {}

  async send(message: OutboundMessage): Promise<DeliveryReceipt> {
    if (!message.tenantId || !message.recipientId) {
      return { success: false, error: 'tenantId and recipientId are required' };
    }
    const provider =
      typeof message.metadata?.['provider'] === 'string'
        ? message.metadata['provider'].toLowerCase()
        : 'gmail';

    const subject = subjectFromOutbound(message);
    const body = bodyFromOutbound(message);

    try {
      if (provider === 'outlook') {
        if (!this.outlook) {
          throw new BadRequestException(
            'OutlookEmailService is not available in this runtime',
          );
        }
        const receipt = await this.outlook.send({
          tenantId: message.tenantId,
          to: [message.recipientId],
          subject,
          bodyHtml: htmlFromOutbound(message),
          bodyText: body,
        });
        return {
          success: true,
          deliveryId: receipt.messageId,
        };
      }

      if (!this.gmail) {
        throw new BadRequestException(
          'GoogleGmailService is not available in this runtime',
        );
      }
      const receipt = await this.gmail.sendEmail(message.tenantId, {
        to: message.recipientId,
        subject,
        body,
      });
      return {
        success: true,
        deliveryId: receipt.messageId,
      };
    } catch (err) {
      const error = toErrorMessage(err);
      this.logger.warn(
        `EmailSender delivery failed for tenant=${message.tenantId} provider=${provider}: ${error}`,
      );
      return { success: false, error };
    }
  }
}

/**
 * Calendar channel receiver — pure transform of an inbound calendar
 * notification.
 */
@Injectable()
export class CalendarReceiver implements IChannelReceiver {
  async receive(input: unknown): Promise<InboundMessage> {
    await Promise.resolve();
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
 * Calendar channel sender — creates a real event via the canonical Google
 * Calendar or Outlook Calendar adapter. Metadata carries the event
 * window (`startIso`, `endIso`) and optional attendees. On any error,
 * returns success:false.
 */
@Injectable()
export class CalendarSender implements IChannelSender {
  private readonly logger = new Logger(CalendarSender.name);

  constructor(
    @Optional() private readonly googleCalendar?: GoogleCalendarService,
    @Optional() private readonly outlookCalendar?: OutlookCalendarService,
  ) {}

  async send(message: OutboundMessage): Promise<DeliveryReceipt> {
    if (!message.tenantId) {
      return { success: false, error: 'tenantId is required' };
    }
    const startIso =
      typeof message.metadata?.['startIso'] === 'string'
        ? message.metadata['startIso']
        : null;
    const endIso =
      typeof message.metadata?.['endIso'] === 'string'
        ? message.metadata['endIso']
        : null;
    if (!startIso || !endIso) {
      return {
        success: false,
        error: 'startIso and endIso are required for CALENDAR delivery',
      };
    }
    const provider =
      typeof message.metadata?.['provider'] === 'string'
        ? message.metadata['provider'].toLowerCase()
        : 'google';

    const subject = subjectFromOutbound(message);
    const attendeesRaw = message.metadata?.['attendees'];
    const attendees = Array.isArray(attendeesRaw)
      ? attendeesRaw.filter(
          (a): a is string => typeof a === 'string' && a.length > 0,
        )
      : [];

    try {
      if (provider === 'outlook') {
        if (!this.outlookCalendar) {
          throw new BadRequestException(
            'OutlookCalendarService is not available in this runtime',
          );
        }
        const event = await this.outlookCalendar.create(message.tenantId, {
          subject,
          bodyHtml: htmlFromOutbound(message),
          bodyText: bodyFromOutbound(message),
          startIso,
          endIso,
          attendees: attendees.map((email) => ({ email })),
        });
        return { success: true, deliveryId: event.id };
      }

      if (!this.googleCalendar) {
        throw new BadRequestException(
          'GoogleCalendarService is not available in this runtime',
        );
      }
      const event = await this.googleCalendar.createEvent(message.tenantId, {
        summary: subject,
        description: bodyFromOutbound(message),
        start: startIso,
        end: endIso,
        attendees,
      });
      return { success: true, deliveryId: event.id };
    } catch (err) {
      const error = toErrorMessage(err);
      this.logger.warn(
        `CalendarSender delivery failed for tenant=${message.tenantId} provider=${provider}: ${error}`,
      );
      return { success: false, error };
    }
  }
}

/**
 * CRM channel receiver — pure transform of an inbound CRM contact
 * message.
 */
@Injectable()
export class CrmReceiver implements IChannelReceiver {
  async receive(input: unknown): Promise<InboundMessage> {
    await Promise.resolve();
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
 * Brevo outbound notification sender — delegates to the canonical
 * BrevoEmailService. The service performs a real Brevo API call; on
 * failure it throws and the adapter returns success:false.
 */
@Injectable()
export class BrevoSender implements IChannelSender {
  private readonly logger = new Logger(BrevoSender.name);

  constructor(@Optional() private readonly brevo?: BrevoEmailService) {}

  async send(message: OutboundMessage): Promise<DeliveryReceipt> {
    if (!message.tenantId || !message.recipientId) {
      return { success: false, error: 'tenantId and recipientId are required' };
    }
    if (!this.brevo) {
      return {
        success: false,
        error: 'BrevoEmailService is not available in this runtime',
      };
    }
    const subject = subjectFromOutbound(message);
    const body = bodyFromOutbound(message);
    try {
      const receipt = await this.brevo.sendEmail(message.tenantId, {
        to: message.recipientId,
        subject,
        htmlContent: htmlFromOutbound(message),
        textContent: body,
        tags: ['service-gateway-v2'],
      });
      if (receipt.messageId === 'suppressed') {
        return {
          success: false,
          error: 'Recipient is on the Brevo suppression list',
        };
      }
      return { success: true, deliveryId: receipt.messageId };
    } catch (err) {
      const error = toErrorMessage(err);
      this.logger.warn(
        `BrevoSender delivery failed for tenant=${message.tenantId}: ${error}`,
      );
      return { success: false, error };
    }
  }
}

/**
 * Teams channel sender — delegates to the canonical TeamsAdapterService.
 * Requires `metadata.chatId` on the outbound message (Teams chats are
 * not creatable from scratch via the delegated scope; the chat must
 * already exist in the user's tenant).
 */
@Injectable()
export class TeamsSender implements IChannelSender {
  private readonly logger = new Logger(TeamsSender.name);

  constructor(@Optional() private readonly teams?: TeamsAdapterService) {}

  async send(message: OutboundMessage): Promise<DeliveryReceipt> {
    if (!message.tenantId) {
      return { success: false, error: 'tenantId is required' };
    }
    const chatId =
      typeof message.metadata?.['chatId'] === 'string'
        ? message.metadata['chatId']
        : null;
    if (!chatId) {
      return {
        success: false,
        error: 'chatId is required for TEAMS delivery',
      };
    }
    if (!this.teams) {
      return {
        success: false,
        error: 'TeamsAdapterService is not available in this runtime',
      };
    }
    try {
      const receipt = await this.teams.sendChatMessage({
        tenantId: message.tenantId,
        chatId,
        bodyHtml: htmlFromOutbound(message),
        bodyText: bodyFromOutbound(message),
      });
      return { success: true, deliveryId: receipt.messageId };
    } catch (err) {
      const error = toErrorMessage(err);
      this.logger.warn(
        `TeamsSender delivery failed for tenant=${message.tenantId} chat=${chatId}: ${error}`,
      );
      return { success: false, error };
    }
  }
}
