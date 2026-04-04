/**
 * Meeting Scheduler Tool - P2-7 of remaining tools
 * Enables AI agents to schedule meetings and manage calendar events
 * For Scheduler, Interview Coordinator agents
 *
 * SOLID Principles Applied:
 * - SRP: Single responsibility for meeting scheduling operations
 * - OCP: Extensible via scheduling provider interfaces
 * - DIP: Depends on abstractions for scheduling providers
 */

import { Injectable, Logger } from '@nestjs/common';
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

export const MeetingSchedulerActionEnum = z.enum([
  'schedule_meeting',
  'update_meeting',
  'cancel_meeting',
  'get_meeting',
  'list_meetings',
  'find_available_slots',
]);

export type MeetingSchedulerAction = z.infer<typeof MeetingSchedulerActionEnum>;

export const MeetingSchedulerInputSchema = z.object({
  action: MeetingSchedulerActionEnum.describe(
    'The meeting scheduler action to perform',
  ),
  meetingId: z.string().optional().describe('Meeting ID'),
  title: z.string().optional().describe('Meeting title'),
  description: z.string().optional().describe('Meeting description'),
  startTime: z.string().optional().describe('Start time (ISO format)'),
  endTime: z.string().optional().describe('End time (ISO format)'),
  duration: z.number().positive().optional().describe('Duration in minutes'),
  participants: z.array(z.string()).optional().describe('Participant emails'),
  location: z.string().optional().describe('Meeting location'),
  organizer: z.string().optional().describe('Organizer email'),
  recurrence: z
    .object({
      frequency: z.enum(['daily', 'weekly', 'monthly']),
      interval: z.number().positive().optional(),
      endDate: z.string().optional(),
    })
    .optional(),
  filters: z
    .object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      status: z.enum(['scheduled', 'cancelled', 'completed']).optional(),
    })
    .optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export type MeetingSchedulerInput = z.infer<typeof MeetingSchedulerInputSchema>;

// ─────────────────────────────────────────────────────────────
// Output Types
// ─────────────────────────────────────────────────────────────

type Meeting = {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  participants: string[];
  location?: string;
  organizer: string;
  status: 'scheduled' | 'cancelled' | 'completed';
  createdAt: string;
  updatedAt: string;
};

type AvailableSlot = {
  startTime: string;
  endTime: string;
  duration: number;
};

type MeetingList = Array<Meeting>;

// ─────────────────────────────────────────────────────────────
// Provider Interface (DIP)
// ─────────────────────────────────────────────────────────────

interface IMeetingSchedulerProvider {
  scheduleMeeting(meeting: {
    title: string;
    description?: string;
    startTime: string;
    endTime?: string;
    duration?: number;
    participants: string[];
    location?: string;
    organizer: string;
    recurrence?: { frequency: string; interval?: number; endDate?: string };
  }): Promise<Meeting>;

  updateMeeting(
    meetingId: string,
    updates: Partial<{
      title: string;
      description: string;
      startTime: string;
      endTime: string;
      participants: string[];
      location: string;
    }>,
  ): Promise<Meeting>;

  cancelMeeting(meetingId: string): Promise<boolean>;

  getMeeting(meetingId: string): Promise<Meeting>;

  listMeetings(
    page: number,
    limit: number,
    filters?: { startDate?: string; endDate?: string; status?: string },
  ): Promise<{ meetings: MeetingList; total: number }>;

  findAvailableSlots(
    organizer: string,
    participants: string[],
    duration: number,
    startDate: string,
    endDate: string,
  ): Promise<AvailableSlot[]>;
}

// ─────────────────────────────────────────────────────────────
// Mock Meeting Scheduler Provider
// ─────────────────────────────────────────────────────────────

@Injectable()
class MockMeetingSchedulerProvider implements IMeetingSchedulerProvider {
  private readonly logger = new Logger(MockMeetingSchedulerProvider.name);
  private readonly meetings = new Map<string, Meeting>();

  async scheduleMeeting(meeting: {
    title: string;
    description?: string;
    startTime: string;
    endTime?: string;
    duration?: number;
    participants: string[];
    location?: string;
    organizer: string;
    recurrence?: { frequency: string; interval?: number; endDate?: string };
  }): Promise<Meeting> {
    this.logger.log('Scheduling meeting: ' + meeting.title);

    const id = 'mtg-' + Date.now();
    const start = new Date(meeting.startTime);
    let end: Date;

    if (meeting.endTime) {
      end = new Date(meeting.endTime);
    } else if (meeting.duration) {
      end = new Date(start.getTime() + meeting.duration * 60000);
    } else {
      end = new Date(start.getTime() + 60 * 60000); // Default 1 hour
    }

    const newMeeting: Meeting = {
      id,
      title: meeting.title,
      description: meeting.description,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      participants: meeting.participants,
      location: meeting.location,
      organizer: meeting.organizer,
      status: 'scheduled',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.meetings.set(id, newMeeting);
    return newMeeting;
  }

  async updateMeeting(
    meetingId: string,
    updates: Partial<{
      title: string;
      description: string;
      startTime: string;
      endTime: string;
      participants: string[];
      location: string;
    }>,
  ): Promise<Meeting> {
    this.logger.log('Updating meeting: ' + meetingId);
    const meeting = this.meetings.get(meetingId);

    if (!meeting) {
      throw new Error('Meeting not found: ' + meetingId);
    }

    const updated: Meeting = {
      ...meeting,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.meetings.set(meetingId, updated);
    return updated;
  }

  async cancelMeeting(meetingId: string): Promise<boolean> {
    this.logger.log('Cancelling meeting: ' + meetingId);
    const meeting = this.meetings.get(meetingId);

    if (!meeting) {
      return false;
    }

    meeting.status = 'cancelled';
    meeting.updatedAt = new Date().toISOString();
    return true;
  }

  async getMeeting(meetingId: string): Promise<Meeting> {
    this.logger.log('Getting meeting: ' + meetingId);
    const meeting = this.meetings.get(meetingId);

    if (!meeting) {
      throw new Error('Meeting not found: ' + meetingId);
    }

    return meeting;
  }

  async listMeetings(
    page: number,
    limit: number,
    filters?: { startDate?: string; endDate?: string; status?: string },
  ): Promise<{ meetings: MeetingList; total: number }> {
    this.logger.log('Listing meetings');
    let all = Array.from(this.meetings.values());

    if (filters?.status) {
      all = all.filter((m) => m.status === filters.status);
    }
    if (filters?.startDate) {
      all = all.filter((m) => m.startTime >= filters.startDate!);
    }
    if (filters?.endDate) {
      all = all.filter((m) => m.startTime <= filters.endDate!);
    }

    // Sort by start time
    all.sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );

    const start = (page - 1) * limit;
    const meetings = all.slice(start, start + limit);

    return { meetings, total: all.length };
  }

  async findAvailableSlots(
    organizer: string,
    participants: string[],
    duration: number,
    startDate: string,
    endDate: string,
  ): Promise<AvailableSlot[]> {
    this.logger.log('Finding available slots');

    // Mock available slots
    const slots: AvailableSlot[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let d = start; d < end; d.setDate(d.getDate() + 1)) {
      // Add morning and afternoon slots
      const morningStart = new Date(d);
      morningStart.setHours(9, 0, 0, 0);
      const morningEnd = new Date(morningStart);
      morningEnd.setHours(12, 0, 0, 0);

      const afternoonStart = new Date(d);
      afternoonStart.setHours(14, 0, 0, 0);
      const afternoonEnd = new Date(afternoonStart);
      afternoonEnd.setHours(17, 0, 0, 0);

      if (duration <= 60) {
        slots.push({
          startTime: morningStart.toISOString(),
          endTime: morningEnd.toISOString(),
          duration: 60,
        });
        slots.push({
          startTime: afternoonStart.toISOString(),
          endTime: afternoonEnd.toISOString(),
          duration: 60,
        });
      }
    }

    return slots;
  }
}

// ─────────────────────────────────────────────────────────────
// Tool Implementation
// ─────────────────────────────────────────────────────────────

@Injectable()
export class MeetingSchedulerTool extends BaseStructuredTool {
  readonly name = 'meeting_scheduler';
  readonly description =
    'Schedule, update, cancel meetings and find available time slots';
  readonly category = ToolCategory.COMMUNICATION;
  readonly inputSchema = MeetingSchedulerInputSchema;

  private readonly log = new Logger(MeetingSchedulerTool.name);
  private readonly provider: IMeetingSchedulerProvider;

  constructor(private readonly config: ConfigService) {
    super();
    this.provider = new MockMeetingSchedulerProvider();
  }

  protected async executeImpl(
    input: MeetingSchedulerInput,
    context: ToolExecutionContext,
  ): Promise<StructuredToolResult<unknown>> {
    this.log.log('Executing Meeting Scheduler action: ' + input.action);

    try {
      switch (input.action) {
        case 'schedule_meeting':
          return await this.handleScheduleMeeting(input);
        case 'update_meeting':
          return await this.handleUpdateMeeting(input);
        case 'cancel_meeting':
          return await this.handleCancelMeeting(input);
        case 'get_meeting':
          return await this.handleGetMeeting(input);
        case 'list_meetings':
          return await this.handleListMeetings(input);
        case 'find_available_slots':
          return await this.handleFindAvailableSlots(input);
        default:
          throw new Error('Unknown action: ' + input.action);
      }
    } catch (error) {
      const err = error as Error;
      this.log.error(
        'Meeting Scheduler action failed: ' + err.message,
        err.stack,
      );
      return { success: false, error: err.message };
    }
  }

  private async handleScheduleMeeting(
    input: MeetingSchedulerInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.title || !input.startTime || !input.organizer) {
      throw new Error(
        'title, startTime, and organizer are required for schedule_meeting action',
      );
    }

    const result = await this.provider.scheduleMeeting({
      title: input.title,
      description: input.description,
      startTime: input.startTime,
      endTime: input.endTime,
      duration: input.duration,
      participants: input.participants || [],
      location: input.location,
      organizer: input.organizer,
      recurrence: input.recurrence,
    });

    return {
      success: true,
      data: result,
    };
  }

  private async handleUpdateMeeting(
    input: MeetingSchedulerInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.meetingId) {
      throw new Error('meetingId is required for update_meeting action');
    }

    const result = await this.provider.updateMeeting(input.meetingId, {
      title: input.title,
      description: input.description,
      startTime: input.startTime,
      endTime: input.endTime,
      participants: input.participants,
      location: input.location,
    });

    return {
      success: true,
      data: result,
    };
  }

  private async handleCancelMeeting(
    input: MeetingSchedulerInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.meetingId) {
      throw new Error('meetingId is required for cancel_meeting action');
    }

    const result = await this.provider.cancelMeeting(input.meetingId);

    return {
      success: result,
      data: { cancelled: result },
    };
  }

  private async handleGetMeeting(
    input: MeetingSchedulerInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.meetingId) {
      throw new Error('meetingId is required for get_meeting action');
    }

    const result = await this.provider.getMeeting(input.meetingId);

    return {
      success: true,
      data: result,
    };
  }

  private async handleListMeetings(
    input: MeetingSchedulerInput,
  ): Promise<StructuredToolResult<unknown>> {
    const page = input.page ?? 1;
    const limit = input.limit ?? 20;

    const result = await this.provider.listMeetings(page, limit, {
      startDate: input.filters?.startDate,
      endDate: input.filters?.endDate,
      status: input.filters?.status,
    });

    return {
      success: true,
      data: result,
    };
  }

  private async handleFindAvailableSlots(
    input: MeetingSchedulerInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (
      !input.organizer ||
      !input.duration ||
      !input.startTime ||
      !input.endTime
    ) {
      throw new Error(
        'organizer, duration, startTime, and endTime are required for find_available_slots action',
      );
    }

    const result = await this.provider.findAvailableSlots(
      input.organizer,
      input.participants || [],
      input.duration,
      input.startTime,
      input.endTime || input.startTime,
    );

    return {
      success: true,
      data: { slots: result, count: result.length },
    };
  }
}
