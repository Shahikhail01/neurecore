/**
 * Customers Module — Interface Definitions
 *
 * Following SOLID (ISP, DIP): focused contracts so other modules depend on
 * abstractions, never on Prisma.
 *
 * Phase 4 (INDUSTRY-SETUP-CONCEPT.md §3.4): added industry-aware KYC/AML
 * fields + lifecycle stage + financialSubType discriminator. These live
 * as first-class columns (not JSONB) so list-page filters and reports
 * don't have to parse Customer.billingInfo for every row.
 */

export type CustomerStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

/** Phase 4 — KYC/AML verification status. */
export type CustomerKycStatus = 'PENDING' | 'VERIFIED' | 'EXPIRED' | 'REJECTED';

/** Phase 4 — AML / credit risk rating (CRITICAL is reserved for sanctions hits). */
export type CustomerRiskRating = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/** Phase 4 — industry-aware lifecycle stage. Mirrors the per-industry
 *  CustomerLifecycleTemplate stages; the column is the canonical source
 *  so analytics don't have to walk tenantTemplate JSONB. */
export type CustomerLifecycleStage =
  | 'PROSPECT'
  | 'KYC_VERIFIED'
  | 'ACTIVE'
  | 'DORMANT'
  | 'CLOSED';

/** Phase 4 — discriminator within Financial & Compliance group.
 *  Null for tenants outside the F&C group; for F&C tenants the
 *  field is the most actionable filter for the list page. */
export type CustomerFinancialSubType =
  | 'BANKING'
  | 'INSURANCE'
  | 'WEALTH_MANAGEMENT'
  | 'INVESTMENT'
  | 'FINTECH'
  | 'ACCOUNTING_AUDIT';

export interface Customer {
  id: string;
  tenantId: string;
  name: string;
  industry: string | null;
  primaryEmail: string | null;
  primaryPhone: string | null;
  billingInfo: Record<string, unknown> | null;
  status: CustomerStatus;
  tags: string[];
  // Phase 4 fields
  kycStatus: CustomerKycStatus | null;
  kycVerifiedAt: Date | null;
  kycExpiresAt: Date | null;
  riskRating: CustomerRiskRating | null;
  taxId: string | null;
  financialSubType: CustomerFinancialSubType | null;
  lifecycleStage: CustomerLifecycleStage | null;
  lifecycleUpdatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerContact {
  id: string;
  customerId: string;
  name: string;
  email: string;
  phone: string | null;
  role: string | null;
  isPrimary: boolean;
  createdAt: Date;
}

export interface CreateCustomerInput {
  name: string;
  industry?: string | null;
  primaryEmail?: string | null;
  primaryPhone?: string | null;
  billingInfo?: Record<string, unknown> | null;
  tags?: string[];
  // Phase 4 — optional on create; the CustomerForm surfaces them only
  // when the tenant's industry is in the F&C group.
  kycStatus?: CustomerKycStatus | null;
  kycExpiresAt?: Date | string | null;
  riskRating?: CustomerRiskRating | null;
  taxId?: string | null;
  financialSubType?: CustomerFinancialSubType | null;
  lifecycleStage?: CustomerLifecycleStage | null;
}

export interface UpdateCustomerInput {
  name?: string;
  industry?: string | null;
  primaryEmail?: string | null;
  primaryPhone?: string | null;
  billingInfo?: Record<string, unknown> | null;
  status?: CustomerStatus;
  tags?: string[];
  // Phase 4 — see CreateCustomerInput.
  kycStatus?: CustomerKycStatus | null;
  kycExpiresAt?: Date | string | null;
  riskRating?: CustomerRiskRating | null;
  taxId?: string | null;
  financialSubType?: CustomerFinancialSubType | null;
  lifecycleStage?: CustomerLifecycleStage | null;
  // SIM-04 G-07 — explicit lifecycle-stage transitions also bump
  // lifecycleUpdatedAt. Internal callers (e.g. moveLifecycleStage service
  // method) use this; external callers should use the dedicated
  // /customers/:id/lifecycle subroute.
  lifecycleUpdatedAt?: Date | null;
}

export interface ListCustomersOptions {
  search?: string;
  status?: CustomerStatus;
  page?: number;
  limit?: number;
  sortKey?: 'name' | 'industry' | 'status' | 'createdAt' | 'updatedAt';
  sortDir?: 'asc' | 'desc';
  // Phase 4 G4 — list-page filter. When set, the query adds a WHERE
  // clause against Customer.financialSubType. Filter combinators are
  // all AND (financialSubType AND status AND search) — the FE never
  // needs OR.
  financialSubType?: CustomerFinancialSubType;
}

export interface ICustomerRepository {
  create(data: CreateCustomerInput, tenantId: string): Promise<Customer>;
  findById(id: string, tenantId: string): Promise<Customer | null>;
  findAll(
    options: ListCustomersOptions,
    tenantId: string,
  ): Promise<{ data: Customer[]; total: number }>;
  update(
    id: string,
    tenantId: string,
    data: UpdateCustomerInput,
  ): Promise<Customer>;
  archive(id: string, tenantId: string): Promise<Customer>;
  addContact(
    customerId: string,
    dto: {
      name: string;
      email: string;
      phone?: string | null;
      role?: string | null;
      isPrimary?: boolean;
    },
  ): Promise<CustomerContact>;
  listContacts(customerId: string): Promise<CustomerContact[]>;
}

export const CUSTOMER_REPOSITORY = 'CUSTOMER_REPOSITORY';
