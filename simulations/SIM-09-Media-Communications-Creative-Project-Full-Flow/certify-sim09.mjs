#!/usr/bin/env node
/**
 * SIM-09-Media-Communications-Creative-Project-Full-Flow — Phase 4.B cert runner.
 *
 * 10 stages:
 *   1. Onboard synthetic media tenant
 *   2. Verify 5 packages installed
 *   3. Verify P3 sub-industry filter: Products/Orders/Inventory/Stores/Promotions HIDDEN for media (only Campaigns + Content visible from consumer-commerce group)
 *   4. Create creative client
 *   5. Create Campaign Launch project (6 stages)
 *   6. Verify Brand Refresh project type selectable
 *   7. Verify Content Series project type selectable (recurring)
 *   8. Create Content (BLOG type) via Content workspace
 *   9. Cross-tenant isolation
 *  10. Verify Campaign Launch stage "Recap" visible (recurring)
 */

import { BaseSimRunner } from '../_lib/base-runner.mjs';

class Sim09Runner extends BaseSimRunner {
  static INDUSTRY_SLUG = 'media-communications-creative';
  static RUNNER_NAME = 'SIM-09';

  stages() {
    return [
      {
        name: 'Onboard synthetic media tenant',
        run: async () => {
          await this.assertTenantOnboarded(process.env.SIM09_TENANT_ID ?? 'sim-media-tenant');
        },
      },
      {
        name: 'Verify 5 media packages installed',
        run: async () => {
          const expected = [
            'media-content-production',
            'media-brand-development',
            'media-social-management',
            'media-video-production',
            'media-pr-campaigns',
          ];
          for (const pkg of expected) await this.assertPackageInstalled(pkg);
        },
      },
      {
        name: 'Verify P3 sub-industry filter: retail-only modules hidden for media',
        run: async () => {
          await this.page.goto(`${this.baseUrl}/home`);
          // Verify the rail does NOT include the retail-only items.
          const railText = await this.page.locator('aside').innerText();
          const shouldHide = ['Products', 'Orders', 'Inventory', 'Stores', 'Promotions'];
          for (const item of shouldHide) {
            if (railText.includes(item)) {
              throw new Error(`P3 filter failed: ${item} should be hidden for media tenant`);
            }
          }
          // Verify the shared items ARE visible.
          const shouldShow = ['Campaigns', 'Content'];
          for (const item of shouldShow) {
            if (!railText.includes(item)) {
              throw new Error(`P3 filter failed: ${item} should be visible for media tenant`);
            }
          }
        },
      },
      {
        name: 'Create creative client',
        run: async () => {
          this.testCustomerId = await this.createCustomerViaForm({
            name: 'SIM09 Creative Studio',
            industry: 'media-communications-creative',
            primaryEmail: 'studio@sim09-creative.example',
          });
        },
      },
      {
        name: 'Create Campaign Launch project (6 stages)',
        run: async () => {
          this.testProjectId = await this.createProjectViaForm({
            projectType: 'campaign-launch',
            name: 'SIM09 Spring Campaign',
            customerId: this.testCustomerId,
          });
          await this.page.goto(`${this.baseUrl}/projects/${this.testProjectId}`);
          const body = await this.page.locator('body').innerText();
          const expectedStages = ['Brief', 'Concept', 'Production', 'Review', 'Launch', 'Recap'];
          for (const stage of expectedStages) {
            if (!body.includes(stage)) throw new Error(`Campaign Launch stage "${stage}" not visible`);
          }
        },
      },
      {
        name: 'Verify Brand Refresh project type selectable',
        run: async () => {
          await this.page.goto(`${this.baseUrl}/projects/new`);
          const options = await this.page.getByLabel(/project type/i).locator('option').allInnerTexts();
          if (!options.some((o) => o.toLowerCase().includes('brand refresh'))) {
            throw new Error('Brand Refresh project type not in dropdown');
          }
        },
      },
      {
        name: 'Verify Content Series project type selectable (recurring)',
        run: async () => {
          await this.page.getByLabel(/project type/i).selectOption('content-series');
          const body = await this.page.locator('body').innerText();
          const expectedStages = ['Plan', 'Produce', 'Publish', 'Measure'];
          for (const stage of expectedStages) {
            if (!body.includes(stage)) throw new Error(`Content Series stage "${stage}" not visible`);
          }
        },
      },
      {
        name: 'Create Content (BLOG type) via Content workspace',
        run: async () => {
          await this.page.goto(`${this.baseUrl}/workspace/content`);
          await this.page.getByRole('button', { name: /new content/i }).first().click();
          await this.page.getByLabel(/title/i).fill('SIM09 Article');
          await this.page.getByLabel(/type/i).selectOption('BLOG');
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
        name: 'Verify Campaign Launch "Recap" stage renders (recurring)',
        run: async () => {
          await this.page.goto(`${this.baseUrl}/projects/${this.testProjectId}`);
          const body = await this.page.locator('body').innerText();
          if (!body.includes('Recap')) {
            throw new Error('Campaign Launch "Recap" stage not visible — recurring behavior broken');
          }
        },
      },
    ];
  }
}

new Sim09Runner().run().catch((err) => { console.error('[SIM-09] FAIL:', err); process.exit(1); });