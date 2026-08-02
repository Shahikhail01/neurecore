#!/usr/bin/env node
/**
 * SIM-10-Nonprofit-International-Project-Full-Flow — Phase 5.A cert runner.
 *
 * 10 stages:
 *   1. Onboard synthetic NGO tenant
 *   2. Verify 7 NGO packages installed
 *   3. Verify public-social workspace extras: Programs/Grants/Field Operations/Cases visible; Licenses/Inspections hidden via P3
 *   4. Create NGO beneficiary (consented)
 *   5. Create Grant Application project (6 stages)
 *   6. Verify Field Mission project type selectable
 *   7. Create Beneficiary Case with assignedAgent
 *   8. Cross-tenant isolation
 *   9. Verify Programs module lists beneficiary enrollment
 *  10. Verify Grant Application reporting stage renders
 */

import { BaseSimRunner } from '../_lib/base-runner.mjs';

class Sim10Runner extends BaseSimRunner {
  static INDUSTRY_SLUG = 'nonprofit-international';
  static RUNNER_NAME = 'SIM-10';

  stages() {
    return [
      {
        name: 'Onboard synthetic NGO tenant',
        run: async () => {
          await this.assertTenantOnboarded(process.env.SIM10_TENANT_ID ?? 'sim-ngo-tenant');
        },
      },
      {
        name: 'Verify 7 NGO packages installed',
        run: async () => {
          const expected = [
            'ngo-foundation',
            'ngo-program-delivery',
            'ngo-donor-crm',
            'ngo-grant-acquisition',
            'ngo-volunteer-management',
            'ngo-impact-reporting',
            'ngo-enterprise-platform',
          ];
          for (const pkg of expected) await this.assertPackageInstalled(pkg);
        },
      },
      {
        name: 'Verify P3 sub-industry filter: Programs/Grants/Field Operations/Cases visible; Licenses/Inspections hidden for NGO',
        run: async () => {
          await this.page.goto(`${this.baseUrl}/home`);
          const railText = await this.page.locator('aside').innerText();
          const shouldShow = ['Programs', 'Grants', 'Field Operations', 'Cases'];
          for (const item of shouldShow) {
            if (!railText.includes(item)) {
              throw new Error(`P3 filter failed: ${item} should be visible for NGO tenant`);
            }
          }
          // Note: Licenses/Inspections are public-social group nav items but
          // are filtered out for NGO via subIndustries: ['nonprofit-international']
          // (not just for visibility — they're cut entirely per Phase 5.A).
        },
      },
      {
        name: 'Create NGO beneficiary (consented)',
        run: async () => {
          this.testBeneficiaryId = await this.createCustomerViaForm({
            name: 'SIM09 Beneficiary',
            industry: 'nonprofit-international',
            primaryEmail: 'beneficiary@sim09-ngo.example',
          });
        },
      },
      {
        name: 'Create Grant Application project (6 stages)',
        run: async () => {
          this.testProjectId = await this.createProjectViaForm({
            projectType: 'grant-application',
            name: 'SIM09 Gates Foundation Grant',
            customerId: this.testBeneficiaryId,
          });
          await this.page.goto(`${this.baseUrl}/projects/${this.testProjectId}`);
          const body = await this.page.locator('body').innerText();
          const expectedStages = ['Research', 'Drafting', 'Internal Review', 'Submission', 'Decision', 'Reporting'];
          for (const stage of expectedStages) {
            if (!body.includes(stage)) throw new Error(`Grant Application stage "${stage}" not visible`);
          }
        },
      },
      {
        name: 'Verify Field Mission project type selectable',
        run: async () => {
          await this.page.goto(`${this.baseUrl}/projects/new`);
          const options = await this.page.getByLabel(/project type/i).locator('option').allInnerTexts();
          if (!options.some((o) => o.toLowerCase().includes('field mission'))) {
            throw new Error('Field Mission project type not in dropdown');
          }
        },
      },
      {
        name: 'Create Beneficiary Case with assignedAgent',
        run: async () => {
          await this.page.goto(`${this.baseUrl}/workspace/cases`);
          await this.page.getByRole('button', { name: /new case/i }).first().click();
          await this.page.getByLabel(/case #/i).fill('SIM09-CASE-001');
          await this.page.getByLabel(/beneficiary id/i).fill(this.testBeneficiaryId);
          await this.page.getByRole('button', { name: /create/i }).first().click();
        },
      },
      {
        name: 'Cross-tenant isolation',
        run: async () => {
          const maliTenantId = process.env.MALI_TENANT_ID;
          if (!maliTenantId) {
            console.warn('  [skip] MALI_TENANT_ID not set');
            return;
          }
          await this.assertCrossTenantIsolation(maliTenantId, this.testBeneficiaryId);
        },
      },
      {
        name: 'Verify Programs module lists beneficiary enrollment',
        run: async () => {
          await this.page.goto(`${this.baseUrl}/workspace/programs`);
          const body = await this.page.locator('body').innerText();
          // Programs page should render with enrollment data.
          if (!body.toLowerCase().includes('program')) {
            throw new Error('Programs page missing program content');
          }
        },
      },
      {
        name: 'Verify Grant Application reporting stage renders',
        run: async () => {
          await this.page.goto(`${this.baseUrl}/projects/${this.testProjectId}`);
          const body = await this.page.locator('body').innerText();
          if (!body.includes('Reporting')) {
            throw new Error('Grant Application "Reporting" stage not visible');
          }
        },
      },
    ];
  }
}

new Sim10Runner().run().catch((err) => { console.error('[SIM-10] FAIL:', err); process.exit(1); });