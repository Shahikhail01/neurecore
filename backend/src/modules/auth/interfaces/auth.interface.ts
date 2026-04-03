import { UserRole } from '@prisma/client';
import { TokenPair } from './token.interface';

// Dependency Inversion: controllers/guards depend on this abstraction
export interface IAuthService {
  register(data: RegisterInput): Promise<AuthResult>;
  login(
    email: string,
    password: string,
    meta: RequestMeta,
  ): Promise<AuthResult>;
  refresh(refreshToken: string): Promise<TokenPair>;
  logout(userId: string, jti: string): Promise<void>;
  validateUser(email: string, password: string): Promise<ValidatedUser | null>;
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName?: string;
  role?: UserRole;
  tenantId?: string;
}

export interface AuthResult {
  user: ValidatedUser;
  tokens: TokenPair;
}

export interface ValidatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  tenantId: string | null;
  isActive: boolean;
}

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}
