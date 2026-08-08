/**
 * MobileSupportMatrixController — Phase 28 (P28) — CR-AI-1107.
 *
 * Exposes the typed mobile support matrix and a narrow
 * per-action gating endpoint for the FE when it cannot rely on the
 * static inlined matrix.
 *
 * SOLID:
 *   SRP — HTTP routing only; the matrix is owned by `MobileSupportMatrix`
 *         (the canonical BE source).
 *   OCP — adding a new matrix action = a new entry in the BE matrix,
 *         no edits to this controller.
 *   DIP — depends on the matrix port (the typed export), not on a
 *         hard-coded list.
 */
import { Controller, Get, Query } from '@nestjs/common';
import {
  MOBILE_SUPPORT_MATRIX_V1,
  mobileSupportFor,
} from '../integrations/mobile/mobile-support-matrix';
import type { MobileAction } from '../integrations/mobile/mobile-support-matrix';

@Controller({ path: 'mobile-support-matrix', version: '1' })
export class MobileSupportMatrixController {
  @Get()
  getMatrix() {
    return MOBILE_SUPPORT_MATRIX_V1;
  }

  /**
   * Mobile-only contract: returns the action row + a typed
   * `isAllowed` boolean for the supplied viewport.
   */
  @Get('gate')
  gate(
    @Query('action') action: string,
    @Query('viewport') viewport: 'mobile' | 'tablet' | 'desktop' = 'desktop',
  ) {
    const row: MobileAction | undefined = action
      ? mobileSupportFor(
          MOBILE_SUPPORT_MATRIX_V1,
          action as Parameters<typeof mobileSupportFor>[1],
        )
      : undefined;
    const order = { mobile: 0, tablet: 1, desktop: 2 } as const;
    const isAllowed = !!(
      row &&
      row.status !== 'UNSUPPORTED' &&
      order[viewport] >= order[row.minimumViewport]
    );
    return { action, viewport, row, isAllowed };
  }
}
