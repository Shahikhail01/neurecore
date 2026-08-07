/**
 * Phase 20 — MobileSupportMatrix (CR-AI-1107).
 *
 * Declares the typed mobile support surface. Drives the FE
 * SupportMatrix component (frontend-tenant/src/shared/mobile)
 * and gates which chat-panel features render on small viewports.
 *
 * SRP — owns ONLY the support-matrix declaration. The
 * responsive UI is the FE module's job; the backend just declares
 * which intents / skills / actions are mobile-safe.
 */

export type MobileActionStatus = 'SUPPORTED' | 'DEGRADED' | 'UNSUPPORTED';

export interface MobileAction {
  readonly action:
    | 'send-chat-message'
    | 'invoke-skill'
    | 'view-skill-result'
    | 'export-chat'
    | 'access-meetings'
    | 'view-customer'
    | 'manage-tasks'
    | 'view-forecast';
  readonly status: MobileActionStatus;
  readonly minimumViewport: 'mobile' | 'tablet' | 'desktop';
  readonly degradedNote?: string;
}

export interface MobileSupportMatrix {
  readonly platform: 'web-mobile';
  readonly version: string;            // mobile-shell version
  readonly lastUpdated: string;
  readonly actions: ReadonlyArray<MobileAction>;
}

export const MOBILE_SUPPORT_MATRIX_V1: MobileSupportMatrix = {
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

/**
 * Query the matrix for a specific action. Returns the matrix entry
 * or undefined if the action is undeclared.
 */
export function mobileSupportFor(
  matrix: MobileSupportMatrix,
  action: MobileAction['action'],
): MobileAction | undefined {
  return matrix.actions.find((a) => a.action === action);
}
