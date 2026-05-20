import { IsUUID } from 'class-validator';

export class AssignDepartmentParentDto {
  @IsUUID()
  parentId!: string;
}

export class AssignDepartmentTierSlotDto {
  @IsUUID()
  slotId!: string;
}
