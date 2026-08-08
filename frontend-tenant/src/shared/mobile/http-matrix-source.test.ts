/**
 * HttpMobileSupportMatrixSource — Phase 28 (P28) — CR-AI-1107.
 *
 * Verifies the live source loads the backend matrix and degrades to the
 * static mirror on fetch failure. No real network.
 */

import { describe, expect, it } from 'vitest';
import {
  HttpMobileSupportMatrixSource,
  type MatrixFetcher,
} from './http-matrix-source';
import { STATIC_MOBILE_MATRIX_V1 } from './static-matrix-source';
import { MobileActionGate } from './mobile-action-gate';
import { StaticMobileSupportMatrixSource } from './static-matrix-source';
import type { IViewportDetector } from './viewport-detector';
import type { MobileSupportMatrix, MobileViewport } from './mobile-matrix';

const REMOTE: MobileSupportMatrix = {
  platform: 'web-mobile',
  version: '2.0.0',
  lastUpdated: '2026-08-08',
  actions: [
    {
      action: 'view-forecast',
      status: 'UNSUPPORTED',
      minimumViewport: 'desktop',
    },
    {
      action: 'access-meetings',
      status: 'SUPPORTED',
      minimumViewport: 'mobile',
    },
  ],
};

describe('HttpMobileSupportMatrixSource', () => {
  it('loads the live backend matrix', async () => {
    const fetcher: MatrixFetcher = async () => REMOTE;
    const source = new HttpMobileSupportMatrixSource(fetcher, '/live');
    const matrix = await source.load();
    expect(matrix).toBe(REMOTE);
    expect(source.current()).toBe(REMOTE);
    expect(matrix.version).toBe('2.0.0');
  });

  it('degrades to the static mirror when the fetch fails', async () => {
    const fetcher: MatrixFetcher = async () => {
      throw new Error('network down');
    };
    const source = new HttpMobileSupportMatrixSource(fetcher, '/down');
    const matrix = await source.load();
    expect(matrix).toEqual(STATIC_MOBILE_MATRIX_V1);
  });

  it('rejects malformed payloads by falling back to the static mirror', async () => {
    const fetcher: MatrixFetcher = async () =>
      ({ not: 'a matrix' }) as unknown as MobileSupportMatrix;
    const source = new HttpMobileSupportMatrixSource(fetcher, '/bad');
    const matrix = await source.load();
    expect(matrix).toEqual(STATIC_MOBILE_MATRIX_V1);
  });

  it('is consumed by the gate: UNSUPPORTED forecast is blocked on mobile', async () => {
    class StubViewport implements IViewportDetector {
      constructor(private readonly v: MobileViewport) {}
      current(): MobileViewport {
        return this.v;
      }
      subscribe(): () => void {
        return () => undefined;
      }
    }
    const gate = new MobileActionGate(
      new StaticMobileSupportMatrixSource(REMOTE),
      new StubViewport('mobile'),
    );
    await gate.ready();
    expect(gate.isAllowed('view-forecast')).toBe(false);
    expect(gate.isAllowed('access-meetings')).toBe(true);
  });
});
