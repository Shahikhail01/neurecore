/**
 * StaticMobileSupportMatrixSource — Phase 28 (P28) — CR-AI-1107.
 *
 * Inlines the BE-declared mobile support matrix so the FE can boot
 * without a network round-trip. The matrix is intentionally the
 * mirror of `MOBILE_SUPPORT_MATRIX_V1` (BE); divergence is a
 * certification failure in the BE G28 gate.
 *
 * SOLID:
 *   - SRP — only ships the static matrix.
 *   - OCP — a new action = new `MobileAction`, no edits to the gate.
 *   - DIP — implements `IMobileSupportMatrixSource`.
 */
import type {
  IMobileSupportMatrixSource,
  MobileSupportMatrix,
} from './mobile-matrix';

export const STATIC_MOBILE_MATRIX_V1: MobileSupportMatrix = {
  platform: 'web-mobile',
  version: '1.0.0',
  lastUpdated: '2026-08-07',
  actions: [
    {
      action: 'send-chat-message',
      status: 'SUPPORTED',
      minimumViewport: 'mobile',
    },
    {
      action: 'invoke-skill',
      status: 'SUPPORTED',
      minimumViewport: 'mobile',
    },
    {
      action: 'view-skill-result',
      status: 'SUPPORTED',
      minimumViewport: 'mobile',
    },
    {
      action: 'export-chat',
      status: 'DEGRADED',
      minimumViewport: 'tablet',
      degradedNote: 'CSV download supports 500 rows max on mobile viewports.',
    },
    {
      action: 'access-meetings',
      status: 'SUPPORTED',
      minimumViewport: 'mobile',
    },
    {
      action: 'view-customer',
      status: 'SUPPORTED',
      minimumViewport: 'mobile',
    },
    {
      action: 'manage-tasks',
      status: 'DEGRADED',
      minimumViewport: 'tablet',
      degradedNote: 'Bulk actions disabled on mobile viewports.',
    },
    {
      action: 'view-forecast',
      status: 'UNSUPPORTED',
      minimumViewport: 'desktop',
      degradedNote: 'Forecast drilldown is desktop-only.',
    },
  ],
};

export class StaticMobileSupportMatrixSource
  implements IMobileSupportMatrixSource
{
  private readonly matrix: MobileSupportMatrix;

  constructor(matrix: MobileSupportMatrix = STATIC_MOBILE_MATRIX_V1) {
    this.matrix = matrix;
  }

  async load(): Promise<MobileSupportMatrix> {
    return this.matrix;
  }

  current(): MobileSupportMatrix | null {
    return this.matrix;
  }
}
