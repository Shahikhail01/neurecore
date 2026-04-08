/**
 * Tenant Middleware
 * Enforces multi-tenancy isolation on all requests
 * SOLID: Single Responsibility - Tenant extraction & validation
 *
 * @author NeureCore Development
 * @version 1.0.0
 * @date 2026-04-07
 */

import {
  Injectable,
  NestMiddleware,
  BadRequestException,
} from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { JwtPayload } from '../services/auth.service';

/**
 * Extended request with tenant context
 */
declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
      user?: JwtPayload;
    }
  }
}

/**
 * TenantMiddleware - Extracts and validates tenant context
 * Must run AFTER JwtAuthGuard (requires user in request)
 *
 * Flow:
 * 1. Extract tenantId from user JWT
 * 2. Validate tenantId in path (if provided) matches user's tenant
 * 3. Attach tenantId to request for subsequent middleware/controllers
 * 4. All database queries auto-filtered by tenantId
 *
 * SOLID:
 * - S: Only responsibility is tenant extraction
 * - O: Can extend with tenant-specific rules without changing
 * - L: Implements NestMiddleware interface
 * - I: Uses narrow interface (Request, Response, NextFunction)
 * - D: No dependencies needed (self-contained)
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // Skip if user not authenticated (public routes)
    if (!req.user) {
      return next();
    }

    const userTenantId = (req.user as JwtPayload).tenantId;
    const pathTenantId = this.extractTenantIdFromPath(req.path);

    // If tenant ID in path doesn't match user's tenant, reject
    if (pathTenantId && pathTenantId !== userTenantId) {
      throw new BadRequestException(
        'Tenant ID in path does not match authenticated user tenant',
      );
    }

    // Attach user's tenant ID to request
    req.tenantId = userTenantId;

    next();
  }

  /**
   * Extract tenantId from URL path if present
   * Expected formats:
   * - /tenants/:tenantId/agents
   * - /api/v1/tenants/:tenantId/tasks
   * @param path Request path
   * @returns Tenant ID or null
   */
  private extractTenantIdFromPath(path: string): string | null {
    const match = path.match(/\/tenants\/([^/]+)/);

    if (!match) {
      return null;
    }

    return match[1];
  }
}

/**
 * Alternative Tenant Extractor using headers
 * Some APIs pass tenant via X-Tenant-ID header
 */
@Injectable()
export class TenantHeaderMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    if (!req.user) {
      return next();
    }

    const headerTenantId = req.headers['x-tenant-id'] as string;
    const userTenantId = (req.user as JwtPayload).tenantId;

    // If header provided, verify it matches user's tenant
    if (headerTenantId && headerTenantId !== userTenantId) {
      throw new BadRequestException(
        'X-Tenant-ID header does not match authenticated user tenant',
      );
    }

    // Attach tenant ID from header or user
    req.tenantId = headerTenantId || userTenantId;

    next();
  }
}

/**
 * Tenant Validation Helper
 * Used in services/repositories to validate tenantId
 */
export class TenantValidator {
  /**
   * Validate that user belongs to tenant
   * @param userTenantId Tenant from JWT
   * @param requestedTenantId Tenant being accessed
   * @throws BadRequestException if tenant mismatch
   */
  static validateTenantAccess(
    userTenantId: string,
    requestedTenantId: string,
  ): void {
    if (userTenantId !== requestedTenantId) {
      throw new BadRequestException(
        'Access denied: You do not have access to this tenant',
      );
    }
  }

  /**
   * Filter query by tenant
   * Ensures all queries return only tenant's data
   * @param tenantId User's tenant
   * @param filters Existing filters
   * @returns Filters with tenantId added
   */
  static applyTenantFilter<T extends Record<string, any>>(
    tenantId: string,
    filters: T,
  ): T & { tenantId: string } {
    return {
      ...filters,
      tenantId,
    };
  }
}
