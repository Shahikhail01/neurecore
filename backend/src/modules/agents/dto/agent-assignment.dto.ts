import { IsUUID } from 'class-validator';

export class AssignAgentDepartmentDto {
  @IsUUID()
  departmentId!: string;
}

export class AssignAgentTierSlotDto {
  @IsUUID()
  slotId!: string;
}
