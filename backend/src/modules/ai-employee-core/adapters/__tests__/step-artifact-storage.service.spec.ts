import { Test, TestingModule } from '@nestjs/testing';
import { StepArtifactStorageService } from '../step-artifact-storage.service';

describe('StepArtifactStorageService', () => {
  let service: StepArtifactStorageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StepArtifactStorageService],
    }).compile();
    service = module.get(StepArtifactStorageService);
  });

  const validInput = {
    tenantId: 't1',
    actorId: 'a1',
    runId: 'run-1',
    stepId: 'step-1',
    stepIdempotencyKey: 'run-1:step-1:reports.save_draft',
    name: 'Q3 Report',
    title: 'Q3 Report',
    content: '# Q3 Report\n\nSummary text here.',
    mimeType: 'text/markdown',
  };

  it('saves a draft and returns an artifact record', async () => {
    const ref = await service.saveDraft(validInput);
    expect(ref.id).toMatch(/^artifact-/);
    expect(ref.type).toBe('REPORT');
    expect(ref.name).toBe('Q3 Report');
    expect(ref.mimeType).toBe('text/markdown');
    expect(ref.checksum).toHaveLength(64);
    expect(ref.tenantId).toBe('t1');
  });

  it('produces the same artifact id for the same idempotency key', async () => {
    const a = await service.saveDraft(validInput);
    const b = await service.saveDraft(validInput);
    expect(a.id).toBe(b.id);
  });

  it('produces different artifact ids for different keys', async () => {
    const a = await service.saveDraft(validInput);
    const b = await service.saveDraft({
      ...validInput,
      stepIdempotencyKey: 'run-2:step-2:reports.save_draft',
    });
    expect(a.id).not.toBe(b.id);
  });

  it('rejects missing required string fields', async () => {
    for (const key of ['tenantId', 'actorId', 'runId', 'stepId', 'name', 'title', 'content', 'mimeType']) {
      await expect(
        service.saveDraft({ ...validInput, [key]: '' }),
      ).rejects.toThrow(key);
    }
  });

  it('rejects content exceeding 1 MB', async () => {
    await expect(
      service.saveDraft({ ...validInput, content: 'x'.repeat(1_000_001) }),
    ).rejects.toThrow(/maximum size/);
  });

  it('rejects unsupported mime type', async () => {
    await expect(
      service.saveDraft({ ...validInput, mimeType: 'image/png' }),
    ).rejects.toThrow(/unsupported mimeType/);
  });

  it('accepts all valid mime types', async () => {
    for (const mt of ['text/markdown', 'text/html', 'text/plain', 'application/json']) {
      const ref = await service.saveDraft({ ...validInput, mimeType: mt });
      expect(ref.id).toBeTruthy();
    }
  });

  it('computes a deterministic checksum', () => {
    const cs = service.checksum('hello');
    expect(cs).toHaveLength(64);
    expect(service.checksum('hello')).toBe(cs);
    expect(service.checksum('world')).not.toBe(cs);
  });
});
