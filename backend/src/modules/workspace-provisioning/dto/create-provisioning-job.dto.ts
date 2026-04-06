import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateProvisioningJobDto {
  @IsEmail()
  inviteeEmail!: string;

  @IsString()
  @IsNotEmpty()
  inviteeFirstName!: string;

  @IsString()
  @IsNotEmpty()
  inviteeLastName!: string;

  @IsString()
  @IsOptional()
  departmentName?: string;
}

export class BulkCreateProvisioningJobsDto {
  @IsNotEmpty()
  members!: CreateProvisioningJobDto[];
}
