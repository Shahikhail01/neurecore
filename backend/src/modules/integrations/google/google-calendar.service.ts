import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { GoogleAuthClient } from './google-auth.client';

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  location?: string;
  attendees: { email: string; responseStatus?: string }[];
  status: string;
  htmlLink?: string;
}

export interface CreateEventInput {
  summary: string;
  description?: string;
  start: string; // ISO 8601 datetime
  end: string; // ISO 8601 datetime
  location?: string;
  attendees?: string[];
  timeZone?: string;
}

@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);
  private readonly CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

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
   * List upcoming events from primary calendar
   */
  async listEvents(
    tenantId: string,
    options: {
      calendarId?: string;
      maxResults?: number;
      timeMin?: string;
      timeMax?: string;
      q?: string;
    } = {},
  ): Promise<CalendarEvent[]> {
    const {
      calendarId = 'primary',
      maxResults = 25,
      timeMin,
      timeMax,
      q,
    } = options;
    const params = new URLSearchParams();
    params.set('maxResults', String(maxResults));
    params.set('singleEvents', 'true');
    params.set('orderBy', 'startTime');
    if (timeMin) params.set('timeMin', timeMin);
    if (timeMax) params.set('timeMax', timeMax);
    if (q) params.set('q', q);

    const res = await this.authFetch(
      `${this.CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
      {},
      tenantId,
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => 'unknown');
      this.logger.error(`Calendar list failed: ${res.status} ${errText}`);
      throw new BadRequestException(`Calendar API error ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = (await res.json()) as { items?: RawGoogleEvent[] };
    if (!data.items) return [];

    return data.items.map(this.parseEvent);
  }

  /**
   * Create a new calendar event
   */
  async createEvent(
    tenantId: string,
    input: CreateEventInput,
    calendarId = 'primary',
  ): Promise<CalendarEvent> {
    const body = {
      summary: input.summary,
      description: input.description,
      location: input.location,
      start: {
        dateTime: input.start,
        timeZone: input.timeZone ?? 'UTC',
      },
      end: {
        dateTime: input.end,
        timeZone: input.timeZone ?? 'UTC',
      },
      attendees: input.attendees?.map((email) => ({ email })),
    };

    const res = await this.authFetch(
      `${this.CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
      tenantId,
    );

    if (!res.ok) {
      const err = await res.text().catch(() => 'unknown');
      this.logger.error(`Calendar event create failed: ${res.status} ${err}`);
      throw new BadRequestException(`Calendar create failed (${res.status}): ${err.slice(0, 200)}`);
    }

    const data = (await res.json()) as RawGoogleEvent;
    return this.parseEvent(data);
  }

  /**
   * Delete a calendar event
   */
  async deleteEvent(
    eventId: string,
    tenantId: string,
    calendarId = 'primary',
  ): Promise<void> {
    const res = await this.authFetch(
      `${this.CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      { method: 'DELETE' },
      tenantId,
    );

    if (!res.ok && res.status !== 410) {
      throw new BadRequestException('Failed to delete calendar event');
    }
  }

  /**
   * List available calendars
   */
  async listCalendars(
    tenantId: string,
  ): Promise<{ id: string; summary: string; primary: boolean }[]> {
    const res = await this.authFetch(
      `${this.CALENDAR_API}/users/me/calendarList`,
      {},
      tenantId,
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => 'unknown');
      this.logger.error(`Calendar list API failed: ${res.status} ${errText}`);
      throw new BadRequestException(`Calendar list API error ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      items?: { id: string; summary: string; primary?: boolean }[];
    };

    return (data.items ?? []).map((c) => ({
      id: c.id,
      summary: c.summary,
      primary: c.primary ?? false,
    }));
  }

  private parseEvent(raw: RawGoogleEvent): CalendarEvent {
    return {
      id: raw.id,
      summary: raw.summary ?? '(No title)',
      description: raw.description,
      start: raw.start?.dateTime ?? raw.start?.date ?? '',
      end: raw.end?.dateTime ?? raw.end?.date ?? '',
      location: raw.location,
      attendees: (raw.attendees ?? []).map((a) => ({
        email: a.email,
        responseStatus: a.responseStatus,
      })),
      status: raw.status ?? 'confirmed',
      htmlLink: raw.htmlLink,
    };
  }
}

interface RawGoogleEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: { email: string; responseStatus?: string }[];
  status?: string;
  htmlLink?: string;
}
