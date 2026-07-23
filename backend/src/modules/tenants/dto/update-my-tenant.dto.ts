// dto/update-my-tenant.dto.ts — Owner-scoped tenant update.
// Used by PATCH /tenants/me. Restricts what non-platform users can change
// about their own tenant (no status, no slug, no tier — those require
// platform admin endpoints).

import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsEmail,
  IsUrl,
  IsObject,
  ValidateIf,
  Min,
  Max,
  MinLength,
  MaxLength,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TenantSizeBucket } from '@prisma/client';

export class AddressDto {
  @IsOptional() @IsString() @MaxLength(200) street?: string;
  @IsOptional() @IsString() @MaxLength(100) city?: string;
  @IsOptional() @IsString() @MaxLength(100) region?: string;
  @IsOptional() @IsString() @MaxLength(20) postal?: string;
  @IsOptional()
  @IsString()
  @MaxLength(2)
  @Matches(/^[A-Z]{2}$/, {
    message: 'country must be ISO-3166 alpha-2 (e.g. US, PK)',
  })
  country?: string;
}

export class UpdateMyTenantDto {
  // ─── Identity ─────────────────────────────────────────────────────
  @IsOptional() @IsString() @MinLength(2) @MaxLength(64) name?: string;

  @IsOptional() @IsUrl() @MaxLength(500) website?: string;

  /**
   * Industry is optional. Tenant users may set it on first onboarding
   * and cannot change it after that; the field is reserved so the
   * service can persist an explicit `null` ("Skip industry" path).
   *
   * `industry: null` is rejected by class-validator if `@IsString` is
   * applied — we use `@ValidateIf` so empty/null values pass through
   * and reach the controller's typed exception layer where they reset
   * Tenant.industryGroup to `null`.
   */
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(100)
  industry?: string | null;

  @IsOptional() @IsEnum(TenantSizeBucket) sizeBucket?: TenantSizeBucket;

  @IsOptional()
  @IsInt()
  @Min(1800)
  @Max(new Date().getFullYear())
  foundedYear?: number;

  @IsOptional() @IsString() @MaxLength(100) businessType?: string;

  @IsOptional() @IsString() @MaxLength(40) phone?: string;

  @IsOptional() @IsEmail() @MaxLength(200) supportEmail?: string;

  // ─── Localization ─────────────────────────────────────────────────
  @IsOptional()
  @IsString()
  @MaxLength(50)
  timezone?: string; // IANA, e.g. "America/New_York"

  @IsOptional()
  @IsString()
  @MaxLength(10)
  locale?: string; // BCP-47, e.g. "en-US"

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string; // ISO-4217, e.g. "USD"

  @IsOptional()
  @IsString()
  @MaxLength(10)
  dateFormat?: 'short' | 'medium' | 'long' | 'relative';

  @IsOptional()
  @IsString()
  @MaxLength(3)
  timeFormat?: '12h' | '24h';

  @IsOptional()
  @IsString()
  @MaxLength(5)
  @Matches(/^\d{2}-\d{2}$/, { message: 'fiscalYearStart must be MM-DD' })
  fiscalYearStart?: string;

  // ─── Structured ────────────────────────────────────────────────────
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  /**
   * Billing profile JSON shape:
   *   { taxId?, taxRegion?, billingContactName?, billingContactEmail?,
   *     billingAddress?: AddressDto, paymentMethod?: 'CARD'|'BANK_TRANSFER'|'INVOICE_ONLY'|'NONE',
   *     poNumber?, invoiceCadence?: 'monthly'|'quarterly'|'yearly',
   *     dunningEmail? }
   *
   * Free-form Json for now — strong typing lands in PR-5 (billing wizard).
   */
  @IsOptional() @IsObject() billingProfile?: Record<string, unknown>;

  /**
   * Operational defaults JSON shape:
   *   { defaultModel?, defaultBudgetPerDay?, defaultAuthorityLevel?,
   *     fromName?, fromEmail?, replyToEmail?, retentionDays? }
   */
  @IsOptional() @IsObject() defaults?: Record<string, unknown>;

  // ─── Branding ─────────────────────────────────────────────────────
  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;
}
