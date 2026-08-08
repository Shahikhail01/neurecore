/**
 * Phase 30 — Cost ceiling DTOs (CR-AI-1305).
 *
 * Request/response shapes for the Command Center ceiling surface.
 * Validation is explicit and integer-only: the API refuses a
 * fractional or negative limit before it can reach the database.
 *
 * SOLID
 *   SRP — owns ONLY the HTTP contract shapes.
 */

import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import {
  COST_DIMENSIONS,
  type CostDimension,
} from '../interfaces/ICeilingRule';

export class SetCostCeilingDto {
  @ApiProperty({ enum: COST_DIMENSIONS as unknown as string[] })
  dimension!: CostDimension;

  @ApiProperty({
    description:
      'Integer limit in the dimension unit (cents, tokens or requests).',
  })
  limitValue!: number;

  @ApiProperty({ description: 'Whether the ceiling denies calls when hit.' })
  enabled!: boolean;

  @ApiProperty({ description: 'Operator reason for the change.' })
  reason?: string;
}

export class CostCeilingEntryDto {
  @ApiProperty({ enum: COST_DIMENSIONS as unknown as string[] })
  @Expose()
  dimension!: CostDimension;

  @ApiProperty()
  @Expose()
  limitValue!: number;

  @ApiProperty()
  @Expose()
  enabled!: boolean;
}

export class CostCeilingListResponseDto {
  @ApiProperty()
  @Expose()
  tenantId!: string;

  @ApiProperty({ type: [CostCeilingEntryDto] })
  @Expose()
  ceilings!: CostCeilingEntryDto[];

  @ApiProperty()
  @Expose()
  fetchedAt!: string;
}

/** True when `value` is a valid `CostDimension`. */
export function isCostDimension(value: unknown): value is CostDimension {
  return (
    typeof value === 'string' &&
    (COST_DIMENSIONS as ReadonlyArray<string>).includes(value)
  );
}
