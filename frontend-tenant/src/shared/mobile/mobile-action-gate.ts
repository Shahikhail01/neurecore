/**
 * MobileActionGate — Phase 28 (P28) — CR-AI-1107.
 *
 * Reads the loaded `MobileSupportMatrix` and gates every action
 * declared by the matrix. The gate is the single source of truth for
 * "is this action allowed on the current viewport?" — components
 * never hard-code their own viewport checks.
 *
 * SOLID:
 *   SRP — only owns the gating decision.
 *   OCP — a new action = new row in the matrix, no edits to the gate.
 *   LSP — satisfies `IActionGate`; the desktop gate (Phase 18) implements
 *         the same interface.
 *   DIP — depends on `IMobileSupportMatrixSource` and `IViewportDetector`,
 *         never on the global `window`.
 */
import type {
  ActionGateContext,
  IActionGate,
  IMobileSupportMatrixSource,
  MobileAction,
  MobileSupportMatrix,
  MobileViewport,
} from './mobile-matrix';
import type { IViewportDetector } from './viewport-detector';

const VIEWPORT_ORDER: Record<MobileViewport, number> = {
  mobile: 0,
  tablet: 1,
  desktop: 2,
};

export class MobileActionGate implements IActionGate {
  private matrix: MobileSupportMatrix | null = null;

  constructor(
    private readonly source: IMobileSupportMatrixSource,
    private readonly detector: IViewportDetector,
  ) {}

  async ready(): Promise<void> {
    if (!this.matrix) {
      this.matrix = await this.source.load();
    }
  }

  /**
   * Whether the given action is allowed on the current viewport.
   * Behaves fail-closed: an unknown action → false.
   */
  isAllowed(action: string, ctx?: ActionGateContext): boolean {
    const matrix = this.matrix ?? this.source.current();
    if (!matrix) return false;
    const row = matrix.actions.find((a) => a.action === action);
    if (!row) return false;
    if (row.status === 'UNSUPPORTED') return false;
    const viewport = ctx?.viewport ?? this.detector.current();
    return VIEWPORT_ORDER[viewport] >= VIEWPORT_ORDER[row.minimumViewport];
  }

  describe(action: string): MobileAction | undefined {
    const matrix = this.matrix ?? this.source.current();
    if (!matrix) return undefined;
    return matrix.actions.find((a) => a.action === action);
  }

  actionsAllowedOn(viewport: MobileViewport): ReadonlyArray<MobileAction> {
    const matrix = this.matrix ?? this.source.current();
    if (!matrix) return [];
    return matrix.actions.filter(
      (a) =>
        a.status !== 'UNSUPPORTED' &&
        VIEWPORT_ORDER[viewport] >= VIEWPORT_ORDER[a.minimumViewport],
    );
  }
}
