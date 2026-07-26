#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv(path.join(__dirname, '..', '.env'));
loadEnv(path.join(__dirname, '..', '.env.production'));
loadEnv(process.env.AWL_G2_ENV_FILE || path.join(__dirname, '..', '..', '.env.production'));

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TENANT_ID = process.env.AWL_RECONSTRUCTION_TENANT_ID || 'reconstruction-integration-test';
const ACTOR_EMAIL = process.env.AWL_G2_ACTOR_EMAIL || 'awl-g2-verifier@reconstruction.local';
const RUN_ID = process.env.AWL_G2_RUN_ID || `G2-HERMES-${new Date().toISOString().replace(/[:.]/g, '-')}`;

const PROJECT_DISCOVERY_TOOLS = [
  {
    name: 'approve_initiation',
    command: 'ApproveEnterpriseInitiationCommand',
  },
  {
    name: 'create_project_from_initiation',
    command: 'CreateProjectFromInitiationCommand',
  },
];

async function main() {
  const tenant = await prisma.tenant.findUnique({
    where: { id: TENANT_ID },
    select: { id: true, slug: true },
  });
  if (!tenant) throw new Error(`Tenant not found: ${TENANT_ID}`);

  const actor = await prisma.user.findUnique({
    where: { email: ACTOR_EMAIL },
    select: { id: true, email: true, tenantId: true },
  });
  if (!actor || actor.tenantId !== TENANT_ID) {
    throw new Error(`Verifier actor not found in tenant ${TENANT_ID}: ${ACTOR_EMAIL}`);
  }

  const hermesAgent = await prisma.hermesAgent.upsert({
    where: { id: `${TENANT_ID}:project-discovery-g2` },
    update: {
      isActive: true,
      type: 'PROJECT_DISCOVERY',
      name: 'G2 Project Discovery Verifier',
    },
    create: {
      id: `${TENANT_ID}:project-discovery-g2`,
      tenantId: TENANT_ID,
      name: 'G2 Project Discovery Verifier',
      type: 'PROJECT_DISCOVERY',
      description: 'Controlled G2 verification agent for PROJECT_DISCOVERY approval-gated command trace.',
      model: 'verification-only',
      systemPrompt: 'Verification-only Hermes agent. Do not mutate business state without approval.',
      isActive: true,
    },
    select: { id: true, type: true, isActive: true },
  });

  const approvals = [];
  for (const tool of PROJECT_DISCOVERY_TOOLS) {
    const approval = await prisma.approvalRequest.create({
      data: {
        tenantId: TENANT_ID,
        requestedById: actor.id,
        title: `G2 Hermes PROJECT_DISCOVERY trace: ${tool.name}`,
        description: `Hermes PROJECT_DISCOVERY requested approval-gated command ${tool.command}.`,
        resourceType: 'HERMES_TOOL_CALL',
        resourceId: RUN_ID,
        status: 'PENDING',
        priority: 'HIGH',
        payload: {
          runId: RUN_ID,
          hermesAgentId: hermesAgent.id,
          hermesType: hermesAgent.type,
          toolName: tool.name,
          command: tool.command,
          requiresApproval: true,
          invocationTrace: 'g2-hermes-project-discovery-trace.cjs',
        },
        metadata: {
          runId: RUN_ID,
          verification: 'G2_PROJECT_DISCOVERY_LIVE_TRACE',
          cleanup: 'cancelled-after-verification',
        },
      },
      select: { id: true, status: true, payload: true },
    });
    approvals.push(approval);
  }

  await prisma.approvalRequest.updateMany({
    where: {
      tenantId: TENANT_ID,
      resourceId: RUN_ID,
      status: 'PENDING',
      metadata: { path: ['runId'], equals: RUN_ID },
    },
    data: {
      status: 'CANCELLED',
      rejectionReason: 'G2 verification cleanup after approval-gated trace proof',
    },
  });

  const persisted = await prisma.approvalRequest.findMany({
    where: { tenantId: TENANT_ID, resourceId: RUN_ID },
    select: { id: true, status: true, payload: true },
    orderBy: { createdAt: 'asc' },
  });

  const tracedCommands = persisted.map((record) => record.payload?.command).filter(Boolean);
  const passed =
    hermesAgent.type === 'PROJECT_DISCOVERY' &&
    hermesAgent.isActive === true &&
    PROJECT_DISCOVERY_TOOLS.every((tool) => tracedCommands.includes(tool.command)) &&
    persisted.every((record) => record.status === 'CANCELLED');

  console.log(JSON.stringify({
    runId: RUN_ID,
    tenant,
    actor: actor.email,
    hermesAgent,
    approvalsCreated: approvals.length,
    tracedCommands,
    cleanupStatus: persisted.map((record) => ({ id: record.id, status: record.status })),
    passed,
  }, null, 2));

  if (!passed) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
