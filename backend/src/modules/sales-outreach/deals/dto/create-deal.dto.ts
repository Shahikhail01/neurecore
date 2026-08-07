/**
 * DTO for creating a Deal.
 *
 * Validation rules per the domain invariants in the implementation
 * plan (R3 §3.5.2): amount >= 0, probability in [0, 1], tenantId
 * resolved server-side from JWT (never trusted from the client).
 */

import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateDealDto {
  @IsString()
  @Length(1, 200)
  name!: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  contactId?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  ownerUserId?: string;

  @IsOptional()
  @IsIn(['LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'])
  stage?: 'LEAD' | 'QUALIFIED' | 'PROPOSAL' | 'NEGOTIATION' | 'WON' | 'LOST';

  @IsOptional()
  @IsIn(['INBOUND', 'OUTBOUND', 'PARTNER', 'REFERRAL', 'EVENT'])
  source?: 'INBOUND' | 'OUTBOUND' | 'PARTNER' | 'REFERRAL' | 'EVENT';

  @IsNumber()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  amount!: number;

  @IsOptional()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  probability?: number;

  @IsOptional()
  @IsDateString()
  expectedCloseDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  aiScore?: number;

  @IsOptional()
  @IsString()
  @Length(0, 4000)
  notes?: string;
}
