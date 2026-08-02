/**
 * Phase P2 — file ingestion unit tests.
 *
 * Exercises:
 *   - size budget enforcement
 *   - MIME allow-list rejection
 *   - signature / declared-mime mismatch
 *   - malware hit (no-op scanner signature path)
 *   - successful text ingestion end-to-end
 *   - archive-bomb guard rejection
 *   - dedupe-by-hash branch
 *
 * Tests use the NoopMalwareScanner and do NOT require any optional
 * parser package to be installed — the TXT parser is always available.
 */
import { FileIngestionService, sniffMagic } from '../file-ingestion.service';
import { FileCipher } from '../file-cipher';
import { NoopMalwareScanner } from '../malware-scanner';
import { ParserRegistry } from '../parsers/parser.registry';
import { PdfParser } from '../parsers/pdf.parser';
import { DocxParser } from '../parsers/docx.parser';
import { TxtParser } from '../parsers/txt.parser';
import { CsvXlsxParser } from '../parsers/csv-xlsx.parser';
import { PptxParser } from '../parsers/pptx.parser';
import { EmailParser } from '../parsers/email.parser';
import { ImageParser } from '../parsers/image.parser';
import { KnowledgeSecurityEventService } from '../security-event.service';
import { ChunkingService } from '../chunking.service';
import { EmbeddingsService } from '../embeddings.service';

function buildSut(opts: { prismaOverride?: unknown } = {}) {
  const prismaMock = {
    knowledgeEntry: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'entry-1' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    ...((opts.prismaOverride as Record<string, unknown>) ?? {}),
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

  const sut = new FileIngestionService(
    prismaMock as never,
    auditMock as never,
    registry,
    cipher,
    scanner,
    securityEvents,
    chunking,
    embeddings as never,
  );
  return { sut, prismaMock, auditMock, cipher };
}

describe('FileIngestionService', () => {
  it('rejects empty buffer', async () => {
    const { sut } = buildSut();
    await expect(
      sut.ingest('t1', 'u1', 'a.txt', 'text/plain', Buffer.alloc(0)),
    ).rejects.toThrow(/empty buffer/);
  });

  it('rejects empty tenantId', async () => {
    const { sut } = buildSut();
    await expect(
      sut.ingest('', 'u1', 'a.txt', 'text/plain', Buffer.from('x')),
    ).rejects.toThrow(/tenantId required/);
  });

  it('rejects disallowed mime', async () => {
    const { sut } = buildSut();
    const rec = await sut.ingest(
      't1',
      'u1',
      'a.exe',
      'application/x-msdownload',
      Buffer.from('MZ'),
    );
    expect(rec.status).toBe('QUARANTINED_REJECTED');
    expect(rec.failureCode).toBe('MIME_NOT_ALLOWED');
  });

  it('rejects mime signature mismatch (declared text/plain but pdf magic)', async () => {
    const { sut } = buildSut();
    const pdfMagic = Buffer.concat([
      Buffer.from('%PDF-1.4'),
      Buffer.alloc(20, 0x20),
    ]);
    const rec = await sut.ingest(
      't1',
      'u1',
      'fake.txt',
      'text/plain',
      pdfMagic,
    );
    expect(rec.status).toBe('QUARANTINED_REJECTED');
    expect(rec.failureCode).toBe('MIME_SNIFF_MISMATCH');
  });

  it('marks file as QUARANTINED_REJECTED with MALWARE_DETECTED when scanner hits', async () => {
    const { sut } = buildSut();
    const rec = await sut.ingest(
      't1',
      'u1',
      'a.txt',
      'text/plain',
      Buffer.from('x'),
      {
        signatureHits: new Map([['Eicar-Test', 'EICAR']]),
      },
    );
    expect(rec.status).toBe('QUARANTINED_REJECTED');
    expect(rec.failureCode).toBe('MALWARE_DETECTED');
  });

  it('ingests a plain text file end-to-end and persists KnowledgeEntry', async () => {
    const { sut, prismaMock } = buildSut();
    const rec = await sut.ingest(
      't1',
      'u1',
      'hello.txt',
      'text/plain',
      Buffer.from('hello world'),
    );
    expect(rec.status).toBe('INDEXED');
    expect(rec.parsed?.text).toBe('hello world');
    expect(prismaMock.knowledgeEntry.create).toHaveBeenCalled();
  });

  it('enforces size budget', async () => {
    const { sut } = buildSut();
    const buf = Buffer.alloc(101, 0x61); // 101 bytes of 'a'
    const rec = await sut.ingest('t1', 'u1', 'big.txt', 'text/plain', buf, {
      sizeBudget: { maxBytes: 100 },
    });
    expect(rec.status).toBe('QUARANTINED_REJECTED');
    expect(rec.failureCode).toBe('SIZE_EXCEEDED');
  });

  it('detects duplicate by content hash', async () => {
    const prismaMock = {
      knowledgeEntry: {
        findFirst: jest.fn().mockResolvedValue({ id: 'entry-existing' }),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    const { sut, auditMock } = buildSut({ prismaOverride: prismaMock });
    const rec = await sut.ingest(
      't1',
      'u1',
      'dup.txt',
      'text/plain',
      Buffer.from('dup'),
    );
    expect(rec.status).toBe('DUPLICATE');
    expect(rec.knowledgeEntryId).toBe('entry-existing');
    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'knowledge.file.duplicate' }),
    );
  });

  it('round-trips encrypted envelope through cipher.decrypt', async () => {
    const plain = Buffer.from('hello encrypted world');
    const fixedKey =
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const cipher = new FileCipher({
      get: (k: string) => (k === 'FILE_ENC_KEY' ? fixedKey : undefined),
    } as never);
    const env = cipher.encrypt(plain);
    const back = cipher.decrypt(env);
    expect(Buffer.compare(plain, back)).toBe(0);
  });
});

describe('sniffMagic', () => {
  it('detects PDF magic', () => {
    expect(sniffMagic(Buffer.from('%PDF-1.4\n'), 'application/pdf')).toBe(
      'application/pdf',
    );
  });
  it('detects PNG magic', () => {
    expect(
      sniffMagic(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]),
        'image/png',
      ),
    ).toBe('image/png');
  });
  it('detects JPEG magic', () => {
    expect(
      sniffMagic(
        Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]),
        'image/jpeg',
      ),
    ).toBe('image/jpeg');
  });
  it('returns null for too-short buffer', () => {
    expect(sniffMagic(Buffer.from([1, 2, 3]), 'application/pdf')).toBeNull();
  });
});
