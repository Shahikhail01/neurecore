import { IsString, IsOptional, IsEnum, IsUUID } from 'class-validator';
import { DepartmentStatus } from '@prisma/client';

export class CreateDepartmentDto {
  @IsOptional() @IsUUID() tenantId?: string;
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(DepartmentStatus) status?: DepartmentStatus;
  @IsOptional() @IsUUID() headAgentId?: string;
  @IsOptional() @IsUUID() parentId?: string;
  @IsOptional() @IsUUID() tierDepartmentPoolId?: string;
  @IsOptional() @IsUUID() templateId?: string;
  @IsOptional() @IsUUID() deployedFromTierId?: string;
  @IsOptional() isFixed?: boolean;
  @IsOptional() isSelected?: boolean;
}

export class UpdateDepartmentDto {
  @IsOptional() @IsUUID() tenantId?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(DepartmentStatus) status?: DepartmentStatus;
  @IsOptional() @IsUUID() headAgentId?: string;
  @IsOptional() @IsUUID() parentId?: string;
  @IsOptional() @IsUUID() tierDepartmentPoolId?: string;
  @IsOptional() @IsUUID() templateId?: string;
  @IsOptional() @IsUUID() deployedFromTierId?: string;
  @IsOptional() isFixed?: boolean;
  @IsOptional() isSelected?: boolean;
}
