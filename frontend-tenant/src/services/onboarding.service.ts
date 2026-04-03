/**
 * Onboarding API Service
 * Handles all API calls to the onboarding backend
 * Following SOLID principles with single responsibility per method
 */

import type {
  StartOnboardingDto,
  StartOnboardingResponse,
  UpdateOrganizationDto,
  UpdateAdminDto,
  SelectPlanDto,
  GetPlansResponse,
  CreateDepartmentsDto,
  CreateDepartmentsResponse,
  InviteUsersDto,
  InviteUsersResponse,
  AddIntegrationDto,
  AddIntegrationResponse,
  GetAgentTemplatesResponse,
  ConfigureAgentsDto,
  ConfigureAgentsResponse,
  UpdateSecurityDto,
  CompleteWizardDto,
  CompleteWizardResponse,
  WizardStateResponse,
} from "@/types/onboarding.types";
import { tokenManager } from "@/core/infrastructure/auth/TokenManager";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

/**
 * Single Responsibility: Each function handles one API call
 * Open/Closed: Easy to extend with new endpoints
 */
class OnboardingApiService {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    // Attach JWT if available — all wizard step endpoints are JWT-guarded globally
    const token = tokenManager.getAccessToken();
    const authHeader: Record<string, string> = token
      ? { Authorization: `Bearer ${token}` }
      : {};

    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...authHeader,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const body = await response
        .json()
        .catch(() => ({ message: "Request failed" }));
      // Backend wraps errors as { error: { message } } or { message }
      const msg =
        body?.error?.message ||
        (Array.isArray(body?.message) ? body.message[0] : body?.message) ||
        `HTTP ${response.status}`;
      throw new Error(msg);
    }

    const json = await response.json();
    // Unwrap the API envelope { status: "success", data: { ... }, meta }
    return (json?.data ?? json) as T;
  }

  // ============================================================================
  // Step 1: Start Onboarding
  // ============================================================================

  async startOnboarding(
    dto: StartOnboardingDto,
  ): Promise<StartOnboardingResponse> {
    return this.request<StartOnboardingResponse>("/onboarding/start", {
      method: "POST",
      body: JSON.stringify(dto),
    });
  }

  async startAuthenticatedWizard(
    accessToken: string,
  ): Promise<StartOnboardingResponse> {
    return this.request<StartOnboardingResponse>(
      "/onboarding/start-authenticated",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
  }

  async getWizardState(wizardId: string): Promise<WizardStateResponse> {
    return this.request<WizardStateResponse>(`/onboarding/state/${wizardId}`);
  }

  // ============================================================================
  // Step 2: Organization
  // ============================================================================

  async updateOrganization(
    dto: UpdateOrganizationDto,
  ): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>("/onboarding/organization", {
      method: "PUT",
      body: JSON.stringify(dto),
    });
  }

  // ============================================================================
  // Step 3: Admin
  // ============================================================================

  async updateAdmin(dto: UpdateAdminDto): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>("/onboarding/admin", {
      method: "PUT",
      body: JSON.stringify(dto),
    });
  }

  // ============================================================================
  // Step 4: Plan
  // ============================================================================

  async getPlans(): Promise<GetPlansResponse> {
    return this.request<GetPlansResponse>("/onboarding/plans");
  }

  async selectPlan(dto: SelectPlanDto): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>("/onboarding/plan", {
      method: "PUT",
      body: JSON.stringify(dto),
    });
  }

  // ============================================================================
  // Step 5: Departments
  // ============================================================================

  async createDepartments(
    dto: CreateDepartmentsDto,
  ): Promise<CreateDepartmentsResponse> {
    return this.request<CreateDepartmentsResponse>("/onboarding/departments", {
      method: "POST",
      body: JSON.stringify(dto),
    });
  }

  // ============================================================================
  // Step 6: Team
  // ============================================================================

  async inviteUsers(dto: InviteUsersDto): Promise<InviteUsersResponse> {
    return this.request<InviteUsersResponse>("/onboarding/invitations", {
      method: "POST",
      body: JSON.stringify(dto),
    });
  }

  // ============================================================================
  // Step 7: Integrations
  // ============================================================================

  async addIntegration(
    dto: AddIntegrationDto,
  ): Promise<AddIntegrationResponse> {
    return this.request<AddIntegrationResponse>("/onboarding/integrations", {
      method: "POST",
      body: JSON.stringify(dto),
    });
  }

  // ============================================================================
  // Step 8: Agents
  // ============================================================================

  async getAgentTemplates(): Promise<GetAgentTemplatesResponse> {
    return this.request<GetAgentTemplatesResponse>(
      "/onboarding/agent-templates",
    );
  }

  async configureAgents(
    dto: ConfigureAgentsDto,
  ): Promise<ConfigureAgentsResponse> {
    return this.request<ConfigureAgentsResponse>("/onboarding/agents", {
      method: "POST",
      body: JSON.stringify(dto),
    });
  }

  // ============================================================================
  // Step 9: Security
  // ============================================================================

  async updateSecurity(dto: UpdateSecurityDto): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>("/onboarding/security", {
      method: "PUT",
      body: JSON.stringify(dto),
    });
  }

  // ============================================================================
  // Step 10: Complete
  // ============================================================================

  async completeWizard(
    dto: CompleteWizardDto,
  ): Promise<CompleteWizardResponse> {
    return this.request<CompleteWizardResponse>("/onboarding/complete", {
      method: "POST",
      body: JSON.stringify(dto),
    });
  }

  // ============================================================================
  // Progress
  // ============================================================================

  async getProgress(wizardId: string): Promise<WizardStateResponse> {
    return this.request<WizardStateResponse>(
      `/onboarding/progress/${wizardId}`,
    );
  }
}

// Export singleton instance
export const onboardingApi = new OnboardingApiService();
