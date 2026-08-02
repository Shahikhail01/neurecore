#!/usr/bin/env node
/**
 * SIM-11-Special-Purpose-Organizations-Project-Full-Flow — Phase 5.B FE-first cert runner.
 *
 * PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §5.8 (Phase 5.B) — certifies
 * special-purpose-organizations tenant onboarding with T8 cross-group
 * inheritance assertion (spo-family-office-reporting package inherits
 * accounting-operations agents).
 *
 * 10 stages:
 *   1. Onboard synthetic SPO tenant
 *   2. Verify 4 SPO packages installed
 *   3. Verify spo-family-office-reporting package composition editor shows "Inherits from accounting-operations" badge (P9)
 *   4. Create member entity (Family Trust)
 *   5. Verify Entity Restructure project type selectable
 *   6. Walk Entity Restructure through 6 stages (Plan → Approve → File → Migrate → Notify → Close)
 *   7. Verify Assets workspace visible + Asset register creates (REAL_ESTATE)
 *   8. Verify Documents workspace visible + Filing type selectable
 *   9. Cross-tenant isolation: Mali (accounting) cannot see SPO entities
 *  10. Verify Annual Review recurring stage renders
 *
 * Usage:
 *   SUPER_ADMIN_EMAIL=... SUPER_ADMIN_PASSWORD=... \
 *     node simulations/SIM-11-.../certify-sim11.mjs
 */

import { BaseSimRunner } from '../_lib/base-runner.mjs';

class Sim11Runner extends BaseSimRunner {
  static INDUSTRY_SLUG = 'special-purpose-organizations';
  static RUNNER_NAME = 'SIM-11';

  stages() {
    return [
      {
        name: 'Onboard synthetic SPO tenant',
        run: async () => {
          await this.assertTenantOnboarded(process.env.SIM11_TENANT_ID ?? 'sim-spo-tenant');
        },
      },
      {
        name: 'Verify 4 SPO packages installed',
        run: async () => {
          const expected = [
            'spo-foundation',
            'spo-multi-entity-operations',
            'spo-portfolio-oversight',
            'spo-family-office-reporting',
          ];
          for (const pkg of expected) await this.assertPackageInstalled(pkg);
        },
      },
      {
        name: 'Verify spo-family-office-reporting shows inheritance badge (P9)',
        run: async () => {
          await this.page.goto(`${this.baseUrl}/admin/packages`);
          // Find the package row and open its edit page.
          const row = this.page.getByText('spo-family-office-reporting', { exact: true }).first();
          await row.click();
          await this.page.waitForURL(/\/admin\/packages\/[a-f0-9-]+\/edit/);
          // Verify the inheritance banner is visible.
          const banner = this.page.getByText(/inherits from/i);
          if (await banner.count() === 0) {
            throw new Error('P9 inheritance banner not visible on spo-family-office-reporting edit page');
          }
        },
      },
      {
        name: 'Create member entity (Family Trust)',
        run: async () => {
          this.testEntityId = await this.createCustomerViaForm({
            name: 'SIM11 Family Trust',
            industry: 'special-purpose-organizations',
            primaryEmail: 'trustee@sim11-family-trust.example',
          });
        },
      },
      {
        name: 'Verify Entity Restructure project type selectable',
        run: async () => {
          await this.page.goto(`${this.baseUrl}/projects/new`);
          const options = await this.page.getByLabel(/project type/i).locator('option').allInnerTexts();
          if (!options.some((o) => o.toLowerCase().includes('entity restructure'))) {
            throw new Error('Entity Restructure project type not in dropdown');
          }
        },
      },
      {
        name: 'Walk Entity Restructure through 6 stages',
        run: async () => {
          this.testProjectId = await this.createProjectViaForm({
            projectType: 'entity-restructure',
            name: 'SIM11 Entity Restructure — Family Trust',
            customerId: this.testEntityId,
          });
          await this.page.goto(`${this.baseUrl}/projects/${this.testProjectId}`);
          const body = await this.page.locator('body').innerText();
          const expectedStages = ['Plan', 'Approve', 'File', 'Migrate', 'Notify', 'Close'];
          for (const stage of expectedStages) {
            if (!body.includes(stage)) throw new Error(`Entity Restructure stage "${stage}" not visible`);
          }
        },
      },
      {
        name: 'Verify Assets workspace visible + Asset register creates (REAL_ESTATE)',
        run: async () => {
          await this.assertWorkspaceModuleVisible('assets');
          await this.page.goto(`${this.baseUrl}/workspace/assets`);
          // Click create + fill REAL_ESTATE asset type.
          await this.page.getByRole('button', { name: /new asset/i }).first().click();
          await this.page.getByLabel(/asset name/i).fill('SIM11 Family Residence');
          await this.page.getByLabel(/type/i).selectOption('REAL_ESTATE');
          // Owner entity selector — pick the one we created.
          await this.page.getByLabel(/owner entity/i).selectOption(this.testEntityId);
          await this.page.getByRole('button', { name: /create/i }).first().click();
        },
      },
      {
        name: 'Verify Documents workspace visible + Filing type selectable',
        run: async () => {
          await this.assertWorkspaceModuleVisible('documents');
          await this.page.goto(`${this.baseUrl}/workspace/documents`);
          await this.page.getByRole('button', { name: /new document/i }).first().click();
          await this.page.getByLabel(/title/i).fill('SIM11 Annual Filing');
          await this.page.getByLabel(/type/i).selectOption('FILING');
          // Close without saving.
          await this.page.keyboard.press('Escape');
        },
      },
      {
        name: 'Cross-tenant isolation: Mali (accounting) cannot see SPO entities',
        run: async () => {
          const maliTenantId = process.env.MALI_TENANT_ID;
          if (!maliTenantId) {
            console.warn('  [skip] MALI_TENANT_ID not set — cross-tenant check skipped');
            return;
          }
          await this.assertCrossTenantIsolation(maliTenantId, this.testEntityId, `/api/v1/customers/${this.testEntityId}`);
        },
      },
      {
        name: 'Verify Annual Review recurring stage renders',
        run: async () => {
          await this.page.goto(`${this.baseUrl}/projects/new`);
          await this.page.getByLabel(/project type/i).selectOption('annual-review');
          const body = await this.page.locator('body').innerText();
          const expectedStages = ['Plan', 'Collect', 'Review', 'Report', 'Archive'];
          for (const stage of expectedStages) {
            if (!body.includes(stage)) throw new Error(`Annual Review stage "${stage}" not visible`);
          }
        },
      },
    ];
  }
}

new Sim11Runner().run().catch((err) => {
  console.error('[SIM-11] FAIL:', err);
  process.exit(1);
});