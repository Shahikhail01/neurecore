import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Optional JWT guard — authenticates when a valid Bearer token is present,
 * but does NOT throw an error when the token is missing or invalid.
 *
 * Use for endpoints that should work both anonymously and with auth context.
 * - Authenticated: `request.user` is populated with the JWT payload.
 * - Anonymous: `request.user` is undefined.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  // Override canActivate to attempt auth but never block the request.
  canActivate(context: ExecutionContext) {
    return super.canActivate(context) as any;
  }

  // Never throw — just return null user on any error.
  handleRequest(_err: unknown, user: unknown) {
    return user ?? null;
  }
}
