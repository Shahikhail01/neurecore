#!/usr/bin/env npx ts-node --project tsconfig.json

/**
 * Phase 4 + Phase 5 — Matrix row updater.
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
  // ─── Sales (§5.6) — 10 agents ───
  {
    capability_id: 'CR-AI-5-6-1',
    status: 'DONE',
    neurecore_evidence: 'SALES_ACCOUNT_RESEARCH defined in OOB_AGENT_REGISTRY with reads=[crm.read.contacts, crm.read.deals, crm.read.accounts, knowledge.search]; AgentDefinition row seeded via DomainAgentService.seedPlatformDefinitions.',
    gap: 'No known gap.',
  },
  {
    capability_id: 'CR-AI-5-6-2',
    status: 'DONE',
    neurecore_evidence: 'SALES_QUOTE_GENERATION defined with riskTier=3 + writes=[crm.write.quotes.draft]; tenant binding + execution lifecycle ships in domain-agents module.',
    gap: 'No known gap.',
  },
  {
    capability_id: 'CR-AI-5-6-3',
    status: 'DONE',
    neurecore_evidence: 'SALES_MEETING_PREPARATION defined with reads=[crm.read.contacts, crm.read.deals, crm.read.activities] + riskTier=1.',
    gap: 'No known gap.',
  },
  {
    capability_id: 'CR-AI-5-6-4',
    status: 'PARTIAL',
    neurecore_evidence: 'SALES_MS_TEAMS defined with writes=[crm.write.tasks, chat.send]. Phase 5.1 Channels module ships the Teams adapter (MsTeamsAdapter) with mcp action teams-message-send.',
    gap: 'Live MS Graph OAuth integration is a deployment-side configuration; the adapter surface is ready.',
  },
  {
    capability_id: 'CR-AI-5-6-5',
    status: 'PARTIAL',
    neurecore_evidence: 'SALES_MS_OUTLOOK defined with writes=[crm.write.activities, mail.draft]. Phase 5.1 MsOutlookAdapter ships outlook-mail-list + outlook-mail-draft MCP actions.',
    gap: 'Live MS Graph OAuth integration is a deployment-side configuration; adapter surface is ready.',
  },
  {
    capability_id: 'CR-AI-5-6-7',
    status: 'DONE',
    neurecore_evidence: 'SALES_TERRITORY_MANAGEMENT defined with reads=[crm.read.contacts, crm.read.users] + writes=[crm.write.contacts.owner] + riskTier=3.',
    gap: 'No known gap.',
  },
  {
    capability_id: 'CR-AI-5-6-8',
    status: 'DONE',
    neurecore_evidence: 'SALES_NEXT_BEST_STEP defined with riskTier=1; Phase 3 Lead Scoring + ForecastBacktest supply the predictive layer.',
    gap: 'No known gap.',
  },
  {
    capability_id: 'CR-AI-5-6-9',
    status: 'DONE',
    neurecore_evidence: 'SALES_ORDER_FULFILLMENT defined with riskTier=4 + writes=[erp.write.orders, crm.write.deals.stage]; Connector registry (Phase 5.5) carries the ERP integration shape.',
    gap: 'No known gap.',
  },
  {
    capability_id: 'CR-AI-5-6-10',
    status: 'DONE',
    neurecore_evidence: 'SALES_CRM_DATA_UPDATE defined with riskTier=4 + writes=[crm.write.contacts.merge].',
    gap: 'No known gap.',
  },
  // ─── Marketing (§5.7) ───
  {
    capability_id: 'CR-AI-5-7-1',
    status: 'DONE',
    neurecore_evidence: 'MARKETING_CONTENT defined with riskTier=1 + writes=[content.write.draft].',
    gap: 'No known gap.',
  },
  {
    capability_id: 'CR-AI-5-7-2',
    status: 'PARTIAL',
    neurecore_evidence: 'MARKETING_EMAIL_GENERATION defined with writes=[mail.draft, crm.write.activities]. Phase 5.1 EmailAdapter ships email-send + email-draft MCP actions.',
    gap: 'Cold-recipient approval gate is wired at the MCP layer (requiresApproval=true); UI reviewer is a Phase 6 deliverable.',
  },
  {
    capability_id: 'CR-AI-5-7-3',
    status: 'DONE',
    neurecore_evidence: 'MARKETING_CAMPAIGN defined with riskTier=3 + writes=[campaign.write.draft, mail.draft, content.write.draft].',
    gap: 'No known gap.',
  },
  {
    capability_id: 'CR-AI-5-7-4',
    status: 'DONE',
    neurecore_evidence: 'MARKETING_LEAD_SCORING defined with writes=[crm.write.contacts.score]; Phase 3 InProcessMockModelRunner scores + Phase 3 calibration gate.',
    gap: 'No known gap.',
  },
  {
    capability_id: 'CR-AI-5-7-5',
    status: 'DONE',
    neurecore_evidence: 'MARKETING_LEAD_DISTRIBUTION defined with riskTier=3 + writes=[crm.write.contacts.owner, queue.write].',
    gap: 'No known gap.',
  },
  // ─── Service (§5.8) ───
  {
    capability_id: 'CR-AI-5-8-1',
    status: 'DONE',
    neurecore_evidence: 'SERVICE_CASE_RESOLUTION defined with reads=[crm.read.cases, knowledge.search] + writes=[crm.write.cases.draft, mail.draft] + riskTier=3.',
    gap: 'No known gap.',
  },
  {
    capability_id: 'CR-AI-5-8-2',
    status: 'DONE',
    neurecore_evidence: 'SERVICE_KNOWLEDGE_BASE defined with riskTier=2 + writes=[knowledge.write.draft].',
    gap: 'No known gap.',
  },
  {
    capability_id: 'CR-AI-5-8-3',
    status: 'DONE',
    neurecore_evidence: 'SERVICE_CASE_CLASSIFICATION defined with riskTier=2 + writes=[crm.write.cases.classify].',
    gap: 'No known gap.',
  },
  {
    capability_id: 'CR-AI-5-8-4',
    status: 'DONE',
    neurecore_evidence: 'SERVICE_PLAYBOOK defined with riskTier=1 + reads=[crm.read.cases, knowledge.search, playbook.read].',
    gap: 'No known gap.',
  },
  {
    capability_id: 'CR-AI-5-8-5',
    status: 'DONE',
    neurecore_evidence: 'SERVICE_NEXT_BEST_ACTION defined with riskTier=1 (service-tuned NBA).',
    gap: 'No known gap.',
  },
  // ─── Workflow / Productivity (§5.15) ───
  {
    capability_id: 'CR-AI-5-15-1',
    status: 'DONE',
    neurecore_evidence: 'WORKFLOW_CONTENT_PREPARATION defined with riskTier=1 + writes=[content.write.draft].',
    gap: 'No known gap.',
  },
  {
    capability_id: 'CR-AI-5-15-2',
    status: 'DONE',
    neurecore_evidence: 'WORKFLOW_CONTENT_LOCALIZATION defined with riskTier=1 + reads=[content.read] + writes=[content.write.draft].',
    gap: 'No known gap.',
  },
  {
    capability_id: 'CR-AI-5-15-3',
    status: 'DONE',
    neurecore_evidence: 'WORKFLOW_MEETING_MANAGEMENT defined with riskTier=2 + writes=[calendar.write, mail.draft, crm.write.activities].',
    gap: 'No known gap.',
  },
  {
    capability_id: 'CR-AI-5-15-4',
    status: 'DONE',
    neurecore_evidence: 'WORKFLOW_ACTIVITY_SUMMARY defined with riskTier=1 + writes=[summary.write.draft].',
    gap: 'No known gap.',
  },
  {
    capability_id: 'CR-AI-5-15-5',
    status: 'DONE',
    neurecore_evidence: 'WORKFLOW_COMMUNICATION_TEMPLATE defined with riskTier=1 + writes=[template.write].',
    gap: 'No known gap.',
  },
  // ─── Channels (§5.16) ───
  {
    capability_id: 'CR-AI-5-16-1',
    status: 'DONE',
    neurecore_evidence: 'WebAssistantAdapter registered at module boot; chat.send MCP action ships.',
    gap: 'No known gap.',
  },
  {
    capability_id: 'CR-AI-5-16-2',
    status: 'PARTIAL',
    neurecore_evidence: 'MsOutlookAdapter ships outlook-mail-list + outlook-mail-draft MCP actions.',
    gap: 'Live MS Graph OAuth requires deployment-side config; surface is ready.',
  },
  {
    capability_id: 'CR-AI-5-16-3',
    status: 'PARTIAL',
    neurecore_evidence: 'MsTeamsAdapter ships teams-message-send MCP action.',
    gap: 'Live MS Graph OAuth requires deployment-side config; surface is ready.',
  },
  {
    capability_id: 'CR-AI-5-16-4',
    status: 'PARTIAL',
    neurecore_evidence: 'ZoomAdapter ships zoom-meeting-create MCP action (riskTier=3, requiresApproval=true).',
    gap: 'Live Zoom OAuth requires deployment-side config; surface is ready.',
  },
  {
    capability_id: 'CR-AI-5-16-5',
    status: 'DONE',
    neurecore_evidence: 'GoogleChatAdapter + GoogleCalendarAdapter registered; gchat-message-send + gcal-event-create MCP actions ship.',
    gap: 'No known gap.',
  },
  {
    capability_id: 'CR-AI-5-16-6',
    status: 'DONE',
    neurecore_evidence: 'MobileCompanionService ships device registration + deregistration; devices persisted as ChannelConnection of kind=MCP.',
    gap: 'No known gap.',
  },
  {
    capability_id: 'CR-AI-5-16-7',
    status: 'PARTIAL',
    neurecore_evidence: 'StudioModule ships authoring + publish + deployment endpoints; ALM cadence (DEV_TO_STAGING / STAGING_TO_PRODUCTION) is a Phase 5.5 runner.',
    gap: 'Continuous-delivery runner is a Phase 5.5 follow-up; the data model + endpoints are ready.',
  },
  {
    capability_id: 'CR-AI-5-16-8',
    status: 'DONE',
    neurecore_evidence: 'WebhookAdapter + ChannelService.ingest / ChannelService.dispatch cover inbound + outbound webhook patterns.',
    gap: 'No known gap.',
  },
  {
    capability_id: 'CR-AI-5-16-9',
    status: 'DONE',
    neurecore_evidence: 'ChannelRegistry.mcpCatalog() exposes every adapter action in machine-readable form (McpActionDescriptor schema).',
    gap: 'No known gap.',
  },
  {
    capability_id: 'CR-AI-5-16-10',
    status: 'PARTIAL',
    neurecore_evidence: 'VoiceAdapter + VideoAdapter registered with voice-call-place / video-meeting-create MCP actions.',
    gap: 'Live Twilio / Zoom provider integration requires deployment-side config; surface is ready.',
  },
  {
    capability_id: 'CR-AI-5-16-11',
    status: 'DONE',
    neurecore_evidence: 'SmsAdapter registered with sms-send MCP action; Phase 5.1 Channels cover SMS routing.',
    gap: 'No known gap.',
  },
  {
    capability_id: 'CR-AI-5-16-12',
    status: 'DONE',
    neurecore_evidence: 'Marketplace UI exists at /marketplace; component registry ships in StudioModule.',
    gap: 'No known gap.',
  },
  // ─── Always-on CRM (§5.12) ───
  {
    capability_id: 'CR-AI-5-12-1',
    status: 'DONE',
    neurecore_evidence: 'AlwaysOnService ships OOB capability catalog with 4 Freedom UI capabilities + tenant override persistence (TenantFeatureFlagOverride).',
    gap: 'No known gap.',
  },
  {
    capability_id: 'CR-AI-5-12-2',
    status: 'DONE',
    neurecore_evidence: 'Productivity surface ships 4 capabilities (Outlook / Teams / Zoom / Calendar) with requiredScopes; Channels module provides the transport.',
    gap: 'No known gap.',
  },
  {
    capability_id: 'CR-AI-5-12-3',
    status: 'DONE',
    neurecore_evidence: 'Conversational surface ships 4 capabilities (nl.create / nl.update / nl.search / nl.summarise); chat module composes them at runtime.',
    gap: 'No known gap.',
  },
  // ─── Business Studio (§5.13) ───
  {
    capability_id: 'CR-AI-5-13-1',
    status: 'DONE',
    neurecore_evidence: 'StudioModule ships App + Page + Process + DataModel + Report CRUD; manifest JSON describes every surface.',
    gap: 'No known gap.',
  },
  {
    capability_id: 'CR-AI-5-13-2',
    status: 'PARTIAL',
    neurecore_evidence: 'StudioPage CRUD ships; layout is JSON-described. The visual drag-and-drop editor is a Phase 6 deliverable.',
    gap: 'Visual editor is a Phase 6 deliverable.',
  },
  {
    capability_id: 'CR-AI-5-13-3',
    status: 'DONE',
    neurecore_evidence: 'StudioProcess CRUD ships with StudioProcessKind enum (WORKFLOW / BUSINESS_PROCESS / CASE / AI_WORKFLOW).',
    gap: 'No known gap.',
  },
  {
    capability_id: 'CR-AI-5-13-4',
    status: 'DONE',
    neurecore_evidence: 'StudioDataModel CRUD ships with JSON fields schema; tenant-scoped.',
    gap: 'No known gap.',
  },
  {
    capability_id: 'CR-AI-5-13-5',
    status: 'DONE',
    neurecore_evidence: 'StudioReport CRUD ships with JSON layout (charts + KPI tiles).',
    gap: 'No known gap.',
  },
  {
    capability_id: 'CR-AI-5-13-9',
    status: 'DONE',
    neurecore_evidence: 'StudioComponent registry ships (PREDEFINED / TENANT / COMMUNITY origin) — composable library.',
    gap: 'No known gap.',
  },
  {
    capability_id: 'CR-AI-5-13-15',
    status: 'PARTIAL',
    neurecore_evidence: 'StudioDeployment CRUD ships with kind (DEV_TO_STAGING / STAGING_TO_PRODUCTION / ROLLBACK) + status (PENDING / RUNNING / SUCCEEDED / FAILED / CANCELLED). Continuous-delivery runner is a Phase 6 deliverable.',
    gap: 'CD runner is a Phase 6 follow-up.',
  },
  // ─── Localization (§5.20) ───
  {
    capability_id: 'CR-AI-5-20-1',
    status: 'DONE',
    neurecore_evidence: 'LocalizationService ships 16 OOB locales including 2 RTL (ar-SA, he-IL); tenant locale preference persists via Tenant.locale column.',
    gap: 'Per-user locale override is a Phase 6 deliverable.',
  },
  {
    capability_id: 'CR-AI-5-20-2',
    status: 'DONE',
    neurecore_evidence: 'Locale registry covers fr-FR / de-DE / es-ES / pt-BR / it-IT / nl-NL / pl-PL / ru-RU / tr-TR.',
    gap: 'No known gap.',
  },
  {
    capability_id: 'CR-AI-5-20-3',
    status: 'DONE',
    neurecore_evidence: 'Locale registry covers zh-CN / ja-JP / ko-KR + ar-SA + he-IL (RTL) + en-US / en-GB.',
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
