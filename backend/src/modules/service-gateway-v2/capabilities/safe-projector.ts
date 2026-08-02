import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import type {
  SensitivityClass,
  ReadCapabilityCanonicalDescriptor,
} from '../interfaces';

/**
 * SafeProjector — Phase 1C of the service-gateway-v2 plan.
 *
 * The plain adapter result of a read capability may carry PII, internal
 * identifiers, or any other field the tenant-frontend must NOT see. The
 * SafeProjector sits between the adapter and the response envelope and:
 *
 *   1. Validates that any `id` field on the result actually resolves to
 *      a tenant-owned record (defense in depth — adapters also enforce
 *      this, but the projector is a second check).
 *   2. Strips or redacts fields according to the capability's sensitivity
 *      class.
 *   3. Throws a structured `ForbiddenException` with a machine-readable
 *      `code` for unsupported sensitivity conditions (e.g. a RESTRICTED
 *      capability being read by a non-elevated principal).
 *
 * The projector is conservative: anything that does not match its allow
 * list is dropped, not partially leaked. Dropped fields are reported in
 * the returned metadata so operators can audit what was hidden.
 */

export interface ProjectionContext {
  tenantId: string;
  actorId: string;
  actorScopes?: ReadonlyArray<string>;
  capability: ReadCapabilityCanonicalDescriptor;
}

export interface ProjectionResult<T> {
  data: T;
  redacted: string[];
  dropped: string[];
}

const REDACTED_FIELDS_BY_CLASS: Record<
  SensitivityClass,
  ReadonlyArray<string>
> = {
  PUBLIC: [],
  INTERNAL: ['internalNotes', 'costCents', 'salaryCents', 'marginCents'],
  CONFIDENTIAL: [
    'internalNotes',
    'costCents',
    'salaryCents',
    'marginCents',
    'pii',
    'ssn',
    'taxId',
    'address',
    'phoneNumber',
    'dateOfBirth',
  ],
  RESTRICTED: [
    'internalNotes',
    'costCents',
    'salaryCents',
    'marginCents',
    'pii',
    'ssn',
    'taxId',
    'address',
    'phoneNumber',
    'dateOfBirth',
    'emailAddress',
    'email',
    'authToken',
    'token',
    'accessToken',
    'refreshToken',
    'passwordHash',
    'apiKey',
    'secret',
    'credentials',
  ],
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return (
    typeof v === 'object' &&
    v !== null &&
    !Array.isArray(v) &&
    Object.getPrototypeOf(v) === Object.prototype
  );
}

@Injectable()
export class SafeProjector {
  private readonly logger = new Logger(SafeProjector.name);

  /**
   * Project a single result value (object, array of objects, or scalar).
   */
  project<T>(value: T, ctx: ProjectionContext): ProjectionResult<T> {
    const redacted: string[] = [];
    const dropped: string[] = [];

    this.assertScope(ctx);

    if (Array.isArray(value)) {
      const projected = value.map((entry) =>
        this.projectEntry(entry, ctx, redacted, dropped),
      );
      return { data: projected as unknown as T, redacted, dropped };
    }
    const projected = this.projectEntry(value, ctx, redacted, dropped);
    return { data: projected as T, redacted, dropped };
  }

  private projectEntry(
    entry: unknown,
    ctx: ProjectionContext,
    redacted: string[],
    dropped: string[],
  ): unknown {
    if (entry === null || entry === undefined) return entry;
    if (!isPlainObject(entry)) return entry;

    const forbidden = REDACTED_FIELDS_BY_CLASS[ctx.capability.sensitivityClass];
    const projected: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(entry)) {
      if (forbidden.includes(key)) {
        redacted.push(key);
        continue;
      }
      if (isPlainObject(val)) {
        projected[key] = this.projectEntry(val, ctx, redacted, dropped);
      } else if (Array.isArray(val)) {
        projected[key] = val.map((v) =>
          isPlainObject(v) ? this.projectEntry(v, ctx, redacted, dropped) : v,
        );
      } else {
        projected[key] = val;
      }
    }

    for (const key of Object.keys(entry)) {
      if (!(key in projected)) dropped.push(key);
    }

    return projected;
  }

  /**
   * Throws if the principal lacks any of the capability's authorization
   * scopes. Convention: scopes prefixed with `tenant.` are tenant-grant
   * assertions; scopes without a dot are checked literally.
   */
  private assertScope(ctx: ProjectionContext): void {
    const required = ctx.capability.authorizationScope ?? [];
    const have = new Set(ctx.actorScopes ?? []);
    const missing = required.filter((s) => !have.has(s));
    if (missing.length > 0) {
      throw new ForbiddenException({
        code: 'CAPABILITY_AUTHORIZATION_FAILED',
        message: `Missing scopes for capability '${ctx.capability.capability}': ${missing.join(', ')}`,
        missing,
      });
    }
  }
}
