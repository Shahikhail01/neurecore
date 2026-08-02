#!/usr/bin/env node
/**
 * SIM-07-Professional-Business-Services-Project-Full-Flow — Phase 3.B cert runner.
 *
 * 10 stages:
 *   1. Onboard synthetic pro-business-services tenant
 *   2. Verify 5 packages installed (T3: legal excluded)
 *   3. Verify B&T workspace extras (Phase 3.A reuse)
 *   4. Create consulting client
 *   5. Create Consulting Engagement project (5 stages)
 *   6. Verify Recruiting Search project type selectable
 *   7. Walk Recruiting Search through 4 stages
 *   8. Create Knowledge Base article
 *   9. Cross-tenant isolation
 *  10. Verify professional-legal package NOT in /admin/packages (T3 cut verified)
 */

import { BaseSimRunner } from '../_lib/base-runner.mjs';

class Sim07Runner extends BaseSimRunner {
  static INDUSTRY_SLUG = 'professional-business-services';
  static RUNNER_NAME = 'SIM-07';

  stages() {
    return [
      {
        name: 'Onboard synthetic pro-business-services tenant',
        run: async () => {
          await this.assertTenantOnboarded(process.env.SIM07_TENANT_ID ?? 'sim-pro-tenant');
        },
      },
      {
        name: 'Verify 5 pro-business packages installed (T3: legal excluded)',
        run: async () => {
          const expected = [
            'professional-consulting',
            'professional-business-dev',
            'professional-research-knowledge',
            'professional-recruiting',
            'professional-advisory-firm',
          ];
          for (const pkg of expected) await this.assertPackageInstalled(pkg);
          // T3: verify legal was CUT.
          await this.page.goto(`${this.baseUrl}/admin/packages`);
          const legalCount = await this.page.getByText('professional-legal', { exact: true }).count();
          if (legalCount > 0) {
            throw new Error('T3 cut failed: professional-legal still visible in /admin/packages');
          }
        },
      },
      {
        name: 'Verify B&T workspace extras (Phase 3.A reuse)',
        run: async () => {
          for (const m of ['tickets', 'releases', 'contracts', 'knowledge']) await this.assertWorkspaceModuleVisible(m);
        },
      },
      {
        name: 'Create consulting client',
        run: async () => {
          this.testCustomerId = await this.createCustomerViaForm({
            name: 'SIM07 Beta Consulting',
            industry: 'professional-business-services',
            primaryEmail: 'engagement@sim07-beta.example',
          });
        },
      },
      {
        name: 'Create Consulting Engagement project (5 stages)',
        run: async () => {
          this.testProjectId = await this.createProjectViaForm({
            projectType: 'consulting-engagement',
            name: 'SIM07 Strategy Engagement',
            customerId: this.testCustomerId,
          });
          await this.page.goto(`${this.baseUrl}/projects/${this.testProjectId}`);
          const body = await this.page.locator('body').innerText();
          const expectedStages = ['Discovery', 'Analysis', 'Recommendation', 'Implementation', 'Close'];
          for (const stage of expectedStages) {
            if (!body.includes(stage)) throw new Error(`Consulting Engagement stage "${stage}" not visible`);
          }
        },
      },
      {
        name: 'Verify Recruiting Search project type selectable',
        run: async () => {
          await this.page.goto(`${this.baseUrl}/projects/new`);
          const options = await this.page.getByLabel(/project type/i).locator('option').allInnerTexts();
          if (!options.some((o) => o.toLowerCase().includes('recruiting search'))) {
            throw new Error('Recruiting Search project type not in dropdown');
          }
        },
      },
      {
        name: 'Walk Recruiting Search through 4 stages',
        run: async () => {
          await this.page.goto(`${this.baseUrl}/projects/new`);
          await this.page.getByLabel(/project type/i).selectOption('recruiting-search');
          const body = await this.page.locator('body').innerText();
          const expectedStages = ['Sourcing', 'Vetting', 'Client Review', 'Placement'];
          for (const stage of expectedStages) {
            if (!body.includes(stage)) throw new Error(`Recruiting Search stage "${stage}" not visible`);
          }
        },
      },
      {
        name: 'Create Knowledge Base article',
        run: async () => {
          await this.page.goto(`${this.baseUrl}/workspace/knowledge`);
          await this.page.getByRole('button', { name: /new article/i }).first().click();
          await this.page.getByLabel(/title/i).fill('SIM07 Engagement Methodology');
          await this.page.getByLabel(/category/i).selectOption('PROCESS');
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
          await this.assertCrossTenantIsolation(maliTenantId, this.testCustomerId);
        },
      },
      {
        name: 'Verify professional-legal package NOT visible (T3 cut)',
        run: async () => {
          await this.page.goto(`${this.baseUrl}/admin/packages`);
          const body = await this.page.locator('body').innerText();
          if (body.toLowerCase().includes('professional-legal')) {
            throw new Error('T3 cut failed: professional-legal still listed in admin packages');
          }
        },
      },
    ];
  }
}

new Sim07Runner().run().catch((err) => { console.error('[SIM-07] FAIL:', err); process.exit(1); });