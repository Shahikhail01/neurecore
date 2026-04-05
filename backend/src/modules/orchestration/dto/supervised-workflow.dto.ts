import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

export class SupervisedWorkflowDto {
  @IsUUID()
  supervisorId!: string;

  @IsArray()
  @IsUUID('4', { each: true })
  workerIds!: string[];

  @IsString()
  goalDescription!: string;

  @IsOptional()
  @IsString()
  tenantId?: string;
}
