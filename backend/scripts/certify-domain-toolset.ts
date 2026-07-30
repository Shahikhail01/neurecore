import { PrismaClient } from '@prisma/client';
import {
  approvalRequiredTools,
  NC_TOOL_NAMES,
  ncToolSchemas,
} from '../src/modules/hermes-adapter/tools/scoped-tool.schemas';
import {
  AWL_CERTIFICATION_STATUS,
  AWL_CERTIFIED_DOMAIN,
  AWL_CERTIFIED_EXECUTION_PLANE,
  certifiedPlatformTemplateWhere,
} from '../src/modules/agent-templates/agent-template-certification';

const SUPPORTED_DOMAINS = new Set(['accounting', AWL_CERTIFIED_DOMAIN]);
const REQUIRED_APPROVAL_TOOLS = new Set([
  'nc.create_customer',
  'nc.create_project',
  'nc.send_notification',
]);

async function main() {
  const domainArg = process.argv.find((arg) => arg.startsWith('--domain='));
  const domain = (domainArg?.split('=')[1] ?? 'accounting').trim();
  const sourceOnly = process.argv.includes('--source-only');

  if (!SUPPORTED_DOMAINS.has(domain)) {
    throw new Error(`Unsupported Phase 4 domain: ${domain}`);
  }

  const toolNames = new Set(NC_TOOL_NAMES);
  if (toolNames.size !== NC_TOOL_NAMES.length) {
    throw new Error('Duplicate scoped tool names detected');
  }

  if (![...toolNames].every((name) => name.startsWith('nc.'))) {
    throw new Error('Non-NeureCore tool exposed in scoped catalog');
  }

  for (const toolName of NC_TOOL_NAMES) {
    const schema = ncToolSchemas[toolName];
    if (!schema || typeof schema.safeParse !== 'function') {
      throw new Error(`Missing executable schema for ${toolName}`);
    }
  }

  const actualApprovalTools = new Set([...approvalRequiredTools]);
  for (const required of REQUIRED_APPROVAL_TOOLS) {
    if (!actualApprovalTools.has(required as never)) {
      throw new Error(`Required approval tool is not guarded: ${required}`);
    }
  }
  for (const actual of actualApprovalTools) {
    if (!REQUIRED_APPROVAL_TOOLS.has(actual)) {
      throw new Error(`Unexpected approval-required scoped tool: ${actual}`);
    }
  }

  const report: Record<string, unknown> = {
    gate: 'nc_certify_toolset',
    domain: AWL_CERTIFIED_DOMAIN,
    status: 'PASS',
    executionPlane: AWL_CERTIFIED_EXECUTION_PLANE,
    sourceOnly,
    scopedToolCount: NC_TOOL_NAMES.length,
    approvalRequiredTools: [...actualApprovalTools].sort(),
    templateCertification: {
      status: AWL_CERTIFICATION_STATUS,
      where: certifiedPlatformTemplateWhere(),
    },
  };

  if (!sourceOnly) {
    const prisma = new PrismaClient();
    try {
      const certifiedTemplates = await prisma.agentTemplate.count({
        where: certifiedPlatformTemplateWhere(),
      });
      const publicTemplates = await prisma.agentTemplate.count({
        where: {
          tenantId: null,
          isPublic: true,
          deprecatedAt: null,
        },
      });
      report.templateCertification = {
        ...(report.templateCertification as Record<string, unknown>),
        certifiedTemplates,
        uncertifiedPublicTemplatesRemainShadow:
          publicTemplates - certifiedTemplates,
      };
      if (certifiedTemplates < 1) {
        throw new Error('No certified accounting platform templates found');
      }
    } finally {
      await prisma.$disconnect();
    }
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
