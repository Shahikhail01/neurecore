/**
 * Sim05Module — wires the Sim-05 service + controller + AccountingModule.
 *
 * Plan ref: NC-SIM05-IMP-2.
 */

import { Module } from '@nestjs/common';
import { Sim05Service } from './sim05.service';
import { Sim05Controller } from './sim05.controller';
import { AccountingModule } from '../../modules/accounting/accounting.module';

@Module({
  imports: [AccountingModule],
  controllers: [Sim05Controller],
  providers: [Sim05Service],
  exports: [Sim05Service],
})
export class Sim05Module {}