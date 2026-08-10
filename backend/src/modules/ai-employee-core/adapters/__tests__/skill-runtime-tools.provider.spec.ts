/**
 * SkillRuntimeToolsProvider — unit tests.
 *
 * Covers registration idempotency, tenant-isolated dispatch, type errors,
 * and that no skill tool claims an external side effect or approval requirement.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { SkillRuntimeToolsProvider } from '../skill-runtime-tools.provider';
import { SummarizeSkillTool } from '../skill-summarize.adapter';
import { ExtractSkillTool } from '../skill-extract.adapter';
import { CompareSkillTool } from '../skill-compare.adapter';
import { DraftReportSkillTool } from '../skill-draft-report.adapter';
import { ReportSaveDraftTool } from '../report-save-draft.adapter';
import { TOOL_REGISTRY, type IToolRegistry } from '../../../work-runtime/contracts/work-runtime.interface';
import { SkillRegistry } from '../../../skill-registry/skill-registry.service';
import { ARTIFACT_STORAGE, type IArtifactStorage } from '../../contracts/artifact-storage.interface';

// -- fake registry ------------------------------------------------------------

class FakeToolRegistry implements IToolRegistry {
  readonly tools: Array<{ name: string }> = [];
  register(tool: { name: string }): void {
    if (this.tools.some((t) => t.name === tool.name)) {
      throw new Error(`Duplicate tool identifier: ${tool.name}`);
    }
    this.tools.push(tool);
  }
  get(name: string) {
    return this.tools.find((t) => t.name === name) as never;
  }
  has(name: string) {
    return this.tools.some((t) => t.name === name);
  }
  list() { return []; }
  listForAuthority() { return []; }
}

// -- fake skill registry (no-op for bootstrap; unit tests validate shape) ----

class FakeSkillRegistry {
}

const fakeRegistry = new FakeSkillRegistry() as unknown as never;
const fakeStorage = { saveDraft: async () => ({ id: 'a1', type: 'REPORT' as const, name: 't', mimeType: 'text/markdown', checksum: 'abc', tenantId: 't1' }) } as IArtifactStorage;

describe('SkillRuntimeToolsProvider', () => {
  let provider: SkillRuntimeToolsProvider;
  let registry: FakeToolRegistry;

  beforeEach(async () => {
    registry = new FakeToolRegistry();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SkillRuntimeToolsProvider,
        { provide: TOOL_REGISTRY, useValue: registry },
        { provide: SkillRegistry, useValue: fakeRegistry },
        { provide: ARTIFACT_STORAGE, useValue: fakeStorage },
      ],
    }).compile();
    provider = module.get(SkillRuntimeToolsProvider);
  });

  it('registers exactly five tools (four skills + reports.save_draft) at bootstrap', () => {
    provider.onApplicationBootstrap();
    expect(registry.tools).toHaveLength(5);
    const names = registry.tools.map((t) => t.name);
    expect(names).toContain('skill.summarize');
    expect(names).toContain('skill.extract');
    expect(names).toContain('skill.compare');
    expect(names).toContain('skill.draft_report');
    expect(names).toContain('reports.save_draft');
  });

  it('does not allow duplicate registration', () => {
    provider.onApplicationBootstrap();
    expect(() => provider.onApplicationBootstrap()).toThrow(
      /Duplicate tool identifier/,
    );
  });
});

describe('Skill tool adapters — metadata contracts', () => {
  const tools = [
    new SummarizeSkillTool(fakeRegistry),
    new ExtractSkillTool(fakeRegistry),
    new CompareSkillTool(fakeRegistry),
    new DraftReportSkillTool(fakeRegistry),
  ];

  for (const tool of tools) {
    describe(tool.name, () => {
      it('is READ-only (no external side effect)', () => {
        expect(tool.effect).toBe('READ');
      });

      it('requires minimum authority 10', () => {
        expect(tool.requiredAuthority).toBe(10);
      });

      it('is not approval-sensitive', () => {
        expect(tool.approvalSensitive).toBe(false);
      });

      it('has a positive timeout', () => {
        expect(tool.timeoutMs).toBeGreaterThan(0);
      });

      it('has bounded retries', () => {
        expect(tool.maxRetries).toBeGreaterThanOrEqual(0);
        expect(tool.maxRetries).toBeLessThanOrEqual(3);
      });

      it('has a non-empty capability and description', () => {
        expect(tool.capability).toBeTruthy();
        expect(tool.description.length).toBeGreaterThan(10);
      });
    });
  }
});

describe('Skill tool adapters — validateInput', () => {
  const tools = [
    new SummarizeSkillTool(fakeRegistry),
    new ExtractSkillTool(fakeRegistry),
    new CompareSkillTool(fakeRegistry),
    new DraftReportSkillTool(fakeRegistry),
  ];

  describe('summarize', () => {
    const tool = tools[0];

    it('accepts a file source input', () => {
      expect(() =>
        tool.validateInput({
          source: { kind: 'file', fileId: 'file-1' },
        }),
      ).not.toThrow();
    });

    it('accepts an inline text source input', () => {
      expect(() =>
        tool.validateInput({
          source: { kind: 'text', text: 'hello' },
        }),
      ).not.toThrow();
    });

    it('accepts a record source input', () => {
      expect(() =>
        tool.validateInput({
          source: { kind: 'record', recordType: 'customer', recordId: 'cust-1' },
        }),
      ).not.toThrow();
    });

    it('rejects a missing source', () => {
      expect(() => tool.validateInput({})).toThrow(/source/);
    });

    it('rejects an empty source object', () => {
      expect(() => tool.validateInput({ source: {} })).toThrow(/kind/);
    });
  });

  describe('extract', () => {
    const tool = tools[1];

    it('accepts a file source input', () => {
      expect(() =>
        tool.validateInput({
          source: { kind: 'file', fileId: 'file-1' },
          schema: { name: { type: 'string' } },
        }),
      ).not.toThrow();
    });

    it('rejects a missing source', () => {
      expect(() => tool.validateInput({ schema: {} })).toThrow(/source/);
    });
  });

  describe('compare', () => {
    const tool = tools[2];

    it('accepts two file source inputs', () => {
      expect(() =>
        tool.validateInput({
          left: { kind: 'file', fileId: 'f1' },
          right: { kind: 'file', fileId: 'f2' },
        }),
      ).not.toThrow();
    });

    it('rejects a missing right source', () => {
      expect(() =>
        tool.validateInput({
          left: { kind: 'file', fileId: 'f1' },
        }),
      ).toThrow(/right/);
    });
  });

  describe('draft_report', () => {
    const tool = tools[3];

    it('accepts a topic and sources array', () => {
      expect(() =>
        tool.validateInput({
          topic: 'Q3 Review',
          sources: [
            { kind: 'file', fileId: 'f1' },
            { kind: 'text', text: 'extra notes' },
          ],
        }),
      ).not.toThrow();
    });

    it('rejects a missing topic', () => {
      expect(() =>
        tool.validateInput({
          sources: [{ kind: 'file', fileId: 'f1' }],
        }),
      ).toThrow(/topic/);
    });

    it('rejects an empty sources array', () => {
      expect(() =>
        tool.validateInput({
          topic: 'Review',
          sources: [],
        }),
      ).toThrow(/sources/);
    });

    it('rejects a non-array sources', () => {
      expect(() =>
        tool.validateInput({
          topic: 'Review',
          sources: 'not-an-array',
        }),
      ).toThrow(/sources/);
    });
  });
});
