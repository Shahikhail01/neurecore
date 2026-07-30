import {
  Controller,
  Get,
  Headers,
  Param,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../../../common/decorators/roles.decorator';
import { AiGatewayService } from '../../ai-gateway/ai-gateway.service';
import { HermesTokenError, HermesTokenService } from '../services/token.service';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

@Controller({ path: 'hermes-adapter/executions/:executionId/model-lease', version: '1' })
@Public()
export class HermesModelLeaseController {
  constructor(
    private readonly tokens: HermesTokenService,
    private readonly aiGateway: AiGatewayService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async getLease(
    @Param('executionId') executionId: string,
    @Headers('authorization') authorization: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
    try {
      const claims = this.tokens.verify(token);
      if (claims.executionId !== executionId) {
        throw new UnauthorizedException('Execution scope mismatch');
      }
      const resolved = await this.aiGateway.select(claims.tenantId, 'tools', {
        preferSpeed: true,
      });
      const [projectTypes, agents] = await Promise.all([
        this.prisma.projectType.findMany({
          where: { tenantId: claims.tenantId },
          select: { id: true, name: true, slug: true },
          orderBy: { name: 'asc' },
          take: 25,
        }),
        this.prisma.agent.findMany({
          where: { tenantId: claims.tenantId, isActive: true },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
          take: 50,
        }),
      ]);
      response.setHeader('Cache-Control', 'no-store, private');
      return {
        provider: resolved.provider.slug,
        model: resolved.model.modelId,
        baseUrl: resolved.provider.apiBaseUrl,
        apiKey: resolved.apiKey,
        expiresAt: claims.exp * 1000,
        executionContext: {
          requestingUserId: claims.sub,
          projectTypes,
          agents,
        },
      };
    } catch (error) {
      if (error instanceof HermesTokenError) {
        throw new UnauthorizedException(error.message);
      }
      throw error;
    }
  }
}
