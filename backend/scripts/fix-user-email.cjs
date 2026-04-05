#!/usr/bin/env node
/**
 * Fix Demo User Email Script
 * Updates the demo user to have a valid email address
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Fixing demo user email...');

  // Find and update the user with the invalid email
  const updatedUser = await prisma.user.updateMany({
    where: {
      email: 'demo@marketing agency.local',
    },
    data: {
      email: 'demo@marketing-agency.local',
    },
  });

  console.log(`✅ Updated ${updatedUser.count} users`);

  // Verify the update
  const user = await prisma.user.findFirst({
    where: {
      email: 'demo@marketing-agency.local',
    },
  });

  if (user) {
    console.log(`✅ User found: ${user.email} (id: ${user.id})`);
  } else {
    console.log('⚠️ User not found after update');
  }

  await prisma.$disconnect();
}

main().catch(console.error);
