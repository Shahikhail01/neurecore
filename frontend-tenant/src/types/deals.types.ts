/**
 * Phase 10.6 R1-BACKLOG — Deal domain types.
 *
 * Mirrors backend `prisma.Deal` shape after JSON serialization. Decimals
 * arrive as strings (Prisma serializes Decimal to string by default); we
 * keep them as strings on the wire and only cast to numbers at render
 * time. Stage is the canonical `DealStage` enum (LEAD → QUALIFIED →
 * PROPOSAL → NEGOTIATION → WON | LOST).
 */

export type DealStage =
  | 'LEAD'
  | 'QUALIFIED'
  | 'PROPOSAL'
  | 'NEGOTIATION'
  | 'WON'
  | 'LOST';

export type DealSource =
  | 'INBOUND'
  | 'OUTBOUND'
  | 'REFERRAL'
  | 'PARTNER'
  | 'EVENT'
  | 'OTHER';

export interface Deal {
  id: string;
  tenantId?: string;
  customerId: string | null;
  contactId: string | null;
  projectId: string | null;
  ownerUserId: string | null;
  name: string;
  stage: DealStage;
  source: DealSource;
  /** Decimal serialized to string by Prisma. */
  amount: string;
  currency: string;
  /** Decimal serialized to string by Prisma. */
  probability: string;
  expectedCloseDate: string | null;
  /** Decimal serialized to string by Prisma. */
  aiScore: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDealPayload {
  customerId?: string | null;
  contactId?: string | null;
  projectId?: string | null;
  name: string;
  stage?: DealStage;
  source?: DealSource;
  amount?: number;
  currency?: string;
  probability?: number;
  expectedCloseDate?: string | null;
  notes?: string | null;
}

export interface UpdateDealPayload {
  customerId?: string | null;
  contactId?: string | null;
  projectId?: string | null;
  name?: string;
  amount?: number;
  currency?: string;
  probability?: number;
  expectedCloseDate?: string | null;
  source?: DealSource;
  notes?: string | null;
}

export interface ListDealsOptions {
  q?: string;
  stage?: DealStage;
  ownerUserId?: string;
  customerId?: string;
  page?: number;
  limit?: number;
  sort?: 'updatedAt' | 'amount' | 'expectedCloseDate' | 'createdAt';
  sortDir?: 'asc' | 'desc';
}