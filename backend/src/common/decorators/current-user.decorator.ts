import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '@prisma/client';

// Extracts the authenticated user (or a specific property) from the request.
// Usage: @CurrentUser() user: User
//        @CurrentUser('tenantId') tenantId: string
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext): User | unknown => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as Record<string, unknown>;
    return data ? user?.[data] : user;
  },
);
