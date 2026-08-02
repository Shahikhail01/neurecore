'use strict';
/**
 * load-env.cjs
 *
 * PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §4.2.1 (R2 helper 1) — single env loader.
 *
 * Every per-Industry seeder requires this instead of duplicating the env-loader
 * block. Reads `.env.production` first (NestJS ConfigurationModule precedence
 * per contabo-ops.md §3.8b), then `.env` as fallback.
 *
 * Usage:
 *   const { loadEnv } = require('./seed-helpers/load-env.cjs');
 *   loadEnv();
 *   const { PrismaClient } = require('@prisma/client');
 */

const fs = require('fs');
const path = require('path');

function loadEnv() {
  const backendRoot = path.join(__dirname, '..', '..');
  const envProd = path.join(backendRoot, '.env.production');
  const envDev = path.join(backendRoot, '.env');
  for (const file of [envProd, envDev]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}

module.exports = { loadEnv };