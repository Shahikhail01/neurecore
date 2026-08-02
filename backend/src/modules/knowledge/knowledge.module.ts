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

import { Module } from '@nestjs/common';
import { KnowledgeController } from './knowledge.controller';
import { knowledgeProviders } from './knowledge.providers';
import { KnowledgeService } from './services/knowledge.service';
import { RagAskSseService } from './services/rag-ask-sse.service';
import { KnowledgeRagAskGuard } from './guards/knowledge-rag-ask.guard';
import { TenantContextModule } from '../../common/context/tenant-context.module';
import { ModelsModule } from '../models/models.module';

@Module({
  imports: [TenantContextModule, ModelsModule],
  controllers: [KnowledgeController],
  providers: [
    ...knowledgeProviders,
    KnowledgeService,
    RagAskSseService,
    KnowledgeRagAskGuard,
  ],
  exports: [
    KnowledgeService,
    RagAskSseService,
    KnowledgeRagAskGuard,
    ...knowledgeProviders,
  ],
})
export class KnowledgeModule {}
