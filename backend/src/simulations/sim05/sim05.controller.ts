/**
 * Sim05Controller — exposes Sim-05 training scenario metadata and the
 * run-compute-step endpoint.
 *
 * Plan ref: NC-SIM05-IMP-2.
 */

import { Controller, Get, Post, Param, ParseIntPipe, Query, UseGuards, Body } from '@nestjs/common';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { Sim05Service } from './sim05.service';
import type { Sim05Category } from './sim05-scenarios';

@UseGuards(JwtAuthGuard)
@Controller({ path: 'sim05', version: '1' })
export class Sim05Controller {
  constructor(private readonly sim05: Sim05Service) {}

  @Get('scenarios')
  list(@Query('category') category?: Sim05Category) {
    // Note: NestJS global response interceptor wraps return values in
    // `{ status, data }`, so we return the inner payload directly to
    // avoid double-wrapping (`{ data: { data: ... } }`).
    if (category) return { scenarios: this.sim05.listByCategory(category) };
    return { scenarios: this.sim05.list() };
  }

  @Get('scenarios/:id')
  get(@Param('id', new ParseIntPipe()) id: number) {
    return { scenario: this.sim05.get(id) };
  }

  @Post('scenarios/:id/run-compute-step')
  async run(
    @Param('id', new ParseIntPipe()) id: number,
    @Body() body: { tenantId: string; userId: string; dataset: Record<string, unknown> },
  ) {
    if (!body?.tenantId || !body?.userId) {
      return { status: 'error', error: 'tenantId and userId required' };
    }
    const result = await this.sim05.runComputeStep(
      body.tenantId, body.userId, id, body.dataset ?? {},
    );
    return { data: result };
  }
}