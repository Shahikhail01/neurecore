'use strict';
/**
 * seed-project-types.cjs
 *
 * PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §4.2.4 (R2 helper 4) — Industry
 * ProjectType metadata registry loader.
 *
 * IMPORTANT (course correction 2026-07-31):
 * `ProjectType` is **tenant-scoped** (schema.prisma:2210 — `tenantId` required
 * for uniqueness, `@@unique([tenantId, name])`). There is NO platform-level
 * project-type pool to seed against. The 16 JSON files in `seeds/project-types/`
 * are metadata describing what gets *created per tenant during onboarding*.
 *
 * So this helper is NOT a DB seeder. It loads + validates + returns the
 * metadata, and is consumed by `OnboardingService.provisionProjectTypes(tenantId, industrySlug)`
 * at provisioning time.
 *
 * Single source of truth for per-Industry project-type config. Adds 0 schema
 * complexity. Pure data loader.
 *
 * Usage from seeder / onboarding / admin / cert runner:
 *   const { loadProjectTypesForIndustry } = require('./seed-helpers/seed-project-types.cjs');
 *   const defs = loadProjectTypesForIndustry('financial-services');
 *   // defs is an array of project-type blueprints ready to provision.
 */

const fs = require('fs');
const path = require('path');

const PROJECT_TYPES_DIR = path.join(__dirname, '..', 'seeds', 'project-types');

/**
 * @typedef {Object} ProjectTypeBlueprint
 * @property {string} name
 * @property {string} slug
 * @property {string} classification
 * @property {string[]} packs
 * @property {Array<{name:string, order:number, defaultDurationDays:number}>} stages
 * @property {Array<Object>} approvals
 * @property {Array<Object>} [fields]
 */

/**
 * Load all project-type blueprints for one Industry slug.
 *
 * @param {string} industrySlug e.g. "financial-services"
 * @returns {ProjectTypeBlueprint[]}
 */
function loadProjectTypesForIndustry(industrySlug) {
  const file = path.join(PROJECT_TYPES_DIR, `${industrySlug}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`ProjectType metadata not found for industry: ${industrySlug} (expected ${file})`);
  }
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!raw || !Array.isArray(raw.types)) {
    throw new Error(`Invalid project-types file for ${industrySlug}: missing 'types' array`);
  }
  return raw.types.map(normalizeBlueprint);
}

/**
 * Load all project-type blueprints across all 16 Industries.
 * Returns a Map keyed by industrySlug.
 *
 * @returns {Map<string, ProjectTypeBlueprint[]>}
 */
function loadAllProjectTypes() {
  const out = new Map();
  const files = fs.readdirSync(PROJECT_TYPES_DIR).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    const slug = file.replace(/\.json$/, '');
    out.set(slug, loadProjectTypesForIndustry(slug));
  }
  return out;
}

/**
 * Validate the schema of a single blueprint.
 * Throws on invalid input — caller catches + surfaces in CI / cert runner.
 *
 * @param {ProjectTypeBlueprint} b
 */
function validateBlueprint(b) {
  if (!b.name || typeof b.name !== 'string') throw new Error(`ProjectType blueprint missing 'name': ${JSON.stringify(b)}`);
  if (!b.slug || typeof b.slug !== 'string') throw new Error(`ProjectType blueprint missing 'slug': ${b.name}`);
  if (!b.classification || !['CLIENT_ENGAGEMENT', 'INTERNAL_INITIATIVE', 'OPERATIONAL_PROGRAM'].includes(b.classification)) {
    throw new Error(`ProjectType "${b.slug}" has invalid classification: ${b.classification}`);
  }
  if (!Array.isArray(b.stages) || b.stages.length === 0) {
    throw new Error(`ProjectType "${b.slug}" must have at least 1 stage`);
  }
  if (!Array.isArray(b.packs)) {
    throw new Error(`ProjectType "${b.slug}" must have 'packs' array`);
  }
}

/**
 * Normalize raw JSON blueprint into canonical shape (defaults filled in).
 */
function normalizeBlueprint(raw) {
  const b = {
    name: raw.name,
    slug: raw.slug ?? raw.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    classification: raw.classification ?? 'INTERNAL_INITIATIVE',
    packs: raw.packs ?? [],
    stages: raw.stageTemplate ?? raw.stages ?? [],
    approvals: raw.approvalTemplate ?? raw.approvals ?? [],
    fields: raw.fieldSchema ?? raw.fields ?? [],
  };
  validateBlueprint(b);
  return b;
}

/**
 * Get the list of all Industry slugs that have a project-types JSON file.
 * @returns {string[]}
 */
function listIndustriesWithProjectTypes() {
  return fs.readdirSync(PROJECT_TYPES_DIR).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
}

module.exports = {
  loadProjectTypesForIndustry,
  loadAllProjectTypes,
  listIndustriesWithProjectTypes,
  validateBlueprint,
};