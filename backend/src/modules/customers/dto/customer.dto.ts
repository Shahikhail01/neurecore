/**
 * Customers Module — DTOs
 */

import { Transform } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsEmail,
  IsArray,
  IsIn,
  IsObject,
  IsBoolean,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';

/**
 * Decorator factory: coerce empty / whitespace-only strings to undefined
 * before validation runs. Without this, a UI control that posts `""` for
 * an unset enum value would be rejected by `IsIn` and the entire request
 * would 400 — turning the modal into a silent "nothing happens" surface.
 *
 * Usage: `@EmptyToUndefined() @IsIn([...]) kycStatus?: ...`
 */
function EmptyToUndefined() {
  return Transform(({ value }: { value: unknown }) => {
    if (value === null || value === undefined) return undefined;
    if (typeof value === 'string' && value.trim().length === 0) {
      return undefined;
    }
    return value;
  });
}

/**
 * SIM-04 G-07 — explicit lifecycle-stage transition DTO. The generic
 * PATCH /customers/:id endpoint already accepts lifecycleStage, but it
 * does not bump lifecycleUpdatedAt, emit a customer:lifecycle-changed
 * timeline event, or capture a reason. This dedicated subroute gives the
 * FE a clear, audit-ready surface for stage transitions and ensures the
 * tenant's timeline records every stage change with attribution.
 */
export class MoveCustomerLifecycleDto {
  @EmptyToUndefined()
  @IsIn(['PROSPECT', 'KYC_VERIFIED', 'ACTIVE', 'DORMANT', 'CLOSED'])
  toStage!: 'PROSPECT' | 'KYC_VERIFIED' | 'ACTIVE' | 'DORMANT' | 'CLOSED';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class CreateCustomerDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @EmptyToUndefined()
  @IsEmail()
  primaryEmail?: string;

  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  primaryPhone?: string;

  @IsOptional()
  @IsObject()
  billingInfo?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  // Phase 4 — Financial & Compliance fields (per INDUSTRY-REQUIREMENTS-STAGED.md
  // §3.4). Persisted on first-class columns by PrismaCustomerRepository.create().
  // Empty strings are normalised to undefined by both the FE and BE so the
  // IsIn validator never sees "" (which would 400 the whole request).
  @IsOptional()
  @EmptyToUndefined()
  @IsIn(['PENDING', 'VERIFIED', 'EXPIRED', 'REJECTED'])
  kycStatus?: 'PENDING' | 'VERIFIED' | 'EXPIRED' | 'REJECTED';

  @IsOptional()
  @EmptyToUndefined()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  riskRating?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @MaxLength(64)
  taxId?: string;

  @IsOptional()
  @EmptyToUndefined()
  @IsIn([
    'BANKING',
    'INSURANCE',
    'WEALTH_MANAGEMENT',
    'INVESTMENT',
    'FINTECH',
    'ACCOUNTING_AUDIT',
  ])
  financialSubType?:
    | 'BANKING'
    | 'INSURANCE'
    | 'WEALTH_MANAGEMENT'
    | 'INVESTMENT'
    | 'FINTECH'
    | 'ACCOUNTING_AUDIT';

  @IsOptional()
  @EmptyToUndefined()
  @IsIn(['PROSPECT', 'KYC_VERIFIED', 'ACTIVE', 'DORMANT', 'CLOSED'])
  lifecycleStage?:
    | 'PROSPECT'
    | 'KYC_VERIFIED'
    | 'ACTIVE'
    | 'DORMANT'
    | 'CLOSED';
}

export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  industry?: string;

  @IsOptional()
  @EmptyToUndefined()
  @IsEmail()
  primaryEmail?: string;

  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  primaryPhone?: string;

  @IsOptional()
  @IsObject()
  billingInfo?: Record<string, unknown>;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'ARCHIVED'])
  status?: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  // Phase 4 — Financial & Compliance fields (mirror CreateCustomerDto so
  // the global ValidationPipe whitelist doesn't strip them).
  @IsOptional()
  @EmptyToUndefined()
  @IsIn(['PENDING', 'VERIFIED', 'EXPIRED', 'REJECTED'])
  kycStatus?: 'PENDING' | 'VERIFIED' | 'EXPIRED' | 'REJECTED';

  @IsOptional()
  @EmptyToUndefined()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  riskRating?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @MaxLength(64)
  taxId?: string;

  @IsOptional()
  @EmptyToUndefined()
  @IsIn([
    'BANKING',
    'INSURANCE',
    'WEALTH_MANAGEMENT',
    'INVESTMENT',
    'FINTECH',
    'ACCOUNTING_AUDIT',
  ])
  financialSubType?:
    | 'BANKING'
    | 'INSURANCE'
    | 'WEALTH_MANAGEMENT'
    | 'INVESTMENT'
    | 'FINTECH'
    | 'ACCOUNTING_AUDIT';

  @IsOptional()
  @EmptyToUndefined()
  @IsIn(['PROSPECT', 'KYC_VERIFIED', 'ACTIVE', 'DORMANT', 'CLOSED'])
  lifecycleStage?:
    | 'PROSPECT'
    | 'KYC_VERIFIED'
    | 'ACTIVE'
    | 'DORMANT'
    | 'CLOSED';
}

export class AddCustomerContactDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class ListCustomersQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'ARCHIVED'])
  status?: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;

  @IsOptional()
  @IsIn(['name', 'industry', 'status', 'createdAt', 'updatedAt'])
  sortKey?: 'name' | 'industry' | 'status' | 'createdAt' | 'updatedAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';

  @IsOptional()
  @IsIn([
    'BANKING',
    'INSURANCE',
    'WEALTH_MANAGEMENT',
    'INVESTMENT',
    'FINTECH',
    'ACCOUNTING_AUDIT',
  ])
  financialSubType?:
    | 'BANKING'
    | 'INSURANCE'
    | 'WEALTH_MANAGEMENT'
    | 'INVESTMENT'
    | 'FINTECH'
    | 'ACCOUNTING_AUDIT';
}
