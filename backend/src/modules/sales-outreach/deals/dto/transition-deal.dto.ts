/**
 * DTO for Deal state transitions. Separate endpoint enforces the
 * transition matrix (LEAD→QUALIFIED→PROPOSAL→NEGOTIATION→WON/LOST;
 * any→LOST).
 */

import { IsIn, IsOptional, IsString, Length } from 'class-validator';

export class TransitionDealDto {
  @IsIn(['LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'])
  toStage!: 'LEAD' | 'QUALIFIED' | 'PROPOSAL' | 'NEGOTIATION' | 'WON' | 'LOST';

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  reason?: string;
}
