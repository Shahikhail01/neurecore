// src/test/certification/fixtures/failure-injection.ts
/**
 * Phase 9 — Failure-injection seams.
 *
 * Per NC-AWL-IMP-1 §2.6 / §11.2:
 *   - Duplicate submission
 *   - Worker termination
 *   - Provider failure
 *   - Session expiry
 *   - Realtime loss
 *
 * These seams are pure, deterministic, and dependency-free. They are
 * composed by scenario runners and never more than once per phase.
 */

export type FailureMode =
  | 'duplicate_submission'
  | 'worker_termination'
  | 'transient_provider_failure'
  | 'session_expiry'
  | 'realtime_loss'
  | 'cross_tenant_attempt'
  | 'budget_exhaustion'
  | 'policy_denial';

export interface FailureInjectionConfig {
  mode: FailureMode;
  /** Number of times to repeat the injection per run. */
  occurrences?: number;
  /** Optional: fail-on-call index (e.g., fail on the 2nd execution call). */
  failOnCallIndex?: number;
  /** Optional: deterministic seed for repeated injection. */
  seed?: string;
}

export interface FailureInjectionRecord {
  mode: FailureMode;
  callIndex: number;
  injectedAt: string;
  recovered: boolean;
  detail: string;
}

export class FailureInjectionBus {
  private readonly records: FailureInjectionRecord[] = [];
  private readonly callCounters = new Map<FailureMode, number>();
  private active = new Map<FailureMode, FailureInjectionConfig>();

  configure(mode: FailureMode, cfg: FailureInjectionConfig): void {
    this.active.set(mode, cfg);
  }

  clear(): void {
    this.active.clear();
    this.callCounters.clear();
  }

  reset(): void {
    this.records.length = 0;
    this.callCounters.clear();
  }

  /**
   * Invoked by handlers before performing the side effect.
   * Returns the prepared failure record or null if no injection fires.
   *
   * The injection fires only on the targeted call index (default 1).
   * Subsequent calls within the same scenario return null so the
   * test can prove the system recovered after the first failure.
   */
  check(mode: FailureMode): FailureInjectionRecord | null {
    const cfg = this.active.get(mode);
    if (!cfg) return null;

    const current = (this.callCounters.get(mode) ?? 0) + 1;
    this.callCounters.set(mode, current);

    const target = cfg.failOnCallIndex ?? 1;
    if (current !== target) return null;

    const record: FailureInjectionRecord = {
      mode,
      callIndex: current,
      injectedAt: new Date().toISOString(),
      recovered: false,
      detail: buildFailureDetail(mode),
    };
    this.records.push(record);
    return record;
  }

  getRecords(): ReadonlyArray<FailureInjectionRecord> {
    return this.records;
  }

  markRecovered(mode: FailureMode, callIndex: number): void {
    const r = this.records.find(
      (x) => x.mode === mode && x.callIndex === callIndex,
    );
    if (r) r.recovered = true;
  }
}

function buildFailureDetail(mode: FailureMode): string {
  switch (mode) {
    case 'duplicate_submission':
      return 'Injected duplicate request with same idempotency key';
    case 'worker_termination':
      return 'Injected worker kill after persistence but before ack';
    case 'transient_provider_failure':
      return 'Injected model provider 503';
    case 'session_expiry':
      return 'Injected session expiry mid-request';
    case 'realtime_loss':
      return 'Injected socket disconnect during execution';
    case 'cross_tenant_attempt':
      return 'Injected cross-tenant identifier reference';
    case 'budget_exhaustion':
      return 'Injected token/cost budget exhaustion';
    case 'policy_denial':
      return 'Injected policy denial for tool/action';
  }
}

/**
 * Calculates exponential backoff with jitter per NC-AWL-IMP-1 §5.1.
 * Pure deterministic for testing.
 */
export function exponentialBackoff(
  attempt: number,
  baseMs: number,
  capMs: number,
  jitterFraction: number,
  seed: string,
): number {
  const exp = Math.min(capMs, baseMs * Math.pow(2, attempt));
  const jitter =
    Math.abs(simpleHash(seed)) % Math.max(1, Math.floor(exp * jitterFraction));
  return Math.floor(exp + jitter);
}

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return h;
}

export function defaultBackoff(attempt: number): number {
  return exponentialBackoff(attempt, 1000, 60_000, 0.1, `seed-${attempt}`);
}
