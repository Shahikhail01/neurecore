import { KnowledgeSourceType } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateKnowledgeSpaceDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;
}

export class AddDocumentDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsString()
  content!: string;

  @IsOptional()
  @IsEnum(KnowledgeSourceType)
  sourceType?: KnowledgeSourceType;

  @IsOptional()
  @IsString()
  sourceUrl?: string;
}

export class GrantAccessDto {
  @IsUUID()
  agentId!: string;
}

export class SearchDocumentsDto {
  @IsString()
  query!: string;

  @IsOptional()
  @IsString()
  limit?: string;
}
