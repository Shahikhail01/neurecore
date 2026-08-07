/**
 * DTO for listing Deals. Pagination + filter + sort.
 * SRP: ListDealsDto carries list-shape only; the DealsService
 * applies tenant-scoping and authorization separately.
 */

import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class ListDealsDto {
  @IsOptional()
  @IsString()
  stage?: string;

  @IsOptional()
  @IsString()
  ownerUserId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit: number = 25;

  @IsOptional()
  @IsIn(['updatedAt', 'amount', 'expectedCloseDate', 'createdAt'])
  sort?: 'updatedAt' | 'amount' | 'expectedCloseDate' | 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';

  /** When true, include soft-deleted deals. Only honored for PLATFORM_ADMIN. */
  @IsOptional()
  includeDeleted?: boolean;
}
