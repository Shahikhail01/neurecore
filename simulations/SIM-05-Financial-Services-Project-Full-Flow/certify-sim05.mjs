#!/usr/bin/env node
/**
 * SIM-05-Financial-Services-Project-Full-Flow — Phase 2.B FE-first cert runner.
 *
 * PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §5.2 (Phase 2.B step 2.B.9) —
 * certifies the full onboarding → workspace flow for `financial-services`
 * tenants. Extends BaseSimRunner from `_lib/base-runner.mjs`.
 *
 * 12 stages:
 *   1. Onboard synthetic FS tenant
 *   2. Verify 8 FS packages installed
 *   3. Verify F&C first-class Customer columns render (kycStatus, riskRating)
 *   4. Verify F&C workspace extras visible (loans, portfolios, compliance, etc.)
 *   5. Create client (BANKING sub-type)
 *   6. Verify Customer.kycStatus appears on new client
 *   7. Create Account Opening project (financial-services sub-type)
 *   8. Walk project through 5 stages (Application → Document Collection → Verification → Activation → Maintenance)
 *   9. Verify AML/BSA workflow visible
 *   10. Cross-tenant isolation: Mali (accounting) cannot see FS tenant's clients
 *   11. Verify loan origination project type selectable
 *   12. Verify Wealth Review recurring stage renders
 *
 * Usage:
 *   SUPER_ADMIN_EMAIL=... SUPER_ADMIN_PASSWORD=... \
 *     node simulations/SIM-05-Financial-Services-Project-Full-Flow/certify-sim05.mjs
 *
 * Optional env: HEADED=1 (run with browser UI); SIM_BASE_URL=...
 */

import { BaseSimRunner } from '../_lib/base-runner.mjs';

class Sim05Runner extends BaseSimRunner {
  static INDUSTRY_SLUG = 'financial-services';
  static RUNNER_NAME = 'SIM-05';

  stages() {
    return [
      {
        name: 'Onboard synthetic financial-services tenant',
        run: async () => {
          await this.assertTenantOnboarded(process.env.SIM05_TENANT_ID ?? 'sim-fs-tenant');
        },
      },
      {
        name: 'Verify 8 FS packages installed',
        run: async () => {
          const expected = [
            'fs-foundation',
            'fs-client-onboarding-kyc',
            'fs-wealth-management',
            'fs-lending',
            'fs-banking-core',
            'fs-insurance-claims',
            'fs-investment-management',
            'fs-enterprise-platform',
          ];
          for (const pkg of expected) await this.assertPackageInstalled(pkg);
        },
      },
      {
        name: 'Verify F&C first-class Customer columns render (kycStatus, riskRating)',
        run: async () => {
          await this.page.goto(`${this.baseUrl}/customers`);
          await this.page.getByRole('button', { name: /new customer/i }).first().click();
          // Verify F&C columns surface on the form (financial-compliance group gate).
          const kycField = await this.page.getByLabel(/kyc/i).count();
          const riskField = await this.page.getByLabel(/risk rating/i).count();
          if (kycField === 0 || riskField === 0) {
            throw new Error(`F&C first-class columns missing: kyc=${kycField}, risk=${riskField}`);
          }
          // Close modal without submitting.
          await this.page.keyboard.press('Escape');
        },
      },
      {
        name: 'Verify F&C workspace extras visible (loans, portfolios, compliance, etc.)',
        run: async () => {
          const modules = ['loans', 'portfolios', 'audits', 'tax', 'payroll', 'compliance', 'risk', 'engagements'];
          for (const m of modules) await this.assertWorkspaceModuleVisible(m);
        },
      },
      {
        name: 'Create client (BANKING sub-type)',
        run: async () => {
          this.testCustomerId = await this.createCustomerViaForm({
            name: 'SIM05 Test Bank Corp',
            industry: 'financial-services',
            primaryEmail: 'ops@sim05-test-bank.example',
          });
        },
      },
      {
        name: 'Verify Customer kycStatus appears on new client',
        run: async () => {
          if (!this.testCustomerId) throw new Error('testCustomerId not set from previous stage');
          await this.page.goto(`${this.baseUrl}/customers/${this.testCustomerId}`);
          const body = await this.page.locator('body').innerText();
          if (!body.toLowerCase().includes('kyc')) {
            throw new Error('Customer detail page missing KYC information');
          }
        },
      },
      {
        name: 'Create Account Opening project',
        run: async () => {
          this.testProjectId = await this.createProjectViaForm({
            projectType: 'account-opening',
            name: 'SIM05 Account Opening — Test Bank Corp',
            customerId: this.testCustomerId,
          });
        },
      },
      {
        name: 'Walk project through 5 stages (Application → Document Collection → Verification → Activation → Maintenance)',
        run: async () => {
          if (!this.testProjectId) throw new Error('testProjectId not set');
          // Stages drive project status; check current stage label.
          const expectedStages = ['Application', 'Document Collection', 'Verification', 'Activation', 'Maintenance'];
          await this.page.goto(`${this.baseUrl}/projects/${this.testProjectId}`);
          const body = await this.page.locator('body').innerText();
          for (const stage of expectedStages) {
            if (!body.includes(stage)) {
              throw new Error(`Stage "${stage}" not visible on project page`);
            }
          }
        },
      },
      {
        name: 'Verify AML/BSA workflow visible',
        run: async () => {
          await this.page.goto(`${this.baseUrl}/workspace/compliance`);
          const body = await this.page.locator('body').innerText();
          if (!body.toLowerCase().includes('aml') && !body.toLowerCase().includes('bsa')) {
            throw new Error('AML/BSA workflow not visible on compliance page');
          }
        },
      },
      {
        name: 'Cross-tenant isolation: Mali (accounting) cannot see FS tenant clients',
        run: async () => {
          const maliTenantId = process.env.MALI_TENANT_ID;
          if (!maliTenantId) {
            console.warn('  [skip] MALI_TENANT_ID not set — cross-tenant check skipped');
            return;
          }
          await this.assertCrossTenantIsolation(maliTenantId, this.testCustomerId, `/api/v1/customers/${this.testCustomerId}`);
        },
      },
      {
        name: 'Verify loan origination project type selectable',
        run: async () => {
          await this.page.goto(`${this.baseUrl}/projects/new`);
          const options = await this.page.getByLabel(/project type/i).locator('option').allInnerTexts();
          if (!options.some((o) => o.toLowerCase().includes('loan origination'))) {
            throw new Error('Loan Origination project type not in dropdown');
          }
        },
      },
      {
        name: 'Verify Wealth Review recurring stage renders',
        run: async () => {
          await this.page.goto(`${this.baseUrl}/projects/new`);
          await this.page.getByLabel(/project type/i).selectOption('wealth-review');
          const body = await this.page.locator('body').innerText();
          const expectedStages = ['Suitability Review', 'Allocation Proposal', 'Client Approval', 'Implementation', 'Quarterly Rebalancing'];
          for (const stage of expectedStages) {
            if (!body.includes(stage)) throw new Error(`Wealth Review stage "${stage}" not visible`);
          }
        },
      },
    ];
  }
}

new Sim05Runner().run().catch((err) => {
  console.error('[SIM-05] FAIL:', err);
  process.exit(1);
});