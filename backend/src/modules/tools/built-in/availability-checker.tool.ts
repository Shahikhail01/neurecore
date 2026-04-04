/**
 * Availability Checker Tool - P2-8 of remaining tools
 * Enables AI agents to check availability for participants
 * For Interview Coordinator, Scheduler agents
 *
 * SOLID Principles Applied:
 * - SRP: Single responsibility for availability checking operations
 * - OCP: Extensible via availability provider interfaces
 * - DIP: Depends on abstractions for availability providers
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

export const AvailabilityCheckerActionEnum = z.enum([
  'check_availability',
  'find_common_slots',
  'get_busy_times',
  'check_working_hours',
  'suggest_alternatives',
]);

export type AvailabilityCheckerAction = z.infer<
  typeof AvailabilityCheckerActionEnum
>;

export const AvailabilityCheckerInputSchema = z.object({
  action: AvailabilityCheckerActionEnum.describe(
    'The availability checker action to perform',
  ),
  participants: z.array(z.string()).optional().describe('Participant emails'),
  startTime: z.string().optional().describe('Start time (ISO format)'),
  endTime: z.string().optional().describe('End time (ISO format)'),
  date: z.string().optional().describe('Date to check (YYYY-MM-DD)'),
  duration: z
    .number()
    .positive()
    .optional()
    .describe('Meeting duration in minutes'),
  timezone: z.string().optional().default('UTC').describe('Timezone'),
  userId: z.string().optional().describe('User ID to check'),
  options: z
    .object({
      includeWorkingHours: z.boolean().optional().default(true),
      bufferTime: z.number().optional().default(15),
      preferredTimes: z
        .array(z.enum(['morning', 'afternoon', 'evening']))
        .optional(),
    })
    .optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export type AvailabilityCheckerInput = z.infer<
  typeof AvailabilityCheckerInputSchema
>;

// ─────────────────────────────────────────────────────────────
// Output Types
// ─────────────────────────────────────────────────────────────

type AvailabilitySlot = {
  startTime: string;
  endTime: string;
  available: boolean;
};

type CommonSlot = {
  startTime: string;
  endTime: string;
  duration: number;
  allAvailable: boolean;
  unavailableParticipants: string[];
};

type BusyTime = {
  start: string;
  end: string;
  type: 'meeting' | 'block' | 'out_of_office';
  title?: string;
};

type WorkingHours = {
  dayOfWeek: number;
  start: string;
  end: string;
  timezone: string;
};

type AlternativeSlot = {
  date: string;
  startTime: string;
  endTime: string;
  score: number;
  reason: string;
};

// ─────────────────────────────────────────────────────────────
// Provider Interface (DIP)
// ─────────────────────────────────────────────────────────────

interface IAvailabilityCheckerProvider {
  checkAvailability(
    userId: string,
    startTime: string,
    endTime: string,
    timezone?: string,
  ): Promise<AvailabilitySlot>;

  findCommonSlots(
    participants: string[],
    date: string,
    duration: number,
    timezone?: string,
  ): Promise<CommonSlot[]>;

  getBusyTimes(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<BusyTime[]>;

  checkWorkingHours(userId: string, date: string): Promise<WorkingHours>;

  suggestAlternatives(
    participants: string[],
    originalTime: string,
    duration: number,
    days: number,
  ): Promise<AlternativeSlot[]>;
}

// ─────────────────────────────────────────────────────────────
// Mock Availability Checker Provider
// ─────────────────────────────────────────────────────────────

@Injectable()
class MockAvailabilityCheckerProvider implements IAvailabilityCheckerProvider {
  private readonly logger = new Logger(MockAvailabilityCheckerProvider.name);

  async checkAvailability(
    userId: string,
    startTime: string,
    endTime: string,
    timezone?: string,
  ): Promise<AvailabilitySlot> {
    this.logger.log('Checking availability for: ' + userId);

    // Mock: randomly available
    const available = Math.random() > 0.3;

    return {
      startTime,
      endTime,
      available,
    };
  }

  async findCommonSlots(
    participants: string[],
    date: string,
    duration: number,
    timezone?: string,
  ): Promise<CommonSlot[]> {
    this.logger.log(
      'Finding common slots for ' + participants.length + ' participants',
    );

    // Mock common slots
    const baseDate = new Date(date);
    const slots: CommonSlot[] = [];

    // Morning slot
    const morningStart = new Date(baseDate);
    morningStart.setHours(9, 0, 0, 0);
    const morningEnd = new Date(morningStart);
    morningEnd.setHours(12, 0, 0, 0);

    // Afternoon slot
    const afternoonStart = new Date(baseDate);
    afternoonStart.setHours(14, 0, 0, 0);
    const afternoonEnd = new Date(afternoonStart);
    afternoonEnd.setHours(17, 0, 0, 0);

    slots.push({
      startTime: morningStart.toISOString(),
      endTime: morningEnd.toISOString(),
      duration: 180,
      allAvailable: true,
      unavailableParticipants: [],
    });

    slots.push({
      startTime: afternoonStart.toISOString(),
      endTime: afternoonEnd.toISOString(),
      duration: 180,
      allAvailable: true,
      unavailableParticipants: [],
    });

    return slots;
  }

  async getBusyTimes(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<BusyTime[]> {
    this.logger.log('Getting busy times for: ' + userId);

    // Mock busy times
    const start = new Date(startDate);
    start.setHours(10, 0, 0, 0);
    const end = new Date(start);
    end.setHours(11, 0, 0, 0);

    return [
      {
        start: start.toISOString(),
        end: end.toISOString(),
        type: 'meeting',
        title: 'Team Standup',
      },
    ];
  }

  async checkWorkingHours(userId: string, date: string): Promise<WorkingHours> {
    this.logger.log('Checking working hours for: ' + userId);

    const dayOfWeek = new Date(date).getDay();

    return {
      dayOfWeek,
      start: '09:00',
      end: '17:00',
      timezone: 'UTC',
    };
  }

  async suggestAlternatives(
    participants: string[],
    originalTime: string,
    duration: number,
    days: number,
  ): Promise<AlternativeSlot[]> {
    this.logger.log('Suggesting alternatives');

    const alternatives: AlternativeSlot[] = [];
    const originalDate = new Date(originalTime);

    for (let i = 1; i <= days; i++) {
      const nextDate = new Date(originalDate);
      nextDate.setDate(nextDate.getDate() + i);

      alternatives.push({
        date: nextDate.toISOString().split('T')[0],
        startTime: '10:00',
        endTime: '11:00',
        score: 0.9 - i * 0.1,
        reason: i === 1 ? 'Next available slot' : `Available in ${i} days`,
      });
    }

    return alternatives;
  }
}

// ─────────────────────────────────────────────────────────────
// Tool Implementation
// ─────────────────────────────────────────────────────────────

@Injectable()
export class AvailabilityCheckerTool extends BaseStructuredTool {
  readonly name = 'availability_checker';
  readonly description =
    'Check availability, find common slots, get busy times, and suggest alternatives';
  readonly category = ToolCategory.COMMUNICATION;
  readonly inputSchema = AvailabilityCheckerInputSchema;

  private readonly log = new Logger(AvailabilityCheckerTool.name);
  private readonly provider: IAvailabilityCheckerProvider;

  constructor(private readonly config: ConfigService) {
    super();
    this.provider = new MockAvailabilityCheckerProvider();
  }

  protected async executeImpl(
    input: AvailabilityCheckerInput,
    context: ToolExecutionContext,
  ): Promise<StructuredToolResult<unknown>> {
    this.log.log('Executing Availability Checker action: ' + input.action);

    try {
      switch (input.action) {
        case 'check_availability':
          return await this.handleCheckAvailability(input);
        case 'find_common_slots':
          return await this.handleFindCommonSlots(input);
        case 'get_busy_times':
          return await this.handleGetBusyTimes(input);
        case 'check_working_hours':
          return await this.handleCheckWorkingHours(input);
        case 'suggest_alternatives':
          return await this.handleSuggestAlternatives(input);
        default:
          throw new Error('Unknown action: ' + input.action);
      }
    } catch (error) {
      const err = error as Error;
      this.log.error(
        'Availability Checker action failed: ' + err.message,
        err.stack,
      );
      return { success: false, error: err.message };
    }
  }

  private async handleCheckAvailability(
    input: AvailabilityCheckerInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.userId || !input.startTime || !input.endTime) {
      throw new Error(
        'userId, startTime, and endTime are required for check_availability action',
      );
    }

    const result = await this.provider.checkAvailability(
      input.userId,
      input.startTime,
      input.endTime,
      input.timezone,
    );

    return {
      success: true,
      data: result,
    };
  }

  private async handleFindCommonSlots(
    input: AvailabilityCheckerInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (
      !input.participants ||
      input.participants.length === 0 ||
      !input.date ||
      !input.duration
    ) {
      throw new Error(
        'participants, date, and duration are required for find_common_slots action',
      );
    }

    const result = await this.provider.findCommonSlots(
      input.participants,
      input.date,
      input.duration,
      input.timezone,
    );

    return {
      success: true,
      data: { slots: result, count: result.length },
    };
  }

  private async handleGetBusyTimes(
    input: AvailabilityCheckerInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.userId || !input.startTime || !input.endTime) {
      throw new Error(
        'userId, startTime, and endTime are required for get_busy_times action',
      );
    }

    const result = await this.provider.getBusyTimes(
      input.userId,
      input.startTime,
      input.endTime,
    );

    return {
      success: true,
      data: { busyTimes: result, count: result.length },
    };
  }

  private async handleCheckWorkingHours(
    input: AvailabilityCheckerInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.userId || !input.date) {
      throw new Error(
        'userId and date are required for check_working_hours action',
      );
    }

    const result = await this.provider.checkWorkingHours(
      input.userId,
      input.date,
    );

    return {
      success: true,
      data: result,
    };
  }

  private async handleSuggestAlternatives(
    input: AvailabilityCheckerInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (
      !input.participants ||
      input.participants.length === 0 ||
      !input.startTime ||
      !input.duration
    ) {
      throw new Error(
        'participants, startTime, and duration are required for suggest_alternatives action',
      );
    }

    const result = await this.provider.suggestAlternatives(
      input.participants,
      input.startTime,
      input.duration,
      7, // Default 7 days ahead
    );

    return {
      success: true,
      data: { alternatives: result, count: result.length },
    };
  }
}
