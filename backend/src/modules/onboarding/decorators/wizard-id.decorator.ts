/**
 * Wizard ID Decorator
 * Extracts and validates wizard ID from headers or params
 */

import {
  createParamDecorator,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';

export const WizardId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();

    // Try to get from header first (x-wizard-id)
    let wizardId = request.headers['x-wizard-id'] as string;

    // Then try from query param
    if (!wizardId) {
      wizardId = request.query['wizardId'] as string;
    }

    // Then try from body
    if (!wizardId && request.body?.wizardId) {
      wizardId = request.body.wizardId;
    }

    if (!wizardId) {
      throw new BadRequestException(
        'Wizard ID is required. Provide it via x-wizard-id header, query param, or body.',
      );
    }

    // Validate wizard ID format
    if (!wizardId.startsWith('wiz_')) {
      throw new BadRequestException('Invalid wizard ID format');
    }

    return wizardId;
  },
);
