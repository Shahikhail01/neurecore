/**
 * command-center/dto/inventory.dto.ts
 *
 * P8 Command Center — Inventory view (CR-AI-1201).
 * Returns the tenant-scoped inventory of AI assets:
 *   agents, skills, models, knowledge sources, channels.
 *
 * Each entry carries provenance (source model + record id),
 * freshness (updatedAt) and tenant scope (tenantId) so the
 * dashboard can reconcile to canonical sources — never a
 * fabricated count.
 */

import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class InventoryAgentDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  name!: string;

  @ApiProperty()
  @Expose()
  status!: string;

  @ApiProperty()
  @Expose()
  model!: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  @Expose()
  departmentId!: string | null;

  @ApiProperty()
  @Expose()
  updatedAt!: string;

  @ApiProperty()
  @Expose()
  source!: 'Agent';
}

export class InventorySkillDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  name!: string;

  @ApiProperty()
  @Expose()
  slug!: string;

  @ApiProperty()
  @Expose()
  version!: string;

  @ApiProperty()
  @Expose()
  status!: string;

  @ApiProperty()
  @Expose()
  updatedAt!: string;

  @ApiProperty()
  @Expose()
  source!: 'AgentSkillDefinition';
}

export class InventoryModelDto {
  @ApiProperty()
  @Expose()
  model!: string;

  @ApiProperty()
  @Expose()
  provider!: string;

  @ApiProperty({
    description: 'Distinct agents using this model within the tenant',
  })
  @Expose()
  agentCount!: number;

  @ApiProperty()
  @Expose()
  source!: 'ExecutionAttempt';
}

export class InventoryKnowledgeSourceDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  name!: string;

  @ApiProperty()
  @Expose()
  kind!: string;

  @ApiProperty()
  @Expose()
  status!: string;

  @ApiProperty()
  @Expose()
  updatedAt!: string;

  @ApiProperty()
  @Expose()
  source!: 'KnowledgeEntry';
}

export class InventoryChannelDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  type!: string;

  @ApiProperty()
  @Expose()
  status!: string;

  @ApiProperty()
  @Expose()
  source!: 'CrmConnector';
}

export class InventoryResponseDto {
  @ApiProperty({ type: [InventoryAgentDto] })
  @Expose()
  @Type(() => InventoryAgentDto)
  agents!: InventoryAgentDto[];

  @ApiProperty({ type: [InventorySkillDto] })
  @Expose()
  @Type(() => InventorySkillDto)
  skills!: InventorySkillDto[];

  @ApiProperty({ type: [InventoryModelDto] })
  @Expose()
  @Type(() => InventoryModelDto)
  models!: InventoryModelDto[];

  @ApiProperty({ type: [InventoryKnowledgeSourceDto] })
  @Expose()
  @Type(() => InventoryKnowledgeSourceDto)
  knowledge!: InventoryKnowledgeSourceDto[];

  @ApiProperty({ type: [InventoryChannelDto] })
  @Expose()
  @Type(() => InventoryChannelDto)
  channels!: InventoryChannelDto[];

  @ApiProperty()
  @Expose()
  tenantId!: string;

  @ApiProperty()
  @Expose()
  fetchedAt!: string;
}
