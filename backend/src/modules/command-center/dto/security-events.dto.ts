/**
 * command-center/dto/security-events.dto.ts
 *
 * P8 Command Center — Security Events view (CR-AI-1206).
 * Reconciles AuditLog (security-related actions) and surfaces
 *   - denials
 *   - injection / DLP / malware events
 * Each row carries the canonical source so the dashboard can
 * present an evidence trail.
 */

import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class SecurityEventDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  actor!: string;

  @ApiProperty()
  @Expose()
  action!: string;

  @ApiProperty({ description: 'security | auth | data | system' })
  @Expose()
  category!: string;

  @ApiProperty({ enum: ['low', 'medium', 'high', 'critical'] })
  @Expose()
  severity!: 'low' | 'medium' | 'high' | 'critical';

  @ApiProperty({ nullable: true })
  @Expose()
  resource!: string | null;

  @ApiProperty({ nullable: true })
  @Expose()
  resourceId!: string | null;

  @ApiProperty({
    nullable: true,
    description: 'PII redacted before transmission',
  })
  @Expose()
  ipAddress!: string | null;

  @ApiProperty({ enum: ['success', 'failure'] })
  @Expose()
  result!: 'success' | 'failure';

  @ApiProperty()
  @Expose()
  occurredAt!: string;

  @ApiProperty()
  @Expose()
  source!: 'AuditLog';
}

export class SecurityEventsSummaryDto {
  @ApiProperty()
  @Expose()
  total!: number;

  @ApiProperty()
  @Expose()
  denials!: number;

  @ApiProperty()
  @Expose()
  injectionAttempts!: number;

  @ApiProperty()
  @Expose()
  dlpEvents!: number;

  @ApiProperty()
  @Expose()
  malwareEvents!: number;

  @ApiProperty()
  @Expose()
  criticalCount!: number;
}

export class SecurityEventsResponseDto {
  @ApiProperty({ type: SecurityEventsSummaryDto })
  @Expose()
  @Type(() => SecurityEventsSummaryDto)
  summary!: SecurityEventsSummaryDto;

  @ApiProperty({ type: [SecurityEventDto] })
  @Expose()
  @Type(() => SecurityEventDto)
  events!: SecurityEventDto[];

  @ApiProperty()
  @Expose()
  tenantId!: string;

  @ApiProperty()
  @Expose()
  fetchedAt!: string;
}
