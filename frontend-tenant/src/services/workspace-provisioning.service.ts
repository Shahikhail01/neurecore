/**
 * WorkspaceProvisioningService
 * Handles all API communication for workspace provisioning endpoints.
 * Triple-fallback extraction pattern matches TransformResponseInterceptor envelope.
 */
import api from "./api";
import type {
  ProvisioningStatusDto,
  ProvisioningJobDto,
  WorkspaceProvisioningConfig,
} from "@/types/onboarding.types";

function unwrap<T>(res: { data: unknown }): T {
  const payload =
    (res.data as { data?: { data?: T } })?.data?.data ??
    (res.data as { data?: T })?.data ??
    (res.data as T);
  return payload as T;
}

class WorkspaceProvisioningService {
  /** GET /workspace-provisioning/status */
  async getStatus(): Promise<ProvisioningStatusDto> {
    const res = await api.get("/workspace-provisioning/status");
    return unwrap<ProvisioningStatusDto>(res);
  }

  /** GET /workspace-provisioning/config */
  async getConfig(): Promise<WorkspaceProvisioningConfig | null> {
    const res = await api.get("/workspace-provisioning/config");
    return unwrap<WorkspaceProvisioningConfig | null>(res);
  }

  /**
   * PUT /workspace-provisioning/configure
   * Creates or updates provisioning config without going through the wizard.
   */
  async configure(
    data: Omit<WorkspaceProvisioningConfig, "enabled">,
  ): Promise<WorkspaceProvisioningConfig> {
    const res = await api.put("/workspace-provisioning/configure", data);
    return unwrap<WorkspaceProvisioningConfig>(res);
  }

  /**
   * DELETE /workspace-provisioning/disconnect
   * Clears OAuth tokens and resets status to PENDING_CONNECT.
   */
  async disconnect(): Promise<void> {
    await api.delete("/workspace-provisioning/disconnect");
  }

  /** GET /workspace-provisioning/oauth/google/authorize */
  async getGoogleAuthUrl(): Promise<string> {
    const res = await api.get("/workspace-provisioning/oauth/google/authorize");
    const data = unwrap<{ authUrl: string }>(res);
    return data.authUrl;
  }

  /** GET /workspace-provisioning/oauth/microsoft/authorize */
  async getMicrosoftAuthUrl(): Promise<string> {
    const res = await api.get(
      "/workspace-provisioning/oauth/microsoft/authorize",
    );
    const data = unwrap<{ authUrl: string }>(res);
    return data.authUrl;
  }

  /** POST /workspace-provisioning/trigger */
  async triggerProvisioning(): Promise<{ queued: number }> {
    const res = await api.post("/workspace-provisioning/trigger");
    return unwrap<{ queued: number }>(res);
  }

  /** GET /workspace-provisioning/jobs */
  async listJobs(): Promise<ProvisioningJobDto[]> {
    const res = await api.get("/workspace-provisioning/jobs");
    const payload = unwrap<
      ProvisioningJobDto[] | { data: ProvisioningJobDto[] }
    >(res);
    return Array.isArray(payload)
      ? payload
      : ((payload as { data: ProvisioningJobDto[] }).data ?? []);
  }
}

export const workspaceProvisioningService = new WorkspaceProvisioningService();
