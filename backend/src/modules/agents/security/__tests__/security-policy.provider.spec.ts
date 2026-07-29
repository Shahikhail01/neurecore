/**
 * Security policy regression tests — pin the customer CRUD tool policy
 * for the `ai-assistant` agent type.
 *
 * History: before this test existed, `createCustomer` was missing from
 * the `ai-assistant` allowedTools list. Because the policy uses
 * default-deny (any tool not in allowedTools and not in blockedTools is
 * rejected), the LLM-driven "create new customer" Hermes command was
 * silently blocked and the user reported the chat command "not working".
 *
 * These tests assert:
 *   - createCustomer is allowed for ai-assistant (chat create works)
 *   - destructive customer tools (archive/unarchive) remain blocked
 *   - updateCustomer remains blocked
 *   - read-only customer tools (get/list/find/projects/contacts) stay allowed
 */

import { SecurityPolicyProvider } from '../providers/security-policy.provider';

describe('SecurityPolicyProvider — customer tool policy', () => {
  let provider: SecurityPolicyProvider;

  beforeEach(() => {
    provider = new SecurityPolicyProvider();
  });

  describe('ai-assistant agent type', () => {
    let policy: NonNullable<Awaited<ReturnType<SecurityPolicyProvider['getPolicy']>>>;

    beforeEach(async () => {
      const p = await provider.getPolicy('ai-assistant', 'tenant-test');
      if (!p) throw new Error('expected policy');
      policy = p;
    });

    it('allows createCustomer so chat "create new customer" works', () => {
      expect(provider.isToolAllowed('createCustomer', policy)).toBe(true);
    });

    it('still allows read-only customer tools', () => {
      for (const name of [
        'getCustomer',
        'listCustomers',
        'findCustomerByName',
        'getCustomerProjects',
        'listCustomerContacts',
      ]) {
        expect(provider.isToolAllowed(name, policy)).toBe(true);
      }
    });

    it('still blocks destructive customer tools (human approval required)', () => {
      for (const name of [
        'archiveCustomer',
        'unarchiveCustomer',
      ]) {
        expect(provider.isToolAllowed(name, policy)).toBe(false);
      }
    });

    it('allows task lifecycle mutations via chat (mark complete, reassign, etc.)', () => {
      // Hermes-tools F1 + F4: the policy must permit these so the
      // curated allowlist actually executes. Destructive ops (deleteTask,
      // cloneTask) remain blocked.
      for (const name of [
        'markTaskComplete',
        'markTaskInProgress',
        'reopenTask',
        'changeTaskPriority',
        'assignTask',
        'unassignTask',
        'addSubtask',
        'updateTask',
        'bulkAssignTasks',
        'bulkChangeStatus',
      ]) {
        expect(provider.isToolAllowed(name, policy)).toBe(true);
      }
    });

    it('still blocks destructive task ops (deleteTask, cloneTask)', () => {
      // Hermes-tools F4: destructive task operations require explicit
      // human approval, not LLM autonomy.
      for (const name of ['deleteTask', 'cloneTask']) {
        expect(provider.isToolAllowed(name, policy)).toBe(false);
      }
    });

    it('allows project_memory tools under their canonical registry names', () => {
      // The structured-tool registry exposes project_memory_add /
      // project_memory_search / project_memory_update_confidence
      // (snake_case). The policy must permit them — without this the
      // LLM silently fails any "add a memory to the project" prompt.
      for (const name of [
        'addProjectMemory',
        'searchProjectMemory',
        'updateMemoryConfidence',
        'project_memory_add',
        'project_memory_search',
        'project_memory_update_confidence',
      ]) {
        expect(provider.isToolAllowed(name, policy)).toBe(true);
      }
    });
  });
});