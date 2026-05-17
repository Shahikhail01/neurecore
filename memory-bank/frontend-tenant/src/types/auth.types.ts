// -------------------------------------------------------
// Types mirrored from API spec — never import from backend
// -------------------------------------------------------

export type UserRole =
  | "SUPER_ADMIN"
  | "PLATFORM_ADMIN"
  | "SECURITY_OFFICER"
  | "SUPPORT"
  | "OWNER"
  | "ADMIN"
  | "USER"
  | "AUDITOR";

export interface TenantProfile {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  industry?: string | null;
  tier?: {
    id: string;
    name: string;
    slug: string;
    maxAgents: number;
    maxUsers: number;
  };
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  tenantId: string | null;
  isActive: boolean;
  tenant?: TenantProfile | null;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResult {
  user: AuthUser;
  tokens: TokenPair;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  firstName: string;
  lastName?: string;
  tenantId?: string;
}
