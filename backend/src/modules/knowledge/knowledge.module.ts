/**
 * KnowledgeModule — wires the Knowledge Hub.
 *
 * Phase 6, Task 6.1 (per EAOS-implementation-roadmap.md §10).
 *
 * Wires:
 *   - Controllers: KnowledgeController
 *   - Providers: ChunkingService, EmbeddingsService, PgVectorStore,
 *                HybridSearchService, RAGPipeline, RagAskSseService,
 *                KnowledgeService, KnowledgeRagAskGuard,
 *                ParserRegistry + parsers, FileCipher, FileIngestionService,
 *                RetentionService, KnowledgeSecurityEventService
 *   - Module dependencies: TenantContextModule (global), ModelsModule
 *     (LLMFactory). CacheModule is @Global so RedisService is available
 *     without an explicit import. AuditModule is @Global.
 *
 * Exports:
 *   - KnowledgeService, RAGPipeline, HybridSearchService — so other
 *     modules (capabilities/intelligence, future Solution Packs) can
 *     re-use the RAG pipeline without duplicating it.
 *   - Phase P2: FileIngestionService, RetentionService,
 *     KnowledgeSecurityEventService, ParserRegistry so Meetings (P3),
 *     Chat and Tools modules can consume them through one owner.
 */

import { Module, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { KnowledgeController } from './knowledge.controller';
import { knowledgeProviders } from './knowledge.providers';
import { KnowledgeService } from './services/knowledge.service';
import { RagAskSseService } from './services/rag-ask-sse.service';
import { KnowledgeRagAskGuard } from './guards/knowledge-rag-ask.guard';
import { TenantContextModule } from '../../common/context/tenant-context.module';
import { ModelsModule } from '../models/models.module';
import { RecordResolver } from './resolvers/record.resolver';
import { ThreadResolver } from './resolvers/thread.resolver';
import { FileResolver } from './resolvers/file.resolver';
import {
  SourceRefResolverRegistry,
  SOURCE_REF_RESOLVER_REGISTRY,
} from './resolvers/source-ref-resolver.registry';

@Module({
  imports: [TenantContextModule, ModelsModule],
  controllers: [KnowledgeController],
  providers: [
    ...knowledgeProviders,
    KnowledgeService,
    RagAskSseService,
    KnowledgeRagAskGuard,
    RecordResolver,
    ThreadResolver,
    FileResolver,
    SourceRefResolverRegistry,
    {
      provide: SOURCE_REF_RESOLVER_REGISTRY,
      useExisting: SourceRefResolverRegistry,
    },
  ],
  exports: [
    KnowledgeService,
    RagAskSseService,
    KnowledgeRagAskGuard,
    ...knowledgeProviders,
    SourceRefResolverRegistry,
    SOURCE_REF_RESOLVER_REGISTRY,
  ],
})
export class KnowledgeModule implements OnApplicationBootstrap {
  private readonly logger = new Logger(KnowledgeModule.name);

  constructor(
    private readonly registry: SourceRefResolverRegistry,
    private readonly record: RecordResolver,
    private readonly thread: ThreadResolver,
    private readonly file: FileResolver,
  ) {}

  onApplicationBootstrap(): void {
    this.registry.registerAll([this.record, this.thread, this.file]);
    this.logger.log('KnowledgeModule: registered 3 source-resolvers');
  }
}
