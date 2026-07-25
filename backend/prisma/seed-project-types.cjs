#!/usr/bin/env node
/**
 * seed-project-types.cjs
 *
 * Sub-phase 2C (project-creation-imp-plan.md §7.2, §9.3).
 *
 * Seeds the 15-industry × 10-types ProjectType catalogue from
 * `prisma/seeds/project-types/*.json`, creating both:
 *   - `project_types` rows (tenantId=null, isSystem=true)
 *   - `project_type_versions` rows (v1 with informationRequirements=[],
 *     fieldSchema/stageTemplate/approvalTemplate copied from JSON)
 *   - `project_type_packs` M2M links (sorted by index in the JSON `packs` array)
 *
 * IDEMPOTENT:
 *   - upsert keyed on `(tenantId=null, name)` for `project_types`
 *   - on re-run: stageTemplate / approvalTemplate / classification are
 *     overwritten with canonical JSON; M2M links are replaced.
 *   - safe to run multiple times.
 *
 * PREREQUISITE: seed-question-packs.cjs must have run first (the packs
 * referenced in `packs` arrays must exist in the DB or M2M inserts fail).
 *
 * Flags:
 *   --check      Dry run; prints drift without writing.
 *   --verbose    Log every row.
 *
 * Reads DATABASE_URL from `backend/.env.production` (falls back to .env).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const envFile = path.join(__dirname, '..', '.env.production');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--check') || process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

const TYPES_DIR = path.join(__dirname, 'seeds', 'project-types');

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(TYPES_DIR, file), 'utf8'));
}

function loadIndustries() {
  const files = fs.readdirSync(TYPES_DIR).filter((f) => f.endsWith('.json')).sort();
  return files.map(readJson);
}

async function ensurePackKeys(packKeys) {
  // Validate every pack referenced exists. Idempotency guard.
  const existing = await prisma.questionPack.findMany({
    where: { key: { in: packKeys } },
    select: { key: true },
  });
  const have = new Set(existing.map((p) => p.key));
  const missing = packKeys.filter((k) => !have.has(k));
  if (missing.length > 0) {
    throw new Error(
      `Missing QuestionPack keys: ${missing.join(', ')}. Run seed-question-packs.cjs first.`,
    );
  }
}

// Pre-computed cache: we load ALL pack ids once and reuse them.
let _packCache = null;
async function loadPackCache() {
  if (_packCache) return _packCache;
  const all = await prisma.questionPack.findMany({
    select: { id: true, key: true },
  });
  _packCache = new Map(all.map((p) => [p.key, p.id]));
  return _packCache;
}

function jsonEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function upsertType(industry, t, existingType) {
  // existingType is preloaded by main() — null if not exists.
  const desiredSlug = t.slug || slugify(t.name);
  let projectTypeId;
  if (!existingType) {
    const created = await prisma.projectType.create({
      data: {
        tenantId: null,
        name: t.name,
        slug: desiredSlug,
        industry: industry.industry,
        isSystem: true,
        classification: t.classification,
      },
    });
    projectTypeId = created.id;
    if (VERBOSE) console.log(`   + created ProjectType ${t.name} (slug=${desiredSlug})`);
  } else {
    projectTypeId = existingType.id;
    if (
      existingType.classification !== t.classification ||
      existingType.industry !== industry.industry ||
      existingType.slug !== desiredSlug
    ) {
      await prisma.projectType.update({
        where: { id: projectTypeId },
        data: {
          classification: t.classification,
          industry: industry.industry,
          slug: desiredSlug,
        },
      });
      if (VERBOSE) console.log(`   ~ updated ProjectType ${t.name} (slug=${desiredSlug})`);
    }
  }

  // Version v1 — upsert by (projectTypeId, version).
  const version = await prisma.projectTypeVersion.findUnique({
    where: { projectTypeId_version: { projectTypeId, version: 1 } },
  });
  if (!version) {
    await prisma.projectTypeVersion.create({
      data: {
        projectTypeId,
        version: 1,
        fieldSchema: t.fieldSchema ?? [],
        stageTemplate: t.stageTemplate ?? [],
        approvalTemplate: t.approvalTemplate ?? [],
        informationRequirements: [],
      },
    });
    if (VERBOSE) console.log(`   + created ProjectTypeVersion v1`);
  } else if (
    !jsonEqual(version.fieldSchema, t.fieldSchema ?? []) ||
    !jsonEqual(version.stageTemplate, t.stageTemplate ?? []) ||
    !jsonEqual(version.approvalTemplate, t.approvalTemplate ?? [])
  ) {
    await prisma.projectTypeVersion.update({
      where: { id: version.id },
      data: {
        fieldSchema: t.fieldSchema ?? [],
        stageTemplate: t.stageTemplate ?? [],
        approvalTemplate: t.approvalTemplate ?? [],
      },
    });
    if (VERBOSE) console.log(`   ~ updated ProjectTypeVersion v1`);
  }

  // M2M pack links — replace (single delete + recreate with real cuids).
  // Pack keys are pre-validated by main(); the cache is guaranteed loaded.
  const keyToId = new Map(t.packs.map((key) => [key, _packCache.get(key)]));
  await prisma.projectTypePack.deleteMany({ where: { projectTypeId } });
  if (t.packs.length > 0) {
    await prisma.projectTypePack.createMany({
      data: t.packs.map((packKey, idx) => ({
        projectTypeId,
        questionPackId: keyToId.get(packKey),
        sortOrder: idx,
      })),
      skipDuplicates: false,
    });
  }
}

async function main() {
  const industries = loadIndustries();
  console.log(`Found ${industries.length} industry files in ${TYPES_DIR}`);

  if (DRY_RUN) {
    const total = await prisma.projectType.count({ where: { tenantId: null, isSystem: true } });
    console.log(`   system ProjectType rows currently in DB: ${total}`);
    return;
  }

  // Preload pack cache once — saves ~150 sequential queries.
  const packCache = await loadPackCache();
  const allKeys = [...packCache.keys()];
  console.log(`Loaded ${allKeys.length} QuestionPack keys from cache`);

  // Preload all existing system project types — saves another ~150 queries.
  const existingTypes = await prisma.projectType.findMany({
    where: { tenantId: null, isSystem: true },
    select: { name: true, industry: true, id: true, slug: true },
  });
  const existingByKey = new Map(existingTypes.map((t) => [`${t.industry}::${t.name}`, t]));
  console.log(`Found ${existingTypes.length} existing system project types`);

  let created = 0;
  let updated = 0;
  for (const ind of industries) {
    // Pre-validate all packs for this industry's types so we fail fast.
    const allPacks = new Set();
    for (const t of ind.types) {
      for (const k of t.packs) allPacks.add(k);
    }
    const missing = [...allPacks].filter((k) => !packCache.has(k));
    if (missing.length > 0) {
      console.error(`   SKIP ${ind.industry}: missing QuestionPack keys: ${missing.join(', ')}`);
      continue;
    }

    if (VERBOSE) console.log(`\n→ ${ind.industry} (${ind.industryName}): ${ind.types.length} types`);
    for (const t of ind.types) {
      const existed = existingByKey.get(`${ind.industry}::${t.name}`);
      await upsertType(ind, t, existed ?? null);
      if (existed) updated += 1; else created += 1;
    }
  }

  const totalTypes = await prisma.projectType.count({ where: { tenantId: null, isSystem: true } });
  const totalPacks = await prisma.projectTypePack.count();
  console.log(`\n   ✓ done. created=${created} updated=${updated}`);
  console.log(`     system ProjectType rows: ${totalTypes}; M2M links: ${totalPacks}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });