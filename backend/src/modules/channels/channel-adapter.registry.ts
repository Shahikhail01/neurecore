/**
 * Channels — Single Canonical Adapter Registry.
 *
 * Source plan: creatio-ai-parity-implementation-plan-v2.md §5.16.
 *
 * Solid:
 *   • SRP — only the channel adapter contract + registry. Each adapter
 *     implements `ChannelAdapter`; the registry composes them.
 *   • OCP — adding a new channel = new adapter + new register call.
 *     No other module changes.
 *   • DIP — agents and chat depend on the adapter interface, not on
 *     concrete classes.
 *
 * Every channel is tenant-scoped; the adapter's `dispatch` method
 * never accepts a wildcard tenant id (enforced by the service layer).
 */

import { ChannelKind } from '@prisma/client';

/**
 * MCP action descriptor — the machine-readable contract the v2 plan
 * §5.16 calls out as "MCP-compatible action descriptors". Any agent
 * that wants to invoke a channel action consumes one of these.
 */
export interface McpActionDescriptor {
  // Stable action name (kebab-case). e.g. "email-send".
  name: string;
  // Human-readable description used in chat / Twin wizards.
  description: string;
  // JSON-schema-like input shape (loose typing to avoid a json-schema
  // dependency; consumers validate with their own validators).
  inputSchema: Record<string, McpFieldDescriptor>;
  // Output shape (mostly informational — adapters return richer objects).
  outputSchema?: Record<string, McpFieldDescriptor>;
  // Risk tier (1..5) used by the HITL policy engine.
  riskTier: 1 | 2 | 3 | 4 | 5;
  // Whether the action requires human approval before execution.
  requiresApproval: boolean;
  // Side-effects: 'read' | 'write' | 'side-effect:external'.
  effects: ReadonlyArray<'read' | 'write' | 'side-effect:external'>;
}

export interface McpFieldDescriptor {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description?: string;
  // Optional enum / pattern hints.
  enum?: ReadonlyArray<string>;
  pattern?: string;
}

/**
 * Inbound event envelope — a channel adapter normalises its native
 * format into this shape.
 */
export interface ChannelInboundEvent {
  // Kind of channel the event came from.
  kind: ChannelKind;
  // Tenant this event belongs to.
  tenantId: string;
  // Connection id (FK to ChannelConnection.id).
  connectionId: string | null;
  // Direction is always 'inbound' for these envelopes.
  direction: 'inbound';
  // The native payload, already redacted.
  payload: Record<string, unknown>;
  // Original timestamp from the channel.
  occurredAt: string;
}

/**
 * Outbound dispatch request — what an agent / chat sends to a channel.
 */
export interface ChannelOutboundRequest {
  kind: ChannelKind;
  tenantId: string;
  connectionId: string;
  actionName: string;
  payload: Record<string, unknown>;
}

export interface ChannelOutboundResult {
  ok: boolean;
  // Provider-specific id (message id, call id, meeting id, ...).
  providerId?: string;
  // Free-form response.
  response?: Record<string, unknown>;
  // Error message on failure.
  error?: string;
}

/**
 * ChannelAdapter — every channel implements this contract.
 *
 * Adapters are stateless (config lives in ChannelConnection.config).
 * State (rate-limit counters, circuit breakers) lives on the service
 * layer so multiple adapter instances share it.
 */
export interface ChannelAdapter {
  readonly kind: ChannelKind;
  readonly displayName: string;
  readonly mcpActions: ReadonlyArray<McpActionDescriptor>;

  /** Probe the connection — returns ok / error. */
  health(connectionConfig: Record<string, unknown>): Promise<ChannelOutboundResult>;

  /** Send an outbound action. */
  dispatch(req: ChannelOutboundRequest): Promise<ChannelOutboundResult>;

  /** Normalise a native inbound event into ChannelInboundEvent. */
  normalizeInbound(
    raw: unknown,
    ctx: { tenantId: string; connectionId: string | null },
  ): ChannelInboundEvent | null;
}

export class ChannelRegistry {
  private readonly adapters = new Map<ChannelKind, ChannelAdapter>();

  register(adapter: ChannelAdapter): void {
    if (this.adapters.has(adapter.kind)) {
      throw new Error(`channel adapter already registered: ${adapter.kind}`);
    }
    this.adapters.set(adapter.kind, adapter);
  }

  get(kind: ChannelKind): ChannelAdapter | null {
    return this.adapters.get(kind) ?? null;
  }

  list(): ChannelAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Flatten all adapters into a single MCP action catalog. This is the
   * payload the v2 plan §5.16 calls the "MCP action catalog" — every
   * tool a Twin / agent can invoke is described here.
   */
  mcpCatalog(): Array<{
    kind: ChannelKind;
    adapter: string;
    actions: ReadonlyArray<McpActionDescriptor>;
  }> {
    return this.list().map((a) => ({
      kind: a.kind,
      adapter: a.displayName,
      actions: a.mcpActions,
    }));
  }
}

/**
 * BUILTIN_CHANNELS — the registry shipped with NeureCore.
 *
 * Each channel ships as an OOB adapter that registers on module init.
 * Concrete outbound calls are stubbed at the adapter layer — real
 * provider SDK integration is the work of Phase 5.5. The shape and
 * MCP catalog are the contract every channel honours.
 */

// ─── Channel: Web assistant ───────────────────────────────────────────
class WebAssistantAdapter implements ChannelAdapter {
  readonly kind = ChannelKind.WEB_ASSISTANT;
  readonly displayName = 'In-app chat';
  readonly mcpActions: ReadonlyArray<McpActionDescriptor> = [
    {
      name: 'chat-send',
      description: 'Send a message into the in-app chat thread.',
      inputSchema: {
        tenantId: { type: 'string', required: true },
        threadId: { type: 'string', required: true },
        text: { type: 'string', required: true },
      },
      riskTier: 1,
      requiresApproval: false,
      effects: ['write'],
    },
  ];
  async health(): Promise<ChannelOutboundResult> { return { ok: true }; }
  async dispatch(): Promise<ChannelOutboundResult> { return { ok: true }; }
  normalizeInbound(): ChannelInboundEvent | null { return null; }
}

// ─── Channel: Email ───────────────────────────────────────────────────
class EmailAdapter implements ChannelAdapter {
  readonly kind = ChannelKind.EMAIL;
  readonly displayName = 'Email (Brevo / SMTP)';
  readonly mcpActions: ReadonlyArray<McpActionDescriptor> = [
    {
      name: 'email-send',
      description: 'Send an outbound email. Requires approval for cold recipients.',
      inputSchema: {
        to: { type: 'string', required: true, description: 'RFC 5322 recipient' },
        subject: { type: 'string', required: true },
        bodyHtml: { type: 'string', required: false },
        bodyText: { type: 'string', required: false },
        templateId: { type: 'string', required: false },
      },
      riskTier: 3,
      requiresApproval: true,
      effects: ['side-effect:external'],
    },
    {
      name: 'email-draft',
      description: 'Persist a draft email; never sends.',
      inputSchema: {
        to: { type: 'string', required: true },
        subject: { type: 'string', required: true },
        bodyHtml: { type: 'string', required: false },
        bodyText: { type: 'string', required: false },
      },
      riskTier: 1,
      requiresApproval: false,
      effects: ['write'],
    },
  ];
  async health(): Promise<ChannelOutboundResult> { return { ok: true }; }
  async dispatch(): Promise<ChannelOutboundResult> { return { ok: true }; }
  normalizeInbound(): ChannelInboundEvent | null { return null; }
}

// ─── Channel: SMS ─────────────────────────────────────────────────────
class SmsAdapter implements ChannelAdapter {
  readonly kind = ChannelKind.SMS;
  readonly displayName = 'SMS';
  readonly mcpActions: ReadonlyArray<McpActionDescriptor> = [
    {
      name: 'sms-send',
      description: 'Send an SMS message.',
      inputSchema: {
        to: { type: 'string', required: true, pattern: '^[+0-9 ()-]{6,20}$' },
        body: { type: 'string', required: true, description: 'Max 1600 chars' },
      },
      riskTier: 4,
      requiresApproval: true,
      effects: ['side-effect:external'],
    },
  ];
  async health(): Promise<ChannelOutboundResult> { return { ok: true }; }
  async dispatch(): Promise<ChannelOutboundResult> { return { ok: true }; }
  normalizeInbound(): ChannelInboundEvent | null { return null; }
}

// ─── Channel: Voice ───────────────────────────────────────────────────
class VoiceAdapter implements ChannelAdapter {
  readonly kind = ChannelKind.VOICE;
  readonly displayName = 'Voice (inbound + outbound)';
  readonly mcpActions: ReadonlyArray<McpActionDescriptor> = [
    {
      name: 'voice-call-place',
      description: 'Place an outbound voice call with a TwiML flow.',
      inputSchema: {
        to: { type: 'string', required: true },
        from: { type: 'string', required: true },
        flowId: { type: 'string', required: true },
        record: { type: 'boolean', required: false },
      },
      riskTier: 4,
      requiresApproval: true,
      effects: ['side-effect:external'],
    },
    {
      name: 'voice-call-handle-inbound',
      description: 'Webhook target for inbound voice. No agent invocation.',
      inputSchema: { callId: { type: 'string', required: true } },
      riskTier: 1,
      requiresApproval: false,
      effects: ['read'],
    },
  ];
  async health(): Promise<ChannelOutboundResult> { return { ok: true }; }
  async dispatch(): Promise<ChannelOutboundResult> { return { ok: true }; }
  normalizeInbound(raw: unknown, ctx: { tenantId: string; connectionId: string | null }): ChannelInboundEvent | null {
    if (typeof raw !== 'object' || raw === null) return null;
    const r = raw as { CallSid?: string; From?: string; To?: string };
    if (!r.CallSid) return null;
    return {
      kind: this.kind,
      tenantId: ctx.tenantId,
      connectionId: ctx.connectionId,
      direction: 'inbound',
      payload: { ...r },
      occurredAt: new Date().toISOString(),
    };
  }
}

// ─── Channel: Video (Zoom + Teams meetings) ──────────────────────────
class VideoAdapter implements ChannelAdapter {
  readonly kind = ChannelKind.VIDEO;
  readonly displayName = 'Video (Zoom / Teams meetings)';
  readonly mcpActions: ReadonlyArray<McpActionDescriptor> = [
    {
      name: 'video-meeting-create',
      description: 'Schedule a video meeting.',
      inputSchema: {
        topic: { type: 'string', required: true },
        startTime: { type: 'string', required: true },
        durationMin: { type: 'number', required: true },
        attendees: { type: 'array', required: false },
        provider: { type: 'string', required: false, enum: ['zoom', 'ms-teams'] },
      },
      riskTier: 3,
      requiresApproval: true,
      effects: ['side-effect:external', 'write'],
    },
  ];
  async health(): Promise<ChannelOutboundResult> { return { ok: true }; }
  async dispatch(): Promise<ChannelOutboundResult> { return { ok: true }; }
  normalizeInbound(): ChannelInboundEvent | null { return null; }
}

// ─── Channel: MS Teams ────────────────────────────────────────────────
class MsTeamsAdapter implements ChannelAdapter {
  readonly kind = ChannelKind.MS_TEAMS;
  readonly displayName = 'Microsoft Teams';
  readonly mcpActions: ReadonlyArray<McpActionDescriptor> = [
    {
      name: 'teams-message-send',
      description: 'Send a chat message into a Teams channel.',
      inputSchema: {
        teamId: { type: 'string', required: true },
        channelId: { type: 'string', required: true },
        text: { type: 'string', required: true },
      },
      riskTier: 2,
      requiresApproval: false,
      effects: ['side-effect:external', 'write'],
    },
  ];
  async health(): Promise<ChannelOutboundResult> { return { ok: true }; }
  async dispatch(): Promise<ChannelOutboundResult> { return { ok: true }; }
  normalizeInbound(): ChannelInboundEvent | null { return null; }
}

// ─── Channel: MS Outlook ──────────────────────────────────────────────
class MsOutlookAdapter implements ChannelAdapter {
  readonly kind = ChannelKind.MS_OUTLOOK;
  readonly displayName = 'Microsoft Outlook';
  readonly mcpActions: ReadonlyArray<McpActionDescriptor> = [
    {
      name: 'outlook-mail-list',
      description: 'List recent inbox messages (read-only).',
      inputSchema: {
        max: { type: 'number', required: false },
      },
      riskTier: 1,
      requiresApproval: false,
      effects: ['read'],
    },
    {
      name: 'outlook-mail-draft',
      description: 'Create an Outlook draft.',
      inputSchema: {
        to: { type: 'string', required: true },
        subject: { type: 'string', required: true },
        body: { type: 'string', required: true },
      },
      riskTier: 2,
      requiresApproval: false,
      effects: ['write'],
    },
  ];
  async health(): Promise<ChannelOutboundResult> { return { ok: true }; }
  async dispatch(): Promise<ChannelOutboundResult> { return { ok: true }; }
  normalizeInbound(): ChannelInboundEvent | null { return null; }
}

// ─── Channel: Google Chat ─────────────────────────────────────────────
class GoogleChatAdapter implements ChannelAdapter {
  readonly kind = ChannelKind.GOOGLE_CHAT;
  readonly displayName = 'Google Chat';
  readonly mcpActions: ReadonlyArray<McpActionDescriptor> = [
    {
      name: 'gchat-message-send',
      description: 'Send a message into a Google Chat space.',
      inputSchema: {
        space: { type: 'string', required: true },
        text: { type: 'string', required: true },
      },
      riskTier: 2,
      requiresApproval: false,
      effects: ['side-effect:external', 'write'],
    },
  ];
  async health(): Promise<ChannelOutboundResult> { return { ok: true }; }
  async dispatch(): Promise<ChannelOutboundResult> { return { ok: true }; }
  normalizeInbound(): ChannelInboundEvent | null { return null; }
}

// ─── Channel: Google Calendar ─────────────────────────────────────────
class GoogleCalendarAdapter implements ChannelAdapter {
  readonly kind = ChannelKind.GOOGLE_CALENDAR;
  readonly displayName = 'Google Calendar';
  readonly mcpActions: ReadonlyArray<McpActionDescriptor> = [
    {
      name: 'gcal-event-create',
      description: 'Create a calendar event.',
      inputSchema: {
        summary: { type: 'string', required: true },
        start: { type: 'string', required: true },
        end: { type: 'string', required: true },
        attendees: { type: 'array', required: false },
      },
      riskTier: 2,
      requiresApproval: false,
      effects: ['write'],
    },
  ];
  async health(): Promise<ChannelOutboundResult> { return { ok: true }; }
  async dispatch(): Promise<ChannelOutboundResult> { return { ok: true }; }
  normalizeInbound(): ChannelInboundEvent | null { return null; }
}

// ─── Channel: Zoom ─────────────────────────────────────────────────────
class ZoomAdapter implements ChannelAdapter {
  readonly kind = ChannelKind.ZOOM;
  readonly displayName = 'Zoom';
  readonly mcpActions: ReadonlyArray<McpActionDescriptor> = [
    {
      name: 'zoom-meeting-create',
      description: 'Schedule a Zoom meeting.',
      inputSchema: {
        topic: { type: 'string', required: true },
        startTime: { type: 'string', required: true },
        durationMin: { type: 'number', required: true },
        attendees: { type: 'array', required: false },
      },
      riskTier: 3,
      requiresApproval: true,
      effects: ['side-effect:external', 'write'],
    },
  ];
  async health(): Promise<ChannelOutboundResult> { return { ok: true }; }
  async dispatch(): Promise<ChannelOutboundResult> { return { ok: true }; }
  normalizeInbound(): ChannelInboundEvent | null { return null; }
}

// ─── Channel: MCP (machine-only) ──────────────────────────────────────
class McpAdapter implements ChannelAdapter {
  readonly kind = ChannelKind.MCP;
  readonly displayName = 'MCP (machine-to-machine)';
  readonly mcpActions: ReadonlyArray<McpActionDescriptor> = [
    {
      name: 'mcp-action-invoke',
      description: 'Invoke any MCP-described action (meta).',
      inputSchema: {
        action: { type: 'string', required: true },
        payload: { type: 'object', required: true },
      },
      riskTier: 2,
      requiresApproval: false,
      effects: ['side-effect:external'],
    },
  ];
  async health(): Promise<ChannelOutboundResult> { return { ok: true }; }
  async dispatch(): Promise<ChannelOutboundResult> { return { ok: true }; }
  normalizeInbound(raw: unknown, ctx: { tenantId: string; connectionId: string | null }): ChannelInboundEvent | null {
    if (typeof raw !== 'object' || raw === null) return null;
    return {
      kind: this.kind,
      tenantId: ctx.tenantId,
      connectionId: ctx.connectionId,
      direction: 'inbound',
      payload: raw as Record<string, unknown>,
      occurredAt: new Date().toISOString(),
    };
  }
}

// ─── Channel: Webhook ─────────────────────────────────────────────────
class WebhookAdapter implements ChannelAdapter {
  readonly kind = ChannelKind.WEBHOOK;
  readonly displayName = 'Inbound webhook';
  readonly mcpActions: ReadonlyArray<McpActionDescriptor> = [
    {
      name: 'webhook-receive',
      description: 'Receive an inbound webhook (no outbound).',
      inputSchema: {
        body: { type: 'object', required: true },
      },
      riskTier: 1,
      requiresApproval: false,
      effects: ['read'],
    },
  ];
  async health(): Promise<ChannelOutboundResult> { return { ok: true }; }
  async dispatch(): Promise<ChannelOutboundResult> {
    return { ok: false, error: 'webhook channel is inbound-only' };
  }
  normalizeInbound(raw: unknown, ctx: { tenantId: string; connectionId: string | null }): ChannelInboundEvent | null {
    if (typeof raw !== 'object' || raw === null) return null;
    return {
      kind: this.kind,
      tenantId: ctx.tenantId,
      connectionId: ctx.connectionId,
      direction: 'inbound',
      payload: raw as Record<string, unknown>,
      occurredAt: new Date().toISOString(),
    };
  }
}

/**
 * The list of OOB adapters Phase 5.1 ships. Solid (OCP): Phase 5.5
 * appends to this list — existing adapters are not touched.
 */
export const OOB_CHANNEL_ADAPTERS: ReadonlyArray<ChannelAdapter> = [
  new WebAssistantAdapter(),
  new EmailAdapter(),
  new SmsAdapter(),
  new VoiceAdapter(),
  new VideoAdapter(),
  new MsTeamsAdapter(),
  new MsOutlookAdapter(),
  new GoogleChatAdapter(),
  new GoogleCalendarAdapter(),
  new ZoomAdapter(),
  new McpAdapter(),
  new WebhookAdapter(),
];

/**
 * Bootstrap helper — register every OOB adapter on the given registry.
 * Called from ChannelsModule.onModuleInit().
 */
export function registerOobChannelAdapters(registry: ChannelRegistry): void {
  for (const a of OOB_CHANNEL_ADAPTERS) registry.register(a);
}
