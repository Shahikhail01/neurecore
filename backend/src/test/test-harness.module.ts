// src/test/test-harness.module.ts
import { Module } from '@nestjs/common';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { CorrelationService } from '../common/correlation/correlation.service';

export interface TestTenant {
  id: string;
  name: string;
  industry: string;
  tier: string;
  reset(): Promise<void>;
}

export interface GoldenScenarioData {
  customer: { name: string; industry: string };
  project: { name: string; goal: string; task: string };
  aiEmployee: { role: string; capabilities: string[] };
}

export const RECONSTRUCTION_TEST_TENANT_ID = 'reconstruction-test-tenant';

@Module({})
export class TestHarnessModule {
  static async provisionReconstructionTenant(prisma: PrismaService): Promise<TestTenant> {
    const existing = await prisma.tenant.findUnique({
      where: { id: RECONSTRUCTION_TEST_TENANT_ID },
    });

    if (!existing) {
      await prisma.tenant.create({
        data: {
          id: RECONSTRUCTION_TEST_TENANT_ID,
          name: 'Reconstruction Test Tenant',
          industry: 'accounting',
          status: 'ACTIVE',
        } as any,
      });
    }

    return {
      id: RECONSTRUCTION_TEST_TENANT_ID,
      name: 'Reconstruction Test Tenant',
      industry: 'accounting',
      tier: 'professional',
      async reset() {
        await prisma.task.deleteMany({ where: { project: { tenantId: this.id } } });
        await prisma.goal.deleteMany({ where: { project: { tenantId: this.id } } });
        await prisma.project.deleteMany({ where: { tenantId: this.id } });
        await prisma.executionAttempt.deleteMany({ where: { tenantId: this.id } });
        await prisma.review.deleteMany({ where: { tenantId: this.id } });
        await prisma.evidenceArtifact.deleteMany({ where: { tenantId: this.id } });
      },
    };
  }

  static getGoldenScenario(): GoldenScenarioData {
    return {
      customer: { name: 'Acme Accounting LLC', industry: 'accounting' },
      project: {
        name: 'Monthly Close Q3 2026',
        goal: 'Complete monthly accounting close',
        task: 'Reconcile bank statements',
      },
      aiEmployee: {
        role: 'Staff Accountant',
        capabilities: ['data_entry', 'reconciliation', 'reporting'],
      },
    };
  }
}
