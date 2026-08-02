/**
 * command-center/dto/channel-health.dto.ts
 *
 * P8 Command Center — Channel Health view (CR-AI-1205).
 * Surfaces CRM/Channel connector status, OAuthToken freshness
 * and any per-channel failure rate. Reconciles to canonical
 * CrmConnector + OAuthToken sources.
 */

import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class ChannelHealthEntryDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  type!: string;

  @ApiProperty()
  @Expose()
  provider!: string;

  @ApiProperty()
  @Expose()
  status!: string;

  @ApiProperty({ description: 'Whether the connector is currently enabled' })
  @Expose()
  enabled!: boolean;

  @ApiProperty({
    nullable: true,
    description: 'Last successful auth expiry, if any',
  })
  @Expose()
  tokenExpiresAt!: string | null;

  @ApiProperty({
    description:
      'Recent failure rate (0-1) — derived from SecurityEvent matches',
  })
  @Expose()
  failureRate!: number;

  @ApiProperty({ enum: ['HEALTHY', 'DEGRADED', 'UNHEALTHY', 'UNKNOWN'] })
  @Expose()
  grade!: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'UNKNOWN';

  @ApiProperty()
  @Expose()
  source!: 'CrmConnector';
}

export class ChannelHealthResponseDto {
  @ApiProperty({ type: [ChannelHealthEntryDto] })
  @Expose()
  @Type(() => ChannelHealthEntryDto)
  channels!: ChannelHealthEntryDto[];

  @ApiProperty()
  @Expose()
  totalChannels!: number;

  @ApiProperty()
  @Expose()
  healthyChannels!: number;

  @ApiProperty()
  @Expose()
  degradedChannels!: number;

  @ApiProperty()
  @Expose()
  unhealthyChannels!: number;

  @ApiProperty()
  @Expose()
  tenantId!: string;

  @ApiProperty()
  @Expose()
  fetchedAt!: string;
}
