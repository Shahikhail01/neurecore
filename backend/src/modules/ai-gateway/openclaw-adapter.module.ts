/**
 * OpenClawAdapterModule
 *
 * Wires the inbound webhook controller (channel adapter) without mixing
 * channel infrastructure with business / AI reasoning logic.
 *
 * SOLID:
 *   SRP  — this module is concerned only with the OpenClaw channel entry-point.
 *   OCP  — adding more channel adapters (Slack, WhatsApp …) means new modules
 *          alongside this one; no changes here.
 *   DIP  — depends on AgentsModule exports (AgentExecutorService abstraction)
 *          and DatabaseModule (PrismaService global).
 */
import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module';
import { OpenClawWebhookController } from './openclaw.controller';

@Module({
  imports: [AgentsModule],
  controllers: [OpenClawWebhookController],
})
export class OpenClawAdapterModule {}
