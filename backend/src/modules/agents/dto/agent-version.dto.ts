/**
 * Agent Version DTOs
 *
 * SOLID:
 *   SRP  — Each DTO carries exactly the fields for one operation.
 *   ISP  — CreateAgentVersionDto is not mixed with RollbackAgentVersionDto.
 *
 * class-validator rules applied throughout – zero 'any' types.
 */

import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

// ─── Request bodies ───────────────────────────────────────────────────────

/**
 * POST /agents/:id/versions
 * Manually create a named snapshot of the current agent config.
 */
export class CreateAgentVersionDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  changeNote?: string;
}

/**
 * POST /agents/:id/rollback
 * Restore the agent to a specific version.
 */
export class RollbackAgentVersionDto {
  @IsInt()
  @Min(1)
  versionNumber!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  changeNote?: string;
}
