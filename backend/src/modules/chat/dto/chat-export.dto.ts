/**
 * Phase 15 — ChatExport DTO.
 *
 * Source plan: IMPLEMENTATION_PLAN_PHASE_15_18.md §5.
 */

import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsBoolean, IsIn, IsString } from 'class-validator';

export type ExportFormat = 'csv' | 'markdown' | 'json';

export class ChatExportRequestDto {
  @ApiProperty({ description: 'UUID of the conversation to export' })
  @IsString()
  @Expose()
  conversationId!: string;

  @ApiProperty({ enum: ['csv', 'markdown', 'json'], default: 'json' })
  @IsIn(['csv', 'markdown', 'json'])
  @Expose()
  format: ExportFormat = 'json';

  @ApiProperty({ description: 'Apply conservative PII redaction' })
  @IsBoolean()
  @Expose()
  redact: boolean = false;
}

export class ChatExportResponseDto {
  @ApiProperty({ description: 'Internal export id; download via /api/v1/chat/export/:id' })
  @Expose()
  exportId!: string;

  @ApiProperty()
  @Expose()
  byteSize!: number;

  @ApiProperty({ description: 'ISO-8601 timestamp; export auto-expires after retention window' })
  @Expose()
  expiresAt!: string;

  @ApiProperty()
  @Expose()
  redacted!: boolean;
}
