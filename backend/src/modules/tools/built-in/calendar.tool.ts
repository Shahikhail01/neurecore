/**
 * Calendar Management Tool
 *
 * Provides calendar operations including:
 * - List events within a date range
 * - Create new events
 * - Update existing events
 * - Delete events
 * - Check availability
 *
 * SOLID Principles:
 * - SRP: Only handles calendar operations
 * - OCP: Add new calendar providers without modifying existing code
 * - DIP: Depends on ICalendarProvider interface, not concrete implementation
 * - LSP: Any calendar provider can substitute for another
 * - ISP: Small, focused interfaces for each calendar type
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { BaseStructuredTool } from '../structured-tool.base';
import {
  ToolCategory,
  StructuredToolResult,
  ToolExecutionContext,
} from '../interfaces/structured-tool.interface';

// ─────────────────────────────────────────────────────────────
// Input Schema
// ─────────────────────────────────────────────────────────────

/**
 * Calendar operation actions
 */
export const CalendarActionEnum = z.enum([
  'list',
  'create',
  'update',
  'delete',
  'availability',
]);

export type CalendarAction = z.infer<typeof CalendarActionEnum>;

/**
 * Input schema for Calendar Tool
 */
export const CalendarInputSchema = z.object({
  action: CalendarActionEnum.describe('Calendar operation to perform'),
  calendarId: z.string().optional().describe('Calendar ID (default: primary)'),
  timeMin: z
    .string()
    .datetime({ message: 'Invalid ISO 8601 datetime format' })
    .optional()
    .describe('Start time (ISO 8601)'),
  timeMax: z
    .string()
    .datetime({ message: 'Invalid ISO 8601 datetime format' })
    .optional()
    .describe('End time (ISO 8601)'),
  summary: z.string().optional().describe('Event title'),
  description: z.string().optional().describe('Event description'),
  attendees: z
    .array(z.string().email({ message: 'Invalid email address' }))
    .optional()
    .describe('Email addresses'),
  location: z.string().optional().describe('Meeting location'),
  startTime: z
    .string()
    .datetime({ message: 'Invalid ISO 8601 datetime format' })
    .optional()
    .describe('Event start'),
  endTime: z
    .string()
    .datetime({ message: 'Invalid ISO 8601 datetime format' })
    .optional()
    .describe('Event end'),
  eventId: z.string().optional().describe('Event ID for update/delete'),
});

export type CalendarInput = z.infer<typeof CalendarInputSchema>;

// ─────────────────────────────────────────────────────────────
// Output Schema
// ─────────────────────────────────────────────────────────────

/**
 * Calendar event output
 */
const CalendarEventSchema = z.object({
  id: z.string(),
  summary: z.string(),
  description: z.string().nullable(),
  start: z.string(),
  end: z.string(),
  attendees: z.array(z.string()),
  location: z.string().nullable(),
});

/**
 * Output schema for Calendar Tool
 */
export const CalendarOutputSchema = z.object({
  events: z.array(CalendarEventSchema).optional(),
  eventId: z.string().optional().describe('Created/updated event ID'),
  availability: z
    .array(
      z.object({
        start: z.string(),
        end: z.string(),
        busy: z.boolean(),
      }),
    )
    .optional(),
  success: z.boolean(),
  message: z.string().optional(),
});

export type CalendarOutput = z.infer<typeof CalendarOutputSchema>;

// ─────────────────────────────────────────────────────────────
// Calendar Provider Interface (DIP)
// ─────────────────────────────────────────────────────────────

/**
 * ICalendarProvider - Interface for calendar providers
 * Following DIP, we depend on this abstraction, not concrete implementations
 */
interface ICalendarProvider {
  listEvents(
    calendarId: string,
    timeMin: string,
    timeMax: string,
  ): Promise<InternalCalendarEvent[]>;
  createEvent(event: CalendarEventInput): Promise<string>;
  updateEvent(eventId: string, event: CalendarEventInput): Promise<string>;
  deleteEvent(eventId: string): Promise<void>;
  getAvailability(
    calendarId: string,
    timeMin: string,
    timeMax: string,
  ): Promise<AvailabilitySlot[]>;
}

/**
 * Internal calendar event type (used by provider)
 */
interface InternalCalendarEvent {
  id: string;
  summary: string;
  description: string | null;
  start: string;
  end: string;
  attendees: string[];
  location: string | null;
}

interface GoogleCalendarEventItem {
  id: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: Array<{ email: string }>;
  location?: string;
}

interface CalendarEventInput {
  summary: string;
  description?: string;
  startTime: string;
  endTime: string;
  attendees?: string[];
  location?: string;
}

interface AvailabilitySlot {
  start: string;
  end: string;
  busy: boolean;
}

// ─────────────────────────────────────────────────────────────
// Google Calendar Provider
// ─────────────────────────────────────────────────────────────

/**
 * GoogleCalendarProvider - Implements ICalendarProvider for Google Calendar
 * OCP: Add this without modifying existing code
 */
class GoogleCalendarProvider implements ICalendarProvider {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://www.googleapis.com/calendar/v3';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async listEvents(
    calendarId: string,
    timeMin: string,
    timeMax: string,
  ): Promise<InternalCalendarEvent[]> {
    const url = `${this.baseUrl}/calendars/${encodeURIComponent(
      calendarId,
    )}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&key=${this.apiKey}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Google Calendar API error: ${response.status}`);
    }

    const data = await response.json();
    return (data.items ?? []).map((item: GoogleCalendarEventItem) => ({
      id: item.id,
      summary: item.summary ?? '',
      description: item.description ?? null,
      start: item.start?.dateTime ?? item.start?.date ?? '',
      end: item.end?.dateTime ?? item.end?.date ?? '',
      attendees: item.attendees?.map((a) => a.email) ?? [],
      location: item.location ?? null,
    }));
  }

  async createEvent(event: CalendarEventInput): Promise<string> {
    const url = `${this.baseUrl}/calendars/primary/events?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: event.summary,
        description: event.description,
        start: { dateTime: event.startTime },
        end: { dateTime: event.endTime },
        attendees: event.attendees?.map((email) => ({ email })),
        location: event.location,
      }),
    });

    if (!response.ok) {
      throw new Error(`Google Calendar API error: ${response.status}`);
    }

    const data = await response.json();
    return data.id as string;
  }

  async updateEvent(
    eventId: string,
    event: CalendarEventInput,
  ): Promise<string> {
    const url = `${this.baseUrl}/calendars/primary/events/${eventId}?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: event.summary,
        description: event.description,
        start: { dateTime: event.startTime },
        end: { dateTime: event.endTime },
        attendees: event.attendees?.map((email) => ({ email })),
        location: event.location,
      }),
    });

    if (!response.ok) {
      throw new Error(`Google Calendar API error: ${response.status}`);
    }

    return eventId;
  }

  async deleteEvent(eventId: string): Promise<void> {
    const url = `${this.baseUrl}/calendars/primary/events/${eventId}?key=${this.apiKey}`;

    const response = await fetch(url, { method: 'DELETE' });
    if (!response.ok && response.status !== 204) {
      throw new Error(`Google Calendar API error: ${response.status}`);
    }
  }

  async getAvailability(
    calendarId: string,
    timeMin: string,
    timeMax: string,
  ): Promise<AvailabilitySlot[]> {
    const events = await this.listEvents(calendarId, timeMin, timeMax);
    const slots: AvailabilitySlot[] = [];
    let currentTime = new Date(timeMin).getTime();
    const endTime = new Date(timeMax).getTime();
    const oneHour = 60 * 60 * 1000;

    while (currentTime < endTime) {
      const slotStart = new Date(currentTime).toISOString();
      const slotEnd = new Date(currentTime + oneHour).toISOString();

      const isBusy = events.some((event) => {
        const eventStart = new Date(event.start).getTime();
        const eventEnd = new Date(event.end).getTime();
        return currentTime >= eventStart && currentTime < eventEnd;
      });

      slots.push({ start: slotStart, end: slotEnd, busy: isBusy });
      currentTime += oneHour;
    }

    return slots;
  }
}

// ─────────────────────────────────────────────────────────────
// Calendar Tool (ISP - small, focused interface)
// ─────────────────────────────────────────────────────────────

/**
 * Calendar Tool
 *
 * Features:
 * - Google Calendar integration
 * - Zod schema validation for inputs and outputs
 * - Structured output with proper error handling
 * - Rate limiting support
 */
@Injectable()
export class CalendarTool extends BaseStructuredTool {
  readonly name = 'calendar';
  readonly description =
    'Manage calendar events, schedule meetings, check availability, and handle calendar operations. Supports Google Calendar with actions: list, create, update, delete, availability.';
  readonly category = ToolCategory.COMMUNICATION;
  readonly inputSchema = CalendarInputSchema;
  readonly outputSchema = CalendarOutputSchema;
  readonly version = '1.0.0';

  private provider: ICalendarProvider | null = null;

  constructor(private readonly config: ConfigService) {
    super();
    this.initializeProvider();
  }

  /**
   * Initialize the calendar provider based on configuration
   * OCP: Add new providers by implementing ICalendarProvider
   */
  private initializeProvider(): void {
    const googleApiKey = this.config.get<string>('GOOGLE_CALENDAR_API_KEY');

    if (googleApiKey) {
      this.provider = new GoogleCalendarProvider(googleApiKey);
      this.logger.log('Google Calendar provider initialized');
    } else {
      this.logger.warn(
        'No calendar provider configured. Set GOOGLE_CALENDAR_API_KEY in environment.',
      );
    }
  }

  /**
   * Core execution logic - SRP: Only handles calendar operations
   */
  protected async executeImpl(
    input: CalendarInput,
    context: Partial<ToolExecutionContext>,
  ): Promise<StructuredToolResult<CalendarOutput>> {
    const startTime = Date.now();
    const tenantId = context?.tenantId ?? 'unknown';

    this.logger.log(
      `[CalendarTool] Action: ${input.action} for tenant: ${tenantId}`,
    );

    // Check if provider is configured
    if (!this.provider) {
      // Demo mode: return mock calendar data
      this.logger.warn('[CalendarTool] No provider — running in demo mode');
      const now = new Date();
      const demoEvents = [
        {
          id: 'demo-1',
          summary: 'Team Standup',
          description: 'Daily sync',
          start: new Date(now.getTime() + 3600000).toISOString(),
          end: new Date(now.getTime() + 5400000).toISOString(),
          attendees: ['team@demo.local'],
          location: null,
        },
        {
          id: 'demo-2',
          summary: 'Client Review — Acme Corp',
          description: 'Monthly campaign review',
          start: new Date(now.getTime() + 86400000).toISOString(),
          end: new Date(now.getTime() + 90000000).toISOString(),
          attendees: ['client@acme.example', 'demo@marketing-agency.local'],
          location: 'Zoom',
        },
        {
          id: 'demo-3',
          summary: 'Content Planning Session',
          description: 'Plan next week content calendar',
          start: new Date(now.getTime() + 172800000).toISOString(),
          end: new Date(now.getTime() + 176400000).toISOString(),
          attendees: ['creative@demo.local'],
          location: null,
        },
      ];
      if (input.action === 'create') {
        return {
          success: true,
          data: {
            eventId: `demo-evt-${Date.now()}`,
            success: true,
            message: 'Event created (demo mode)',
          },
          metadata: { demo: true },
        } as StructuredToolResult<CalendarOutput>;
      }
      if (input.action === 'delete') {
        return {
          success: true,
          data: { success: true, message: 'Event deleted (demo mode)' },
          metadata: { demo: true },
        } as StructuredToolResult<CalendarOutput>;
      }
      return {
        success: true,
        data: {
          events: demoEvents,
          success: true,
          message: 'Demo calendar data (GOOGLE_CALENDAR_API_KEY not set)',
        },
        metadata: { demo: true, durationMs: Date.now() - startTime },
      } as StructuredToolResult<CalendarOutput>;
    }

    try {
      switch (input.action) {
        case 'list':
          return await this.handleList(input, startTime);
        case 'create':
          return await this.handleCreate(input, startTime);
        case 'update':
          return await this.handleUpdate(input, startTime);
        case 'delete':
          return await this.handleDelete(input, startTime);
        case 'availability':
          return await this.handleAvailability(input, startTime);
        default:
          return {
            success: false,
            error: `Unknown action: ${input.action}`,
            metadata: { durationMs: Date.now() - startTime },
          };
      }
    } catch (error) {
      this.logger.error(
        `[CalendarTool] Action ${input.action} failed`,
        error instanceof Error ? error.message : String(error),
      );
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Calendar operation failed',
        metadata: { durationMs: Date.now() - startTime },
      };
    }
  }

  /**
   * Handle list events action
   */
  private async handleList(
    input: CalendarInput,
    startTime: number,
  ): Promise<StructuredToolResult<CalendarOutput>> {
    if (!this.provider) {
      return {
        success: false,
        error: 'Calendar provider not configured',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    if (!input.timeMin || !input.timeMax) {
      return {
        success: false,
        error: 'timeMin and timeMax are required for list action',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    const calendarId = input.calendarId ?? 'primary';
    const events = await this.provider.listEvents(
      calendarId,
      input.timeMin,
      input.timeMax,
    );

    return {
      success: true,
      data: {
        events: events.map((e) => ({
          id: e.id,
          summary: e.summary,
          description: e.description,
          start: e.start,
          end: e.end,
          attendees: e.attendees,
          location: e.location,
        })),
        success: true,
      },
      metadata: {
        durationMs: Date.now() - startTime,
        model: 'google-calendar-v1',
      },
    };
  }

  /**
   * Handle create event action
   */
  private async handleCreate(
    input: CalendarInput,
    startTime: number,
  ): Promise<StructuredToolResult<CalendarOutput>> {
    if (!this.provider) {
      return {
        success: false,
        error: 'Calendar provider not configured',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    if (!input.summary || !input.startTime || !input.endTime) {
      return {
        success: false,
        error: 'summary, startTime, and endTime are required for create action',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    const eventId = await this.provider.createEvent({
      summary: input.summary,
      description: input.description,
      startTime: input.startTime,
      endTime: input.endTime,
      attendees: input.attendees,
      location: input.location,
    });

    return {
      success: true,
      data: {
        eventId,
        success: true,
        message: `Event created successfully`,
      },
      metadata: {
        durationMs: Date.now() - startTime,
        model: 'google-calendar-v1',
      },
    };
  }

  /**
   * Handle update event action
   */
  private async handleUpdate(
    input: CalendarInput,
    startTime: number,
  ): Promise<StructuredToolResult<CalendarOutput>> {
    if (!this.provider) {
      return {
        success: false,
        error: 'Calendar provider not configured',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    if (!input.eventId) {
      return {
        success: false,
        error: 'eventId is required for update action',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    const eventId = await this.provider.updateEvent(input.eventId, {
      summary: input.summary ?? '',
      description: input.description,
      startTime: input.startTime ?? '',
      endTime: input.endTime ?? '',
      attendees: input.attendees,
      location: input.location,
    });

    return {
      success: true,
      data: {
        eventId,
        success: true,
        message: `Event ${eventId} updated successfully`,
      },
      metadata: {
        durationMs: Date.now() - startTime,
        model: 'google-calendar-v1',
      },
    };
  }

  /**
   * Handle delete event action
   */
  private async handleDelete(
    input: CalendarInput,
    startTime: number,
  ): Promise<StructuredToolResult<CalendarOutput>> {
    if (!this.provider) {
      return {
        success: false,
        error: 'Calendar provider not configured',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    if (!input.eventId) {
      return {
        success: false,
        error: 'eventId is required for delete action',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    await this.provider.deleteEvent(input.eventId);

    return {
      success: true,
      data: {
        eventId: input.eventId,
        success: true,
        message: `Event ${input.eventId} deleted successfully`,
      },
      metadata: {
        durationMs: Date.now() - startTime,
        model: 'google-calendar-v1',
      },
    };
  }

  /**
   * Handle availability check action
   */
  private async handleAvailability(
    input: CalendarInput,
    startTime: number,
  ): Promise<StructuredToolResult<CalendarOutput>> {
    if (!this.provider) {
      return {
        success: false,
        error: 'Calendar provider not configured',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    if (!input.timeMin || !input.timeMax) {
      return {
        success: false,
        error: 'timeMin and timeMax are required for availability action',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    const calendarId = input.calendarId ?? 'primary';
    const availability = await this.provider.getAvailability(
      calendarId,
      input.timeMin,
      input.timeMax,
    );

    return {
      success: true,
      data: {
        availability,
        success: true,
      },
      metadata: {
        durationMs: Date.now() - startTime,
        model: 'google-calendar-v1',
      },
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Export types for external use
// ─────────────────────────────────────────────────────────────

export type {
  ICalendarProvider,
  InternalCalendarEvent,
  CalendarEventInput,
  AvailabilitySlot,
};
