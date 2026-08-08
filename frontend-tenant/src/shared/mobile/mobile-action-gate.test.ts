/**
 * MobileActionGate — Phase 28 (P28) — CR-AI-1107.
 *
 * Tests the gate with a stub matrix source + stub viewport detector.
 * No `window` / `matchMedia` dependency.
 */

import { describe, expect, it } from 'vitest';
import { MobileActionGate } from './mobile-action-gate';
import { STATIC_MOBILE_MATRIX_V1, StaticMobileSupportMatrixSource } from './static-matrix-source';
import type { IMobileSupportMatrixSource, MobileSupportMatrix } from './mobile-matrix';
import type { IViewportDetector } from './viewport-detector';
import type { MobileViewport } from './mobile-matrix';

class StubViewportDetector implements IViewportDetector {
  constructor(private readonly v: MobileViewport) {}
  current(): MobileViewport {
    return this.v;
  }
  subscribe(): () => void {
    return () => undefined;
  }
}

class StubMatrixSource implements IMobileSupportMatrixSource {
  constructor(private readonly matrix: MobileSupportMatrix) {}
  async load(): Promise<MobileSupportMatrix> {
    return this.matrix;
  }
  current(): MobileSupportMatrix | null {
    return this.matrix;
  }
}

describe('MobileActionGate', () => {
  it('allows SUPPORTED actions on the matching viewport', async () => {
    const gate = new MobileActionGate(
      new StubMatrixSource(STATIC_MOBILE_MATRIX_V1),
      new StubViewportDetector('mobile'),
    );
    await gate.ready();
    expect(gate.isAllowed('send-chat-message')).toBe(true);
    expect(gate.isAllowed('view-customer')).toBe(true);
  });

  it('denies UNSUPPORTED actions regardless of viewport', async () => {
    const gate = new MobileActionGate(
      new StubMatrixSource(STATIC_MOBILE_MATRIX_V1),
      new StubViewportDetector('desktop'),
    );
    await gate.ready();
    expect(gate.isAllowed('view-forecast')).toBe(false);
  });

  it('denies actions whose minimumViewport exceeds the current viewport', async () => {
    const gate = new MobileActionGate(
      new StubMatrixSource(STATIC_MOBILE_MATRIX_V1),
      new StubViewportDetector('mobile'),
    );
    await gate.ready();
    expect(gate.isAllowed('export-chat')).toBe(false);
    expect(gate.isAllowed('manage-tasks')).toBe(false);
  });

  it('allows tablet actions on tablet and desktop', async () => {
    const gate = new MobileActionGate(
      new StubMatrixSource(STATIC_MOBILE_MATRIX_V1),
      new StubViewportDetector('tablet'),
    );
    await gate.ready();
    expect(gate.isAllowed('export-chat')).toBe(true);
    expect(gate.isAllowed('manage-tasks')).toBe(true);
  });

  it('returns false for unknown actions (fail-closed)', async () => {
    const gate = new MobileActionGate(
      new StubMatrixSource(STATIC_MOBILE_MATRIX_V1),
      new StubViewportDetector('desktop'),
    );
    await gate.ready();
    expect(gate.isAllowed('not-in-matrix')).toBe(false);
  });

  it('uses an explicit ActionGateContext when supplied', async () => {
    const gate = new MobileActionGate(
      new StubMatrixSource(STATIC_MOBILE_MATRIX_V1),
      new StubViewportDetector('mobile'),
    );
    await gate.ready();
    expect(gate.isAllowed('export-chat', { viewport: 'desktop' })).toBe(true);
  });

  it('actionsAllowedOn returns the typed subset for a viewport', async () => {
    const gate = new MobileActionGate(
      new StubMatrixSource(STATIC_MOBILE_MATRIX_V1),
      new StubViewportDetector('desktop'),
    );
    await gate.ready();
    const desktop = gate.actionsAllowedOn('desktop');
    expect(desktop.find((a) => a.action === 'view-forecast')).toBeUndefined();
    expect(desktop.find((a) => a.action === 'send-chat-message')).toBeDefined();
  });

  it('describe returns the matrix row for an action', async () => {
    const gate = new MobileActionGate(
      new StubMatrixSource(STATIC_MOBILE_MATRIX_V1),
      new StubViewportDetector('desktop'),
    );
    await gate.ready();
    expect(gate.describe('view-forecast')?.status).toBe('UNSUPPORTED');
  });
});
