import { extractArtifactRefs } from '../artifact-extractor';
import type { StepWithResult } from '../../../work-runtime/contracts/work-runtime.interface';

describe('extractArtifactRefs', () => {
  function step(overrides: Partial<StepWithResult> = {}): StepWithResult {
    return {
      id: 's1',
      sequence: 1,
      toolName: 'reports.save_draft',
      capability: 'artifacts',
      operationType: 'INTERNAL_WRITE',
      status: 'SUCCEEDED',
      governanceDecision: null,
      governanceReason: null,
      policySource: null,
      approvalId: null,
      attemptCount: 1,
      errorCode: null,
      result: null,
      ...overrides,
    };
  }

  it('returns an empty array when there are no artifact steps', () => {
    expect(extractArtifactRefs([])).toEqual([]);
    expect(
      extractArtifactRefs([
        step({ toolName: 'skill.summarize', status: 'SUCCEEDED', result: { content: 'ok' } }),
      ]),
    ).toEqual([]);
  });

  it('extracts a single artifact reference from a succeeded save_draft step', () => {
    const refs = extractArtifactRefs([
      step({
        toolName: 'reports.save_draft',
        status: 'SUCCEEDED',
        result: {
          artifactId: 'artifact-abc123',
          artifactType: 'REPORT',
          artifactName: 'Q3 Review',
          checksum: 'sha256...',
        },
      }),
    ]);
    expect(refs).toHaveLength(1);
    expect(refs[0]).toEqual({
      id: 'artifact-abc123',
      type: 'REPORT',
      name: 'Q3 Review',
    });
    expect(Object.isFrozen(refs[0])).toBe(true);
  });

  it('skips steps that are not SUCCEEDED', () => {
    const refs = extractArtifactRefs([
      step({
        toolName: 'reports.save_draft',
        status: 'FAILED',
        result: { artifactId: 'artifact-abc123' },
      }),
    ]);
    expect(refs).toEqual([]);
  });

  it('skips steps without artifactId in result', () => {
    const refs = extractArtifactRefs([
      step({ status: 'SUCCEEDED', result: { content: 'text' } }),
    ]);
    expect(refs).toEqual([]);
  });

  it('deduplicates artifact references by id', () => {
    const refs = extractArtifactRefs([
      step({
        status: 'SUCCEEDED',
        result: { artifactId: 'artifact-1', artifactType: 'REPORT', artifactName: 'A' },
      }),
      step({
        status: 'SUCCEEDED',
        result: { artifactId: 'artifact-1', artifactType: 'REPORT', artifactName: 'B' },
      }),
      step({
        status: 'SUCCEEDED',
        result: { artifactId: 'artifact-2', artifactType: 'DOCUMENT', artifactName: 'C' },
      }),
    ]);
    expect(refs).toHaveLength(2);
    expect(refs[0].name).toBe('A');
    expect(refs[1].name).toBe('C');
  });

  it('handles steps with null result', () => {
    expect(extractArtifactRefs([step({ status: 'SUCCEEDED', result: null })])).toEqual([]);
  });

  it('handles multiple artifact-producing steps correctly', () => {
    const refs = extractArtifactRefs([
      step({
        status: 'SUCCEEDED',
        result: { artifactId: 'a1', artifactType: 'REPORT', artifactName: 'Report1' },
      }),
      step({
        status: 'SUCCEEDED',
        toolName: 'skill.summarize',
        result: { content: 'no artifact here' },
      }),
      step({
        status: 'SUCCEEDED',
        result: { artifactId: 'a2', artifactType: 'DOCUMENT', artifactName: 'Doc1' },
      }),
    ]);
    expect(refs).toHaveLength(2);
  });

  it('returns empty when artifactId is an empty string', () => {
    const refs = extractArtifactRefs([
      step({ status: 'SUCCEEDED', result: { artifactId: '', artifactType: 'REPORT' } }),
    ]);
    expect(refs).toEqual([]);
  });
});
