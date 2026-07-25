export type CustomerStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

/**
 * Phase 4 (INDUSTRY-SETUP-CONCEPT.md §3.4): industry-aware Customer
 * fields. Mirrors the BE enum types 1:1.
 */
export type CustomerKycStatus = 'PENDING' | 'VERIFIED' | 'EXPIRED' | 'REJECTED';
export type CustomerRiskRating = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type CustomerLifecycleStage =
  | 'PROSPECT'
  | 'KYC_VERIFIED'
  | 'ACTIVE'
  | 'DORMANT'
  | 'CLOSED';
export type CustomerFinancialSubType =
  | 'BANKING'
  | 'INSURANCE'
  | 'WEALTH_MANAGEMENT'
  | 'INVESTMENT'
  | 'FINTECH'
  | 'ACCOUNTING_AUDIT';

export interface Customer {
  id: string;
  tenantId?: string;
  name: string;
  industry?: string | null;
  primaryEmail?: string | null;
  primaryPhone?: string | null;
  billingInfo?: Record<string, unknown> | null;
  /**
   * FIX-CUST-D1 (Round-3 verification, 2026-07-24): industry-specific
   * fields that the CustomerForm renders for the tenant's industry
   * (e.g. Healthcare: hipaaConsent, emergencyContact, primaryPhysician,
   * insuranceProvider, medicalRecordNumber). The BE persists these on
   * `billingInfo.industryFields` and returns them as a separate field
   * on Customer. Surfaced in the detail page so operators can verify
   * the captured values without re-opening the edit modal.
   */
  industryFields?: Record<string, string | boolean | null> | null;
  status: CustomerStatus;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  // Phase 4 — first-class KYC/AML + lifecycle + financialSubType.
  kycStatus?: CustomerKycStatus | null;
  kycVerifiedAt?: string | null;
  kycExpiresAt?: string | null;
  riskRating?: CustomerRiskRating | null;
  taxId?: string | null;
  financialSubType?: CustomerFinancialSubType | null;
  lifecycleStage?: CustomerLifecycleStage | null;
  lifecycleUpdatedAt?: string | null;
}

export interface CustomerContact {
  id: string;
  customerId: string;
  name: string;
  email: string;
  phone?: string | null;
  role?: string | null;
  isPrimary: boolean;
  createdAt: string;
}

export interface CreateCustomerPayload {
  name: string;
  industry?: string;
  primaryEmail?: string;
  primaryPhone?: string;
  billingInfo?: Record<string, unknown>;
  tags?: string[];
  // Phase 4 — surfaced only when the tenant's industry is in the
  // 'financial-compliance' group (CustomerForm shows them conditionally).
  kycStatus?: CustomerKycStatus;
  kycExpiresAt?: string;
  riskRating?: CustomerRiskRating;
  taxId?: string;
  financialSubType?: CustomerFinancialSubType;
  lifecycleStage?: CustomerLifecycleStage;
}

export interface UpdateCustomerPayload {
  name?: string;
  industry?: string;
  primaryEmail?: string;
  primaryPhone?: string;
  billingInfo?: Record<string, unknown>;
  status?: CustomerStatus;
  tags?: string[];
  // Phase 4 — see CreateCustomerPayload.
  kycStatus?: CustomerKycStatus;
  kycExpiresAt?: string;
  riskRating?: CustomerRiskRating;
  taxId?: string;
  financialSubType?: CustomerFinancialSubType;
  lifecycleStage?: CustomerLifecycleStage;
}

export interface ListCustomersOptions {
  search?: string;
  status?: CustomerStatus;
  /** Phase 4 — F&C discriminator filter. */
  financialSubType?: CustomerFinancialSubType;
  page?: number;
  limit?: number;
  sortKey?: 'name' | 'industry' | 'status' | 'createdAt' | 'updatedAt';
  sortDir?: 'asc' | 'desc';
}
