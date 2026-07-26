import { DocumentsTool } from './documents.tool';
import { ToolDataAccessService } from '../tool-data-access.service';
import { GoogleDriveService } from '../../integrations/google/google-drive.service';

const mockPrisma = {
  agent: { findUnique: jest.fn() },
};

const mockDrive = {
  createFile: jest.fn(),
  listFiles: jest.fn(),
  getAccessToken: jest.fn(),
  ensureRootFolder: jest.fn(),
  setupAgentFolders: jest.fn(),
  shareFile: jest.fn(),
  listFilePermissions: jest.fn(),
  revokeFilePermission: jest.fn(),
};

const originalFetch = global.fetch;

function makeTool(): DocumentsTool {
  return new DocumentsTool(
    mockPrisma as unknown as ToolDataAccessService,
    mockDrive as unknown as GoogleDriveService,
  );
}

const defaultContext = { tenantId: 'tenant-1', agentId: 'agent-1' };

beforeEach(() => {
  jest.clearAllMocks();

  mockPrisma.agent.findUnique.mockResolvedValue({
    id: 'agent-1',
    name: 'TestAgent',
    tenantId: 'tenant-1',
    googleDriveFolderId: 'folder-agent',
  });

  mockDrive.setupAgentFolders.mockResolvedValue({
    folderId: 'folder-agent',
    subfolders: {
      Drafts: 'folder-drafts',
      Documents: 'folder-docs',
      Reports: 'folder-reports',
      Templates: 'folder-templates',
      Archive: 'folder-archive',
    },
  });

  mockDrive.ensureRootFolder.mockResolvedValue({
    id: 'root-folder',
    name: 'NeureCore',
    mimeType: 'application/vnd.google-apps.folder',
  });

  mockDrive.getAccessToken.mockResolvedValue('token-mock');

  mockDrive.createFile.mockResolvedValue({
    id: 'file-123',
    name: 'test-doc',
    mimeType: 'text/html',
    webViewLink: 'https://drive.google.com/file/d/file-123/view',
  });

  mockDrive.listFiles.mockResolvedValue([
    {
      id: 'f1',
      name: 'report',
      mimeType: 'application/vnd.google-apps.document',
      webViewLink: 'https://drive.google.com/file/d/f1/view',
      modifiedTime: '2026-01-01T00:00:00.000Z',
      size: '1024',
    },
  ]);

  mockDrive.shareFile.mockResolvedValue({
    id: 'perm-1',
    role: 'reader',
    type: 'user',
  });

  mockDrive.listFilePermissions.mockResolvedValue([
    { id: 'perm-1', role: 'reader', type: 'user', emailAddress: 'user@example.com' },
  ]);

  mockDrive.revokeFilePermission.mockResolvedValue(undefined);
});

afterAll(() => {
  global.fetch = originalFetch;
});

describe('DocumentsTool', () => {
  describe('create', () => {
    it('requires title and content — error if missing', async () => {
      const tool = makeTool();
      const result = await tool.execute(
        { action: 'create', title: '', content: '' },
        defaultContext,
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('title: String must contain at least 1 character(s)');
    });

    it('calls drive.createFile with sanitized title, content, mimeType, and resolved parentId', async () => {
      const tool = makeTool();
      await tool.execute(
        {
          action: 'create',
          title: 'My /Test: Doc*',
          content: '<h1>Hello</h1>',
          format: 'html',
          folder: 'Documents',
        },
        defaultContext,
      );
      expect(mockDrive.createFile).toHaveBeenCalledWith('tenant-1', {
        name: 'My -Test- Doc-',
        content: '<h1>Hello</h1>',
        mimeType: 'text/html',
        parentId: 'folder-docs',
      });
    });

    it('returns fileId, fileName, webViewLink, mimeType, contentLength, folder', async () => {
      const tool = makeTool();
      const result = await tool.execute(
        {
          action: 'create',
          title: 'Test',
          content: 'hello world',
        },
        defaultContext,
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        action: 'create',
        fileId: 'file-123',
        fileName: 'test-doc',
        webViewLink: 'https://drive.google.com/file/d/file-123/view',
        mimeType: 'text/html',
        contentLength: 11,
        folder: 'Documents',
      });
    });
  });

  describe('list', () => {
    it('calls drive.listFiles with resolved parentId and pageSize', async () => {
      const tool = makeTool();
      await tool.execute(
        { action: 'list', folder: 'Reports', pageSize: 10 },
        defaultContext,
      );
      expect(mockDrive.listFiles).toHaveBeenCalledWith(
        'tenant-1',
        'folder-reports',
        { pageSize: 10 },
      );
    });

    it('returns files array with id/name/mimeType/webViewLink/modifiedTime/size', async () => {
      const tool = makeTool();
      const result = await tool.execute(
        { action: 'list' },
        defaultContext,
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        action: 'list',
        folder: 'Documents',
        count: 1,
        files: [
          {
            id: 'f1',
            name: 'report',
            mimeType: 'application/vnd.google-apps.document',
            webViewLink: 'https://drive.google.com/file/d/f1/view',
            modifiedTime: '2026-01-01T00:00:00.000Z',
            size: '1024',
          },
        ],
      });
    });
  });

  describe('read', () => {
    it('requires fileId — error if missing', async () => {
      const tool = makeTool();
      const result = await tool.execute(
        { action: 'read' },
        defaultContext,
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe('read requires fileId');
    });

    it('fetches file metadata and exports Google Docs as HTML', async () => {
      const fetchMock = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            name: 'my-doc',
            mimeType: 'application/vnd.google-apps.document',
            webViewLink: 'https://drive.google.com/file/d/doc-1/view',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => '<html><body>Exported content</body></html>',
        });
      global.fetch = fetchMock as unknown as typeof fetch;

      const tool = makeTool();
      const result = await tool.execute(
        { action: 'read', fileId: 'doc-1' },
        defaultContext,
      );
      expect(result.success).toBe(true);
      expect((result.data as any).content).toBe('<html><body>Exported content</body></html>');
      expect((result.data as any).fileName).toBe('my-doc');
    });

    it('returns content, fileName, webViewLink, mimeType for a plain text file', async () => {
      const fetchMock = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            name: 'plain.txt',
            mimeType: 'text/plain',
            webViewLink: 'https://drive.google.com/file/d/txt-1/view',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => 'plain text content',
        });
      global.fetch = fetchMock as unknown as typeof fetch;

      const tool = makeTool();
      const result = await tool.execute(
        { action: 'read', fileId: 'txt-1' },
        defaultContext,
      );
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        action: 'read',
        fileId: 'txt-1',
        fileName: 'plain.txt',
        webViewLink: 'https://drive.google.com/file/d/txt-1/view',
        mimeType: 'text/plain',
        content: 'plain text content',
        contentLength: 18,
      });
    });
  });

  describe('share', () => {
    it('requires fileId — error if missing', async () => {
      const tool = makeTool();
      const result = await tool.execute(
        { action: 'share' },
        defaultContext,
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe('share requires fileId');
    });

    it('validates emailAddress for user/group shareType, domain for domain shareType', async () => {
      const tool = makeTool();
      let result = await tool.execute(
        { action: 'share', fileId: 'f1', shareType: 'user' },
        defaultContext,
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('emailAddress');

      result = await tool.execute(
        { action: 'share', fileId: 'f1', shareType: 'domain' },
        defaultContext,
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('domain');
    });

    it('calls drive.shareFile and returns permissionId, role, shareType', async () => {
      const tool = makeTool();
      const result = await tool.execute(
        {
          action: 'share',
          fileId: 'f1',
          shareType: 'user',
          emailAddress: 'user@example.com',
          role: 'writer',
        },
        defaultContext,
      );
      expect(mockDrive.shareFile).toHaveBeenCalledWith('tenant-1', 'f1', {
        role: 'writer',
        type: 'user',
        emailAddress: 'user@example.com',
        domain: undefined,
        sendNotification: undefined,
        emailMessage: undefined,
      });
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        action: 'share',
        fileId: 'f1',
        permissionId: 'perm-1',
        role: 'reader',
        shareType: 'user',
      });
    });
  });

  describe('unshare', () => {
    it('resolves permissionId by emailAddress match from drive.listFilePermissions', async () => {
      const tool = makeTool();
      const result = await tool.execute(
        {
          action: 'unshare',
          fileId: 'f1',
          emailAddress: 'user@example.com',
        },
        defaultContext,
      );
      expect(mockDrive.listFilePermissions).toHaveBeenCalledWith('tenant-1', 'f1');
      expect(mockDrive.revokeFilePermission).toHaveBeenCalledWith(
        'tenant-1',
        'f1',
        'perm-1',
      );
      expect(result.success).toBe(true);
    });

    it('calls drive.revokeFilePermission with resolved permissionId', async () => {
      const tool = makeTool();
      const result = await tool.execute(
        {
          action: 'unshare',
          fileId: 'f1',
          permissionId: 'direct-perm',
        },
        defaultContext,
      );
      expect(mockDrive.revokeFilePermission).toHaveBeenCalledWith(
        'tenant-1',
        'f1',
        'direct-perm',
      );
      expect(result.data).toMatchObject({
        action: 'unshare',
        fileId: 'f1',
        permissionId: 'direct-perm',
      });
    });
  });
});
