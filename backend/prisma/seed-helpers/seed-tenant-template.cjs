'use strict';
/**
 * seed-tenant-template.cjs
 *
 * PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §4.2.2 (R2 helper 2) — idempotent upsert
 * of one DepartmentTemplate row + its AgentTemplate rows.
 *
 * Idempotent: re-running with same `slug` produces identical output. No
 * env-loading boilerplate (caller uses load-env.cjs). No Prisma init boilerplate
 * (caller passes its own Prisma client).
 *
 * Used by every per-Industry tenant-template seeder (Phase 2.B, 3.B, 4.A, 4.B,
 * 5.A, 5.B). Refactored seeders using this helper shrink to ~50 lines.
 */

const { Prisma } = require('@prisma/client');

/**
 * @typedef {Object} SlotDef
 * @property {string} name
 * @property {string} [description]
 * @property {'EXECUTIVE'|'CORE'|'FUNCTIONAL'} type
 * @property {string} [parentSlug]
 */

/**
 * @typedef {Object} AgentDef
 * @property {string} name                (will become AgentTemplate.name; lookup by name)
 * @property {string} [description]       (AgentTemplate.description)
 * @property {string} [systemPrompt]      (AgentTemplate.systemPrompt)
 * @property {'FUNCTIONAL'|'EXECUTIVE'} [type]
 * @property {string} [model]
 * @property {string} [departmentName]    (links agent to a DepartmentTemplate slot by name)
 */

/**
 * @param {Object} args
 * @param {import('@prisma/client').PrismaClient} args.prisma
 * @param {string} args.slug                DepartmentTemplate.slug (unique)
 * @param {string} args.name                DepartmentTemplate.name
 * @param {string} [args.description]       DepartmentTemplate.description
 * @param {string} args.category            DepartmentTemplate.category (free-text; P13 will enum)
 * @param {SlotDef[]} args.structure        DepartmentTemplate.structure JSON
 * @param {AgentDef[]} [args.agents]         AgentTemplate rows to create (no slug on AgentTemplate)
 * @param {Object} [args.options]
 * @param {boolean} [args.options.isPublic=true]
 * @param {string[]} [args.options.tags=[]]
 * @param {boolean} [args.options.dryRun=false]
 * @returns {Promise<{templateId:string, agentIds:string[]}>}
 */
async function seedTenantTemplate({ prisma, slug, name, description, category, structure, agents = [], options = {} }) {
  const { isPublic = true, tags = [], dryRun = false } = options;

  if (dryRun) {
    console.log(`[DRY] DepartmentTemplate ${slug}: ${structure.length} dept slots, ${agents.length} agents`);
    return { templateId: 'dry-run', agentIds: [] };
  }

  const upserted = await prisma.departmentTemplate.upsert({
    where: { slug },
    create: {
      slug,
      name,
      description: description ?? null,
      category,
      structure: structure ?? [],
      isPublic,
      tags,
    },
    update: {
      name,
      description: description ?? null,
      category,
      structure: structure ?? [],
      isPublic,
      tags,
    },
  });

  const agentIds = [];
  for (const a of agents) {
    // AgentTemplate has no slug; match by (tenantId=null, name) which is the
    // canonical "platform template" lookup. Note: tenantId must be null for
    // platform templates per the schema.
    const existing = await prisma.agentTemplate.findFirst({
      where: { name: a.name, tenantId: null },
    });

    const data = {
      name: a.name,
      description: a.description ?? null,
      type: a.type ?? 'FUNCTIONAL',
      model: a.model ?? 'gpt-4o-mini',
      systemPrompt: a.systemPrompt ?? null,
      tenantId: null,
      isPublic: true,
      enabled: true,
    };

    const upsertedAgent = existing
      ? await prisma.agentTemplate.update({ where: { id: existing.id }, data })
      : await prisma.agentTemplate.create({ data });

    agentIds.push(upsertedAgent.id);
  }

  return { templateId: upserted.id, agentIds };
}

module.exports = { seedTenantTemplate };