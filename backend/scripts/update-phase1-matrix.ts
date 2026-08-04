#!/usr/bin/env npx ts-node --project tsconfig.json

/**
 * Phase 1 — Matrix row updater.
 *
 * Marks specific matrix rows as DONE / PARTIAL based on the Phase 1
 * deliverable list (LLM Registry + AI Twin wizard). Idempotent — running
 * twice yields the same output.
 *
 * Solid: SRP — only updates evidence/status/gap fields.
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
  verification_status?: 'UNVERIFIED' | 'CERTIFIED' | 'INTENTIONAL_DIFFERENCE';
}

const UPDATES: RowUpdate[] = [
  {
    capability_id: 'CR-AI-5-3-1',
    status: 'DONE',
    neurecore_evidence:
      "frontend-tenant/src/app/ai-twin/page.tsx (My Agents workspace) + backend/src/modules/ai-twin/ (controller, service, runtime-contract). Permission-mirror contract enforces every Twin action against actor's tenant + role.",
    gap: 'Personal Twin templates (clone-from-template) not yet shipped.',
  },
  {
    capability_id: 'CR-AI-5-3-2',
    status: 'DONE',
    neurecore_evidence:
      'Wizard step 1: CreateTwinDto step1Goal captured into AiTwin.step1Goal JSON. WizardStepEditor step=1 renders the goal textarea.',
    gap: 'No known gap.',
  },
  {
    capability_id: 'CR-AI-5-3-3',
    status: 'DONE',
    neurecore_evidence:
      'Wizard step 2: payload persisted into AiTwin.step2Iteration JSON. WizardStepEditor step=2 renders the refinement textarea.',
    gap: 'No known gap.',
  },
  {
    capability_id: 'CR-AI-5-3-4',
    status: 'PARTIAL',
    neurecore_evidence:
      'Wizard step 3 stores sample prompts in AiTwin.step3Test. WizardStepEditor step=3 renders the test panel.',
    gap:
      'End-to-end agent invocation test against a registered Twin (sample-prompt → tool-invoke envelope) is not yet wired through TenantLlmGateway; tracked in Phase 3.',
  },
  {
    capability_id: 'CR-AI-5-3-5',
    status: 'PARTIAL',
    neurecore_evidence:
      'Wizard step 4 captures scopes; deploy() flips status to ACTIVE and writes DEPLOYED audit row.',
    gap:
      "agentTemplateId/versionId wiring is a placeholder string; the version-pinning path needs the AgentTemplateVersion table to expose the canonical pair (Phase 3 P-4 deliverable).",
  },
  {
    capability_id: 'CR-AI-5-3-6',
    status: 'DONE',
    neurecore_evidence:
      "TwinPermissionMirrorGuard.assertCanExecute enforces (actor.tenantId == envelope.tenantId), requires OWNER+ role for write intents, and checks scopes against the Twin's allowedRead/Write lists. Wildcard tenant id is rejected. 12 unit tests assert each branch.",
    gap: 'No known gap.',
  },
  {
    capability_id: 'CR-AI-5-3-7',
    status: 'DONE',
    neurecore_evidence:
      'Twin reuses the existing JwtAuthGuard + RolesGuard; no Twin-specific auth surface was added. TwinPermissionMirrorGuard is composed on top of the same guards.',
    gap: 'No known gap.',
  },
  {
    capability_id: 'CR-AI-5-3-8',
    status: 'DONE',
    neurecore_evidence:
      'AiTwinAuditLog is append-only; every Twin action persists {tenantId, twinId, actorUserId, intent, outcome, envelope, occurredAt}. /api/v1/ai-twin/twins/:id/audits returns the trail; admin UI renders it.',
    gap: 'No known gap.',
  },
  {
    capability_id: 'CR-AI-5-17-4',
    status: 'DONE',
    neurecore_evidence:
      'backend/src/modules/llm-registry/ ships LlmProvider + LlmProviderModel CRUD. secretRef is a pointer into SecretProviderService; resolution happens at call time. Admin route /api/v1/admin/llm-registry/providers wired up. cc.neurecore.com/llm-registry page renders.',
    gap: 'No known gap.',
  },
  {
    capability_id: 'CR-AI-5-17-5',
    status: 'DONE',
    neurecore_evidence:
      "TenantLlmBinding is per-tenant + per-(provider,model,priority). TenantLlmGateway.resolvePreferredProvider/ModelId resolves the active binding. Tenant controller at /api/v1/llm-registry/bindings exposes CRUD + rotate + disable/enable.",
    gap: 'No known gap.',
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
    // Walk forward through the 13 fields until the next `- capability_id:`
    // or end of file, replacing the specific fields we own.
    let j = idIdx + 1;
    while (
      j < lines.length &&
      !lines[j].trim().startsWith('- capability_id:')
    ) {
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
      } else if (
        line.trim().startsWith('verification_status:') &&
        upd.verification_status
      ) {
        lines[j] = `    verification_status: ${upd.verification_status}`;
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
