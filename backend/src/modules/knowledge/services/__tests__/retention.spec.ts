/**
 * Phase P2 — retention service unit tests.
 */
import {
  RetentionService,
  DEFAULT_RETENTION_POLICY,
} from '../retention.service';
import { FileIngestionService } from '../file-ingestion.service';
import { ParserRegistry } from '../parsers/parser.registry';
import { PdfParser } from '../parsers/pdf.parser';
import { DocxParser } from '../parsers/docx.parser';
import { TxtParser } from '../parsers/txt.parser';
import { CsvXlsxParser } from '../parsers/csv-xlsx.parser';
import { PptxParser } from '../parsers/pptx.parser';
import { EmailParser } from '../parsers/email.parser';
import { ImageParser } from '../parsers/image.parser';
import { FileCipher } from '../file-cipher';
import { NoopMalwareScanner } from '../malware-scanner';
import { KnowledgeSecurityEventService } from '../security-event.service';
import { ChunkingService } from '../chunking.service';
import { EmbeddingsService } from '../embeddings.service';

function buildSut() {
  const prismaMock = {
    knowledgeEntry: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'entry-1' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const auditMock = { log: jest.fn().mockResolvedValue(undefined) };
  const cipher = new FileCipher({ get: () => undefined } as never);
  const registry = new ParserRegistry(
    new PdfParser(),
    new DocxParser(),
    new TxtParser(),
    new CsvXlsxParser(),
    new PptxParser(),
    new EmailParser(),
    new ImageParser(),
  );
  const scanner = new NoopMalwareScanner();
  const securityEvents = {
    emit: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn().mockReturnValue(() => undefined),
  } as unknown as KnowledgeSecurityEventService;
  const chunking = new ChunkingService();
  const embeddings = {
    embedDocuments: jest.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
    embedQuery: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    dimensions: 3,
  } as unknown as EmbeddingsService;
  const ingestion = new FileIngestionService(
    prismaMock as never,
    auditMock as never,
    registry,
    cipher,
    scanner,
    securityEvents,
    chunking,
    embeddings as never,
  );
  const retention = new RetentionService(
    prismaMock as never,
    auditMock as never,
    ingestion,
  );
  return { retention, ingestion, auditMock, prismaMock };
}

describe('RetentionService', () => {
  it('engages and clears legal hold', async () => {
    const { retention, auditMock } = buildSut();
    const r1 = await retention.setLegalHold('t1', 'f1', 'u1', true);
    expect(r1.legalHold).toBe(true);
    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'knowledge.file.legal_hold.set' }),
    );
    await retention.setLegalHold('t1', 'f1', 'u1', false);
    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'knowledge.file.legal_hold.cleared' }),
    );
  });

  it('soft-delete blocked by legal hold', async () => {
    const { retention, ingestion } = buildSut();
    await ingestion.ingest('t1', 'u1', 'a.txt', 'text/plain', Buffer.from('x'));
    await retention
      .setLegalHold('t1', 'ingest-1', 'u1', true)
      .catch(() => undefined);
    const rec = retention.ensurePolicy('t1', 'ingest-1');
    rec.legalHold = true;
    await expect(
      retention.softDelete('t1', 'ingest-1', 'u1', 'test'),
    ).rejects.toThrow(/legal_hold/);
  });

  it('soft-delete + hard-delete flow writes tombstone + audit', async () => {
    const { retention, ingestion, auditMock } = buildSut();
    await ingestion.ingest(
      't1',
      'u1',
      'a.txt',
      'text/plain',
      Buffer.from('hello'),
    );
    const files = ingestion.list('t1');
    const fileId = files[0].fileId;
    await retention.softDelete('t1', fileId, 'u1', 'user requested');
    expect(retention.get('t1', fileId).softDeletedAt).not.toBeNull();
    await retention.hardDelete('t1', fileId, 'u1', 'gdpr request');
    const row = retention.get('t1', fileId);
    expect(row.hardDeletedAt).not.toBeNull();
    expect(row.tombstone?.reason).toBe('gdpr request');
    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'knowledge.file.hard_deleted' }),
    );
  });

  it('reconcile hard-deletes soft-deleted files past the grace window', async () => {
    const { retention, ingestion } = buildSut();
    await ingestion.ingest('t1', 'u1', 'a.txt', 'text/plain', Buffer.from('x'));
    const fileId = ingestion.list('t1')[0].fileId;
    const row = retention.ensurePolicy('t1', fileId, {
      ...DEFAULT_RETENTION_POLICY,
      hardDeleteGraceDays: 0,
    });
    row.softDeletedAt = new Date(Date.now() - 60_000).toISOString();
    const purged = await retention.reconcile('t1');
    expect(purged).toContain(fileId);
    expect(retention.get('t1', fileId).hardDeletedAt).not.toBeNull();
  });

  it('reconcile skips files under legal hold', async () => {
    const { retention, ingestion } = buildSut();
    await ingestion.ingest('t1', 'u1', 'a.txt', 'text/plain', Buffer.from('x'));
    const fileId = ingestion.list('t1')[0].fileId;
    const row = retention.ensurePolicy('t1', fileId, {
      ...DEFAULT_RETENTION_POLICY,
      hardDeleteGraceDays: 0,
    });
    row.legalHold = true;
    row.softDeletedAt = new Date(Date.now() - 60_000).toISOString();
    const purged = await retention.reconcile('t1');
    expect(purged).not.toContain(fileId);
  });
});
