// src/test/architecture/circuit-breaker.spec.ts
import { CircuitBreaker, CircuitState } from '../../common/outbox/circuit-breaker';

describe('Circuit Breaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 100,
      halfOpenSuccessThreshold: 2,
    });
  });

  it('starts in CLOSED state', () => {
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
    expect(breaker.canExecute()).toBe(true);
  });

  it('opens after threshold failures', () => {
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.getState()).toBe(CircuitState.CLOSED);

    breaker.recordFailure();
    expect(breaker.getState()).toBe(CircuitState.OPEN);
    expect(breaker.canExecute()).toBe(false);
  });

  it('transitions to HALF_OPEN after reset timeout', async () => {
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.getState()).toBe(CircuitState.OPEN);

    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(breaker.canExecute()).toBe(true);
  });

  it('closes after half-open successes', async () => {
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.getState()).toBe(CircuitState.OPEN);

    await new Promise((resolve) => setTimeout(resolve, 150));
    breaker.canExecute();
    expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);

    breaker.recordSuccess();
    breaker.recordSuccess();
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('re-opens on failure in half-open state', async () => {
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();
    await new Promise((resolve) => setTimeout(resolve, 150));
    breaker.canExecute();
    expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);

    breaker.recordFailure();
    expect(breaker.getState()).toBe(CircuitState.OPEN);
  });

  it('resets manually', () => {
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.getState()).toBe(CircuitState.OPEN);

    breaker.reset();
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
    expect(breaker.getFailureCount()).toBe(0);
  });
});
