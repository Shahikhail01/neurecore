#!/usr/bin/env node
/**
 * base-runner.mjs — abstract base class for SIM-XX FE-first cert runners.
 *
 * PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §6.2 (P2) — extracted from SIM-04.
 *
 * Every SIM-XX runner extends BaseSimRunner and declares its stages. Common
 * utilities (browser setup, login, common assertions, form-driven actions)
 * live here. Each runner becomes ~50-80 lines vs the ~200 of SIM-04.
 *
 * SOLID:
 *   - S: stages() is the only thing subclasses declare.
 *   - O: new runner = extend + add stages; no existing code changes.
 *   - L: shared utilities behave identically across all runners.
 *   - I: subclasses override only what they need (template method pattern).
 */

import { chromium } from '@playwright/test';

export class BaseSimRunner {
  /** Subclass override: industry slug this runner certifies. */
  static INDUSTRY_SLUG = 'accounting-audit-services';

  /** Subclass override: human-readable cert runner name. */
  static RUNNER_NAME = 'SIM-BASE';

  /** Subclass overrides return an ordered list of stages. */
  stages() {
    throw new Error(`${this.constructor.name}.stages() must be overridden`);
  }

  /** Entry point. */
  async run() {
    console.log(`[${this.constructor.RUNNER_NAME}] starting`);
    await this.setup();
    try {
      const stages = this.stages();
      for (let i = 0; i < stages.length; i++) {
        const stage = stages[i];
        console.log(`[${this.constructor.RUNNER_NAME}] stage ${i + 1}/${stages.length}: ${stage.name}`);
        await stage.run();
      }
      console.log(`[${this.constructor.RUNNER_NAME}] PASS`);
    } finally {
      await this.teardown();
    }
  }

  async setup() {
    this.browser = await chromium.launch({ headless: process.env.HEADED !== '1' });
    this.context = await this.browser.newContext({ viewport: { width: 1280, height: 720 } });
    this.page = await this.context.newPage();
    this.baseUrl = process.env.SIM_BASE_URL ?? 'https://hq.neurecore.com';
    await this.loginAsSuperAdmin();
  }

  async teardown() {
    try {
      await this.context.close();
    } finally {
      await this.browser.close();
    }
  }

  async loginAsSuperAdmin() {
    const email = process.env.SUPER_ADMIN_EMAIL;
    const password = process.env.SUPER_ADMIN_PASSWORD;
    if (!email || !password) {
      throw new Error('SUPER_ADMIN_EMAIL + SUPER_ADMIN_PASSWORD must be set');
    }
    await this.page.goto(`${this.baseUrl}/login`);
    await this.page.getByLabel('Email').fill(email);
    await this.page.getByLabel('Password').fill(password);
    await this.page.getByRole('button', { name: 'Sign in' }).click();
    await this.page.waitForURL(/\/(home|admin)/);
  }

  // ─── Common assertions ───────────────────────────────────────────────

  async assertTenantOnboarded(tenantId) {
    await this.page.goto(`${this.baseUrl}/admin/tenants/${tenantId}`);
    const heading = await this.page.locator('h1').first().innerText();
    if (!heading) throw new Error(`Tenant ${tenantId} page did not render`);
  }

  async assertPackageInstalled(packageName) {
    await this.page.goto(`${this.baseUrl}/admin/tenants`);
    const count = await this.page.getByText(packageName, { exact: false }).count();
    if (count === 0) throw new Error(`Package "${packageName}" not visible`);
  }

  async assertWorkspaceModuleVisible(moduleId) {
    await this.page.goto(`${this.baseUrl}/workspace/${moduleId}`);
    const heading = await this.page.locator('h1').first().innerText();
    if (!heading) throw new Error(`Module "${moduleId}" did not render`);
  }

  async assertCrossTenantIsolation(tenantAId, tenantBId, path = '/api/v1/customers') {
    const res = await this.page.request.get(`${this.baseUrl}${path}?tenantId=${tenantBId}`, {
      headers: { 'x-tenant-id': tenantAId },
    });
    if (res.status() !== 403 && res.status() !== 404) {
      throw new Error(`Cross-tenant access succeeded: ${res.status()}`);
    }
  }

  // ─── Form-driven actions ─────────────────────────────────────────────

  async createCustomerViaForm({ name, industry, primaryEmail, tags = [] }) {
    await this.page.goto(`${this.baseUrl}/customers`);
    await this.page.getByRole('button', { name: /new customer|create customer/i }).first().click();
    if (name) await this.page.getByLabel(/^name$/i).fill(name);
    if (industry) await this.page.getByLabel(/^industry$/i).selectOption(industry);
    if (primaryEmail) await this.page.getByLabel(/email/i).fill(primaryEmail);
    if (tags.length) await this.page.getByLabel(/^tags$/i).fill(tags.join(', '));
    await this.page.getByRole('button', { name: /create customer|save/i }).first().click();
    await this.page.waitForURL(/\/customers\/[a-f0-9-]+/);
    return this.page.url().split('/').pop();
  }

  async createProjectViaForm({ projectType, name, customerId }) {
    await this.page.goto(`${this.baseUrl}/projects/new`);
    if (projectType) await this.page.getByLabel(/project type/i).selectOption(projectType);
    if (name) await this.page.getByLabel(/^name$/i).fill(name);
    if (customerId) await this.page.getByLabel(/customer/i).selectOption(customerId);
    await this.page.getByRole('button', { name: /create project|save/i }).first().click();
    await this.page.waitForURL(/\/projects\/[a-f0-9-]+/);
    return this.page.url().split('/').pop();
  }
}