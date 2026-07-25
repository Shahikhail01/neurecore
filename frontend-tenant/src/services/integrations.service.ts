import api from './api';
import { unwrapItem } from './unwrap';

export interface IntegrationStatus {
  connected: boolean;
  source?: 'tenant' | 'master';
  email?: string;
  scopes?: string[];
  expiresAt?: string;
}

export interface Integration {
  provider: string;
  label: string;
  description: string;
  connected: boolean;
  source?: 'tenant' | 'master';
  email?: string;
  scopes?: string[];
  expiresAt?: string;
}

export interface IntegrationsList {
  google: Integration;
  brevo: Integration;
}

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

export interface GmailMessageBody {
  plainText: string;
  html: string;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  html?: boolean;
}

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
  start: string;
  end: string;
  location?: string;
  attendees?: string[];
  timeZone?: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  parents?: string[];
  createdTime?: string;
  modifiedTime?: string;
  size?: string;
}

export interface SpreadsheetMeta {
  spreadsheetId: string;
  title: string;
  sheets: {
    sheetId: number;
    title: string;
    index: number;
    rowCount: number;
    columnCount: number;
  }[];
  webViewLink?: string;
}

export interface SheetRangeData {
  range: string;
  values: string[][];
  majorDimension: 'ROWS' | 'COLUMNS';
  rowCount?: number;
  colCount?: number;
}

export interface CreateSpreadsheetInput {
  title: string;
  sheets?: { title: string; rowCount?: number; columnCount?: number }[];
}

export interface SheetsSearchHit {
  file: DriveFile;
  matchedAs?: 'spreadsheet';
  spreadsheetId?: string;
  webViewLink?: string;
}

export interface AgentFolder {
  agentId: string;
  agentName: string;
  folderId: string;
  folderLink?: string;
}

export interface AgentFoldersResponse {
  rootFolderId: string;
  agents: AgentFolder[];
}

export interface SetupAgentFoldersResponse {
  folderId: string;
  subfolders: Record<string, string>;
}

class IntegrationsService {
  async listIntegrations(): Promise<IntegrationsList> {
    const res = await api.get(`/integrations?_t=${Date.now()}`);
    return unwrapItem(res) as IntegrationsList;
  }

  async getGoogleStatus(): Promise<IntegrationStatus> {
    const res = await api.get('/integrations/google/status');
    return unwrapItem(res) as IntegrationStatus;
  }

  async getBrevoStatus(): Promise<{ connected: boolean; source?: 'tenant' | 'master' }> {
    const res = await api.get(`/integrations/brevo/status?_t=${Date.now()}`);
    return unwrapItem(res) as { connected: boolean; source?: 'tenant' | 'master' };
  }

  async initiateGoogleOAuth(
    redirectUri?: string,
    audience: 'tenant' | 'admin' = 'tenant',
    origin: 'settings' | 'onboarding' = 'settings',
  ): Promise<{ url: string }> {
    const res = await api.post('/integrations/google/authorize', {
      redirectUri,
      audience,
      origin,
    });
    return unwrapItem(res) as { url: string };
  }

  async disconnectGoogle(): Promise<void> {
    await api.post('/integrations/google/disconnect');
  }

  async connectBrevo(apiKey: string): Promise<{ connected: boolean }> {
    const res = await api.post('/integrations/brevo/connect', { apiKey });
    return unwrapItem(res) as { connected: boolean };
  }

  async disconnectBrevo(): Promise<void> {
    await api.post('/integrations/brevo/disconnect');
  }

  async brevoTestSend(
    payload: { to: string; subject?: string; htmlContent?: string },
  ): Promise<{ success: boolean; messageId?: string; source?: string; error?: string }> {
    const res = await api.post('/integrations/brevo/test-send', payload);
    const data = (unwrapItem(res) as Record<string, unknown>) ?? {};
    return {
      success: data.success === true,
      messageId: typeof data.messageId === 'string' ? data.messageId : undefined,
      source: typeof data.source === 'string' ? data.source : undefined,
      error: typeof data.error === 'string' ? data.error : undefined,
    };
  }

  /**
   * Persist per-tenant sender identity (email + display name + reply-to).
   * Used by BrevoWizard after a successful connect.
   */
  async setBrevoSender(payload: {
    brevoSenderEmail: string;
    brevoSenderName?: string;
    brevoReplyToEmail?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const res = await api.put('/integrations/brevo/sender', payload);
    return unwrapItem(res) as { success: boolean; error?: string };
  }

  async getBrevoSender(): Promise<{
    tenant: {
      brevoSenderEmail: string | null;
      brevoSenderName: string | null;
      brevoReplyToEmail: string | null;
    };
  }> {
    const res = await api.get('/integrations/brevo/sender');
    return unwrapItem(res) as {
      tenant: {
        brevoSenderEmail: string | null;
        brevoSenderName: string | null;
        brevoReplyToEmail: string | null;
      };
    };
  }

  async getBrevoUsage(): Promise<{
    sentToday: number;
    dailyLimit: number;
    warningThreshold: number;
    isAtWarning: boolean;
    isAtLimit: boolean;
    remaining: number;
  }> {
    const res = await api.get(`/integrations/usage/brevo?_t=${Date.now()}`);
    return unwrapItem(res) as never;
  }

  async getGoogleDriveFolders(): Promise<{
    rootFolderId: string | null;
    children: unknown[];
  }> {
    const res = await api.get('/integrations/google/drive-folders');
    return unwrapItem(res) as { rootFolderId: string | null; children: unknown[] };
  }

  // ─── Gmail ──────────────────────────────────────────────────────────

  async getInbox(options: { maxResults?: number; pageToken?: string; q?: string } = {}): Promise<{
    messages: GmailMessage[];
    nextPageToken?: string;
  }> {
    const params: Record<string, string> = {};
    if (options.maxResults) params.maxResults = String(options.maxResults);
    if (options.pageToken) params.pageToken = options.pageToken;
    if (options.q) params.q = options.q;
    const res = await api.get('/integrations/gmail/inbox', { params });
    return unwrapItem(res) as { messages: GmailMessage[]; nextPageToken?: string };
  }

  async getMessage(id: string): Promise<GmailMessage> {
    const res = await api.get(`/integrations/gmail/messages/${id}`);
    return unwrapItem(res) as GmailMessage;
  }

  async getMessageBody(id: string): Promise<GmailMessageBody> {
    const res = await api.get(`/integrations/gmail/messages/${id}/body`);
    return unwrapItem(res) as GmailMessageBody;
  }

  async sendEmail(input: SendEmailInput): Promise<{ messageId: string; threadId: string }> {
    const res = await api.post('/integrations/gmail/send', input);
    return unwrapItem(res) as { messageId: string; threadId: string };
  }

  async getGmailLabels(): Promise<{ id: string; name: string; type: string }[]> {
    const res = await api.get('/integrations/gmail/labels');
    return unwrapItem(res) as { id: string; name: string; type: string }[];
  }

  // ─── Calendar ──────────────────────────────────────────────────────

  async getCalendarEvents(options: {
    calendarId?: string;
    maxResults?: number;
    timeMin?: string;
    timeMax?: string;
    q?: string;
  } = {}): Promise<CalendarEvent[]> {
    const params: Record<string, string> = {};
    if (options.calendarId) params.calendarId = options.calendarId;
    if (options.maxResults) params.maxResults = String(options.maxResults);
    if (options.timeMin) params.timeMin = options.timeMin;
    if (options.timeMax) params.timeMax = options.timeMax;
    if (options.q) params.q = options.q;
    const res = await api.get('/integrations/calendar/events', { params });
    return unwrapItem(res) as CalendarEvent[];
  }

  async createCalendarEvent(input: CreateEventInput, calendarId?: string): Promise<CalendarEvent> {
    const params = calendarId ? { calendarId } : {};
    const res = await api.post('/integrations/calendar/events', input, { params });
    return unwrapItem(res) as CalendarEvent;
  }

  async deleteCalendarEvent(id: string, calendarId?: string): Promise<void> {
    const params = calendarId ? { calendarId } : {};
    await api.delete(`/integrations/calendar/events/${id}`, { params });
  }

  async getCalendarList(): Promise<{ id: string; summary: string; primary: boolean }[]> {
    const res = await api.get('/integrations/calendar/list');
    return unwrapItem(res) as { id: string; summary: string; primary: boolean }[];
  }

  // ─── Drive ──────────────────────────────────────────────────────────

  async listAgentFolders(): Promise<AgentFoldersResponse> {
    const res = await api.get('/integrations/drive/folders/agents');
    return unwrapItem(res) as AgentFoldersResponse;
  }

  async setupAgentFolders(agentId: string, agentName: string): Promise<SetupAgentFoldersResponse> {
    const res = await api.post(`/integrations/drive/folders/agents/${agentId}/setup`, { agentName });
    return unwrapItem(res) as SetupAgentFoldersResponse;
  }

  async listDriveFiles(folderId: string): Promise<DriveFile[]> {
    const res = await api.get(`/integrations/drive/folders/${folderId}/files`);
    return unwrapItem(res) as DriveFile[];
  }

  async createDriveFolder(name: string, parentId?: string): Promise<DriveFile> {
    const res = await api.post('/integrations/drive/folders', { name, parentId });
    return unwrapItem(res) as DriveFile;
  }

  async createDriveFile(input: { name: string; content: string; mimeType?: string; parentId?: string }): Promise<DriveFile> {
    const res = await api.post('/integrations/drive/files', input);
    return unwrapItem(res) as DriveFile;
  }

  async searchDrive(
    query: string,
    options: { pageSize?: number; mimeType?: string; mode?: 'name' | 'fulltext' } = {},
  ): Promise<DriveFile[]> {
    const params: Record<string, string> = { q: query };
    if (options.pageSize) params.pageSize = String(options.pageSize);
    if (options.mimeType) params.mimeType = options.mimeType;
    if (options.mode) params.mode = options.mode;
    const res = await api.get('/integrations/drive/search', { params });
    return unwrapItem(res) as DriveFile[];
  }

  // ─── Google Sheets ─────────────────────────────────────────────────

  async createSpreadsheet(input: CreateSpreadsheetInput): Promise<SpreadsheetMeta> {
    const res = await api.post('/integrations/sheets', input);
    return unwrapItem(res) as SpreadsheetMeta;
  }

  async getSpreadsheetMetadata(spreadsheetId: string): Promise<SpreadsheetMeta> {
    const res = await api.get(`/integrations/sheets/${encodeURIComponent(spreadsheetId)}/metadata`);
    return unwrapItem(res) as SpreadsheetMeta;
  }

  async readSheetRange(
    spreadsheetId: string,
    range: string,
    majorDimension: 'ROWS' | 'COLUMNS' = 'ROWS',
  ): Promise<SheetRangeData> {
    const res = await api.get(
      `/integrations/sheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`,
      { params: { majorDimension } },
    );
    const data = (unwrapItem(res) as { range: string; majorDimension: 'ROWS' | 'COLUMNS'; values: string[][] });
    return {
      range: data.range,
      majorDimension: data.majorDimension,
      values: data.values ?? [],
      rowCount: data.values?.length ?? 0,
      colCount: data.values?.[0]?.length ?? 0,
    };
  }

  async writeSheetRange(
    spreadsheetId: string,
    range: string,
    values: string[][],
    majorDimension: 'ROWS' | 'COLUMNS' = 'ROWS',
  ): Promise<{ updatedRange: string; updatedRows: number; updatedColumns: number; updatedCells: number }> {
    const res = await api.post(
      `/integrations/sheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`,
      { values, majorDimension },
    );
    return unwrapItem(res) as { updatedRange: string; updatedRows: number; updatedColumns: number; updatedCells: number };
  }

  async appendSheetRows(
    spreadsheetId: string,
    range: string,
    values: string[][],
  ): Promise<{ updatedRange: string; updatedRows: number; updatedColumns: number }> {
    const res = await api.post(
      `/integrations/sheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}/append`,
      { values },
    );
    const data = unwrapItem(res) as { updatedRange: string; updates: { updatedRows: number; updatedColumns: number } };
    return {
      updatedRange: data.updatedRange,
      updatedRows: data.updates.updatedRows,
      updatedColumns: data.updates.updatedColumns,
    };
  }

  async clearSheetRange(spreadsheetId: string, range: string): Promise<void> {
    await api.post(
      `/integrations/sheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}/clear`,
    );
  }

  // ─── Google Docs ────────────────────────────────────────────────

  async createGoogleDoc(input: { title: string; content?: string; parentId?: string }): Promise<{ documentId: string; title: string; url: string }> {
    const res = await api.post('/integrations/docs', input);
    return unwrapItem(res) as { documentId: string; title: string; url: string };
  }

  async getGoogleDoc(documentId: string): Promise<Record<string, unknown>> {
    const res = await api.get(`/integrations/docs/${documentId}`);
    return unwrapItem(res) as Record<string, unknown>;
  }

  // ─── Google Slides ──────────────────────────────────────────────

  async createGoogleSlides(input: { title: string; slides?: { title: string; body?: string }[]; parentId?: string }): Promise<{ presentationId: string; title: string; url: string }> {
    const res = await api.post('/integrations/slides', input);
    return unwrapItem(res) as { presentationId: string; title: string; url: string };
  }

  async getGoogleSlides(presentationId: string): Promise<Record<string, unknown>> {
    const res = await api.get(`/integrations/slides/${presentationId}`);
    return unwrapItem(res) as Record<string, unknown>;
  }

  // ─── Drive Sharing (G8) ───────────────────────────────────────────

  async shareDriveFile(
    fileId: string,
    input: {
      role: 'reader' | 'writer' | 'commenter';
      type: 'user' | 'group' | 'domain' | 'anyone';
      emailAddress?: string;
      domain?: string;
      sendNotification?: boolean;
      emailMessage?: string;
    },
  ): Promise<{ id: string; role: string; type: string; emailAddress?: string }> {
    const res = await api.post(
      `/integrations/drive/files/${encodeURIComponent(fileId)}/permissions`,
      input,
    );
    return unwrapItem(res) as { id: string; role: string; type: string; emailAddress?: string };
  }

  async listDriveFilePermissions(
    fileId: string,
  ): Promise<{ id: string; role: string; type: string; emailAddress?: string; domain?: string }[]> {
    const res = await api.get(
      `/integrations/drive/files/${encodeURIComponent(fileId)}/permissions`,
    );
    return unwrapItem(res) as { id: string; role: string; type: string; emailAddress?: string; domain?: string }[];
  }

  async revokeDriveFilePermission(
    fileId: string,
    permissionId: string,
  ): Promise<void> {
    await api.delete(
      `/integrations/drive/files/${encodeURIComponent(fileId)}/permissions/${encodeURIComponent(permissionId)}`,
    );
  }
}

export const integrationsService = new IntegrationsService();