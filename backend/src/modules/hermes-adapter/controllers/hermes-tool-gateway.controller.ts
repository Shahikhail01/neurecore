import { Body, Controller, Headers, Param, Post, UnauthorizedException } from '@nestjs/common';
import { Public } from '../../../common/decorators/roles.decorator';
import { HermesTokenError, HermesTokenService } from '../services/token.service';
import { ScopedToolGatewayService, type ToolGatewayResult } from '../tools/scoped-tool-gateway.service';

@Controller({ path: 'hermes-adapter/executions/:executionId/tools', version: '1' })
@Public()
export class HermesToolGatewayController {
  constructor(private readonly tokens: HermesTokenService, private readonly tools: ScopedToolGatewayService) {}

  @Post(':toolName')
  async execute(
    @Param('executionId') executionId: string,
    @Param('toolName') toolName: string,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: { arguments?: unknown; approvedApprovalId?: string },
  ): Promise<ToolGatewayResult> {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
    try {
      const claims = this.tokens.verify(token);
      if (claims.executionId !== executionId) throw new UnauthorizedException('Execution scope mismatch');
      return this.tools.execute(toolName, body.arguments ?? {}, claims, body.approvedApprovalId);
    } catch (error) {
      if (error instanceof HermesTokenError) throw new UnauthorizedException(error.message);
      throw error;
    }
  }
}
