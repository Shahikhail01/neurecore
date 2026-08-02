'use strict';
/**
 * seed-package.cjs
 *
 * PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §4.2.3 (R2 helper 3) — idempotent
 * upsert of one Package row + M2M departments/agents/features.
 *
 * Idempotent: upsert on (industryId, tierId, slug) — the unique constraint
 * in schema.prisma:4200. Re-running with same inputs is a no-op.
 *
 * Phase 5.B (T8) extends this with optional `parentPackageSlug` once the
 * Package.parentPackageId FK is added.
 */

const { Prisma } = require('@prisma/client');

/**
 * @typedef {Object} PackageDef
 * @property {string} slug
 * @property {string} name
 * @property {string} [description]
 * @property {'FUNCTIONAL'|'VERTICAL'} scope
 * @property {string[]} [departmentTemplateSlugs=[]]
 * @property {string[]} [agentTemplateNames=[]]
 * @property {string[]} [featureKeys=[]]
 * @property {string} [parentPackageSlug]     // T8 — Phase 5.B
 * @property {number} [sortOrder=0]
 * @property {number} [suggestedAgentCount]
 * @property {number} [suggestedDepartmentCount]
 */

/**
 * @param {Object} args
 * @param {import('@prisma/client').PrismaClient} args.prisma
 * @param {string} args.industrySlug
 * @param {string} args.tierSlug               canonical: 'starter' | 'professional' | 'enterprise'
 * @param {PackageDef} args.packageDef
 * @param {boolean} [args.dryRun=false]
 */
async function seedPackage({ prisma, industrySlug, tierSlug, packageDef, dryRun = false }) {
  const industry = await prisma.industry.findUnique({ where: { slug: industrySlug } });
  if (!industry) throw new Error(`Industry not found: ${industrySlug}`);
  const tier = await prisma.tier.findUnique({ where: { slug: tierSlug } });
  if (!tier) throw new Error(`Tier not found: ${tierSlug}`);

  // T8 (Phase 5.B): resolve parentPackageSlug to parentPackageId.
  // Parent package MUST be in the same (industryId, tierId) — keeps the FK
  // semantic simple. Cross-group inheritance is resolved at onboarding
  // time via the resolver (not via direct FK), allowing the parent to be
  // in a different industry/tier pair.
  let parentPackageId = null;
  if (packageDef.parentPackageSlug) {
    const parent = await prisma.package.findFirst({
      where: {
        slug: packageDef.parentPackageSlug,
        industryId: industry.id,
        tierId: tier.id,
      },
      select: { id: true },
    });
    if (parent) parentPackageId = parent.id;
  }

  if (dryRun) {
    console.log(`[DRY] Package ${packageDef.slug} (${industrySlug}/${tierSlug}, ${packageDef.scope})${packageDef.parentPackageSlug ? ` [parent=${packageDef.parentPackageSlug}]` : ''}`);
    return;
  }

  const upserted = await prisma.package.upsert({
    where: { industryId_tierId_slug: { industryId: industry.id, tierId: tier.id, slug: packageDef.slug } },
    create: {
      slug: packageDef.slug,
      name: packageDef.name,
      description: packageDef.description ?? null,
      scope: packageDef.scope,
      sortOrder: packageDef.sortOrder ?? 0,
      industryId: industry.id,
      tierId: tier.id,
      parentPackageId,
      suggestedAgentCount: packageDef.suggestedAgentCount ?? null,
      suggestedDepartmentCount: packageDef.suggestedDepartmentCount ?? null,
    },
    update: {
      name: packageDef.name,
      description: packageDef.description ?? null,
      scope: packageDef.scope,
      sortOrder: packageDef.sortOrder ?? 0,
      parentPackageId,
      suggestedAgentCount: packageDef.suggestedAgentCount ?? null,
      suggestedDepartmentCount: packageDef.suggestedDepartmentCount ?? null,
    },
  });

  if (packageDef.departmentTemplateSlugs?.length) {
    const depts = await prisma.departmentTemplate.findMany({
      where: { slug: { in: packageDef.departmentTemplateSlugs } },
    });
    await prisma.package.update({
      where: { id: upserted.id },
      data: { departments: { set: depts.map((d) => ({ id: d.id })) } },
    });
  }

  if (packageDef.agentTemplateNames?.length) {
    const ags = await prisma.agentTemplate.findMany({
      where: { name: { in: packageDef.agentTemplateNames }, tenantId: null },
    });
    await prisma.package.update({
      where: { id: upserted.id },
      data: { aiAgents: { set: ags.map((a) => ({ id: a.id })) } },
    });
  }

  if (packageDef.featureKeys?.length) {
    const feats = await prisma.feature.findMany({
      where: { key: { in: packageDef.featureKeys } },
    });
    await prisma.package.update({
      where: { id: upserted.id },
      data: { features: { set: feats.map((f) => ({ id: f.id })) } },
    });
  }
}

module.exports = { seedPackage };