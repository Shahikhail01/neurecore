import api from './api';
import { unwrapItem, unwrapList } from './unwrap';

export interface HarnessDashboard {
  capabilities: number;
  runs: Array<{ state: string; _count: number }>;
  pendingApprovals: number;
  activeCertificates: number;
  activeWaivers: number;
  integrityIssues: number;
  replayBundles: number;
  activeRunPolicies: number;
}

export interface HarnessRun {
  id: string;
  capabilityId: string;
  scenarioId: string;
  environment: string;
  state: string;
  requestedBy: string;
  approvedBy?: string;
  destructive: boolean;
  outcome?: string;
  createdAt: string;
  _count?: { evidence: number };
}

export interface HarnessChangeVersion {
  id: string;
  kind: string;
  key: string;
  version: number;
  state: string;
  ownerId: string;
  createdBy: string;
  approvedBy?: string;
  createdAt: string;
}

export interface HarnessWaiver {
  id: string;
  capabilityId: string;
  scope: string;
  reason: string;
  compensatingControl: string;
  ownerId: string;
  requestedBy: string;
  approvedBy?: string;
  issueLink: string;
  state: string;
  expiresAt: string;
}

export interface HarnessCertificate {
  id: string;
  capabilityId: string;
  environment: string;
  state: string;
  verdict: string;
  evidenceHash: string;
  limitations: string[];
  issuedAt: string;
  expiresAt: string;
}

export interface HarnessEvidence {
  id: string;
  runId: string;
  tenantId: string | null;
  mediaType: string;
  classification: string;
  storageRef: string;
  checksum: string;
  previousHash: string | null;
  redacted: boolean;
  retentionClass: string;
  createdAt: string;
}

export interface HarnessAuditEvent {
  id: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  tenantId: string | null;
  result: string;
  previousHash: string | null;
  eventHash: string;
  createdAt: string;
}

export interface HarnessReplayBundle {
  id: string;
  sourceRunId: string;
  environment: string;
  externalSideEffects: boolean;
  schemaVersion: string;
  checksum: string;
  createdAt: string;
}

export const harnessControlService = {
  async dashboard(): Promise<HarnessDashboard> {
    return unwrapItem(await api.get('/harness-control/dashboard'));
  },
  async runs(): Promise<HarnessRun[]> {
    return unwrapList<HarnessRun>(await api.get('/harness-control/runs')).items;
  },
  async approveRun(id: string): Promise<HarnessRun> {
    return unwrapItem(await api.post(`/harness-control/runs/${id}/approve`));
  },
  async cancelRun(id: string): Promise<HarnessRun> {
    return unwrapItem(await api.post(`/harness-control/runs/${id}/cancel`));
  },
  async evidence(id: string): Promise<HarnessEvidence> {
    return unwrapItem(await api.get(`/harness-control/evidence/${id}`));
  },
  async changes(): Promise<HarnessChangeVersion[]> {
    return unwrapList<HarnessChangeVersion>(
      await api.get('/harness-control/changes'),
    ).items;
  },
  async waivers(): Promise<HarnessWaiver[]> {
    return unwrapList<HarnessWaiver>(
      await api.get('/harness-control/waivers'),
    ).items;
  },
  async approveWaiver(id: string): Promise<HarnessWaiver> {
    return unwrapItem(await api.post(`/harness-control/waivers/${id}/approve`));
  },
  async revokeWaiver(id: string, reason: string): Promise<HarnessWaiver> {
    return unwrapItem(
      await api.post(`/harness-control/waivers/${id}/revoke`, { reason }),
    );
  },
  async certificates(): Promise<HarnessCertificate[]> {
    return unwrapList<HarnessCertificate>(
      await api.get('/harness-control/certificates'),
    ).items;
  },
  async revokeCertificate(id: string, reason: string): Promise<HarnessCertificate> {
    return unwrapItem(
      await api.post(`/harness-control/certificates/${id}/revoke`, { reason }),
    );
  },
  async audit(): Promise<HarnessAuditEvent[]> {
    return unwrapList<HarnessAuditEvent>(
      await api.get('/harness-control/audit'),
    ).items;
  },
  async verifyAudit(): Promise<{ ok: boolean; brokenAt?: string; checked: number }> {
    return unwrapItem(await api.get('/harness-control/audit/verify'));
  },
  async replayBundles(): Promise<HarnessReplayBundle[]> {
    return unwrapList<HarnessReplayBundle>(
      await api.get('/harness-control/replay'),
    ).items;
  },
  async executeReplay(bundleId: string): Promise<{ id: string; state: string }> {
    return unwrapItem(
      await api.post(`/harness-control/replay/${bundleId}/execute`),
    );
  },
};
