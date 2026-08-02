/**
 * command-center/dto/kill-switch.dto.ts
 *
 * P8 Command Center — Kill Switch view (CR-AI-1207).
 * Surfaces the canonical Service Gateway v2 flag matrix plus
 * per-tenant overrides. Toggle mutations are recorded to
 * AuditLog so the dashboard has a tamper-evident trail.
 */

import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export type KillSwitchScope =
  | 'process'
  | 'phase'
  | 'channel'
  | 'tenant-feature';

export class KillSwitchEntryDto {
  @ApiProperty({
    enum: ['process', 'phase', 'channel', 'tenant-feature'],
  })
  @Expose()
  scope!: KillSwitchScope;

  @ApiProperty({ description: 'Phase / channel / feature name' })
  @Expose()
  target!: string;

  @ApiProperty()
  @Expose()
  enabled!: boolean;

  @ApiProperty({ description: 'Process-wide kill switch' })
  @Expose()
  processEnabled!: boolean;

  @ApiProperty({ description: 'Last update (ISO 8601)' })
  @Expose()
  updatedAt!: string;
}

export class KillSwitchListResponseDto {
  @ApiProperty({ type: [KillSwitchEntryDto] })
  @Expose()
  entries!: KillSwitchEntryDto[];

  @ApiProperty()
  @Expose()
  processEnabled!: boolean;

  @ApiProperty({ type: 'object', additionalProperties: true })
  @Expose()
  overrides!: Record<string, boolean>;

  @ApiProperty()
  @Expose()
  tenantId!: string;

  @ApiProperty()
  @Expose()
  fetchedAt!: string;
}

export class SetKillSwitchDto {
  @ApiProperty({
    enum: ['process', 'phase', 'channel', 'tenant-feature'],
  })
  scope!: KillSwitchScope;

  @ApiProperty({
    description:
      'Phase / channel / feature sub-key. Required for non-process scopes.',
  })
  target?: string;

  @ApiProperty()
  enabled!: boolean;

  @ApiProperty({ description: 'Operator reason for the toggle' })
  reason!: string;
}

export class SetKillSwitchResponseDto {
  @ApiProperty()
  @Expose()
  scope!: KillSwitchScope;

  @ApiProperty({ nullable: true })
  @Expose()
  target!: string | null;

  @ApiProperty()
  @Expose()
  enabled!: boolean;

  @ApiProperty()
  @Expose()
  appliedAt!: string;

  @ApiProperty()
  @Expose()
  auditLogId!: string;
}
