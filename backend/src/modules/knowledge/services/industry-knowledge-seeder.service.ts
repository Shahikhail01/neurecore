/**
 * IndustryKnowledgeSeeder — seeds tenant-scoped knowledge corpus rows
 * keyed by industry group. Phase 7 G1.
 *
 * INDUSTRY-SETUP-CONCEPT.md §3.6 / IMPLEMENTATION-PLAN Phase 7.
 *
 * KnowledgeEntry rows are tenant-scoped (per the schema's tenantId FK),
 * so the industry corpus must be cloned to each tenant at onboarding
 * time. This service centralises that cloning logic so the
 * TenantTemplateSeederService can call it without duplicating content.
 *
 * SRP: this service only knows about seeding industry knowledge corpus.
 *      It does NOT handle runtime RAG retrieval (that's RAGPipeline /
 *      VectorStoreService).
 * DRY: industry content lives in `INDUSTRY_KNOWLEDGE_CORPUS` below
 *      (the single source of truth) — adding a new industry group means
 *      adding one entry there.
 *
 * PGVector note: this seeder writes `contentVector = null` because
 * embeddings require an OpenAI API key at seed time. The RAG pipeline
 * falls back to BM25 keyword search when contentVector is NULL (see
 * VectorStoreService.search — it filters rows with NULL contentVector).
 * Production tenants run a one-shot backfill script that calls
 * `seedAllEmbeddings()` after this seeder completes.
 */
import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import type { KnowledgeType } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { INDUSTRY_GROUP } from '../../industry/tier-industry-matrix';

const INDUSTRY_KNOWLEDGE_CORPUS: Record<
  string,
  Array<{
    title: string;
    content: string;
    type: KnowledgeType;
    tags: string[];
    sourceUrl?: string;
  }>
> = {
  // ─── Financial & Compliance ────────────────────────────────────────────
  [INDUSTRY_GROUP.FINANCIAL_COMPLIANCE]: [
    {
      title: 'Know Your Customer (KYC) — Customer Identification Program',
      content:
        'The Customer Identification Program (CIP) requires financial institutions to verify the identity of every customer at account opening. Required elements: (1) name, (2) date of birth, (3) residential address, (4) government-issued ID number. For non-US persons: passport + visa or similar. Records must be retained for 5 years after account closure. Re-verify every 3 years for high-risk customers; every 5 years for standard.',
      type: 'POLICY',
      tags: ['kyc', 'cip', 'identity-verification', 'compliance'],
      sourceUrl:
        'https://www.ffiec.gov/bsa_aml_infobase/pages_manual/OLM_013.htm',
    },
    {
      title: 'Anti-Money Laundering (AML) — Suspicious Activity Reporting',
      content:
        'A Suspicious Activity Report (SAR) must be filed within 30 calendar days of the date of detection of the initial underlying activity for transactions of $5,000 or more. Currency Transaction Reports (CTRs) are required for cash transactions exceeding $10,000 in a single business day. Red flags include: structuring (smurfing), funnel accounts, rapid in-and-out transfers, transactions inconsistent with customer profile, and refusal to provide documentation. AML training required quarterly for all staff.',
      type: 'POLICY',
      tags: ['aml', 'sar', 'ctr', 'fincen', 'compliance'],
    },
    {
      title: 'Bank Secrecy Act (BSA) Recordkeeping Requirements',
      content:
        'The Bank Secrecy Act requires financial institutions to maintain records of all financial transactions. Retention: 5 years for most records (CTR / SAR); funds transfer records (Travel Rule) require full originator/beneficiary info for transfers ≥ $3,000. Record format must be retrievable on demand by FinCEN. Records must include: amount, parties, account numbers, execution time, and any payment instructions.',
      type: 'REGULATION',
      tags: ['bsa', 'fincen', 'travel-rule', 'compliance'],
      sourceUrl:
        'https://www.fincen.gov/resources/statutes-regulations/bank-secrecy-act',
    },
    {
      title: 'OFAC Sanctions Screening — Required Frequency',
      content:
        'Office of Foreign Assets Control (OFAC) screening must be performed: (1) at customer onboarding, (2) on every transaction regardless of amount, (3) when the SDN list is updated (typically daily), and (4) periodically for existing customer relationships. Match hits must be escalated to compliance officer within 24 hours. False positive documentation is mandatory for audit defense. Use the SDN list API for real-time screening when transaction volume exceeds 1,000/day.',
      type: 'SOP',
      tags: ['ofac', 'sanctions', 'sdn', 'compliance', 'screening'],
    },
    {
      title: 'CPE Credit Requirements for CPAs (US)',
      content:
        'Continuing Professional Education (CPE) requirements vary by state but typically require 40 hours annually for active CPAs. Of those 40 hours: minimum 4 hours in ethics, 2 hours in state-specific laws, balance in accounting/auditing/tax. Public accounting firms with audit clients: minimum 20% of CPE in audit and accounting. Most states accept self-study (NASBA-approved) up to 50% of total hours. Carry-forward typically capped at 20 excess hours. Reporting is on an honor system in most states; audited members must retain CPE records for 5 years.',
      type: 'POLICY',
      tags: ['cpe', 'cpa', 'continuing-education', 'compliance'],
    },
    {
      title: 'Audit Engagement Quality Control (PCAOB AS 1220)',
      content:
        "PCAOB Auditing Standard 1220 requires engagement quality reviews for all audits of public companies. The engagement quality reviewer (EQR) must be independent of the engagement team, possess the expertise and authority to evaluate the engagement, and review the engagement team's significant judgments and conclusions. Documentation of EQR procedures is required. For non-public audits, AICPA SAS 1220 provides similar peer review requirements. The review must be completed BEFORE the audit report is released.",
      type: 'REGULATION',
      tags: ['pcaob', 'audit', 'as-1220', 'eqr', 'compliance'],
    },
    {
      title: 'Tax Filing Deadlines Calendar (US Business)',
      content:
        'Key US business tax deadlines: Form 1120 (C-corp) — 15th day of 4th month after fiscal year-end (April 15 for calendar-year filers). Form 1120-S (S-corp) — 15th day of 3rd month (March 15). Form 1065 (partnership) — 15th day of 3rd month. Form 1040 — April 15. Quarterly estimated taxes — Q1: April 15, Q2: June 15, Q3: September 15, Q4: January 15. Extensions: Form 7004 (corporations/partnerships) buys 5-6 months; Form 4868 (individuals) buys 6 months. Payroll Form 941: quarterly by last day of month following quarter-end.',
      type: 'GUIDE',
      tags: ['tax', 'deadlines', 'irs', 'compliance', 'calendar'],
    },
  ],
};

/**
 * Single source of truth for industry knowledge corpus content.
 * Exposed as a constant for the unit tests + integration seeder.
 */
export const KNOWLEDGE_CORPUS = INDUSTRY_KNOWLEDGE_CORPUS;

@Injectable()
export class IndustryKnowledgeSeeder {
  private readonly logger = new Logger(IndustryKnowledgeSeeder.name);

  constructor(
    @Optional()
    @Inject('PrismaService')
    private readonly prisma?: PrismaService,
  ) {}

  /**
   * Seed the knowledge corpus for a tenant's industry. Idempotent —
   * skips entries whose (tenantId, title, type) tuple already exists.
   * Returns the number of new rows created.
   *
   * SRP: this method is the only public surface for corpus seeding. Tests
   *      use a stubbed PrismaService; production routes through OnboardingService.
   */
  async seedForTenant(tenantId: string, industrySlug: string): Promise<number> {
    if (!this.prisma) {
      this.logger.warn(
        `seedForTenant(${tenantId}, ${industrySlug}) called with no Prisma — skipping (likely test environment)`,
      );
      return 0;
    }
    const corpus = INDUSTRY_KNOWLEDGE_CORPUS[industrySlug];
    if (!corpus || corpus.length === 0) {
      this.logger.debug(
        `seedForTenant: no corpus for industry "${industrySlug}"`,
      );
      return 0;
    }

    let created = 0;
    for (const entry of corpus) {
      const existing = await this.prisma.knowledgeEntry.findFirst({
        where: { tenantId, title: entry.title, type: entry.type },
      });
      if (existing) continue;
      // contentVector is intentionally NOT in the typed create() call
      // because Prisma has no native pgvector type. The column defaults to
      // NULL; the PgVectorStore.upsert() call populates it later during
      // the embedding backfill.
      await this.prisma.knowledgeEntry.create({
        data: {
          tenantId,
          title: entry.title,
          content: entry.content,
          type: entry.type,
          tags: entry.tags,
          sourceUrl: entry.sourceUrl ?? null,
          language: 'en',
          source: 'system-corpus',
          status: 'published',
          version: '1.0.0',
          visibilityScope: 'TENANT',
        },
      });
      created++;
    }
    this.logger.log(
      `seedForTenant: tenant=${tenantId} industry=${industrySlug} created=${created} corpusSize=${corpus.length}`,
    );
    return created;
  }

  /**
   * List every industry group for which we ship a curated corpus.
   * SRP: lets the onboarding wizard show "your industry has N knowledge
   * base entries" without inspecting the corpus directly.
   */
  listIndustriesWithCorpus(): string[] {
    return Object.keys(INDUSTRY_KNOWLEDGE_CORPUS);
  }

  /**
   * Returns the corpus entry count for an industry. Used by unit tests
   * + tenant onboarding summary.
   */
  corpusSizeFor(industrySlug: string): number {
    return INDUSTRY_KNOWLEDGE_CORPUS[industrySlug]?.length ?? 0;
  }
}
