// src/test/architecture/phase8-security-observability.spec.ts
import * as fs from 'fs';
import * as path from 'path';

function read(file: string): string {
  return fs.readFileSync(file, 'utf8');
}

function fileExists(p: string): boolean {
  return fs.existsSync(p);
}

describe('Phase 8 — Security, Observability, and Operations invariants (NC-AWL-IMP-1 §10)', () => {
  describe('§10.1 Security enforcement at every boundary', () => {
    it('TenantScopeEnforcer is the single tenant-scope check helper', () => {
      const file = path.join(
        __dirname,
        '../../modules/phase8/application/tenant-scope-enforcer.ts',
      );
      expect(fileExists(file)).toBe(true);
      const content = read(file);
      expect(content).toContain('CROSS_TENANT_NOT_FOUND');
      expect(content).toContain('X_TENANT_NOT_FOUND');
    });

    it('no AuditLog row is mutated or deleted anywhere in src/', () => {
      const root = path.join(__dirname, '../../..');
      const offenders: string[] = [];
      const stack: string[] = [root];
      while (stack.length > 0) {
        const dir = stack.pop()!;
        if (!fs.existsSync(dir)) continue;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (entry.name === 'node_modules' || entry.name === 'dist') continue;
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            stack.push(full);
            continue;
          }
          if (!entry.name.endsWith('.ts')) continue;
          if (entry.name.endsWith('.spec.ts')) continue;
          const content = read(full);
          if (
            /auditLog\.(update|updateMany|delete|deleteMany)\b/.test(content)
          ) {
            offenders.push(full);
          }
        }
      }
      expect(offenders).toEqual([]);
    });

    it('PiiRedactor and ExecutionPolicyEnforcer exist with tests', () => {
      const redactorSpec = path.join(
        __dirname,
        '../../modules/execution/application/pii-redactor.spec.ts',
      );
      const policySpec = path.join(
        __dirname,
        '../../modules/execution/application/execution-policy-enforcer.spec.ts',
      );
      expect(fileExists(redactorSpec)).toBe(true);
      expect(fileExists(policySpec)).toBe(true);
    });
  });

  describe('§10.2 Metrics catalog', () => {
    it('GoldenPathMetricsService builds the full golden-path catalog', () => {
      const file = path.join(
        __dirname,
        '../../modules/phase8/observability/golden-path-metrics.ts',
      );
      expect(fileExists(file)).toBe(true);
      const content = read(file);
      const required = [
        'initiations_created_total',
        'initiations_approved_total',
        'project_command_success_total',
        'project_command_duplicate_suppressed_total',
        'outbox_event_age_seconds',
        'outbox_backlog_size',
        'event_processing_latency_seconds',
        'job_retries_total',
        'job_dead_letters_total',
        'automation_completion_rate',
        'assignment_success_total',
        'assignment_failure_total',
        'execution_queue_time_seconds',
        'execution_duration_seconds',
        'attempt_success_total',
        'attempt_retry_total',
        'attempt_failure_total',
        'needs_input_total',
        'needs_review_total',
        'approval_total',
        'revision_requested_total',
        'tool_failure_total',
        'token_usage_total',
        'estimated_cost_total',
        'socket_reconnect_total',
        'socket_error_total',
        'session_refresh_failure_total',
      ];
      for (const metric of required) {
        expect(content).toContain(metric);
      }
    });

    it('every metric has a non-empty help text', () => {
      const file = path.join(
        __dirname,
        '../../modules/phase8/observability/golden-path-metrics.ts',
      );
      const content = read(file);
      // Every new Counter({...}) must specify help text.
      const counterMatches = content.match(/new Counter\({[\s\S]*?}\)/g) ?? [];
      for (const m of counterMatches) {
        expect(m).toMatch(/help:\s*['"][^'"]+['"]/);
      }
    });
  });

  describe('§10.3 Correlated logging', () => {
    it('Phase8CorrelationLogger includes every golden-path entity id', () => {
      const file = path.join(
        __dirname,
        '../../common/logging/phase8-correlation-logger.ts',
      );
      expect(fileExists(file)).toBe(true);
      const content = read(file);
      const required = [
        'initiationId',
        'projectId',
        'goalId',
        'taskId',
        'assignmentId',
        'executionAttemptId',
        'reviewId',
        'outboxEventId',
      ];
      for (const id of required) {
        expect(content).toContain(id);
      }
    });
  });

  describe('§10.4 Runbook inventory (10 runbooks)', () => {
    const runbooks = [
      'outbox-backlog.md',
      'poison-event.md',
      'stuck-execution.md',
      'provider-outage.md',
      'duplicate-project.md',
      'failed-automation.md',
      'session-failure.md',
      'socket-failure.md',
      'cross-tenant.md',
      'model-rollback.md',
    ];
    for (const rb of runbooks) {
      it(`runbook ${rb} exists`, () => {
        const file = path.join(__dirname, '../../docs/runbooks', rb);
        expect(fileExists(file)).toBe(true);
        const content = read(file);
        expect(content.length).toBeGreaterThan(100);
      });
    }
  });

  describe('§10.5 Phase 8 deliverables — code is present', () => {
    const requiredFiles = [
      'src/modules/phase8/domain/phase8.constants.ts',
      'src/modules/phase8/application/phase8-permission.service.ts',
      'src/modules/phase8/application/side-effect-approval.service.ts',
      'src/modules/phase8/application/artifact-access.service.ts',
      'src/modules/phase8/application/tenant-scope-enforcer.ts',
      'src/modules/phase8/observability/golden-path-metrics.service.ts',
      'src/modules/phase8/phase8.module.ts',
    ];
    for (const f of requiredFiles) {
      it(f, () => {
        const full = path.join(__dirname, '../../..', f);
        expect(fileExists(full)).toBe(true);
      });
    }
  });
});
