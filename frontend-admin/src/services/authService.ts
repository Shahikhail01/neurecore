/**
 * Authentication Service
 * Calls to Phase 2 JWT backend (/api/v1/auth/*)
 * Handles token refresh, login, logout, registration
 */

import axios, { AxiosInstance } from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const AUTH_ENDPOINT = `${API_BASE_URL}/api/v1/auth`;

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    role: string;
    tenantId: string;
  };
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  tenantId: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface ResetPasswordRequest {
  resetToken: string;
  newPassword: string;
}

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

class AuthService {
  private axiosInstance: AxiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: AUTH_ENDPOINT,
      withCredentials: true, // For httpOnly cookie refresh token
    });
  }

  /**
   * Login with email and password
   */
  async login(request: LoginRequest): Promise<LoginResponse> {
    try {
      const response = await this.axiosInstance.post<LoginResponse>(
        "/login",
        request,
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Register new user
   */
  async register(request: RegisterRequest): Promise<LoginResponse> {
    try {
      const response = await this.axiosInstance.post<LoginResponse>(
        "/register",
        request,
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<LoginResponse> {
    try {
      const response = await this.axiosInstance.post<LoginResponse>(
        "/refresh",
        {
          refreshToken,
        },
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Logout - revoke all refresh tokens
   */
  async logout(accessToken: string): Promise<void> {
    try {
      await this.axiosInstance.post(
        "/logout",
        {},
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Request password reset email
   */
  async requestPasswordReset(email: string): Promise<{ message: string }> {
    try {
      const response = await this.axiosInstance.post("/forgot-password", {
        email,
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(
    request: ResetPasswordRequest,
  ): Promise<{ message: string }> {
    try {
      const response = await this.axiosInstance.post(
        "/reset-password",
        request,
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Change password (authenticated)
   */
  async changePassword(
    request: ChangePasswordRequest,
    accessToken: string,
  ): Promise<{ message: string }> {
    try {
      const response = await this.axiosInstance.post(
        "/change-password",
        request,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get current user
   */
  async getCurrentUser(accessToken: string): Promise<any> {
    try {
      const response = await this.axiosInstance.get("/me", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Health check
   */
  async health(): Promise<{ status: string }> {
    try {
      const response = await this.axiosInstance.get("/health");
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Handle API errors
   */
  private handleError(error: any) {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message || "An error occurred";

      switch (status) {
        case 400:
          return new Error(`Validation error: ${message}`);
        case 401:
          return new Error("Invalid credentials");
        case 409:
          return new Error(`Already exists: ${message}`);
        case 500:
          return new Error("Server error. Please try again later.");
        default:
          return new Error(message);
      }
    }

    if (error.request) {
      return new Error(
        "No response from server. Please check your connection.",
      );
    }

    return error;
  }
}

export default new AuthService();
