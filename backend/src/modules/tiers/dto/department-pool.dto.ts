import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';
import { SlotType } from './pool-provisioning.dto';

export class CreateDepartmentPoolSlotDto {
  @IsUUID()
  departmentTemplateId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  slot?: number;

  @IsEnum(SlotType)
  slotType!: SlotType;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefaultSelected?: boolean;
}

export class UpdateDepartmentPoolSlotDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  slot?: number;

  @IsOptional()
  @IsEnum(SlotType)
  slotType?: SlotType;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefaultSelected?: boolean;
}

export class ReorderDepartmentPoolDto {
  @IsUUID('4', { each: true })
  orderedIds!: string[];
}
