'use strict';
/**
 * seed-tenant-template-rows.cjs
 *
 * PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §4.2.2 addendum (R2 helper 5) —
 * writes TenantTemplate rows (the OTHER tenant template model).
 *
 * IMPORTANT (course correction 2026-07-31):
 * The platform has TWO tenant-template models:
 *   1. `DepartmentTemplate` (schema.prisma:1346) — what seed-tenant-template.cjs
 *      writes. Models a department structure JSON + isPublic/category/tags.
 *      Linked from Package.departments (M2M).
 *   2. `TenantTemplate` (schema.prisma:5435) — a richer model with
 *      templateType (CUSTOMER_LIFECYCLE | AGENT_ROLE | ROUTINE | REPORT |
 *      TASK_TEMPLATE | DEPARTMENT_DEFAULT), config: Json, and
 *      per-tenant scoping. The platform lifecycle/role seeder service
 *      (`tenant-template-seeder.service.ts`) consumes this model.
 *
 * Industry seeders that need both models use:
 *   - seedTenantTemplate() to write DepartmentTemplate rows.
 *   - seedTenantTemplateRows() to write TenantTemplate rows for a given
 *     templateType.
 *
 * For Phase 2.B (FS) + future Phases, we write DEPARTMENT_DEFAULT rows so
 * new tenants get the matching tenant template when they onboard.
 */

const { Prisma } = require('@prisma/client');

const VALID_TEMPLATE_TYPES = ['CUSTOMER_LIFECYCLE', 'AGENT_ROLE', 'ROUTINE', 'REPORT', 'TASK_TEMPLATE', 'DEPARTMENT_DEFAULT'];

/**
 * @typedef {Object} TenantTemplateRow
 * @property {string} slug
 * @property {string} name
 * @property {string} [description]
 * @property {'CUSTOMER_LIFECYCLE'|'AGENT_ROLE'|'ROUTINE'|'REPORT'|'TASK_TEMPLATE'|'DEPARTMENT_DEFAULT'} templateType
 * @property {string} [industrySlug]      industry association; null = global
 * @property {Object} config               JSON config payload
 * @property {string} [sourceSeedId]
 * @property {number} [version=1]
 */

/**
 * @param {Object} args
 * @param {import('@prisma/client').PrismaClient} args.prisma
 * @param {TenantTemplateRow[]} args.rows
 * @param {boolean} [args.dryRun=false]
 */
async function seedTenantTemplateRows({ prisma, rows, dryRun = false }) {
  if (dryRun) {
    for (const r of rows) {
      if (!VALID_TEMPLATE_TYPES.includes(r.templateType)) {
        throw new Error(`Invalid templateType: ${r.templateType} (must be one of ${VALID_TEMPLATE_TYPES.join(', ')})`);
      }
      console.log(`[DRY] TenantTemplate ${r.slug} (${r.templateType}, industry=${r.industrySlug ?? 'global'})`);
    }
    return { count: rows.length };
  }

  let count = 0;
  for (const r of rows) {
    if (!VALID_TEMPLATE_TYPES.includes(r.templateType)) {
      throw new Error(`Invalid templateType: ${r.templateType}`);
    }

    const existing = await prisma.tenantTemplate.findUnique({
      where: {
        tenantId_slug_templateType: {
          tenantId: null, // platform-level template
          slug: r.slug,
          templateType: r.templateType,
        },
      },
    });

    if (existing) {
      await prisma.tenantTemplate.update({
        where: { id: existing.id },
        data: {
          name: r.name,
          description: r.description ?? null,
          industrySlug: r.industrySlug ?? null,
          config: r.config,
          version: r.version ?? 1,
        },
      });
    } else {
      await prisma.tenantTemplate.create({
        data: {
          tenantId: null,
          slug: r.slug,
          name: r.name,
          description: r.description ?? null,
          templateType: r.templateType,
          industrySlug: r.industrySlug ?? null,
          config: r.config,
          sourceSeedId: r.sourceSeedId ?? null,
          version: r.version ?? 1,
          isActive: true,
        },
      });
    }
    count++;
  }

  return { count };
}

module.exports = { seedTenantTemplateRows, VALID_TEMPLATE_TYPES };