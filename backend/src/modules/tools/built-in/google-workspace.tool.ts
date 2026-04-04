/**
 * Google Workspace API Tool - P0-5 of remaining tools
 * Enables AI agents to manage Google Calendar, Gmail, Docs, and Sheets operations
 *
 * SOLID Principles Applied:
 * - SRP: Single responsibility for Google Workspace operations
 * - OCP: Extensible via provider interfaces for different Google services
 * - DIP: Depends on abstractions for Google API integration
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

export const GoogleWorkspaceActionEnum = z.enum([
  'calendar_events',
  'calendar_create_event',
  'calendar_update_event',
  'calendar_delete_event',
  'send_email',
  'read_email',
  'create_document',
  'read_document',
  'update_document',
  'create_spreadsheet',
  'read_spreadsheet',
  'update_spreadsheet',
]);

export type GoogleWorkspaceAction = z.infer<typeof GoogleWorkspaceActionEnum>;

export const GoogleWorkspaceInputSchema = z.object({
  action: GoogleWorkspaceActionEnum.describe(
    'The Google Workspace action to perform',
  ),
  // Calendar options
  eventId: z.string().optional().describe('Calendar event ID'),
  calendarId: z.string().optional().describe('Calendar ID (default: primary)'),
  startTime: z.string().optional().describe('Event start time (ISO)'),
  endTime: z.string().optional().describe('Event end time (ISO)'),
  title: z.string().optional().describe('Event/document title'),
  description: z.string().optional().describe('Event/document description'),
  attendees: z.array(z.string()).optional().describe('List of attendee emails'),
  location: z.string().optional().describe('Event location'),
  // Email options
  to: z.string().optional().describe('Recipient email address'),
  subject: z.string().optional().describe('Email subject'),
  body: z.string().optional().describe('Email body content'),
  emailId: z.string().optional().describe('Email ID for reading'),
  // Document options
  documentId: z.string().optional().describe('Google Doc ID'),
  documentContent: z.string().optional().describe('Document content to write'),
  // Spreadsheet options
  spreadsheetId: z.string().optional().describe('Google Spreadsheet ID'),
  sheetName: z.string().optional().describe('Sheet name'),
  data: z
    .array(z.array(z.union([z.string(), z.number(), z.boolean()])))
    .optional()
    .describe('Spreadsheet data rows'),
});

export type GoogleWorkspaceInput = z.infer<typeof GoogleWorkspaceInputSchema>;

// ─────────────────────────────────────────────────────────────
// Output Schemas
// ─────────────────────────────────────────────────────────────

export const CalendarEventSchema = z.object({
  id: z.string(),
  summary: z.string().optional(),
  description: z.string().optional(),
  start: z.string(),
  end: z.string(),
  location: z.string().optional(),
  attendees: z.array(z.string()).optional(),
});

export const EmailSchema = z.object({
  id: z.string(),
  subject: z.string(),
  from: z.string(),
  to: z.string(),
  body: z.string(),
  date: z.string(),
});

export const GoogleDocumentSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string().optional(),
  createdTime: z.string(),
  modifiedTime: z.string(),
});

export const GoogleSpreadsheetSchema = z.object({
  id: z.string(),
  title: z.string(),
  sheetName: z.string().optional(),
  data: z.array(z.array(z.union([z.string(), z.number()]))).optional(),
});

export const GoogleWorkspaceOutputSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  data: z.record(z.unknown()).optional(),
  events: z.array(CalendarEventSchema).optional(),
  event: CalendarEventSchema.optional(),
  email: EmailSchema.optional(),
  document: GoogleDocumentSchema.optional(),
  spreadsheet: GoogleSpreadsheetSchema.optional(),
});

// ─────────────────────────────────────────────────────────────
// Provider Interface (DIP)
// ─────────────────────────────────────────────────────────────

interface IGoogleCalendarProvider {
  listEvents(options: {
    calendarId?: string;
    maxResults?: number;
  }): Promise<z.infer<typeof CalendarEventSchema>[]>;

  createEvent(options: {
    calendarId?: string;
    summary: string;
    description?: string;
    start: string;
    end: string;
    location?: string;
    attendees?: string[];
  }): Promise<z.infer<typeof CalendarEventSchema>>;

  updateEvent(
    eventId: string,
    options: {
      calendarId?: string;
      summary?: string;
      description?: string;
      start?: string;
      end?: string;
      location?: string;
    },
  ): Promise<z.infer<typeof CalendarEventSchema>>;

  deleteEvent(eventId: string, calendarId?: string): Promise<void>;
}

interface IGoogleGmailProvider {
  sendEmail(options: {
    to: string;
    subject: string;
    body: string;
  }): Promise<{ messageId: string }>;

  readEmail(emailId: string): Promise<z.infer<typeof EmailSchema>>;
}

interface IGoogleDocsProvider {
  createDocument(options: {
    title: string;
    content?: string;
  }): Promise<z.infer<typeof GoogleDocumentSchema>>;

  readDocument(
    documentId: string,
  ): Promise<z.infer<typeof GoogleDocumentSchema>>;

  updateDocument(
    documentId: string,
    options: { content?: string; title?: string },
  ): Promise<z.infer<typeof GoogleDocumentSchema>>;
}

interface IGoogleSheetsProvider {
  createSpreadsheet(options: {
    title: string;
    sheetName?: string;
    data?: string[][];
  }): Promise<z.infer<typeof GoogleSpreadsheetSchema>>;

  readSpreadsheet(
    spreadsheetId: string,
    sheetName?: string,
  ): Promise<z.infer<typeof GoogleSpreadsheetSchema>>;

  updateSpreadsheet(
    spreadsheetId: string,
    options: { sheetName?: string; data?: string[][] },
  ): Promise<z.infer<typeof GoogleSpreadsheetSchema>>;
}

// ─────────────────────────────────────────────────────────────
// Mock Google Workspace Provider (Development Mode)
// ─────────────────────────────────────────────────────────────

@Injectable()
class MockGoogleWorkspaceProvider
  implements
    IGoogleCalendarProvider,
    IGoogleGmailProvider,
    IGoogleDocsProvider,
    IGoogleSheetsProvider
{
  private readonly logger = new Logger(MockGoogleWorkspaceProvider.name);

  private events = new Map<string, z.infer<typeof CalendarEventSchema>>();
  private documents = new Map<string, z.infer<typeof GoogleDocumentSchema>>();
  private spreadsheets = new Map<
    string,
    z.infer<typeof GoogleSpreadsheetSchema>
  >();
  private emailIdCounter = 1;

  constructor() {
    this.initializeMockData();
  }

  private initializeMockData(): void {
    // Mock calendar events
    const mockEvents = [
      {
        id: 'evt-1',
        summary: 'Team Standup',
        description: 'Daily standup meeting',
        start: '2026-04-04T09:00:00Z',
        end: '2026-04-04T09:30:00Z',
        location: 'Conference Room A',
      },
      {
        id: 'evt-2',
        summary: 'Product Review',
        description: 'Q2 product roadmap review',
        start: '2026-04-04T14:00:00Z',
        end: '2026-04-04T15:00:00Z',
        location: 'Zoom',
      },
      {
        id: 'evt-3',
        summary: 'Client Call',
        description: 'Weekly sync with client',
        start: '2026-04-05T11:00:00Z',
        end: '2026-04-05T12:00:00Z',
      },
    ];
    mockEvents.forEach((e) => this.events.set(e.id, e));

    // Mock documents
    const mockDocs = [
      {
        id: 'doc-1',
        title: 'Q1 Report',
        content: 'Q1 2026 Business Report',
        createdTime: '2026-03-01T00:00:00Z',
        modifiedTime: '2026-03-31T00:00:00Z',
      },
      {
        id: 'doc-2',
        title: 'Meeting Notes',
        content: 'Weekly team meeting notes',
        createdTime: '2026-04-01T00:00:00Z',
        modifiedTime: '2026-04-04T00:00:00Z',
      },
    ];
    mockDocs.forEach((d) => this.documents.set(d.id, d));

    // Mock spreadsheets
    const mockSheets = [
      {
        id: 'sheet-1',
        title: 'Budget 2026',
        sheetName: 'Sheet1',
        data: [
          ['Category', 'Amount'],
          ['Marketing', 50000],
          ['Sales', 75000],
        ],
      },
      {
        id: 'sheet-2',
        title: 'Sales Data',
        sheetName: 'Q1',
        data: [
          ['Month', 'Revenue'],
          ['January', 25000],
          ['February', 30000],
        ],
      },
    ];
    mockSheets.forEach((s) => this.spreadsheets.set(s.id, s));
  }

  // Calendar methods
  async listEvents(options: {
    calendarId?: string;
    maxResults?: number;
  }): Promise<z.infer<typeof CalendarEventSchema>[]> {
    this.logger.log(`Listing calendar events: ${JSON.stringify(options)}`);
    const events = Array.from(this.events.values()).slice(
      0,
      options.maxResults ?? 10,
    );
    return events;
  }

  async createEvent(options: {
    calendarId?: string;
    summary: string;
    description?: string;
    start: string;
    end: string;
    location?: string;
    attendees?: string[];
  }): Promise<z.infer<typeof CalendarEventSchema>> {
    this.logger.log(`Creating calendar event: ${options.summary}`);
    const eventId = `evt-${Date.now()}`;
    const event: z.infer<typeof CalendarEventSchema> = {
      id: eventId,
      summary: options.summary,
      description: options.description,
      start: options.start,
      end: options.end,
      location: options.location,
      attendees: options.attendees,
    };
    this.events.set(eventId, event);
    return event;
  }

  async updateEvent(
    eventId: string,
    options: {
      calendarId?: string;
      summary?: string;
      description?: string;
      start?: string;
      end?: string;
      location?: string;
    },
  ): Promise<z.infer<typeof CalendarEventSchema>> {
    this.logger.log(`Updating calendar event: ${eventId}`);
    const event = this.events.get(eventId);
    if (!event) {
      throw new Error(`Event not found: ${eventId}`);
    }
    const updated = { ...event, ...options };
    this.events.set(eventId, updated);
    return updated;
  }

  async deleteEvent(eventId: string, calendarId?: string): Promise<void> {
    this.logger.log(`Deleting calendar event: ${eventId}`);
    if (!this.events.has(eventId)) {
      throw new Error(`Event not found: ${eventId}`);
    }
    this.events.delete(eventId);
  }

  // Gmail methods
  async sendEmail(options: {
    to: string;
    subject: string;
    body: string;
  }): Promise<{ messageId: string }> {
    this.logger.log(`Sending email to: ${options.to}`);
    const messageId = `msg-${this.emailIdCounter++}`;
    return { messageId };
  }

  async readEmail(emailId: string): Promise<z.infer<typeof EmailSchema>> {
    this.logger.log(`Reading email: ${emailId}`);
    return {
      id: emailId,
      subject: 'Mock Email Subject',
      from: 'sender@example.com',
      to: 'recipient@example.com',
      body: 'This is a mock email body',
      date: new Date().toISOString(),
    };
  }

  // Docs methods
  async createDocument(options: {
    title: string;
    content?: string;
  }): Promise<z.infer<typeof GoogleDocumentSchema>> {
    this.logger.log(`Creating document: ${options.title}`);
    const docId = `doc-${Date.now()}`;
    const now = new Date().toISOString();
    const doc: z.infer<typeof GoogleDocumentSchema> = {
      id: docId,
      title: options.title,
      content: options.content,
      createdTime: now,
      modifiedTime: now,
    };
    this.documents.set(docId, doc);
    return doc;
  }

  async readDocument(
    documentId: string,
  ): Promise<z.infer<typeof GoogleDocumentSchema>> {
    this.logger.log(`Reading document: ${documentId}`);
    const doc = this.documents.get(documentId);
    if (!doc) {
      throw new Error(`Document not found: ${documentId}`);
    }
    return doc;
  }

  async updateDocument(
    documentId: string,
    options: { content?: string; title?: string },
  ): Promise<z.infer<typeof GoogleDocumentSchema>> {
    this.logger.log(`Updating document: ${documentId}`);
    const doc = this.documents.get(documentId);
    if (!doc) {
      throw new Error(`Document not found: ${documentId}`);
    }
    const updated: z.infer<typeof GoogleDocumentSchema> = {
      ...doc,
      ...options,
      modifiedTime: new Date().toISOString(),
    };
    this.documents.set(documentId, updated);
    return updated;
  }

  // Sheets methods
  async createSpreadsheet(options: {
    title: string;
    sheetName?: string;
    data?: string[][];
  }): Promise<z.infer<typeof GoogleSpreadsheetSchema>> {
    this.logger.log(`Creating spreadsheet: ${options.title}`);
    const sheetId = `sheet-${Date.now()}`;
    const sheet: z.infer<typeof GoogleSpreadsheetSchema> = {
      id: sheetId,
      title: options.title,
      sheetName: options.sheetName ?? 'Sheet1',
      data: options.data,
    };
    this.spreadsheets.set(sheetId, sheet);
    return sheet;
  }

  async readSpreadsheet(
    spreadsheetId: string,
    sheetName?: string,
  ): Promise<z.infer<typeof GoogleSpreadsheetSchema>> {
    this.logger.log(`Reading spreadsheet: ${spreadsheetId}`);
    const sheet = this.spreadsheets.get(spreadsheetId);
    if (!sheet) {
      throw new Error(`Spreadsheet not found: ${spreadsheetId}`);
    }
    return { ...sheet, sheetName: sheetName ?? sheet.sheetName };
  }

  async updateSpreadsheet(
    spreadsheetId: string,
    options: { sheetName?: string; data?: string[][] },
  ): Promise<z.infer<typeof GoogleSpreadsheetSchema>> {
    this.logger.log(`Updating spreadsheet: ${spreadsheetId}`);
    const sheet = this.spreadsheets.get(spreadsheetId);
    if (!sheet) {
      throw new Error(`Spreadsheet not found: ${spreadsheetId}`);
    }
    const updated: z.infer<typeof GoogleSpreadsheetSchema> = {
      ...sheet,
      ...options,
    };
    this.spreadsheets.set(spreadsheetId, updated);
    return updated;
  }
}

// ─────────────────────────────────────────────────────────────
// Tool Implementation
// ─────────────────────────────────────────────────────────────

@Injectable()
export class GoogleWorkspaceTool extends BaseStructuredTool {
  readonly name = 'google_workspace';
  readonly description =
    'Manage Google Workspace operations including Calendar, Gmail, Docs, and Sheets';
  readonly category = ToolCategory.API;
  readonly inputSchema = GoogleWorkspaceInputSchema;

  private readonly log = new Logger(GoogleWorkspaceTool.name);
  private readonly provider: MockGoogleWorkspaceProvider;

  constructor(private readonly config: ConfigService) {
    super();
    this.provider = new MockGoogleWorkspaceProvider();
  }

  protected async executeImpl(
    input: GoogleWorkspaceInput,
    context: ToolExecutionContext,
  ): Promise<StructuredToolResult<unknown>> {
    this.logger.log(`Executing Google Workspace action: ${input.action}`);

    try {
      switch (input.action) {
        case 'calendar_events':
          return await this.handleCalendarEvents(input);
        case 'calendar_create_event':
          return await this.handleCalendarCreateEvent(input);
        case 'calendar_update_event':
          return await this.handleCalendarUpdateEvent(input);
        case 'calendar_delete_event':
          return await this.handleCalendarDeleteEvent(input);
        case 'send_email':
          return await this.handleSendEmail(input);
        case 'read_email':
          return await this.handleReadEmail(input);
        case 'create_document':
          return await this.handleCreateDocument(input);
        case 'read_document':
          return await this.handleReadDocument(input);
        case 'update_document':
          return await this.handleUpdateDocument(input);
        case 'create_spreadsheet':
          return await this.handleCreateSpreadsheet(input);
        case 'read_spreadsheet':
          return await this.handleReadSpreadsheet(input);
        case 'update_spreadsheet':
          return await this.handleUpdateSpreadsheet(input);
        default:
          throw new Error(`Unknown action: ${input.action}`);
      }
    } catch (error) {
      const err = error as Error;
      this.log.error(
        `Google Workspace action failed: ${err.message}`,
        err.stack,
      );
      return {
        success: false,
        error: err.message,
      };
    }
  }

  private async handleCalendarEvents(
    input: GoogleWorkspaceInput,
  ): Promise<StructuredToolResult<unknown>> {
    const events = await this.provider.listEvents({
      calendarId: input.calendarId,
      maxResults: 10,
    });

    return {
      success: true,
      data: { events, total: events.length },
    };
  }

  private async handleCalendarCreateEvent(
    input: GoogleWorkspaceInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.title || !input.startTime || !input.endTime) {
      throw new Error(
        'title, startTime, and endTime are required for calendar_create_event',
      );
    }

    const event = await this.provider.createEvent({
      calendarId: input.calendarId,
      summary: input.title,
      description: input.description,
      start: input.startTime,
      end: input.endTime,
      location: input.location,
      attendees: input.attendees,
    });

    return {
      success: true,
      data: { event, message: 'Calendar event created successfully' },
    };
  }

  private async handleCalendarUpdateEvent(
    input: GoogleWorkspaceInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.eventId) {
      throw new Error('eventId is required for calendar_update_event');
    }

    const event = await this.provider.updateEvent(input.eventId, {
      calendarId: input.calendarId,
      summary: input.title,
      description: input.description,
      start: input.startTime,
      end: input.endTime,
      location: input.location,
    });

    return {
      success: true,
      data: { event, message: 'Calendar event updated successfully' },
    };
  }

  private async handleCalendarDeleteEvent(
    input: GoogleWorkspaceInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.eventId) {
      throw new Error('eventId is required for calendar_delete_event');
    }

    await this.provider.deleteEvent(input.eventId, input.calendarId);

    return {
      success: true,
      data: { message: 'Calendar event deleted successfully' },
    };
  }

  private async handleSendEmail(
    input: GoogleWorkspaceInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.to || !input.subject || !input.body) {
      throw new Error('to, subject, and body are required for send_email');
    }

    const result = await this.provider.sendEmail({
      to: input.to,
      subject: input.subject,
      body: input.body,
    });

    return {
      success: true,
      data: { messageId: result.messageId, message: 'Email sent successfully' },
    };
  }

  private async handleReadEmail(
    input: GoogleWorkspaceInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.emailId) {
      throw new Error('emailId is required for read_email');
    }

    const email = await this.provider.readEmail(input.emailId);

    return {
      success: true,
      data: { email },
    };
  }

  private async handleCreateDocument(
    input: GoogleWorkspaceInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.title) {
      throw new Error('title is required for create_document');
    }

    const document = await this.provider.createDocument({
      title: input.title,
      content: input.documentContent,
    });

    return {
      success: true,
      data: { document, message: 'Document created successfully' },
    };
  }

  private async handleReadDocument(
    input: GoogleWorkspaceInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.documentId) {
      throw new Error('documentId is required for read_document');
    }

    const document = await this.provider.readDocument(input.documentId);

    return {
      success: true,
      data: { document },
    };
  }

  private async handleUpdateDocument(
    input: GoogleWorkspaceInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.documentId) {
      throw new Error('documentId is required for update_document');
    }

    const document = await this.provider.updateDocument(input.documentId, {
      content: input.documentContent,
      title: input.title,
    });

    return {
      success: true,
      data: { document, message: 'Document updated successfully' },
    };
  }

  private async handleCreateSpreadsheet(
    input: GoogleWorkspaceInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.title) {
      throw new Error('title is required for create_spreadsheet');
    }

    const spreadsheet = await this.provider.createSpreadsheet({
      title: input.title,
      sheetName: input.sheetName,
      data:
        input.data?.map((row) => row.map((cell) => String(cell))) ?? undefined,
    });

    return {
      success: true,
      data: { spreadsheet, message: 'Spreadsheet created successfully' },
    };
  }

  private async handleReadSpreadsheet(
    input: GoogleWorkspaceInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.spreadsheetId) {
      throw new Error('spreadsheetId is required for read_spreadsheet');
    }

    const spreadsheet = await this.provider.readSpreadsheet(
      input.spreadsheetId,
      input.sheetName,
    );

    return {
      success: true,
      data: { spreadsheet },
    };
  }

  private async handleUpdateSpreadsheet(
    input: GoogleWorkspaceInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.spreadsheetId) {
      throw new Error('spreadsheetId is required for update_spreadsheet');
    }

    const spreadsheet = await this.provider.updateSpreadsheet(
      input.spreadsheetId,
      {
        sheetName: input.sheetName,
        data:
          input.data?.map((row) => row.map((cell) => String(cell))) ??
          undefined,
      },
    );

    return {
      success: true,
      data: { spreadsheet, message: 'Spreadsheet updated successfully' },
    };
  }
}
