import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { GoogleAuthClient } from './google-auth.client';
import type { IDriveService } from './drive-service.interface';

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

export interface CreateFolderInput {
  name: string;
  parentId?: string;
}

export interface CreateFileInput {
  name: string;
  content: string;
  mimeType?: string;
  parentId?: string;
}

const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const NEURECORE_ROOT_FOLDER = 'NeureCore';

@Injectable()
export class GoogleDriveService implements IDriveService {
  private readonly logger = new Logger(GoogleDriveService.name);
  private readonly DRIVE_API = 'https://www.googleapis.com/drive/v3';
  private readonly DRIVE_UPLOAD_API =
    'https://www.googleapis.com/upload/drive/v3';

  constructor(
    private readonly authClient: GoogleAuthClient,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async getAccessToken(tenantId: string): Promise<string | null> {
    return this.authClient.getAccessToken(tenantId);
  }

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
      ...(options.headers ?? {}),
    };

    return fetch(url, { ...options, headers });
  }

  /**
   * Find a folder by name in the Drive root. Used to avoid creating duplicates.
   */
  async findFolderByName(
    tenantId: string,
    name: string,
    parentId?: string,
  ): Promise<DriveFile | null> {
    let query = `mimeType='${FOLDER_MIME_TYPE}' and name='${name.replace(/'/g, "\\'")}' and trashed=false`;
    if (parentId) {
      query += ` and '${parentId}' in parents`;
    }

    const params = new URLSearchParams({
      q: query,
      fields:
        'files(id,name,mimeType,webViewLink,parents,createdTime,modifiedTime)',
    });

    const res = await this.authFetch(
      `${this.DRIVE_API}/files?${params.toString()}`,
      {},
      tenantId,
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => 'unknown');
      this.logger.error(`Drive folder search failed: ${res.status} ${errText}`);
      throw new BadRequestException(`Drive search failed (${res.status}): ${errText.slice(0, 200)}`);
    }

    const data = (await res.json()) as { files?: DriveFile[] };
    return data.files?.[0] ?? null;
  }

  /**
   * Create a folder. Returns existing folder if one with the same name exists.
   */
  async createFolder(
    tenantId: string,
    input: CreateFolderInput,
  ): Promise<DriveFile> {
    const existing = await this.findFolderByName(
      tenantId,
      input.name,
      input.parentId,
    );
    if (existing) {
      this.logger.log(
        `Folder "${input.name}" already exists (id=${existing.id}) for tenant ${tenantId}`,
      );
      return existing;
    }

    const body: Record<string, unknown> = {
      name: input.name,
      mimeType: FOLDER_MIME_TYPE,
    };
    if (input.parentId) {
      body.parents = [input.parentId];
    }

    const fields =
      'id,name,mimeType,webViewLink,parents,createdTime,modifiedTime';
    const res = await this.authFetch(
      `${this.DRIVE_API}/files?fields=${encodeURIComponent(fields)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      tenantId,
    );

    if (!res.ok) {
      const err = await res.text().catch(() => 'unknown');
      this.logger.error(`Drive folder create failed: ${res.status} ${err}`);
      throw new BadRequestException('Failed to create Drive folder');
    }

    const file = (await res.json()) as DriveFile;
    this.logger.log(
      `Folder "${input.name}" created (id=${file.id}) for tenant ${tenantId}`,
    );
    return file;
  }

  /**
   * Get or create the tenant's root NeureCore folder.
   * Caches the folder ID on the tenant record.
   */
  async ensureRootFolder(tenantId: string): Promise<DriveFile> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { googleDriveRootFolderId: true },
    });

    if (tenant?.googleDriveRootFolderId) {
      return {
        id: tenant.googleDriveRootFolderId,
        name: NEURECORE_ROOT_FOLDER,
        mimeType: FOLDER_MIME_TYPE,
      };
    }

    const root = await this.createFolder(tenantId, {
      name: NEURECORE_ROOT_FOLDER,
    });

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { googleDriveRootFolderId: root.id },
    });

    return root;
  }

  /**
   * Set up Drive folder structure for an agent:
   *   NeureCore / [Agent Name] / {Drafts, Documents, Reports, Templates, Archive}
   *
   * Idempotent: re-running for the same agent won't create duplicates.
   * Caches the agent folder ID on the agent record.
   */
  async setupAgentFolders(
    tenantId: string,
    agentId: string,
    agentName: string,
  ): Promise<{ folderId: string; subfolders: Record<string, string> }> {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      select: { googleDriveFolderId: true, name: true, tenantId: true },
    });

    if (!agent || agent.tenantId !== tenantId) {
      throw new BadRequestException(
        `Agent ${agentId} not found for tenant ${tenantId}`,
      );
    }

    const root = await this.ensureRootFolder(tenantId);

    let agentFolder: DriveFile;
    if (agent.googleDriveFolderId) {
      agentFolder = {
        id: agent.googleDriveFolderId,
        name: agentName,
        mimeType: FOLDER_MIME_TYPE,
      };
    } else {
      agentFolder = await this.createFolder(tenantId, {
        name: agentName,
        parentId: root.id,
      });
      await this.prisma.agent.update({
        where: { id: agentId },
        data: { googleDriveFolderId: agentFolder.id },
      });
    }

    const subfolderNames = [
      'Drafts',
      'Documents',
      'Reports',
      'Templates',
      'Archive',
    ];
    const subfolders: Record<string, string> = {};

    for (const subName of subfolderNames) {
      const sub = await this.createFolder(tenantId, {
        name: subName,
        parentId: agentFolder.id,
      });
      subfolders[subName] = sub.id;
    }

    this.logger.log(
      `Agent ${agentName} (${agentId}) Drive folders ready for tenant ${tenantId}`,
    );

    return { folderId: agentFolder.id, subfolders };
  }

  /**
   * List files in a folder
   */
  async listFiles(
    tenantId: string,
    folderId: string,
    options: { pageSize?: number } = {},
  ): Promise<DriveFile[]> {
    const { pageSize = 50 } = options;
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed=false`,
      pageSize: String(pageSize),
      fields:
        'files(id,name,mimeType,webViewLink,parents,createdTime,modifiedTime,size)',
      orderBy: 'modifiedTime desc',
    });

    const res = await this.authFetch(
      `${this.DRIVE_API}/files?${params.toString()}`,
      {},
      tenantId,
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => 'unknown');
      this.logger.error(`Drive list files failed: ${res.status} ${errText}`);
      throw new BadRequestException(`Drive list failed (${res.status}): ${errText.slice(0, 200)}`);
    }

    const data = (await res.json()) as { files?: DriveFile[] };
    return data.files ?? [];
  }

  /**
   * Create a file in a folder
   */
  async createFile(
    tenantId: string,
    input: CreateFileInput,
  ): Promise<DriveFile> {
    const metadata: Record<string, unknown> = {
      name: input.name,
      mimeType: input.mimeType ?? 'text/plain',
    };
    if (input.parentId) {
      metadata.parents = [input.parentId];
    }

    const boundary = 'neurecore_boundary_' + Date.now();
    const multipartBody =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${input.mimeType ?? 'text/plain'}\r\n\r\n` +
      `${input.content}\r\n` +
      `--${boundary}--`;

    const fields =
      'id,name,mimeType,webViewLink,parents,createdTime,modifiedTime,size';
    const res = await this.authFetch(
      `${this.DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=${encodeURIComponent(fields)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body: multipartBody,
      },
      tenantId,
    );

    if (!res.ok) {
      const err = await res.text().catch(() => 'unknown');
      this.logger.error(`Drive file create failed: ${res.status} ${err}`);
      throw new BadRequestException('Failed to create Drive file');
    }

    return (await res.json()) as DriveFile;
  }

  /**
   * Search files across Drive.
   *
   * mode='name'     — `name contains '<query>'` (filenames only; default)
   * mode='fulltext' — `fullText contains '<query>'` (Drive indexes filenames,
   *                   descriptions, text content of text/markdown/csv/json,
   *                   and OCR for PDFs/images)
   */
  async searchFiles(
    tenantId: string,
    query: string,
    options: {
      pageSize?: number;
      mimeType?: string;
      mode?: 'name' | 'fulltext';
    } = {},
  ): Promise<DriveFile[]> {
    const { pageSize = 25, mimeType, mode = 'name' } = options;
    const safe = query.replace(/'/g, "\\'");
    const hasQuery = safe.trim().length > 0;
    let q = `trashed=false`;
    if (hasQuery) {
      const operator =
        mode === 'fulltext' ? 'fullText contains' : 'name contains';
      q += ` and ${operator} '${safe}'`;
    }
    if (mimeType) {
      q += ` and mimeType='${mimeType}'`;
    }
    const params = new URLSearchParams({
      q,
      pageSize: String(pageSize),
      fields:
        'files(id,name,mimeType,webViewLink,parents,createdTime,modifiedTime,size)',
      orderBy: 'modifiedTime desc',
    });

    const res = await this.authFetch(
      `${this.DRIVE_API}/files?${params.toString()}`,
      {},
      tenantId,
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => 'unknown');
      this.logger.error(`Drive search failed: ${res.status} ${errText}`);
      throw new BadRequestException(`Drive search failed (${res.status}): ${errText.slice(0, 200)}`);
    }

    const data = (await res.json()) as { files?: DriveFile[] };
    return data.files ?? [];
  }

  /**
   * List all agent folders for the tenant
   */
  async listAgentFolders(tenantId: string): Promise<{
    rootFolderId: string;
    agents: {
      agentId: string;
      agentName: string;
      folderId: string;
      folderLink?: string;
    }[];
  }> {
    const root = await this.ensureRootFolder(tenantId);

    const agents = await this.prisma.agent.findMany({
      where: { tenantId, googleDriveFolderId: { not: null } },
      select: { id: true, name: true, googleDriveFolderId: true },
    });

    return {
      rootFolderId: root.id,
      agents: agents.map((a) => ({
        agentId: a.id,
        agentName: a.name,
        folderId: a.googleDriveFolderId!,
      })),
    };
  }

  /**
   * G8: Share a Drive file or folder with another user or make it public.
   *
   * Drive permissions API:
   *   POST /drive/v3/files/{fileId}/permissions
   *   body: { role: 'reader'|'writer'|'commenter', type: 'user'|'group'|'domain'|'anyone', emailAddress?: string }
   *
   * Returns the created permission resource so callers can persist the id.
   */
  async shareFile(
    tenantId: string,
    fileId: string,
    input: {
      role: 'reader' | 'writer' | 'commenter';
      type: 'user' | 'group' | 'domain' | 'anyone';
      emailAddress?: string;
      domain?: string;
      sendNotification?: boolean;
      emailMessage?: string;
    },
  ): Promise<{ id: string; role: string; type: string }> {
    if (
      (input.type === 'user' || input.type === 'group') &&
      !input.emailAddress
    ) {
      throw new BadRequestException(
        'emailAddress is required for user/group permissions',
      );
    }
    if (input.type === 'domain' && !input.domain) {
      throw new BadRequestException(
        'domain is required for type="domain" permissions',
      );
    }

    const body: Record<string, unknown> = {
      role: input.role,
      type: input.type,
    };
    if (input.emailAddress) body.emailAddress = input.emailAddress;
    if (input.domain) body.domain = input.domain;

    const params = new URLSearchParams();
    if (input.sendNotification === false) {
      // Drive API default is true; we only send the param when caller wants off.
      params.set('sendNotificationEmail', 'false');
    }
    if (input.emailMessage) {
      params.set('emailMessage', input.emailMessage);
    }
    const queryString = params.toString();

    const url =
      `${this.DRIVE_API}/files/${encodeURIComponent(fileId)}/permissions` +
      (queryString ? `?${queryString}` : '');

    const res = await this.authFetch(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      tenantId,
    );

    if (!res.ok) {
      const err = await res.text().catch(() => 'unknown');
      this.logger.error(
        `Drive share failed for ${fileId}: ${res.status} ${err}`,
      );
      throw new BadRequestException('Failed to share Drive file');
    }

    const created = (await res.json()) as {
      id: string;
      role: string;
      type: string;
    };
    this.logger.log(
      `Drive file ${fileId} shared (permission ${created.id}, role=${input.role}, type=${input.type}) for tenant ${tenantId}`,
    );
    return created;
  }

  /**
   * G8: List permissions on a Drive file or folder.
   */
  async listFilePermissions(
    tenantId: string,
    fileId: string,
  ): Promise<
    Array<{
      id: string;
      role: string;
      type: string;
      emailAddress?: string;
      domain?: string;
    }>
  > {
    const url =
      `${this.DRIVE_API}/files/${encodeURIComponent(fileId)}/permissions` +
      `?fields=permissions(id,role,type,emailAddress,domain)` +
      `&supportsAllDrives=true`;
    const res = await this.authFetch(url, {}, tenantId);
    if (!res.ok) {
      throw new BadRequestException('Failed to list Drive permissions');
    }
    const data = (await res.json()) as {
      permissions?: Array<{
        id: string;
        role: string;
        type: string;
        emailAddress?: string;
        domain?: string;
      }>;
    };
    return data.permissions ?? [];
  }

  /**
   * G8: Revoke a single Drive permission (un-share a file with one user).
   * 204 No Content on success.
   */
  async revokeFilePermission(
    tenantId: string,
    fileId: string,
    permissionId: string,
  ): Promise<void> {
    const res = await this.authFetch(
      `${this.DRIVE_API}/files/${encodeURIComponent(fileId)}/permissions/${encodeURIComponent(permissionId)}`,
      { method: 'DELETE' },
      tenantId,
    );
    if (!res.ok && res.status !== 404) {
      throw new BadRequestException('Failed to revoke Drive permission');
    }
  }

  /**
   * WS-6.2: Permanently delete a Drive file or folder (used by cleanup cron).
   * Caller should have already verified the file is empty.
   */
  async deleteFile(tenantId: string, fileId: string): Promise<void> {
    const res = await this.authFetch(
      `${this.DRIVE_API}/files/${encodeURIComponent(fileId)}`,
      { method: 'DELETE' },
      tenantId,
    );
    if (!res.ok && res.status !== 404) {
      const err = await res.text().catch(() => 'unknown');
      this.logger.error(
        `Drive delete failed for ${fileId}: ${res.status} ${err}`,
      );
      throw new BadRequestException('Failed to delete Drive file');
    }
  }

  /**
   * WS-3: List the full Drive folder tree under the tenant's NeureCore root.
   * Returns root + immediate children + nested agent subfolders (1 level deep).
   */
  async listRootTree(tenantId: string): Promise<{
    rootFolderId: string | null;
    children: {
      id: string;
      name: string;
      mimeType: string;
      webViewLink?: string;
      children: DriveFile[];
    }[];
  }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { googleDriveRootFolderId: true },
    });
    const rootFolderId = tenant?.googleDriveRootFolderId ?? null;
    if (!rootFolderId) {
      return { rootFolderId: null, children: [] };
    }

    let rootChildren: DriveFile[];
    try {
      rootChildren = await this.listFiles(tenantId, rootFolderId, {
        pageSize: 50,
      });
    } catch {
      return { rootFolderId, children: [] };
    }

    const childrenWithNested = await Promise.all(
      rootChildren.map(async (folder) => {
        let nested: DriveFile[] = [];
        if (folder.mimeType === FOLDER_MIME_TYPE) {
          try {
            nested = await this.listFiles(tenantId, folder.id, {
              pageSize: 20,
            });
          } catch {
            nested = [];
          }
        }
        return { ...folder, children: nested };
      }),
    );

    return { rootFolderId, children: childrenWithNested };
  }
}
