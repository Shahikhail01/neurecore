/**
 * WorkspaceProvisioningService
 * Handles all API communication for workspace provisioning endpoints.
 * Triple-fallback extraction pattern matches TransformResponseInterceptor envelope.
 */
import api from "./api";
import type {
  ProvisioningStatusDto,
  ProvisioningJobDto,
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
  async getConfig(): Promise<Record<string, unknown> | null> {
    const res = await api.get("/workspace-provisioning/config");
    return unwrap<Record<string, unknown> | null>(res);
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
