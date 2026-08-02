/**
 * industry-metadata.provider.ts
 *
 * PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §4.3.1 (R3 interface 1) — narrow
 * IndustryMetadataProvider abstraction over the Industry table.
 *
 * Every Industry-aware service depends on this interface (via DI), not on
 * PrismaService directly. Adding a new Industry = adding rows to the
 * Industry table; existing code never changes.
 *
 * SOLID: I (Interface Segregation) — only Industry metadata concerns.
 *         D (Dependency Inversion) — consumers depend on this abstraction.
 */

import type { Industry, Prisma } from '@prisma/client';
import type { IndustryGroupSlug } from '../tier-industry-matrix';

export const INDUSTRY_METADATA = Symbol('INDUSTRY_METADATA');

export interface ListIndustriesOptions {
  /** Filter by group; omit to list across all groups. */
  groupSlug?: IndustryGroupSlug;
  /** Filter by status; defaults to ACTIVE. */
  status?: 'ACTIVE' | 'ARCHIVED';
  /** Optional search by slug/name (case-insensitive). */
  search?: string;
}

export interface IndustryMetadataProvider {
  /** Get one Industry by its slug. Returns null if not found. */
  getIndustry(slug: string): Promise<Industry | null>;

  /** Get one Industry by id. Returns null if not found. */
  getIndustryById(id: string): Promise<Industry | null>;

  /** Resolve the group slug for an Industry. Returns null if Industry absent. */
  getGroupForIndustry(slug: string): Promise<IndustryGroupSlug | null>;

  /** List Industries in a group (sorted by groupSortOrder). */
  listIndustriesInGroup(group: IndustryGroupSlug): Promise<Industry[]>;

  /**
   * List active Industries matching the given options.
   * Used by Phase 2.A's onboarding picker + Customer dropdown filter.
   */
  listActiveIndustries(options?: ListIndustriesOptions): Promise<Industry[]>;

  /**
   * Build a Prisma `where` clause for Industry queries matching the options.
   * Provided so consumers can compose with their own filters without
   * knowing the canonical `status: ACTIVE` semantics.
   */
  buildWhereClause(options: ListIndustriesOptions): Prisma.IndustryWhereInput;
}
