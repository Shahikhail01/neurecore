import { Test, TestingModule } from '@nestjs/testing';
import { ReportSaveDraftTool } from '../report-save-draft.adapter';
import { ARTIFACT_STORAGE, type IArtifactStorage, type ArtifactRecord } from '../../contracts/artifact-storage.interface';
import type { SaveDraftInput } from '../../contracts/artifact-storage.interface';

class FakeArtifactStorage implements IArtifactStorage {
  calls: SaveDraftInput[] = [];
  async saveDraft(input: SaveDraftInput): Promise<ArtifactRecord> {
    this.calls.push(input);
    return { id: 'artifact-test', type: 'REPORT', name: input.title, mimeType: input.mimeType, checksum: 'abc123', tenantId: input.tenantId };
  }
}

describe('ReportSaveDraftTool', () => {
  let tool: ReportSaveDraftTool;
  let storage: FakeArtifactStorage;

  beforeEach(async () => {
    storage = new FakeArtifactStorage();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportSaveDraftTool,
        { provide: ARTIFACT_STORAGE, useValue: storage },
      ],
    }).compile();
    tool = module.get(ReportSaveDraftTool);
  });

  describe('metadata', () => {
    it('is an INTERNAL_WRITE tool', () => {
      expect(tool.effect).toBe('INTERNAL_WRITE');
    });

    it('requires authority 50', () => {
      expect(tool.requiredAuthority).toBe(50);
    });

    it('is not approval-sensitive', () => {
      expect(tool.approvalSensitive).toBe(false);
    });
  });

  describe('validateInput', () => {
    it('accepts valid title, content, and mimeType', () => {
      expect(() =>
        tool.validateInput({
          title: 'Report',
          content: '# Report',
          mimeType: 'text/markdown',
        }),
      ).not.toThrow();
    });

    it('rejects missing title', () => {
      expect(() =>
        tool.validateInput({ content: '# Report', mimeType: 'text/markdown' }),
      ).toThrow(/title/);
    });

    it('rejects empty title', () => {
      expect(() =>
        tool.validateInput({ title: '', content: '# Report', mimeType: 'text/markdown' }),
      ).toThrow(/title/);
    });

    it('rejects missing content', () => {
      expect(() =>
        tool.validateInput({ title: 'Report', mimeType: 'text/markdown' }),
      ).toThrow(/content/);
    });

    it('rejects missing mimeType', () => {
      expect(() =>
        tool.validateInput({ title: 'Report', content: '# Report' }),
      ).toThrow(/mimeType/);
    });
  });

  describe('execute', () => {
    const ctx = {
      tenantId: 't1',
      actorId: 'a1',
      actorType: 'AI_AGENT' as const,
      runId: 'run-1',
      stepId: 'step-1',
    };

    it('calls artifact storage and returns ok', async () => {
      const result = await tool.execute(
        { title: 'Q3 Report', content: '# Report', mimeType: 'text/markdown' },
        ctx,
      );
      expect(result.ok).toBe(true);
      expect(result.data).toEqual({
        artifactId: 'artifact-test',
        artifactType: 'REPORT',
        artifactName: 'Q3 Report',
        mimeType: 'text/markdown',
        checksum: 'abc123',
      });
      expect(storage.calls).toHaveLength(1);
      expect(storage.calls[0].tenantId).toBe('t1');
      expect(storage.calls[0].runId).toBe('run-1');
      expect(storage.calls[0].stepId).toBe('step-1');
    });

    it('returns error when storage throws', async () => {
      const badStorage: IArtifactStorage = {
        saveDraft: async () => {
          throw new Error('simulated failure');
        },
      };
      const badTool = new ReportSaveDraftTool(badStorage);
      const result = await badTool.execute(
        { title: 'Bad', content: '#x', mimeType: 'text/markdown' },
        ctx,
      );
      expect(result.ok).toBe(false);
      expect(result.errorCode).toBe('ARTIFACT_PERSIST_FAILED');
      expect(result.errorMessage).toContain('simulated failure');
    });
  });
});
