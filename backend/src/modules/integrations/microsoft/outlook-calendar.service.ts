import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { MicrosoftGraphAuthService } from './microsoft-graph-auth.service';
import type {
  OutlookCalendarEventInput,
  OutlookCalendarEvent,
} from './dto/microsoft-graph.dto';

interface GraphEvent {
  id: string;
  subject?: string;
  body?: { contentType?: string; content?: string };
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
  location?: { displayName?: string };
  attendees?: {
    emailAddress?: { name?: string; address?: string };
    type?: string;
    status?: { response?: string };
  }[];
  isOnlineMeeting?: boolean;
  onlineMeeting?: { joinUrl?: string };
  isCancelled?: boolean;
  webLink?: string;
}

@Injectable()
export class OutlookCalendarService {
  private readonly logger = new Logger(OutlookCalendarService.name);

  constructor(private readonly auth: MicrosoftGraphAuthService) {}

  async create(
    tenantId: string,
    input: OutlookCalendarEventInput,
    userUpn?: string,
  ): Promise<OutlookCalendarEvent> {
    const token = await this.auth.getAccessToken(tenantId);
    if (!token) {
      throw new BadRequestException(
        'Microsoft 365 is not connected for this tenant',
      );
    }

    const base = userUpn
      ? `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userUpn)}`
      : 'https://graph.microsoft.com/v1.0/me';

    const body: Record<string, unknown> = {
      subject: input.subject,
      body: {
        contentType: 'HTML',
        content: input.bodyHtml ?? input.bodyText ?? '',
      },
      start: {
        dateTime: input.startIso,
        timeZone: input.timeZone ?? 'UTC',
      },
      end: {
        dateTime: input.endIso,
        timeZone: input.timeZone ?? 'UTC',
      },
      ...(input.location ? { location: { displayName: input.location } } : {}),
      ...(input.attendees && input.attendees.length > 0
        ? {
            attendees: input.attendees.map((a) => ({
              emailAddress: { address: a.email, name: a.email },
              type: a.type ?? 'required',
            })),
          }
        : {}),
      ...(input.isOnline ? { isOnlineMeeting: true } : {}),
    };

    const res = await fetch(`${base}/events`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => 'unknown');
      this.logger.error(
        `Outlook calendar create failed tenant=${tenantId} status=${res.status}: ${text}`,
      );
      throw new BadRequestException(
        `Outlook calendar create failed: ${text.slice(0, 200)}`,
      );
    }

    const created = (await res.json()) as GraphEvent;
    return this.toEvent(created);
  }

  async update(
    tenantId: string,
    eventId: string,
    patch: Partial<OutlookCalendarEventInput>,
    userUpn?: string,
  ): Promise<OutlookCalendarEvent> {
    const token = await this.auth.getAccessToken(tenantId);
    if (!token) {
      throw new BadRequestException(
        'Microsoft 365 is not connected for this tenant',
      );
    }
    const base = userUpn
      ? `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userUpn)}`
      : 'https://graph.microsoft.com/v1.0/me';

    const body: Record<string, unknown> = {};
    if (patch.subject !== undefined) body['subject'] = patch.subject;
    if (patch.bodyHtml !== undefined || patch.bodyText !== undefined) {
      body['body'] = {
        contentType: 'HTML',
        content: patch.bodyHtml ?? patch.bodyText ?? '',
      };
    }
    if (patch.startIso !== undefined) {
      body['start'] = {
        dateTime: patch.startIso,
        timeZone: patch.timeZone ?? 'UTC',
      };
    }
    if (patch.endIso !== undefined) {
      body['end'] = {
        dateTime: patch.endIso,
        timeZone: patch.timeZone ?? 'UTC',
      };
    }
    if (patch.location !== undefined) {
      body['location'] = patch.location
        ? { displayName: patch.location }
        : null;
    }
    if (patch.attendees !== undefined) {
      body['attendees'] = patch.attendees.map((a) => ({
        emailAddress: { address: a.email, name: a.email },
        type: a.type ?? 'required',
      }));
    }

    const res = await fetch(`${base}/events/${encodeURIComponent(eventId)}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => 'unknown');
      throw new BadRequestException(
        `Outlook calendar update failed: ${text.slice(0, 200)}`,
      );
    }

    const updated = (await res.json()) as GraphEvent;
    return this.toEvent(updated);
  }

  async delete(
    tenantId: string,
    eventId: string,
    userUpn?: string,
  ): Promise<void> {
    const token = await this.auth.getAccessToken(tenantId);
    if (!token) {
      throw new BadRequestException(
        'Microsoft 365 is not connected for this tenant',
      );
    }
    const base = userUpn
      ? `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userUpn)}`
      : 'https://graph.microsoft.com/v1.0/me';

    const res = await fetch(`${base}/events/${encodeURIComponent(eventId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok && res.status !== 404) {
      const text = await res.text().catch(() => 'unknown');
      throw new BadRequestException(
        `Outlook calendar delete failed: ${text.slice(0, 200)}`,
      );
    }
  }

  async list(
    tenantId: string,
    options: {
      startIso?: string;
      endIso?: string;
      top?: number;
      userUpn?: string;
    },
  ): Promise<OutlookCalendarEvent[]> {
    const token = await this.auth.getAccessToken(tenantId);
    if (!token) {
      throw new BadRequestException(
        'Microsoft 365 is not connected for this tenant',
      );
    }
    const base = options.userUpn
      ? `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(options.userUpn)}`
      : 'https://graph.microsoft.com/v1.0/me';
    const params = new URLSearchParams();
    params.set('$top', String(Math.min(Math.max(options.top ?? 25, 1), 100)));
    params.set('$orderby', 'start/dateTime');
    if (options.startIso) params.set('startDateTime', options.startIso);
    if (options.endIso) params.set('endDateTime', options.endIso);

    const url = `${base}/calendar/calendarView?${params.toString()}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => 'unknown');
      throw new BadRequestException(
        `Outlook calendar list failed: ${text.slice(0, 200)}`,
      );
    }
    const data = (await res.json()) as { value: GraphEvent[] };
    return (data.value ?? []).map((e) => this.toEvent(e));
  }

  private toEvent(raw: GraphEvent): OutlookCalendarEvent {
    return {
      id: raw.id,
      subject: raw.subject ?? '',
      startIso: raw.start?.dateTime ?? '',
      endIso: raw.end?.dateTime ?? '',
      timeZone: raw.start?.timeZone ?? 'UTC',
      attendees: (raw.attendees ?? []).map((a) => ({
        email: a.emailAddress?.address ?? '',
        responseStatus: a.status?.response,
      })),
      webLink: raw.webLink ?? raw.onlineMeeting?.joinUrl,
      isCancelled: raw.isCancelled ?? false,
    };
  }
}
