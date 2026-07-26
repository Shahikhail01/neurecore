/**
 * ContextTool — Phase F (Weeks 25-26)
 *
 * Loads context for the AI agent from three sources:
 *   1. Memory: prior agent memory entries (vector + keyword search via MemoryService)
 *   2. Drive: documents stored in the tenant's Google Drive (via GoogleDriveService)
 *   3. Conversation history: prior Q&A stored as MemoryEntry with type=LONG_TERM
 *
 * Actions:
 *   action='search_memory'  → semantic search over the agent's memory entries
 *   action='load_drive'     → list/read files in the agent's Documents/Drafts folder
 *   action='load_history'   → load prior conversation turns (by topic/keyword)
 *   action='load_all'       → bundle: memory matches + recent history + Drive doc snippets
 *
 * Security:
 *   - All searches are tenant-scoped (MemoryService + GoogleDriveService enforce)
 *   - Drive access requires Google to be connected (handled by GoogleDriveService)
 *   - History returns only memory entries with metadata.conversationTopic set
 *   - Result snippets capped to prevent token blowup
 */

import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { BaseStructuredTool } from '../structured-tool.base';
import {
  ToolCategory,
  StructuredToolResult,
  ToolExecutionContext,
} from '../interfaces/structured-tool.interface';
import { MemoryService } from '../../memory/memory.service';
import { GoogleDriveService } from '../../integrations/google/google-drive.service';
import { ToolDataAccessService } from '../tool-data-access.service';

const SNIPPET_MAX_CHARS = 800;
const MAX_SNIPPETS = 5;
const MAX_HISTORY_TURNS = 10;

export const ContextInputSchema = z.object({
  action: z
    .enum(['search_memory', 'load_drive', 'load_history', 'load_all'])
    .describe('Context action'),

  // search_memory / load_all
  query: z.string().optional().describe('Search query (search_memory / load_all)'),

  // load_drive
  folder: z
    .enum(['Documents', 'Drafts', 'Reports', 'Templates', 'Archive', 'root'])
    .optional()
    .describe('Drive folder to read (load_drive, default Documents)'),
  fileLimit: z.number().int().positive().max(20).optional().describe('Max Drive files to list (load_drive, default 10)'),

  // load_history
  topic: z.string().optional().describe('Conversation topic key (load_history)'),

  // common
  limit: z.number().int().positive().max(50).optional().describe('Max results (search_memory / load_history)'),
});
export type ContextInput = z.infer<typeof ContextInputSchema>;

export const ContextOutputSchema = z.object({
  action: z.string(),
  memory: z
    .array(z.object({ id: z.string(), summary: z.string().optional(), content: z.string(), importance: z.number().optional() }))
    .optional(),
  drive: z
    .array(z.object({ id: z.string(), name: z.string(), mimeType: z.string(), snippet: z.string().optional(), webViewLink: z.string().optional() }))
    .optional(),
  history: z
    .array(z.object({ role: z.string(), content: z.string(), createdAt: z.string().optional(), topic: z.string().optional() }))
    .optional(),
  totals: z.object({ memory: z.number().optional(), drive: z.number().optional(), history: z.number().optional() }).optional(),
});
export type ContextOutput = z.infer<typeof ContextOutputSchema>;

@Injectable()
export class ContextTool extends BaseStructuredTool {
  readonly name = 'context';
  readonly description =
    'Load company context for the agent. ' +
    "action='search_memory' does a semantic + keyword search over prior agent memory. " +
    "action='load_drive' lists and snippets documents from the agent's Drive folder. " +
    "action='load_history' returns prior conversation turns on a topic. " +
    "action='load_all' bundles all three for a comprehensive context pull. " +
    'Use before answering questions that depend on prior decisions, prior chats, or stored documents.';
  readonly category = ToolCategory.AI;
  readonly inputSchema = ContextInputSchema;
  readonly outputSchema = ContextOutputSchema;
  readonly requiredPermissions = ['context:read'];

  constructor(
    private readonly memory: MemoryService,
    private readonly drive: GoogleDriveService,
    private readonly data: ToolDataAccessService,
  ) {
    super();
  }

  protected async executeImpl(
    input: ContextInput,
    context?: Partial<ToolExecutionContext>,
  ): Promise<StructuredToolResult<ContextOutput>> {
    const tenantId = context?.tenantId;
    const agentId = context?.agentId;
    if (!tenantId) return { success: false, error: 'Tenant context required' };

    try {
      switch (input.action) {
        case 'search_memory':
          return await this.searchMemory(tenantId, agentId, input);
        case 'load_drive':
          return await this.loadDrive(tenantId, agentId, input);
        case 'load_history':
          return await this.loadHistory(tenantId, agentId, input);
        case 'load_all':
          return await this.loadAll(tenantId, agentId, input);
        default:
          return { success: false, error: `Unknown action: ${String(input.action)}` };
      }
    } catch (error) {
      this.logger.error(`ContextTool [${input.action}] failed`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Context load failed',
      };
    }
  }

  // ─── search_memory ───────────────────────────────────────────────────────

  private async searchMemory(
    tenantId: string,
    agentId: string | undefined,
    input: ContextInput,
  ): Promise<StructuredToolResult<ContextOutput>> {
    if (!input.query) return { success: false, error: 'search_memory requires query' };

    const entries = (await this.memory.search({
      tenantId,
      agentId,
      query: input.query,
      limit: input.limit ?? 10,
    })) as Array<{
      id: string;
      content: string;
      summary?: string | null;
      importance?: number;
    }>;

    const items = entries.slice(0, MAX_SNIPPETS).map((e) => ({
      id: e.id,
      summary: e.summary ?? undefined,
      content: e.content.length > SNIPPET_MAX_CHARS
        ? e.content.slice(0, SNIPPET_MAX_CHARS) + '…'
        : e.content,
      importance: e.importance,
    }));

    return {
      success: true,
      data: { action: 'search_memory', memory: items, totals: { memory: items.length } },
      metadata: { model: 'context-tool-v1' },
    };
  }

  // ─── load_drive ──────────────────────────────────────────────────────────

  private async loadDrive(
    tenantId: string,
    agentId: string | undefined,
    input: ContextInput,
  ): Promise<StructuredToolResult<ContextOutput>> {
    const folderName = input.folder ?? 'Documents';
    const fileLimit = input.fileLimit ?? 10;

    let parentId: string;
    if (folderName === 'root' || !agentId) {
      const root = await this.drive.ensureRootFolder(tenantId);
      parentId = root.id;
    } else {
      const agent = await this.data.agent.findUnique({
        where: { id: agentId },
        select: { id: true, name: true, tenantId: true },
      });
      if (!agent || agent.tenantId !== tenantId) {
        return { success: false, error: `Agent ${agentId} not found` };
      }
      const folders = await this.drive.setupAgentFolders(tenantId, agent.id, agent.name);
      parentId = folders.subfolders[folderName] ?? folders.folderId;
    }

    const files = await this.drive.listFiles(tenantId, parentId, { pageSize: fileLimit });

    const items: Array<{
      id: string;
      name: string;
      mimeType: string;
      snippet?: string;
      webViewLink?: string;
    }> = [];

    for (const f of files) {
      let snippet: string | undefined;
      if (f.mimeType === 'text/html' || f.mimeType === 'text/plain') {
        try {
          const accessToken = await this.drive['authClient'].getAccessToken(tenantId);
          if (accessToken) {
            const res = await fetch(
              `https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`,
              { headers: { Authorization: `Bearer ${accessToken}` } },
            );
            if (res.ok) {
              const text = await res.text();
              const stripped = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
              snippet = stripped.length > SNIPPET_MAX_CHARS
                ? stripped.slice(0, SNIPPET_MAX_CHARS) + '…'
                : stripped;
            }
          }
        } catch {
          // snippet is best-effort
        }
      }
      items.push({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        snippet,
        webViewLink: f.webViewLink,
      });
    }

    return {
      success: true,
      data: { action: 'load_drive', drive: items, totals: { drive: items.length } },
      metadata: { model: 'context-tool-v1' },
    };
  }

  // ─── load_history ────────────────────────────────────────────────────────

  private async loadHistory(
    tenantId: string,
    agentId: string | undefined,
    input: ContextInput,
  ): Promise<StructuredToolResult<ContextOutput>> {
    const limit = input.limit ?? MAX_HISTORY_TURNS;

    // History is stored as MemoryEntry rows with metadata.conversationTopic + metadata.role
    const rows = await this.data.memoryEntry.findMany({
      where: {
        tenantId,
        ...(agentId ? { agentId } : {}),
        type: 'LONG_TERM',
        ...(input.topic ? { content: { contains: input.topic, mode: 'insensitive' } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Oldest-first ordering for conversation flow
    const items = rows
      .reverse()
      .map((r) => {
        const md = (r.metadata ?? {}) as Record<string, unknown>;
        return {
          role: typeof md.role === 'string' ? md.role : 'user',
          content: r.content.length > SNIPPET_MAX_CHARS
            ? r.content.slice(0, SNIPPET_MAX_CHARS) + '…'
            : r.content,
          createdAt: r.createdAt.toISOString(),
          topic: typeof md.conversationTopic === 'string' ? md.conversationTopic : undefined,
        };
      });

    return {
      success: true,
      data: { action: 'load_history', history: items, totals: { history: items.length } },
      metadata: { model: 'context-tool-v1' },
    };
  }

  // ─── load_all ────────────────────────────────────────────────────────────

  private async loadAll(
    tenantId: string,
    agentId: string | undefined,
    input: ContextInput,
  ): Promise<StructuredToolResult<ContextOutput>> {
    if (!input.query) {
      return { success: false, error: 'load_all requires query (used as the search anchor)' };
    }
    const [mem, drv, hist] = await Promise.all([
      this.searchMemory(tenantId, agentId, { ...input, action: 'search_memory' }),
      this.loadDrive(tenantId, agentId, { ...input, action: 'load_drive', fileLimit: 5 }),
      this.loadHistory(tenantId, agentId, { ...input, action: 'load_history', limit: MAX_HISTORY_TURNS }),
    ]);

    return {
      success: true,
      data: {
        action: 'load_all',
        memory: (mem.data as ContextOutput | undefined)?.memory,
        drive: (drv.data as ContextOutput | undefined)?.drive,
        history: (hist.data as ContextOutput | undefined)?.history,
        totals: {
          memory: (mem.data as ContextOutput | undefined)?.totals?.memory,
          drive: (drv.data as ContextOutput | undefined)?.totals?.drive,
          history: (hist.data as ContextOutput | undefined)?.totals?.history,
        },
      },
      metadata: { model: 'context-tool-v1' },
    };
  }
}
