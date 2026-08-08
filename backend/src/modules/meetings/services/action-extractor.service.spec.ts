/**
 * Phase 16 + Phase 25 — ActionExtractorService tests.
 */

import {
  ActionExtractorService,
  ActionExtractionForbiddenError,
  type IOwnerResolver,
} from './action-extractor.service';

const noopResolver: IOwnerResolver = {
  resolve: async () => null,
  candidates: async () => [],
};

const svc = new ActionExtractorService(noopResolver);

describe('Phase 16 — ActionExtractorService', () => {
  it('refuses wildcard tenantId', () => {
    expect(() =>
      svc.extract({
        tenantId: '*',
        transcriptId: 't-1',
        transcriptText: 'Alice will follow up.',
      }),
    ).toThrow(ActionExtractionForbiddenError);
  });

  it('returns [] on empty transcript', () => {
    expect(
      svc.extract({
        tenantId: 't',
        transcriptId: 't-1',
        transcriptText: '',
      }),
    ).toEqual([]);
  });

  it('extracts a "will <verb>" sentence as an action', () => {
    const out = svc.extract({
      tenantId: 't',
      transcriptId: 't-1',
      transcriptText: 'Alice will follow up with Bob by 2026-09-12.',
    });
    expect(out).toHaveLength(1);
    expect(out[0]?.description).toContain('Alice');
    expect(out[0]?.dueDate).toBe('2026-09-12');
  });

  it('captures "@name" tokens as ownerHint', () => {
    const out = svc.extract({
      tenantId: 't',
      transcriptId: 't-1',
      transcriptText: '@charlie will ship the report.',
    });
    expect(out[0]?.ownerHint).toBe('charlie');
    expect(out[0]?.ambiguousOwner).toBe(false);
  });

  it('flags ambiguous owner when 2+ @tokens are present', () => {
    const out = svc.extract({
      tenantId: 't',
      transcriptId: 't-1',
      transcriptText: '@charlie and @dana will close this out.',
    });
    expect(out[0]?.ambiguousOwner).toBe(true);
  });

  it('confidencePercent rises with owner + due signals', () => {
    const no_signals = svc.extract({
      tenantId: 't',
      transcriptId: 't-1',
      transcriptText: 'Alice will follow up.',
    });
    const with_signals = svc.extract({
      tenantId: 't',
      transcriptId: 't-1',
      transcriptText: '@alice will follow up by 2026-09-12.',
    });
    expect(with_signals[0]!.confidencePercent).toBeGreaterThan(
      no_signals[0]!.confidencePercent,
    );
  });

  it('de-duplicates near-identical descriptions', () => {
    const out = svc.extract({
      tenantId: 't',
      transcriptId: 't-1',
      transcriptText:
        'Alice will follow up. Alice will follow up. Alice will follow up.',
    });
    expect(out).toHaveLength(1);
  });
});
