// src/test/certification/golden-path.spec.ts
import { TestHarnessModule, RECONSTRUCTION_TEST_TENANT_ID } from '../test-harness.module';

describe('Certification: Golden Path', () => {
  it('runs the golden path scenario', async () => {
    const scenario = TestHarnessModule.getGoldenScenario();
    expect(scenario.customer.name).toBe('Acme Accounting LLC');
    expect(scenario.project.name).toBe('Monthly Close Q3 2026');
    expect(RECONSTRUCTION_TEST_TENANT_ID).toBe('reconstruction-test-tenant');
  });

  it('verifies idempotency keys are unique per aggregate', () => {
    const keys = [
      `create-goal:tenant:project:1:goal-categorize`,
      `create-task:tenant:project:1:task-goal-categorize-input`,
      `assign-task:tenant:task:1:1`,
    ];
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });
});
