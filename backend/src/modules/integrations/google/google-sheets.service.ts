import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { GoogleAuthClient } from './google-auth.client';

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
}

export interface CreateSpreadsheetInput {
  title: string;
  sheets?: { title: string; rowCount?: number; columnCount?: number }[];
}

export interface WriteRangeInput {
  spreadsheetId: string;
  range: string;
  values: string[][];
  majorDimension?: 'ROWS' | 'COLUMNS';
}

export interface AppendRowsInput {
  spreadsheetId: string;
  range: string;
  values: string[][];
}

export interface BatchUpdateRequest {
  requests: Record<string, unknown>[];
  includeSpreadsheetInResponse?: boolean;
}

export interface CopySheetInput {
  spreadsheetId: string;
  sheetId: number;
  destinationSpreadsheetId: string;
}

export interface CopySheetResult {
  sheetId: number;
  title: string;
  index: number;
  spreadsheetId: string;
}

@Injectable()
export class GoogleSheetsService {
  private readonly logger = new Logger(GoogleSheetsService.name);
  private readonly SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

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
   * Create a new spreadsheet with optional named sheets.
   */
  async createSpreadsheet(
    tenantId: string,
    input: CreateSpreadsheetInput,
  ): Promise<SpreadsheetMeta> {
    const body: Record<string, unknown> = {
      properties: { title: input.title },
    };
    if (input.sheets?.length) {
      body.sheets = input.sheets.map((s) => ({
        properties: {
          title: s.title,
          gridProperties: {
            rowCount: s.rowCount ?? 1000,
            columnCount: s.columnCount ?? 26,
          },
        },
      }));
    }

    const res = await this.authFetch(
      this.SHEETS_API,
      { method: 'POST', body: JSON.stringify(body) },
      tenantId,
    );

    if (!res.ok) {
      const err = await res.text().catch(() => 'unknown');
      this.logger.error(`Sheets create failed: ${res.status} ${err}`);
      throw new BadRequestException(`Sheets create failed (${res.status}): ${err.slice(0, 200)}`);
    }

    const data = (await res.json()) as RawSpreadsheet;
    return this.parseSpreadsheet(data);
  }

  /**
   * Read values from a range (e.g. "Sheet1!A1:D10" or "Sheet1" for entire sheet).
   */
  async readRange(
    tenantId: string,
    spreadsheetId: string,
    range: string,
    majorDimension: 'ROWS' | 'COLUMNS' = 'ROWS',
  ): Promise<SheetRangeData> {
    const params = new URLSearchParams({
      majorDimension,
      valueRenderOption: 'FORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING',
    });

    const res = await this.authFetch(
      `${this.SHEETS_API}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?${params.toString()}`,
      {},
      tenantId,
    );

    if (!res.ok) {
      const err = await res.text().catch(() => 'unknown');
      this.logger.error(`Sheets read failed: ${res.status} ${err}`);
      throw new BadRequestException(`Sheets read failed (${res.status}): ${err.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      range: string;
      majorDimension: string;
      values?: string[][];
    };
    return {
      range: data.range,
      majorDimension: (data.majorDimension as 'ROWS' | 'COLUMNS') ?? 'ROWS',
      values: data.values ?? [],
    };
  }

  /**
   * Write values to a range. Overwrites existing content.
   */
  async writeRange(
    tenantId: string,
    input: WriteRangeInput,
  ): Promise<{
    updatedRange: string;
    updatedRows: number;
    updatedColumns: number;
    updatedCells: number;
  }> {
    const params = new URLSearchParams({
      valueInputOption: 'USER_ENTERED',
    });

    const body = {
      majorDimension: input.majorDimension ?? 'ROWS',
      values: input.values,
    };

    const res = await this.authFetch(
      `${this.SHEETS_API}/${encodeURIComponent(input.spreadsheetId)}/values/${encodeURIComponent(input.range)}?${params.toString()}`,
      { method: 'PUT', body: JSON.stringify(body) },
      tenantId,
    );

    if (!res.ok) {
      const err = await res.text().catch(() => 'unknown');
      this.logger.error(`Sheets write failed: ${res.status} ${err}`);
      throw new BadRequestException(`Sheets write failed (${res.status}): ${err.slice(0, 200)}`);
    }

    return (await res.json()) as {
      updatedRange: string;
      updatedRows: number;
      updatedColumns: number;
      updatedCells: number;
    };
  }

  /**
   * Append rows after the last row of data in a sheet.
   */
  async appendRows(
    tenantId: string,
    input: AppendRowsInput,
  ): Promise<{
    updatedRange: string;
    updates: { updatedRows: number; updatedColumns: number };
  }> {
    const params = new URLSearchParams({
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
    });

    const body = {
      majorDimension: 'ROWS',
      values: input.values,
    };

    const res = await this.authFetch(
      `${this.SHEETS_API}/${encodeURIComponent(input.spreadsheetId)}/values/${encodeURIComponent(input.range)}:append?${params.toString()}`,
      { method: 'POST', body: JSON.stringify(body) },
      tenantId,
    );

    if (!res.ok) {
      const err = await res.text().catch(() => 'unknown');
      this.logger.error(`Sheets append failed: ${res.status} ${err}`);
      throw new BadRequestException(`Sheets append failed (${res.status}): ${err.slice(0, 200)}`);
    }

    return (await res.json()) as {
      updatedRange: string;
      updates: { updatedRows: number; updatedColumns: number };
    };
  }

  /**
   * Get spreadsheet metadata (sheets list, title, etc).
   */
  async getMetadata(
    tenantId: string,
    spreadsheetId: string,
  ): Promise<SpreadsheetMeta> {
    const params = new URLSearchParams({
      fields:
        'spreadsheetId,properties.title,sheets.properties(sheetId,title,index,gridProperties),spreadsheetUrl',
    });

    const res = await this.authFetch(
      `${this.SHEETS_API}/${encodeURIComponent(spreadsheetId)}?${params.toString()}`,
      {},
      tenantId,
    );

    if (!res.ok) {
      const err = await res.text().catch(() => 'unknown');
      this.logger.error(`Sheets metadata failed: ${res.status} ${err}`);
      throw new BadRequestException(`Sheets metadata failed (${res.status}): ${err.slice(0, 200)}`);
    }

    const data = (await res.json()) as RawSpreadsheet;
    return this.parseSpreadsheet(data);
  }

  /**
   * Execute a batch of spreadsheet mutations via spreadsheets.batchUpdate.
   * Supports adding/deleting sheets, formatting cells, and any other request type
   * accepted by the Sheets v4 batchUpdate endpoint.
   */
  async batchUpdate(
    tenantId: string,
    spreadsheetId: string,
    input: BatchUpdateRequest,
  ): Promise<Record<string, unknown>> {
    const params = new URLSearchParams();
    if (input.includeSpreadsheetInResponse) {
      params.set('includeSpreadsheetInResponse', 'true');
    }

    const res = await this.authFetch(
      `${this.SHEETS_API}/${encodeURIComponent(spreadsheetId)}:batchUpdate${params.toString() ? '?' + params.toString() : ''}`,
      { method: 'POST', body: JSON.stringify({ requests: input.requests }) },
      tenantId,
    );

    if (!res.ok) {
      const err = await res.text().catch(() => 'unknown');
      this.logger.error(`Sheets batchUpdate failed: ${res.status} ${err}`);
      throw new BadRequestException(`Sheets batchUpdate failed (${res.status}): ${err.slice(0, 200)}`);
    }

    return (await res.json()) as Record<string, unknown>;
  }

  /**
   * Copy a sheet from one spreadsheet to another via spreadsheets.sheets.copyTo.
   */
  async copySheet(
    tenantId: string,
    input: CopySheetInput,
  ): Promise<CopySheetResult> {
    const body = {
      destinationSpreadsheetId: input.destinationSpreadsheetId,
    };

    const res = await this.authFetch(
      `${this.SHEETS_API}/${encodeURIComponent(input.spreadsheetId)}/sheets/${input.sheetId}:copyTo`,
      { method: 'POST', body: JSON.stringify(body) },
      tenantId,
    );

    if (!res.ok) {
      const err = await res.text().catch(() => 'unknown');
      this.logger.error(`Sheets copyTo failed: ${res.status} ${err}`);
      throw new BadRequestException(`Sheets copy failed (${res.status}): ${err.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      sheetId: number;
      title: string;
      index: number;
      spreadsheetId?: string;
    };
    return {
      sheetId: data.sheetId,
      title: data.title,
      index: data.index,
      spreadsheetId: data.spreadsheetId ?? input.destinationSpreadsheetId,
    };
  }

  /**
   * Clear values in a range.
   */
  async clearRange(
    tenantId: string,
    spreadsheetId: string,
    range: string,
  ): Promise<void> {
    const res = await this.authFetch(
      `${this.SHEETS_API}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:clear`,
      { method: 'POST' },
      tenantId,
    );

    if (!res.ok) {
      const err = await res.text().catch(() => 'unknown');
      this.logger.error(`Sheets clear failed: ${res.status} ${err}`);
      throw new BadRequestException(`Sheets clear failed (${res.status}): ${err.slice(0, 200)}`);
    }
  }

  private parseSpreadsheet(data: RawSpreadsheet): SpreadsheetMeta {
    return {
      spreadsheetId: data.spreadsheetId,
      title: data.properties?.title ?? '',
      sheets: (data.sheets ?? []).map((s) => ({
        sheetId: s.properties?.sheetId ?? 0,
        title: s.properties?.title ?? 'Sheet1',
        index: s.properties?.index ?? 0,
        rowCount: s.properties?.gridProperties?.rowCount ?? 1000,
        columnCount: s.properties?.gridProperties?.columnCount ?? 26,
      })),
      webViewLink: data.spreadsheetUrl,
    };
  }
}

interface RawSpreadsheet {
  spreadsheetId: string;
  spreadsheetUrl?: string;
  properties?: { title?: string };
  sheets?: {
    properties?: {
      sheetId?: number;
      title?: string;
      index?: number;
      gridProperties?: { rowCount?: number; columnCount?: number };
    };
  }[];
}
