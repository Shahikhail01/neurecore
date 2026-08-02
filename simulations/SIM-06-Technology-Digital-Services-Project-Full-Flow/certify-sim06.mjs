#!/usr/bin/env node
/**
 * SIM-06-Technology-Digital-Services-Project-Full-Flow — Phase 3.A cert runner.
 *
 * PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §5.3 (Phase 3.A) — 10 stages:
 *   1. Onboard synthetic tech-digital-services tenant
 *   2. Verify 8 packages installed
 *   3. Verify 4 B&T workspace extras visible (Tickets/Releases/Contracts/Knowledge)
 *   4. Create IT client
 *   5. Create IT project
 *   6. Create Ticket with HIGH severity + SLA due
 *   7. Verify Product Launch project type selectable
 *   8. Verify Support Escalation workflow stages visible
 *   9. Cross-tenant isolation: Mali cannot see tech tenant
 *  10. Create Knowledge Base article (markdown)
 */

import { BaseSimRunner } from '../_lib/base-runner.mjs';

class Sim06Runner extends BaseSimRunner {
  static INDUSTRY_SLUG = 'technology-digital-services';
  static RUNNER_NAME = 'SIM-06';

  stages() {
    return [
      {
        name: 'Onboard synthetic tech-digital-services tenant',
        run: async () => {
          await this.assertTenantOnboarded(process.env.SIM06_TENANT_ID ?? 'sim-tech-tenant');
        },
      },
      {
        name: 'Verify 8 tech-digital-services packages installed',
        run: async () => {
          const expected = [
            'it-project-delivery',
            'it-client-success',
            'it-devops-infrastructure',
            'it-product-development',
            'it-quality-engineering',
            'it-saas-operations',
            'it-managed-services',
            'it-enterprise-platform',
          ];
          for (const pkg of expected) await this.assertPackageInstalled(pkg);
        },
      },
      {
        name: 'Verify B&T workspace extras visible (Tickets/Releases/Contracts/Knowledge)',
        run: async () => {
          for (const m of ['tickets', 'releases', 'contracts', 'knowledge']) await this.assertWorkspaceModuleVisible(m);
        },
      },
      {
        name: 'Create IT client',
        run: async () => {
          this.testCustomerId = await this.createCustomerViaForm({
            name: 'SIM06 Acme IT',
            industry: 'technology-digital-services',
            primaryEmail: 'ops@sim06-acme.example',
          });
        },
      },
      {
        name: 'Create IT project',
        run: async () => {
          this.testProjectId = await this.createProjectViaForm({
            projectType: 'saas-product-build',
            name: 'SIM06 Platform Build',
            customerId: this.testCustomerId,
          });
        },
      },
      {
        name: 'Create Ticket with HIGH severity + SLA due',
        run: async () => {
          await this.page.goto(`${this.baseUrl}/workspace/tickets`);
          await this.page.getByRole('button', { name: /new ticket/i }).first().click();
          await this.page.getByLabel(/title/i).fill('SIM06 Production outage');
          await this.page.getByLabel(/severity/i).selectOption('HIGH');
          await this.page.getByLabel(/sla due/i).fill('2026-08-15T12:00');
          await this.page.getByLabel(/status/i).selectOption('OPEN');
          await this.page.getByRole('button', { name: /create/i }).first().click();
        },
      },
      {
        name: 'Verify Product Launch project type selectable',
        run: async () => {
          await this.page.goto(`${this.baseUrl}/projects/new`);
          const options = await this.page.getByLabel(/project type/i).locator('option').allInnerTexts();
          if (!options.some((o) => o.toLowerCase().includes('product launch'))) {
            throw new Error('Product Launch project type not in dropdown');
          }
        },
      },
      {
        name: 'Verify Support Escalation workflow stages visible',
        run: async () => {
          await this.page.goto(`${this.baseUrl}/projects/new`);
          await this.page.getByLabel(/project type/i).selectOption('support-escalation');
          const body = await this.page.locator('body').innerText();
          const expectedStages = ['Ticket Intake', 'Triage', 'Investigation', 'Resolution', 'Post-Mortem'];
          for (const stage of expectedStages) {
            if (!body.includes(stage)) throw new Error(`Support Escalation stage "${stage}" not visible`);
          }
        },
      },
      {
        name: 'Cross-tenant isolation: Mali cannot see tech tenant customers',
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
        name: 'Create Knowledge Base article (markdown)',
        run: async () => {
          await this.page.goto(`${this.baseUrl}/workspace/knowledge`);
          await this.page.getByRole('button', { name: /new article/i }).first().click();
          await this.page.getByLabel(/title/i).fill('SIM06 On-Call Runbook');
          await this.page.getByLabel(/category/i).selectOption('RUNBOOK');
          await this.page.getByLabel(/content/i).fill('# Incident Response\n1. Check status page\n2. Page on-call\n3. Document timeline');
          await this.page.getByRole('button', { name: /create/i }).first().click();
        },
      },
    ];
  }
}

new Sim06Runner().run().catch((err) => { console.error('[SIM-06] FAIL:', err); process.exit(1); });