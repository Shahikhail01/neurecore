import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  ValidateNested,
  ArrayMaxSize,
} from 'class-validator';

export class EmployeeRunContextDto {
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  taskId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  fileIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  threadId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  includeCapabilities?: string[];
}

export class EmployeeRunTriggerDto {
  @IsIn(['USER', 'TASK', 'SCHEDULE', 'EVENT', 'MISSION'])
  type!: 'USER' | 'TASK' | 'SCHEDULE' | 'EVENT' | 'MISSION';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  sourceId?: string;
}

export class StartEmployeeRunDto {
  @IsUUID()
  employeeId!: string;

  @IsString()
  @Length(1, 10_000)
  objective!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => EmployeeRunContextDto)
  context?: EmployeeRunContextDto;

  @ValidateNested()
  @Type(() => EmployeeRunTriggerDto)
  trigger!: EmployeeRunTriggerDto;

  @IsString()
  @Length(8, 200)
  idempotencyKey!: string;
}

export class CancelEmployeeRunDto {
  @IsString()
  @Length(1, 500)
  reason!: string;
}

export class ListEmployeeRunsQueryDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsIn([
    'CREATED',
    'PLANNING',
    'RUNNING',
    'WAITING_FOR_APPROVAL',
    'PAUSED',
    'COMPLETED',
    'FAILED',
    'CANCELLED',
  ])
  status?:
    | 'CREATED'
    | 'PLANNING'
    | 'RUNNING'
    | 'WAITING_FOR_APPROVAL'
    | 'PAUSED'
    | 'COMPLETED'
    | 'FAILED'
    | 'CANCELLED';

  @IsOptional()
  @IsUUID()
  taskId?: string;
}
