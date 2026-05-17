'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import type { AuthUser } from '@/types/auth.types';

/** Tenant roles that may access the portal */
const TENANT_ROLES = ['OWNER', 'ADMIN', 'USER', 'AUDITOR'];

/**
 * Guards all tenant portal pages.
 * Redirects to /login when unauthenticated or not a tenant-level role.
 * Returns the authenticated user, or null during redirect.
 */
export function useTenantAuth(): AuthUser | null {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  useEffect(() => {
    if (!user || !TENANT_ROLES.includes(user.role)) {
      router.replace('/login');
    }
  }, [user, router]);

  return user && TENANT_ROLES.includes(user.role) ? user : null;
}
