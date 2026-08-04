/**
 * Coding Agent SDK Bridge — Module.
 */

import { Module } from '@nestjs/common';
import { CodingAgentSdkBridgeService } from './coding-agent-sdk-bridge.service';
import { CodingAgentSdkBridgeController } from './coding-agent-sdk-bridge.controller';

@Module({
  controllers: [CodingAgentSdkBridgeController],
  providers: [CodingAgentSdkBridgeService],
  exports: [CodingAgentSdkBridgeService],
})
export class CodingAgentSdkBridgeModule {}
