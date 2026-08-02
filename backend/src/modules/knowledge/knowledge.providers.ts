/**
 * knowledge.providers.ts — DI bindings for the knowledge module.
 *
 * Phase 6, Task 6.1.
 *
 * Each interface token (CHUNKING_SERVICE / EMBEDDINGS_SERVICE / VECTOR_STORE)
 * is bound to a concrete provider class so consumers can inject via
 * `@Inject(TOKEN)`. The bindings use `useClass` so NestJS still handles
 * lifecycle (singleton scope by default).
 *
 * Phase P2 additions:
 *   - ParserRegistry, individual parsers
 *   - FileCipher, FileIngestionService, RetentionService
 *   - KnowledgeSecurityEventService
 *   - MALWARE_SCANNER port (clamd in prod, no-op in dev/test)
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Provider } from '@nestjs/common';
import { ChunkingService } from './services/chunking.service';
import { EmbeddingsService } from './services/embeddings.service';
import { PgVectorStore } from './services/vector-store.service';
import { HybridSearchService } from './services/hybrid-search.service';
import { RAGPipeline } from './services/rag-pipeline.service';
import { IndustryKnowledgeSeeder } from './services/industry-knowledge-seeder.service';
import {
  CHUNKING_SERVICE,
  EMBEDDINGS_SERVICE,
  RAG_PIPELINE,
  VECTOR_STORE,
} from './interfaces/knowledge.interface';
import { ParserRegistry } from './services/parsers/parser.registry';
import { PdfParser } from './services/parsers/pdf.parser';
import { DocxParser } from './services/parsers/docx.parser';
import { TxtParser } from './services/parsers/txt.parser';
import { CsvXlsxParser } from './services/parsers/csv-xlsx.parser';
import { PptxParser } from './services/parsers/pptx.parser';
import { EmailParser } from './services/parsers/email.parser';
import { ImageParser } from './services/parsers/image.parser';
import { FileCipher } from './services/file-cipher';
import { FileIngestionService } from './services/file-ingestion.service';
import { RetentionService } from './services/retention.service';
import { KnowledgeSecurityEventService } from './services/security-event.service';
import {
  ClamdScanner,
  MALWARE_SCANNER,
  NoopMalwareScanner,
  type IMalwareScanner,
} from './services/malware-scanner';

export const knowledgeProviders: Provider[] = [
  // Concrete classes (also available via their own DI tokens)
  ChunkingService,
  EmbeddingsService,
  HybridSearchService,
  RAGPipeline,
  PgVectorStore,
  IndustryKnowledgeSeeder,

  // Phase P2 — parsers + ingestion
  ParserRegistry,
  // Parsers carry non-injectable constructor defaults; use factory providers
  // so Nest does not try to DI-resolve them.
  { provide: PdfParser, useFactory: () => new PdfParser() },
  { provide: DocxParser, useFactory: () => new DocxParser() },
  { provide: TxtParser, useFactory: () => new TxtParser() },
  { provide: CsvXlsxParser, useFactory: () => new CsvXlsxParser() },
  { provide: PptxParser, useFactory: () => new PptxParser() },
  { provide: EmailParser, useFactory: () => new EmailParser() },
  { provide: ImageParser, useFactory: () => new ImageParser() },
  FileCipher,
  FileIngestionService,
  RetentionService,
  KnowledgeSecurityEventService,

  // Malware scanner port: dev profile uses no-op; production swaps to
  // ClamdScanner via the env-driven `useExisting` rebind at bootstrap.
  NoopMalwareScanner,
  ClamdScanner,
  {
    provide: MALWARE_SCANNER,
    useFactory: (
      noop: NoopMalwareScanner,
      clamd: ClamdScanner,
    ): IMalwareScanner => {
      const profile = process.env.MALWARE_SCANNER ?? 'noop';
      const chosen: IMalwareScanner = profile === 'clamd' ? clamd : noop;
      return chosen;
    },
    inject: [NoopMalwareScanner, ClamdScanner],
  },

  // Interface → concrete class bindings
  { provide: CHUNKING_SERVICE, useExisting: ChunkingService },
  { provide: EMBEDDINGS_SERVICE, useExisting: EmbeddingsService },
  { provide: VECTOR_STORE, useExisting: PgVectorStore },
  { provide: RAG_PIPELINE, useExisting: RAGPipeline },
];
