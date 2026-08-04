#!/usr/bin/env npx ts-node --project tsconfig.json

/**
 * Phase 2 — Matrix row updater for compliance, governance, and DSR.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const MATRIX = path.resolve(
  REPO_ROOT,
  'neurecore/memory-bank-arc/comms/creatio-ai-parity-matrix.yaml',
);

interface RowUpdate {
  capability_id: string;
  status: 'DONE' | 'PARTIAL' | 'NOT_STARTED';
  neurecore_evidence: string;
  gap: string;
}

const UPDATES: RowUpdate[] = [
  {
    capability_id: 'CR-AI-5-4-8',
    status: 'PARTIAL',
    neurecore_evidence:
      'DsrService + DsrController expose the full state machine (OPEN → IN_PROGRESS → COMPLETED/REJECTED/CANCELLED). DsrAuditLog is append-only. Tenant DSR workflow admin page at /governance/dsr shipped.',
    gap:
      'Article 12(3) 30-day SLA timer + escalation webhook not yet shipped; tracked in Phase 3 backlog.',
  },
  {
    capability_id: 'CR-AI-5-4-11',
    status: 'DONE',
    neurecore_evidence:
      "Secure hosting options documented: Contabo private-cloud is the current production target. On-premise and hybrid are product-level decisions captured in v2 §5.4.11; the runtime tolerates any baseUrl on LlmProvider, so deployment topology is data, not code.",
    gap: 'On-prem install automation not yet documented.',
  },
  {
    capability_id: 'CR-AI-5-4-12',
    status: 'DONE',
    neurecore_evidence:
      'Per-tenant data isolation is enforced at every Phase 1 + 2 service boundary (see LlmRegistryService.assertRealTenantId, TwinPermissionMirrorGuard.assertCanExecute, DsrService, CompliancePostureService). The detect-wildcard-tenant-bypass.ts CI gate reports 19 sites — 0 unsafe, 19 explicit-deny.',
    gap: 'No known gap.',
  },
  {
    capability_id: 'CR-AI-5-14-1',
    status: 'PARTIAL',
    neurecore_evidence:
      'Governance app shell + 4 governance domains (data / user-access / operational / security) shipped. Admin page at /governance renders domain summary + seed action.',
    gap: 'Full environment-connect workflow is a follow-up (Phase 3); current code ships the local seed.',
  },
  {
    capability_id: 'CR-AI-5-14-2',
    status: 'DONE',
    neurecore_evidence:
      'GovernanceService defines 10 predefined controls across the 4 domains, each mapped to standards (SOC 2 / HIPAA / GDPR / ISO 27001 / EU AI Act) and severity. seedPredefinedControlsForTenant is idempotent.',
    gap: 'Custom-control authoring UI is a Phase 3 deliverable; current backend route is gated by service-layer audit.',
  },
  {
    capability_id: 'CR-AI-5-14-4',
    status: 'PARTIAL',
    neurecore_evidence:
      'Comprehensive audits (scheduled) — GovernanceControlEvaluation is append-only and the most recent run is read for domain summary.',
    gap: 'Scheduled runner (DAILY / WEEKLY / MONTHLY cadence) is a Phase 3 deliverable; ad-hoc evaluation works.',
  },
  {
    capability_id: 'CR-AI-5-14-6',
    status: 'PARTIAL',
    neurecore_evidence:
      'Data governance domain ships with 2 predefined controls (data-access-sensitive, data-deletion-receipt). DsrService is the GDPR surface; CompliancePostureService measures it.',
    gap: 'Sensitive-data auto-recognition is a Phase 3 deliverable.',
  },
  {
    capability_id: 'CR-AI-5-14-7',
    status: 'PARTIAL',
    neurecore_evidence:
      'User-access governance domain ships with 2 predefined controls (admin-role-justified, session-expiry-enforced). JWT auth context carries role/perm; the RolesGuard + Roles decorator enforce least-privilege on every Phase 1 + 2 route.',
    gap: 'Admin-permission least-privilege review tool is a Phase 3 deliverable.',
  },
  {
    capability_id: 'CR-AI-5-18-1',
    status: 'DONE',
    neurecore_evidence:
      'AICPA SOC compliance posture page at /compliance renders live posture derived from AuditLog + control evaluations. Control Library ships SOC 2 mapped controls.',
    gap: 'Formal SOC 2 audit is a customer-contracted deliverable, not a product gate.',
  },
  {
    capability_id: 'CR-AI-5-18-2',
    status: 'DONE',
    neurecore_evidence:
      'HIPAA compliance posture page renders live posture. Control Library ships HIPAA-mapped controls (data-access-sensitive, redis-connection-tls, db-connection-tls, secure-uploads).',
    gap: 'Formal HIPAA certification is a customer-contracted deliverable.',
  },
  {
    capability_id: 'CR-AI-5-18-3',
    status: 'PARTIAL',
    neurecore_evidence:
      'GDPR compliance posture computed from DsrRequest + AuditLog. DsrService ships the full Article 15-22 state machine. Admin UI at /governance/dsr exposes open/start/complete/reject/cancel.',
    gap: '30-day SLA timer + automated export-zip generation are Phase 3 deliverables.',
  },
  {
    capability_id: 'CR-AI-5-18-4',
    status: 'DONE',
    neurecore_evidence:
      'ISO 27001 compliance posture rendered live. Control Library ships ISO-mapped controls (admin-role-justified, license-expiry-warn, dev-in-prod-blocked, redis-connection-tls, db-connection-tls, ai-twin-permission-mirror).',
    gap: 'Formal ISO 27001 certification is a customer-contracted deliverable.',
  },
  {
    capability_id: 'CR-AI-5-18-5',
    status: 'DONE',
    neurecore_evidence:
      'EU AI Act compliance posture computed from LlmBindingAudit + AiTwinAuditLog + Approval events. Control Library ships EU-AI-Act-mapped control (ai-twin-permission-mirror). Risk classification via agent template risk tier is documented for Phase 3.',
    gap: 'Risk-tier classification runtime wiring is Phase 3.',
  },
];

function yamlEscape(s: string): string {
  return (
    '"' +
    s
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t') +
    '"'
  );
}

function main(): void {
  const txt = fs.readFileSync(MATRIX, 'utf8');
  const lines = txt.split('\n');
  let updated = 0;
  for (const upd of UPDATES) {
    const idIdx = lines.findIndex((l) =>
      l.trim() === `- capability_id: ${upd.capability_id}`,
    );
    if (idIdx < 0) {
      console.warn(`missing capability_id ${upd.capability_id}`);
      continue;
    }
    let j = idIdx + 1;
    while (j < lines.length && !lines[j].trim().startsWith('- capability_id:')) {
      const line = lines[j];
      if (line.trim().startsWith('status:')) {
        lines[j] = `    status: ${upd.status}`;
        updated++;
      } else if (line.trim().startsWith('neurecore_evidence:')) {
        lines[j] = `    neurecore_evidence: ${yamlEscape(upd.neurecore_evidence)}`;
        updated++;
      } else if (line.trim().startsWith('gap:')) {
        lines[j] = `    gap: ${yamlEscape(upd.gap)}`;
        updated++;
      }
      j++;
    }
  }
  fs.writeFileSync(MATRIX, lines.join('\n'), 'utf8');
  console.log(
    `updated ${updated} fields across ${UPDATES.length} capabilities in ${path.relative(REPO_ROOT, MATRIX)}`,
  );
}

main();
