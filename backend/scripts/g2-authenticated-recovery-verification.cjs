#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

function loadEnv(file, options = { override: false }) {
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
    if (options.override || !process.env[key]) process.env[key] = value;
  }
}

loadEnv(path.join(__dirname, '..', '.env'));
loadEnv(path.join(__dirname, '..', '.env.production'));
loadEnv(process.env.AWL_G2_ENV_FILE || path.join(__dirname, '..', '..', '.env.production'));

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const API_BASE = process.env.AWL_G2_API_BASE || 'https://brain.neurecore.com/api/v1';
const TENANT_ID = process.env.AWL_RECONSTRUCTION_TENANT_ID || 'reconstruction-integration-test';
const ACTOR_EMAIL = process.env.AWL_G2_ACTOR_EMAIL || 'awl-g2-verifier@reconstruction.local';
const RUN_ID = process.env.AWL_G2_SOURCE_RUN_ID || 'G2-2026-07-26T13-28-CONTABO-PRISMA';

async function main() {
  const actor = await prisma.user.findUnique({
    where: { email: ACTOR_EMAIL },
    select: {
      id: true,
      email: true,
      role: true,
      tenantId: true,
      isActive: true,
    },
  });
  if (!actor || actor.tenantId !== TENANT_ID || !actor.isActive) {
    throw new Error(`Active verifier actor not found in tenant ${TENANT_ID}: ${ACTOR_EMAIL}`);
  }

  const initiation = await prisma.enterpriseInitiation.findFirst({
    where: {
      tenantId: TENANT_ID,
      discoveredData: { path: ['runId'], equals: RUN_ID },
      projectId: { not: null },
    },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, status: true, projectId: true },
  });
  if (!initiation) throw new Error(`No materialized initiation found for run ${RUN_ID}`);

  if (actor.email !== 'awl-g2-verifier@reconstruction.local') {
    throw new Error('Refusing to modify password for a non-G2 verifier account');
  }

  const password = `G2-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.update({
    where: { id: actor.id },
    data: {
      passwordHash,
      isActive: true,
      isVerified: true,
      lockedUntil: null,
      metadata: {
        g2RecoveryVerifier: true,
        passwordRotatedFor: 'g2-authenticated-recovery-verification.cjs',
        rotatedAt: new Date().toISOString(),
      },
    },
  });

  const loginResponse = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ email: actor.email, password }),
  });
  const loginBody = await loginResponse.json().catch(() => null);
  const token =
    loginBody?.tokens?.accessToken ??
    loginBody?.data?.tokens?.accessToken ??
    loginBody?.accessToken ??
    loginBody?.data?.accessToken;
  if (!token) {
    throw new Error(`Login failed with HTTP ${loginResponse.status}: ${JSON.stringify(loginBody)}`);
  }

  const url = `${API_BASE}/enterprise-initiation/${initiation.id}/status`;
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/json',
    },
  });
  const body = await response.json().catch(() => null);
  const data = body?.data ?? body;
  const passed =
    response.status === 200 &&
    data?.initiationId === initiation.id &&
    data?.projectId === initiation.projectId;

  console.log(JSON.stringify({
    runId: RUN_ID,
    url,
    loginStatus: loginResponse.status,
    httpStatus: response.status,
    actor: actor.email,
    initiation,
    response: data,
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
