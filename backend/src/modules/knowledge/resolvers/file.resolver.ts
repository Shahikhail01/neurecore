/**
 * Phase 12 — FileResolver.
 *
 * Resolves `kind: 'file'` SourceRefs (fileId = KnowledgeEntry.id) to
 * the cached chunk text + per-chunk citations. Falls back to a
 * re-chunking of `KnowledgeEntry.content` when the cached chunks are
 * missing.
 *
 * SRP: this class owns ONLY file resolution through the knowledge
 * corpus. Other ingestion flows (P2 file-quarantine, archive-bomb,
 * malware) live in file-ingestion.service.ts and are NOT invoked
 * here — Phase 12 reads from the already-processed knowledge store.
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { ChunkingService } from '../services/chunking.service';
import {
  FileTextResolver,
  ResolvedText,
  ResolverKind,
} from './source-ref-resolver.registry';
import type { SourceRef, SkillCitation } from '../../skill-registry/interfaces/skill.types';

type FileRef = Extract<SourceRef, { kind: 'file' }>;

const MAX_CHARS = 12_000;

@Injectable()
export class FileResolver extends FileTextResolver<FileRef> {
  readonly kind: ResolverKind = 'file';
  private readonly logger = new Logger(FileResolver.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chunking: ChunkingService,
  ) {
    super();
  }

  protected async doResolve(
    tenantId: string,
    ref: FileRef,
  ): Promise<ResolvedText> {
    const entry = await this.prisma.knowledgeEntry.findFirst({
      where: { id: ref.fileId, tenantId },
      select: {
        id: true,
        title: true,
        type: true,
        content: true,
        chunkCount: true,
        language: true,
      },
    });
    if (!entry) {
      throw new NotFoundException(
        `file (knowledge entry) ${ref.fileId} not found in tenant ${tenantId}`,
      );
    }
    const chunks = this.chunking.split(entry.content, { maxChunkChars: MAX_CHARS });
    const text = renderEntry(entry.title, entry.type, entry.language, entry.content, chunks.length);
    const citations: SkillCitation[] = chunks.map((c, i) => ({
      fileId: entry.id,
      locator: `file:${entry.id}#chunk-${c.chunkIndex}`,
      quote: c.text.length > 200 ? `${c.text.slice(0, 200)}…` : c.text,
    }));
    return { text, citations };
  }
}

function renderEntry(
  title: string,
  type: string,
  language: string,
  content: string,
  chunkCount: number,
): string {
  const truncated = content.length > MAX_CHARS
    ? `${content.slice(0, MAX_CHARS)}…(truncated)`
    : content;
  return [
    `Knowledge file: ${title}`,
    `type: ${type}`,
    `language: ${language}`,
    `chunks: ${chunkCount}`,
    '',
    truncated,
  ].join('\n');
}
