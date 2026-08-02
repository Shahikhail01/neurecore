// backend/prisma/migrate-healthcare.cjs (one-shot)
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const r = await p.tenant.updateMany({
    where: { industry: 'healthcare-life-sciences' },
    data: { industry: 'professional-business-services', industryGroup: 'business-technology' },
  });
  console.log('migrated:', r.count, 'tenants');
  await p.$disconnect();
})();