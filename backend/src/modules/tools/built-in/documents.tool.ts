/**
 * DocumentsTool — Phase D (Weeks 15-16)
 *
 * Unified document operations exposed to AI agents. Wraps GoogleDriveService
 * with agent-aware folder resolution (auto-creates NeureCore/<Agent>/Documents
 * folder on first use via existing setupAgentFolders pipeline).
 *
 * Actions:
 *   action='create'   → write a new document (HTML or plain text) into the agent's Documents folder
 *   action='list'     → list files in the agent's Documents folder
 *   action='read'     → fetch the content of a specific Drive file (downloads as text)
 *   action='share'    → share a Drive file with a user, group, domain, or anyone (G8)
 *   action='unshare'  → revoke a single Drive permission (G8)
 *
 * Format strategy:
 *   - HTML is preferred (Drive converts to Doc natively)
 *   - Plain text is also accepted (stored as text/plain)
 *   - Markdown is rendered to a minimal HTML scaffold before upload (handled by caller)
 *
 * PDF export (Phase D weeks 19-20) is achieved via Drive's native "Download as PDF"
 * capability by storing HTML — agents can pass `format='html'` and downstream tools
 * convert via Drive export API. Browser-side rendering is also supported via the
 * tool returning the HTML string in its result for the UI to display/print.
 *
 * Phase 3 G8:
 *   - `share`  uses the Drive permissions API (POST .../permissions) to grant
 *     reader/writer/commenter access to a user, group, domain, or the world.
 *   - `unshare` lists permissions and revokes the matching one by email or by
 *     provided permissionId; idempotent (404s are swallowed).
 */

import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { BaseStructuredTool } from '../structured-tool.base';
import {
  ToolCategory,
  StructuredToolResult,
  ToolExecutionContext,
} from '../interfaces/structured-tool.interface';
import { ToolDataAccessService } from '../tool-data-access.service';
import { GoogleDriveService } from '../../integrations/google/google-drive.service';

export const DocumentInputSchema = z.object({
  action: z
    .enum(['create', 'list', 'read', 'share', 'unshare'])
    .describe('Document operation'),

  // create
  title: z.string().min(1).optional().describe('Document title (create, required)'),
  content: z
    .string()
    .min(1)
    .optional()
    .describe('Document body content — HTML or plain text (create, required)'),
  format: z
    .enum(['html', 'text'])
    .optional()
    .describe("Content format (create, default 'html'). HTML renders as a Doc in Drive."),
  folder: z
    .enum(['Documents', 'Drafts', 'Reports', 'Templates', 'Archive'])
    .optional()
    .describe("Subfolder under the agent's folder (create, default 'Documents')"),

  // list / read
  pageSize: z.number().int().positive().max(100).optional().describe('Max files (list, default 50)'),
  fileId: z.string().optional().describe('Drive file ID (read, required)'),

  // share (G8)
  role: z
    .enum(['reader', 'writer', 'commenter'])
    .optional()
    .describe('Access role to grant (share, default reader)'),
  shareType: z
    .enum(['user', 'group', 'domain', 'anyone'])
    .optional()
    .describe('Who to share with (share, default user)'),
  emailAddress: z
    .string()
    .email()
    .optional()
    .describe('Email of the user/group (share when shareType=user|group, required)'),
  domain: z
    .string()
    .optional()
    .describe('Domain to share with (share when shareType=domain, required)'),
  sendNotification: z
    .boolean()
    .optional()
    .describe('Email the recipient (share, default true)'),
  emailMessage: z
    .string()
    .optional()
    .describe('Custom message for the notification email (share, optional)'),

  // unshare (G8)
  permissionId: z
    .string()
    .optional()
    .describe('Drive permission id to revoke (unshare, optional if emailAddress given)'),
});
export type DocumentInput = z.infer<typeof DocumentInputSchema>;

export const DocumentOutputSchema = z.object({
  action: z.string(),
  fileId: z.string().optional(),
  fileName: z.string().optional(),
  webViewLink: z.string().optional(),
  mimeType: z.string().optional(),
  content: z.string().optional(),
  contentLength: z.number().optional(),
  files: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        mimeType: z.string(),
        webViewLink: z.string().optional(),
        modifiedTime: z.string().optional(),
        size: z.string().optional(),
      }),
    )
    .optional(),
  count: z.number().optional(),
  folder: z.string().optional(),
  // G8 share/unshare
  permissionId: z.string().optional(),
  role: z.string().optional(),
  shareType: z.string().optional(),
});
export type DocumentOutput = z.infer<typeof DocumentOutputSchema>;

@Injectable()
export class DocumentsTool extends BaseStructuredTool {
  readonly name = 'documents';
  readonly description =
    'Manage documents for the agent. ' +
    "action='create' writes a new document into the agent's Google Drive folder (HTML or plain text). " +
    "action='list' shows all files in the agent's Documents folder. " +
    "action='read' fetches the content of a specific document. " +
    "action='share' grants access on a Drive file to a user (emailAddress), group (emailAddress), domain (domain), or anyone (no recipient). role='reader'|'writer'|'commenter'. " +
    "action='unshare' revokes a Drive permission — provide permissionId OR emailAddress (or domain for domain permissions). " +
    'Use create to draft reports, proposals, briefs, or any artifact; the agent can then email or share the link.';
  readonly category = ToolCategory.FILE;
  readonly inputSchema = DocumentInputSchema;
  readonly outputSchema = DocumentOutputSchema;
  readonly requiredPermissions = ['documents:read', 'documents:write'];

  constructor(
    private readonly data: ToolDataAccessService,
    private readonly drive: GoogleDriveService,
  ) {
    super();
  }

  protected async executeImpl(
    input: DocumentInput,
    context?: Partial<ToolExecutionContext>,
  ): Promise<StructuredToolResult<DocumentOutput>> {
    const tenantId = context?.tenantId;
    const agentId = context?.agentId;
    if (!tenantId) return { success: false, error: 'Tenant context required' };

    try {
      switch (input.action) {
        case 'create':
          return await this.create(tenantId, agentId, input);
        case 'list':
          return await this.list(tenantId, agentId, input);
        case 'read':
          return await this.read(tenantId, input);
        case 'share':
          return await this.share(tenantId, input);
        case 'unshare':
          return await this.unshare(tenantId, input);
        default:
          return { success: false, error: `Unknown action: ${String(input.action)}` };
      }
    } catch (error) {
      this.logger.error(`DocumentsTool [${input.action}] failed`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Document operation failed',
      };
    }
  }

  // ─── create ─────────────────────────────────────────────────────────────

  private async create(
    tenantId: string,
    agentId: string | undefined,
    input: DocumentInput,
  ): Promise<StructuredToolResult<DocumentOutput>> {
    if (!input.title || !input.content) {
      return { success: false, error: 'create requires title and content' };
    }

    const folder = input.folder ?? 'Documents';
    const parentId = await this.resolveSubfolder(tenantId, agentId, folder);
    const format = input.format ?? 'html';
    const mimeType =
      format === 'html' ? 'text/html' : 'text/plain';
    const safeTitle = input.title.replace(/[\\/:*?"<>|]/g, '-').slice(0, 200);

    const file = await this.drive.createFile(tenantId, {
      name: safeTitle,
      content: input.content,
      mimeType,
      parentId,
    });

    return {
      success: true,
      data: {
        action: 'create',
        fileId: file.id,
        fileName: file.name,
        webViewLink: file.webViewLink,
        mimeType: file.mimeType,
        contentLength: input.content.length,
        folder,
      },
      metadata: { model: 'documents-tool-v1' },
    };
  }

  // ─── list ───────────────────────────────────────────────────────────────

  private async list(
    tenantId: string,
    agentId: string | undefined,
    input: DocumentInput,
  ): Promise<StructuredToolResult<DocumentOutput>> {
    const folder = input.folder ?? 'Documents';
    const parentId = await this.resolveSubfolder(tenantId, agentId, folder);
    const files = await this.drive.listFiles(tenantId, parentId, {
      pageSize: input.pageSize ?? 50,
    });

    return {
      success: true,
      data: {
        action: 'list',
        folder,
        count: files.length,
        files: files.map((f) => ({
          id: f.id,
          name: f.name,
          mimeType: f.mimeType,
          webViewLink: f.webViewLink,
          modifiedTime: f.modifiedTime,
          size: f.size,
        })),
      },
      metadata: { model: 'documents-tool-v1' },
    };
  }

  // ─── read ───────────────────────────────────────────────────────────────

  private async read(
    tenantId: string,
    input: DocumentInput,
  ): Promise<StructuredToolResult<DocumentOutput>> {
    if (!input.fileId) return { success: false, error: 'read requires fileId' };

    const accessToken = await this.drive.getAccessToken(tenantId);
    if (!accessToken) return { success: false, error: 'Google is not connected' };

    // Use Drive's "export" endpoint for Google Docs (HTML), or "download" for binary
    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${input.fileId}?fields=name,mimeType,webViewLink`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!metaRes.ok) return { success: false, error: 'Failed to fetch file metadata' };
    const meta = (await metaRes.json()) as {
      name: string;
      mimeType: string;
      webViewLink?: string;
    };

    let content = '';
    if (meta.mimeType.startsWith('application/vnd.google-apps')) {
      // Google-native formats (Doc, Sheet, Slide) — export as HTML
      const exportRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${input.fileId}/export?mimeType=text/html`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!exportRes.ok) return { success: false, error: 'Failed to export file content' };
      content = await exportRes.text();
    } else {
      // Plain text / HTML / etc — download raw
      const dlRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${input.fileId}?alt=media`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!dlRes.ok) return { success: false, error: 'Failed to download file' };
      content = await dlRes.text();
    }

    return {
      success: true,
      data: {
        action: 'read',
        fileId: input.fileId,
        fileName: meta.name,
        webViewLink: meta.webViewLink,
        mimeType: meta.mimeType,
        content,
        contentLength: content.length,
      },
      metadata: { model: 'documents-tool-v1' },
    };
  }

  // ─── share (G8) ─────────────────────────────────────────────────────────

  private async share(
    tenantId: string,
    input: DocumentInput,
  ): Promise<StructuredToolResult<DocumentOutput>> {
    if (!input.fileId) {
      return { success: false, error: 'share requires fileId' };
    }
    const shareType = input.shareType ?? 'user';
    if ((shareType === 'user' || shareType === 'group') && !input.emailAddress) {
      return {
        success: false,
        error: `shareType="${shareType}" requires emailAddress`,
      };
    }
    if (shareType === 'domain' && !input.domain) {
      return {
        success: false,
        error: 'shareType="domain" requires domain',
      };
    }

    const perm = await this.drive.shareFile(tenantId, input.fileId, {
      role: input.role ?? 'reader',
      type: shareType,
      emailAddress: input.emailAddress,
      domain: input.domain,
      sendNotification: input.sendNotification,
      emailMessage: input.emailMessage,
    });

    return {
      success: true,
      data: {
        action: 'share',
        fileId: input.fileId,
        permissionId: perm.id,
        role: perm.role,
        shareType: perm.type,
      },
      metadata: { model: 'documents-tool-v1' },
    };
  }

  // ─── unshare (G8) ───────────────────────────────────────────────────────

  private async unshare(
    tenantId: string,
    input: DocumentInput,
  ): Promise<StructuredToolResult<DocumentOutput>> {
    if (!input.fileId) {
      return { success: false, error: 'unshare requires fileId' };
    }
    let permissionId = input.permissionId;
    if (!permissionId) {
      if (!input.emailAddress && !input.domain) {
        return {
          success: false,
          error:
            'unshare requires permissionId or emailAddress (or domain for domain-type permissions)',
        };
      }
      const perms = await this.drive.listFilePermissions(tenantId, input.fileId);
      const match = perms.find((p) => {
        if (input.emailAddress && p.emailAddress === input.emailAddress) return true;
        if (input.domain && p.domain === input.domain) return true;
        return false;
      });
      if (!match) {
        return {
          success: false,
          error: 'No matching permission found for the given identifier',
        };
      }
      permissionId = match.id;
    }

    await this.drive.revokeFilePermission(tenantId, input.fileId, permissionId);

    return {
      success: true,
      data: {
        action: 'unshare',
        fileId: input.fileId,
        permissionId,
      },
      metadata: { model: 'documents-tool-v1' },
    };
  }

  // ─── helpers ────────────────────────────────────────────────────────────

  private async resolveSubfolder(
    tenantId: string,
    agentId: string | undefined,
    subfolder: string,
  ): Promise<string> {
    if (!agentId) {
      // No agent context — fall back to the tenant's root NeureCore folder
      const root = await this.drive.ensureRootFolder(tenantId);
      return root.id;
    }

    const agent = await this.data.agent.findUnique({
      where: { id: agentId },
      select: { id: true, name: true, tenantId: true, googleDriveFolderId: true },
    });
    if (!agent || agent.tenantId !== tenantId) {
      throw new Error(`Agent ${agentId} not found for tenant ${tenantId}`);
    }

    // Ensure the agent folder structure exists (idempotent)
    const folders = await this.drive.setupAgentFolders(
      tenantId,
      agent.id,
      agent.name,
    );
    const subId = folders.subfolders[subfolder];
    if (!subId) {
      throw new Error(`Subfolder ${subfolder} not found for agent ${agent.name}`);
    }
    return subId;
  }
}
