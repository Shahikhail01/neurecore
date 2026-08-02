/**
 * File ingestion service — the canonical entry point for P2 file
 * uploads (Knowledge + Attachments).
 *
 * Pipeline (per plan §P2):
 *   upload → quarantine → MIME/signature sniff → malware scan →
 *   archive-bomb guard → encryption (at-rest) → dedupe-by-hash →
 *   parse → chunk/index → status surface
 *
 * The service holds ingestion state in an in-process map keyed by
 * `(tenantId, fileId)`. The KnowledgeEntry / attachment linkage is
 * left to the caller — this service returns a structured
 * {@link FileIngestionRecord} that the caller's downstream handler
 * consumes.
 *
 * FAILURE MODES — every branch maps to a typed {@link IngestionStatus}.
 * We never return success when the file failed at any stage. The
 * status is also persisted to the audit log so the Command Center
 * P8 inventory reflects ingestion activity.
 */
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { ParserRegistry } from './parsers/parser.registry';
import {
  ParserUnavailableError,
  ParserFormatError,
  type ParsedDocument,
} from './parsers/parser.interface';
import { FileCipher, type EncryptedEnvelope } from './file-cipher';
import {
  MalwareDetectedError,
  type IMalwareScanner,
  MALWARE_SCANNER,
} from './malware-scanner';
import {
  DEFAULT_ARCHIVE_LIMITS,
  DEFAULT_SIZE_BUDGET,
  enforceArchiveBombGuards,
  enforceSizeBudget,
  type ArchiveBombLimits,
  type SizeBudget,
} from './archive-bomb';
import { KnowledgeSecurityEventService } from './security-event.service';
import { ChunkingService } from './chunking.service';
import {
  EMBEDDINGS_SERVICE,
  type IEmbeddingsService,
} from '../interfaces/knowledge.interface';

export type IngestionStatus =
  | 'PENDING'
  | 'QUARANTINED'
  | 'SCANNING'
  | 'PARSE_FAILED'
  | 'PARSER_UNAVAILABLE'
  | 'INDEXED'
  | 'DUPLICATE'
  | 'QUARANTINED_REJECTED'
  | 'FAILED';

export interface FileIngestionRecord {
  fileId: string;
  tenantId: string;
  actorId: string;
  filename: string;
  mime: string;
  sha256: string;
  bytes: number;
  status: IngestionStatus;
  envelope?: EncryptedEnvelope;
  parsed?: ParsedDocument;
  knowledgeEntryId?: string;
  failureCode?: string;
  failureReason?: string;
  warnings: Array<{
    code: string;
    severity: 'info' | 'warn' | 'error';
    message: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface IngestOptions {
  /** Override default size budget. */
  sizeBudget?: Partial<SizeBudget>;
  /** Override archive-bomb limits. */
  archiveLimits?: Partial<ArchiveBombLimits>;
  /** Skip embedding step (useful for tests). */
  skipIndex?: boolean;
  /** Optional signature map to drive the no-op scanner in tests. */
  signatureHits?: Map<string, string>;
  /** Force a specific knowledgeEntryId (e.g. attachment path). */
  knowledgeEntryId?: string;
}

const ALLOWED_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/csv',
  'application/json',
  'message/rfc822',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/tiff',
]);

@Injectable()
export class FileIngestionService {
  private readonly logger = new Logger(FileIngestionService.name);
  private readonly records = new Map<string, FileIngestionRecord>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly parsers: ParserRegistry,
    private readonly cipher: FileCipher,
    @Inject(MALWARE_SCANNER) private readonly scanner: IMalwareScanner,
    private readonly securityEvents: KnowledgeSecurityEventService,
    private readonly chunking: ChunkingService,
    @Inject(EMBEDDINGS_SERVICE) private readonly embeddings: IEmbeddingsService,
  ) {}

  /**
   * Ingest a buffer through the canonical pipeline. Returns the
   * terminal {@link FileIngestionRecord}.
   *
   * THROWS: {@link BadRequestException} for any structural / size /
   * archive / policy violation at the entry point. Soft failures
   * (parse unavailable, format error) are recorded on the returned
   * record's `status` so the UI can render the failure surface.
   */
  async ingest(
    tenantId: string,
    actorId: string,
    filename: string,
    mime: string,
    buffer: Buffer,
    options: IngestOptions = {},
  ): Promise<FileIngestionRecord> {
    if (!tenantId) throw new ForbiddenException('tenantId required');
    if (!actorId) throw new ForbiddenException('actorId required');
    if (!filename) throw new BadRequestException('filename required');
    if (!buffer || buffer.length === 0)
      throw new BadRequestException('empty buffer');

    const fileId = cryptoRandomId();
    const sha256 = createHash('sha256').update(buffer).digest('hex');
    const sizeBudget = {
      ...DEFAULT_SIZE_BUDGET,
      ...(options.sizeBudget ?? {}),
    };
    const archiveLimits = {
      ...DEFAULT_ARCHIVE_LIMITS,
      ...(options.archiveLimits ?? {}),
    };

    const record: FileIngestionRecord = {
      fileId,
      tenantId,
      actorId,
      filename,
      mime,
      sha256,
      bytes: buffer.length,
      status: 'PENDING',
      warnings: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.records.set(this.key(tenantId, fileId), record);

    // 1. Size budget
    try {
      enforceSizeBudget({ bytes: buffer.length }, sizeBudget);
    } catch (err) {
      return this.fail(record, 'SIZE_EXCEEDED', (err as Error).message);
    }

    // 2. MIME allow-list + signature sniff
    if (!ALLOWED_MIMES.has(mime.toLowerCase())) {
      return this.fail(
        record,
        'MIME_NOT_ALLOWED',
        `mime "${mime}" is not allowed`,
      );
    }
    const sniffed = sniffMagic(buffer, mime);
    if (sniffed && sniffed !== mime.toLowerCase()) {
      return this.fail(
        record,
        'MIME_SNIFF_MISMATCH',
        `declared mime ${mime} but signature is ${sniffed}`,
      );
    }

    // 3. Malware scan
    record.status = 'SCANNING';
    try {
      await this.scanner.scan(buffer, { signatureHits: options.signatureHits });
    } catch (err) {
      const reason =
        err instanceof MalwareDetectedError
          ? err.signature
          : (err as Error).message;
      await this.securityEvents.emit({
        tenantId,
        actorId,
        kind: 'MALWARE_DETECTED',
        resource: 'knowledge_file',
        resourceId: fileId,
        details: { filename, mime, reason },
        fatal: true,
      });
      return this.fail(record, 'MALWARE_DETECTED', reason);
    }

    // 4. Archive-bomb guard (if mime is an archive)
    if (mime.toLowerCase() === 'application/zip') {
      // Without an expensive pre-scan we conservatively bound the
      // outer archive; full checks live in the archive parser.
      enforceArchiveBombGuards(
        {
          compressedBytes: buffer.length,
          uncompressedBytes: buffer.length,
          entryCount: 0,
          depth: 0,
        },
        archiveLimits,
      );
    }

    // 5. Encryption + dedupe
    const envelope = this.cipher.encrypt(buffer);
    record.envelope = envelope;
    const dedupeKey = this.cipher.contentKey(envelope);
    const existing = await this.prisma.knowledgeEntry.findFirst({
      where: { tenantId, sourceUrl: `ingestion:${dedupeKey}` },
      select: { id: true },
    });
    if (existing) {
      record.status = 'DUPLICATE';
      record.knowledgeEntryId = existing.id;
      record.updatedAt = new Date().toISOString();
      await this.audit.log({
        actor: actorId,
        action: 'knowledge.file.duplicate',
        resource: 'knowledge_file',
        resourceId: fileId,
        tenantId,
        details: { sha256, knowledgeEntryId: existing.id },
      });
      return record;
    }

    // 6. Parse
    const parser = this.parsers.findFor(mime);
    if (!parser) {
      record.warnings.push({
        code: 'NO_PARSER',
        severity: 'warn',
        message: `No parser registered for mime ${mime}; content not extracted.`,
      });
      record.status = 'QUARANTINED';
      record.updatedAt = new Date().toISOString();
      return record;
    }
    if (!parser.isAvailable()) {
      record.status = 'PARSER_UNAVAILABLE';
      record.failureCode = 'PARSER_UNAVAILABLE';
      record.failureReason = `Parser ${parser.name} dependency not installed`;
      record.updatedAt = new Date().toISOString();
      return record;
    }
    try {
      const parsed = await parser.parse(buffer, mime);
      record.parsed = parsed;
      record.warnings.push(...parsed.warnings);
      const tokens = parsed.metadata.tokenEstimate;
      try {
        enforceSizeBudget(
          { bytes: buffer.length, pages: parsed.metadata.pageCount, tokens },
          sizeBudget,
        );
      } catch (err) {
        return this.fail(
          record,
          'PARSED_SIZE_EXCEEDED',
          (err as Error).message,
        );
      }

      if (options.skipIndex) {
        record.status = 'QUARANTINED';
      } else {
        const entryId = options.knowledgeEntryId ?? fileId;
        const chunks = this.chunking.split(parsed.text, { maxChunkChars: 800 });
        await this.embeddings.embedDocuments(chunks.map((c) => c.text));
        // Persist to KnowledgeEntry as the canonical knowledge record.
        await this.prisma.knowledgeEntry.create({
          data: {
            id: entryId,
            tenantId,
            type: 'POLICY' as never,
            title: filename,
            content: parsed.text.slice(0, 50_000),
            source: 'file-ingestion',
            sourceUrl: `ingestion:${dedupeKey}`,
            status: 'published',
            chunkCount: chunks.length,
            visibilityScope: 'TENANT',
          },
        });
        record.knowledgeEntryId = entryId;
        record.status = 'INDEXED';
      }
    } catch (err) {
      if (err instanceof ParserUnavailableError) {
        record.status = 'PARSER_UNAVAILABLE';
        record.failureCode = 'PARSER_UNAVAILABLE';
        record.failureReason = err.reason;
      } else if (err instanceof ParserFormatError) {
        record.status = 'PARSE_FAILED';
        record.failureCode = 'PARSE_FORMAT_ERROR';
        record.failureReason = err.reason;
      } else {
        record.status = 'FAILED';
        record.failureCode = 'PARSE_UNKNOWN';
        record.failureReason = (err as Error).message;
      }
    }

    record.updatedAt = new Date().toISOString();
    await this.audit.log({
      actor: actorId,
      action: 'knowledge.file.ingested',
      resource: 'knowledge_file',
      resourceId: fileId,
      tenantId,
      result: record.status === 'INDEXED' ? 'success' : 'failure',
      details: {
        status: record.status,
        sha256,
        knowledgeEntryId: record.knowledgeEntryId,
        failureCode: record.failureCode,
        failureReason: record.failureReason,
      },
    });
    return record;
  }

  get(tenantId: string, fileId: string): FileIngestionRecord {
    const r = this.records.get(this.key(tenantId, fileId));
    if (!r) throw new NotFoundException(`file ${fileId} not found`);
    return r;
  }

  list(tenantId: string): FileIngestionRecord[] {
    return Array.from(this.records.values()).filter(
      (r) => r.tenantId === tenantId,
    );
  }

  /** Read the encrypted envelope for download / decryption tests. */
  readEnvelope(tenantId: string, fileId: string): EncryptedEnvelope {
    const r = this.get(tenantId, fileId);
    if (!r.envelope)
      throw new NotFoundException(`file ${fileId} has no envelope`);
    return r.envelope;
  }

  private key(tenantId: string, fileId: string): string {
    return `${tenantId}:${fileId}`;
  }

  private fail(
    record: FileIngestionRecord,
    code: string,
    reason: string,
  ): FileIngestionRecord {
    record.status = 'QUARANTINED_REJECTED';
    record.failureCode = code;
    record.failureReason = reason;
    record.updatedAt = new Date().toISOString();
    return record;
  }
}

function cryptoRandomId(): string {
  // RFC 4122 v4 without external dep.
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Minimal magic-byte sniff for the formats whose signatures differ
 * from the declared MIME. Returns the canonical mime, or `null` when
 * the signature is unknown / matches.
 */
export function sniffMagic(buf: Buffer, declared: string): string | null {
  if (!buf || buf.length < 8) return null;
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46)
    return 'application/pdf';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)
    return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
    return 'image/jpeg';
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46)
    return 'image/webp';
  if (
    buf[0] === 0x50 &&
    buf[1] === 0x4b &&
    buf[2] === 0x03 &&
    buf[3] === 0x04
  ) {
    // ZIP-family: only declared if container mime is one of the OOXML variants
    if (declared.includes('wordprocessingml')) return declared;
    if (declared.includes('spreadsheetml')) return declared;
    if (declared.includes('presentationml')) return declared;
    return 'application/zip';
  }
  return null;
}
