'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import type { AuthUser } from '@/types/auth.types';

const ADMIN_ROLES = ['SUPER_ADMIN', 'PLATFORM_ADMIN', 'SECURITY_OFFICER', 'SUPPORT'];

export function useAdminAuth(): AuthUser | null {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  useEffect(() => {
    if (!user || !ADMIN_ROLES.includes(user.role)) {
      router.replace('/login');
    }
  }, [user, router]);

  return user && ADMIN_ROLES.includes(user.role) ? user : null;
}
