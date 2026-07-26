#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv(process.env.AWL_G2_ENV_FILE || path.join(__dirname, '..', '..', '.env.production'));
loadEnv(path.join(__dirname, '..', '.env.production'));
loadEnv(path.join(__dirname, '..', '.env'));

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TENANT_ID = process.env.AWL_RECONSTRUCTION_TENANT_ID || 'reconstruction-integration-test';
const ACTOR_EMAIL = process.env.AWL_G2_ACTOR_EMAIL || 'awl-g2-verifier@reconstruction.local';
const RUN_ID = process.env.AWL_G2_RUN_ID || `G2-${new Date().toISOString().replace(/[:.]/g, '-')}`;
const REPETITIONS = Number(process.env.AWL_G2_REPETITIONS || 20);
const CONCURRENCY = Number(process.env.AWL_G2_CONCURRENCY || 10);

function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

async function ensureActor() {
  const tenant = await prisma.tenant.findUnique({
    where: { id: TENANT_ID },
    select: { id: true, slug: true, name: true },
  });
  if (!tenant) throw new Error(`Reconstruction tenant not found: ${TENANT_ID}`);

  const flag = await prisma.tenantFeatureFlagOverride.findUnique({
    where: { tenantId_flagKey: { tenantId: TENANT_ID, flagKey: 'CANONICAL_INITIATION' } },
    select: { enabled: true },
  });
  if (!flag?.enabled) {
    throw new Error(`CANONICAL_INITIATION is not enabled for ${TENANT_ID}`);
  }

  const actor = await prisma.user.upsert({
    where: { email: ACTOR_EMAIL },
    update: { tenantId: TENANT_ID, isActive: true, isVerified: true },
    create: {
      email: ACTOR_EMAIL,
      firstName: 'AWL',
      lastName: 'G2 Verifier',
      role: 'OWNER',
      isActive: true,
      isVerified: true,
      tenantId: TENANT_ID,
      metadata: { seededBy: 'g2-live-initiation-verification.cjs' },
    },
    select: { id: true, email: true },
  });

  return { tenant, actor };
}

async function materializeOne(index, actorId) {
  const label = `${RUN_ID}-REP-${String(index).padStart(2, '0')}`;
  const correlationId = `${label}-corr`;

  return prisma.$transaction(async (tx) => {
    const initiation = await tx.enterpriseInitiation.create({
      data: {
        tenantId: TENANT_ID,
        projectName: `${label} Canonical Project`,
        projectDescription: `G2 controlled repetition ${index}`,
        discoveredData: { runId: RUN_ID, repetition: index },
        status: 'DRAFT',
      },
    });

    const approved = await tx.enterpriseInitiation.update({
      where: { id: initiation.id },
      data: {
        status: 'APPROVED',
        approvedByActorId: actorId,
        approvedAt: new Date(),
        approvalComment: 'G2 controlled verification approval',
        version: { increment: 1 },
      },
    });

    const project = await tx.project.create({
      data: {
        tenantId: TENANT_ID,
        name: `${label} Canonical Project`,
        description: `G2 controlled repetition ${index}`,
        status: 'ACTIVE',
        executionEngineVersion: 'canonical',
        metadata: { runId: RUN_ID, repetition: index, g2Verification: true },
      },
      select: { id: true, name: true },
    });

    const updateResult = await tx.enterpriseInitiation.updateMany({
      where: {
        id: initiation.id,
        tenantId: TENANT_ID,
        status: 'APPROVED',
        version: approved.version,
      },
      data: {
        status: 'MATERIALIZING',
        projectId: project.id,
        version: { increment: 1 },
      },
    });
    if (updateResult.count !== 1) throw new Error(`Optimistic lock failed for ${initiation.id}`);

    const outbox = await tx.enterpriseEventOutbox.create({
      data: {
        tenantId: TENANT_ID,
        eventType: 'ProjectAutomationRequested',
        version: 1,
        actorId,
        actorType: 'HUMAN',
        correlationId,
        causationId: null,
          idempotencyKey: `g2-automation-requested:${project.id}`,
        sourceModule: 'project-automation',
        payload: { projectId: project.id, initiationId: initiation.id, runId: RUN_ID },
        status: 'PENDING',
      },
    });

    await tx.$executeRawUnsafe(
      `INSERT INTO "audit_logs"
        ("id", "tenantId", "actor", "action", "resource", "resourceId", "result", "details", "createdAt")
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW())`,
      newId('g2audit'),
      TENANT_ID,
      actorId,
      'G2_PROJECT_CREATED_FROM_INITIATION',
      'Project',
      project.id,
      'success',
      JSON.stringify({ initiationId: initiation.id, outboxId: outbox.id, correlationId, runId: RUN_ID }),
    );

    return { initiationId: initiation.id, projectId: project.id, outboxId: outbox.id };
  });
}

async function createApprovedInitiation(actorId) {
  const label = `${RUN_ID}-CONCURRENCY`;
  return prisma.enterpriseInitiation.create({
    data: {
      tenantId: TENANT_ID,
      projectName: `${label} Canonical Project`,
      projectDescription: 'G2 concurrent duplicate boundary test',
      discoveredData: { runId: RUN_ID, concurrency: true },
      status: 'APPROVED',
      approvedByActorId: actorId,
      approvedAt: new Date(),
      approvalComment: 'G2 concurrency setup',
      version: 2,
    },
  });
}

async function attemptConcurrentMaterialization(initiation, actorId, index) {
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        tenantId: TENANT_ID,
        name: `${RUN_ID}-CONCURRENCY attempt ${index}`,
        description: 'G2 concurrent duplicate attempt',
        status: 'ACTIVE',
        executionEngineVersion: 'canonical',
        metadata: { runId: RUN_ID, concurrencyAttempt: index, g2Verification: true },
      },
      select: { id: true, name: true },
    });

    const updateResult = await tx.enterpriseInitiation.updateMany({
      where: {
        id: initiation.id,
        tenantId: TENANT_ID,
        status: 'APPROVED',
        version: initiation.version,
      },
      data: {
        status: 'MATERIALIZING',
        projectId: project.id,
        version: { increment: 1 },
      },
    });
    if (updateResult.count !== 1) throw new Error('OPTIMISTIC_LOCK_FAILED');

    await tx.enterpriseEventOutbox.create({
      data: {
        tenantId: TENANT_ID,
        eventType: 'ProjectAutomationRequested',
        version: 1,
        actorId,
        actorType: 'HUMAN',
        correlationId: `${RUN_ID}-concurrency-${index}`,
        causationId: null,
        idempotencyKey: `g2-concurrency:${initiation.id}:${index}`,
        sourceModule: 'project-automation',
        payload: { projectId: project.id, initiationId: initiation.id, runId: RUN_ID },
        status: 'PENDING',
      },
    });

    return { ok: true, projectId: project.id };
  });
}

async function summarize() {
  const projects = await prisma.project.findMany({
    where: {
      tenantId: TENANT_ID,
      metadata: { path: ['runId'], equals: RUN_ID },
    },
    select: { id: true, name: true, initiation: { select: { id: true, projectId: true, status: true } } },
  });
  const outboxCount = await prisma.enterpriseEventOutbox.count({
    where: {
      tenantId: TENANT_ID,
      payload: { path: ['runId'], equals: RUN_ID },
      eventType: 'ProjectAutomationRequested',
    },
  });
  const initiationIds = projects.map((project) => project.initiation?.id).filter(Boolean);
  const duplicateInitiations = initiationIds.filter((id, index) => initiationIds.indexOf(id) !== index);

  return {
    projectCount: projects.length,
    outboxCount,
    uniqueInitiationLinks: new Set(initiationIds).size,
    duplicateInitiationLinks: [...new Set(duplicateInitiations)],
  };
}

async function main() {
  const { tenant, actor } = await ensureActor();
  console.log(`G2 run: ${RUN_ID}`);
  console.log(`Tenant: ${tenant.id} (${tenant.slug})`);
  console.log(`Actor: ${actor.email}`);

  const repetitions = [];
  for (let i = 1; i <= REPETITIONS; i += 1) {
    repetitions.push(await materializeOne(i, actor.id));
  }
  console.log(`Controlled repetition: ${repetitions.length}/${REPETITIONS} materialized`);

  const concurrencyInitiation = await createApprovedInitiation(actor.id);
  const attempts = await Promise.allSettled(
    Array.from({ length: CONCURRENCY }, (_, index) =>
      attemptConcurrentMaterialization(concurrencyInitiation, actor.id, index + 1),
    ),
  );
  const fulfilled = attempts.filter((result) => result.status === 'fulfilled');
  const rejected = attempts.filter((result) => result.status === 'rejected');
  console.log(`Concurrency duplicate test: fulfilled=${fulfilled.length}, rejected=${rejected.length}`);

  const summary = await summarize();
  const passed =
    repetitions.length === REPETITIONS &&
    fulfilled.length === 1 &&
    summary.projectCount === REPETITIONS + 1 &&
    summary.outboxCount === REPETITIONS + 1 &&
    summary.duplicateInitiationLinks.length === 0;

  console.log(JSON.stringify({ runId: RUN_ID, passed, summary }, null, 2));

  if (!passed) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
