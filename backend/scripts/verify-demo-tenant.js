#!/usr/bin/env node
/**
 * Demo Tenant Verification Script
 * Verifies the demo tenant data is correctly set up in the database
 *
 * Usage: node verify-demo-tenant.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('='.repeat(60));
  console.log('🔍 Demo Tenant Verification');
  console.log('='.repeat(60));

  try {
    // Find the demo tenant
    const tenant = await prisma.tenant.findUnique({
      where: { slug: 'growth-marketing-agency' },
    });

    if (!tenant) {
      console.log('❌ Demo tenant not found!');
      process.exit(1);
    }

    console.log(`\n✅ Tenant found: ${tenant.name} (${tenant.slug})`);
    console.log(`   ID: ${tenant.id}`);
    console.log(`   Industry: ${tenant.industry}`);
    console.log(`   Status: ${tenant.status}`);

    // Get users
    const users = await prisma.user.findMany({
      where: { tenantId: tenant.id },
    });
    console.log(`\n✅ Users: ${users.length}`);
    users.forEach((u) => console.log(`   - ${u.email} (${u.role})`));

    // Get departments
    const departments = await prisma.department.findMany({
      where: { tenantId: tenant.id },
    });
    console.log(`\n✅ Departments: ${departments.length}`);
    departments.forEach((d) => console.log(`   - ${d.name}`));

    // Get agents
    const agents = await prisma.agent.findMany({
      where: { tenantId: tenant.id },
    });
    console.log(`\n✅ AI Agents: ${agents.length}`);
    agents.forEach((a) => console.log(`   - ${a.name} (${a.type})`));

    // Get tool integrations
    const toolIntegrations = await prisma.toolIntegration.findMany({
      where: { tenantId: tenant.id },
    });
    console.log(`\n✅ Tool Integrations: ${toolIntegrations.length}`);
    toolIntegrations.forEach((t) =>
      console.log(`   - ${t.name} (${t.category})`),
    );

    // Get workflows
    const workflows = await prisma.workflow.findMany({
      where: { tenantId: tenant.id },
    });
    console.log(`\n✅ Workflows: ${workflows.length}`);
    workflows.forEach((w) => console.log(`   - ${w.name} (${w.status})`));

    // Get tasks
    const tasks = await prisma.task.findMany({
      where: { tenantId: tenant.id },
    });
    console.log(`\n✅ Tasks: ${tasks.length}`);
    tasks
      .slice(0, 5)
      .forEach((t) => console.log(`   - ${t.title} (${t.status})`));
    if (tasks.length > 5) {
      console.log(`   ... and ${tasks.length - 5} more`);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Demo Tenant Summary');
    console.log('='.repeat(60));
    console.log(`Tenant: ${tenant.name}`);
    console.log(`Login: demo@marketing agency.local`);
    console.log(`Password: Marketing@123!`);
    console.log('\nCreated:');
    console.log(`  - ${departments.length} Departments`);
    console.log(`  - ${agents.length} AI Agents`);
    console.log(`  - ${toolIntegrations.length} Tool Integrations`);
    console.log(`  - ${workflows.length} Workflows`);
    console.log(`  - ${tasks.length} Tasks`);

    console.log('\n✅ Demo tenant verification complete!');
    console.log('\nTo access the demo tenant:');
    console.log(
      '1. Start the backend server: cd backend && pnpm run start:dev',
    );
    console.log('2. Start the frontend: cd frontend-tenant && pnpm run dev');
    console.log('3. Login with: demo@marketing agency.local / Marketing@123!');

    await prisma.$disconnect();
  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    console.error(error.stack);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
