/**
 * Agent Streaming Service - SSE Client
 *
 * Provides real-time streaming for agent execution using Server-Sent Events.
 */

import { create } from "zustand";

export type StreamingEventType =
  | "connected"
  | "disconnected"
  | "error"
  | "start"
  | "step_start"
  | "step_complete"
  | "step_error"
  | "tool_call"
  | "tool_result"
  | "thinking"
  | "complete"
  | "cancelled"
  | "heartbeat"
  | "progress";

export interface StreamingEvent {
  type: StreamingEventType;
  timestamp: number;
  sessionId: string;
  taskId?: string;
  stepIndex?: number;
  stepCount?: number;
  step?: {
    id: string;
    description: string;
    status: "pending" | "running" | "complete" | "error";
  };
  tool?: {
    name: string;
    input?: unknown;
    output?: unknown;
    error?: string;
    durationMs?: number;
  };
  reasoning?: string;
  progress?: number;
  data?: unknown;
  error?: string;
}

export interface StreamingSession {
  sessionId: string;
  taskId: string;
  status:
    | "connecting"
    | "connected"
    | "streaming"
    | "complete"
    | "error"
    | "cancelled";
  connectedAt?: number;
  events: StreamingEvent[];
  error?: string;
}

interface StreamingState {
  sessions: Map<string, StreamingSession>;
  activeSessionId: string | null;

  // Actions
  createSession: (sessionId: string, taskId: string) => void;
  updateSessionStatus: (
    sessionId: string,
    status: StreamingSession["status"],
    error?: string,
  ) => void;
  addEvent: (sessionId: string, event: StreamingEvent) => void;
  clearSession: (sessionId: string) => void;
  setActiveSession: (sessionId: string | null) => void;
  getSession: (sessionId: string) => StreamingSession | undefined;
}

export const useStreamingStore = create<StreamingState>((set, get) => ({
  sessions: new Map(),
  activeSessionId: null,

  createSession: (sessionId, taskId) => {
    set((state) => {
      const newSessions = new Map(state.sessions);
      newSessions.set(sessionId, {
        sessionId,
        taskId,
        status: "connecting",
        events: [],
      });
      return { sessions: newSessions, activeSessionId: sessionId };
    });
  },

  updateSessionStatus: (sessionId, status, error) => {
    set((state) => {
      const session = state.sessions.get(sessionId);
      if (!session) return state;

      const newSessions = new Map(state.sessions);
      newSessions.set(sessionId, {
        ...session,
        status,
        error,
        connectedAt: status === "connected" ? Date.now() : session.connectedAt,
      });
      return { sessions: newSessions };
    });
  },

  addEvent: (sessionId, event) => {
    set((state) => {
      const session = state.sessions.get(sessionId);
      if (!session) return state;

      const newSessions = new Map(state.sessions);
      newSessions.set(sessionId, {
        ...session,
        status:
          event.type === "complete"
            ? "complete"
            : event.type === "error"
              ? "error"
              : event.type === "cancelled"
                ? "cancelled"
                : "streaming",
        events: [...session.events, event],
      });
      return { sessions: newSessions };
    });
  },

  clearSession: (sessionId) => {
    set((state) => {
      const newSessions = new Map(state.sessions);
      newSessions.delete(sessionId);
      return {
        sessions: newSessions,
        activeSessionId:
          state.activeSessionId === sessionId ? null : state.activeSessionId,
      };
    });
  },

  setActiveSession: (sessionId) => {
    set({ activeSessionId: sessionId });
  },

  getSession: (sessionId) => {
    return get().sessions.get(sessionId);
  },
}));

/**
 * SSE Streaming Service
 * Manages EventSource connections for agent streaming
 */
export class AgentStreamingService {
  private eventSources: Map<string, EventSource> = new Map();
  private apiBaseUrl: string;

  constructor(apiBaseUrl: string = "") {
    this.apiBaseUrl = apiBaseUrl;
  }

  /**
   * Create a new streaming session
   */
  async createSession(
    taskId: string,
    userId?: string,
    tenantId?: string,
  ): Promise<{ sessionId: string; url: string }> {
    const params = new URLSearchParams({ taskId });
    if (userId) params.append("userId", userId);
    if (tenantId) params.append("tenantId", tenantId);

    const response = await fetch(
      `${this.apiBaseUrl}/api/v1/agents/streaming/sessions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, userId, tenantId }),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to create session: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Connect to a streaming session
   */
  connect(
    sessionId: string,
    onEvent: (event: StreamingEvent) => void,
    onError?: (error: Error) => void,
  ): EventSource {
    // Close existing connection if any
    this.disconnect(sessionId);

    const eventSource = new EventSource(
      `${this.apiBaseUrl}/api/v1/agents/streaming/sessions/${sessionId}/events`,
    );

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as StreamingEvent;
        onEvent(data);
      } catch (err) {
        console.error("Failed to parse streaming event:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("EventSource error:", err);
      if (onError) {
        onError(new Error("SSE connection error"));
      }
    };

    this.eventSources.set(sessionId, eventSource);
    return eventSource;
  }

  /**
   * Execute with streaming
   */
  async execute(
    sessionId: string,
    goal: string,
    agentId: string = "default",
    tenantId?: string,
  ): Promise<{ taskId: string; status: string }> {
    const params = new URLSearchParams({
      goal,
      agentId,
      sessionId,
    });
    if (tenantId) params.append("tenantId", tenantId);

    const response = await fetch(
      `${this.apiBaseUrl}/api/v1/agents/streaming/sessions/${sessionId}/execute?${params}`,
      { method: "POST" },
    );

    if (!response.ok) {
      throw new Error(`Failed to start execution: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Cancel a streaming session
   */
  async cancel(sessionId: string): Promise<void> {
    const response = await fetch(
      `${this.apiBaseUrl}/api/v1/agents/streaming/sessions/${sessionId}`,
      { method: "DELETE" },
    );

    if (!response.ok && response.status !== 404) {
      throw new Error(`Failed to cancel session: ${response.statusText}`);
    }

    this.disconnect(sessionId);
  }

  /**
   * Get session status
   */
  async getSessionStatus(sessionId: string): Promise<{
    sessionId: string;
    taskId: string;
    connectedAt: number;
    active: boolean;
  }> {
    const response = await fetch(
      `${this.apiBaseUrl}/api/v1/agents/streaming/sessions/${sessionId}`,
    );

    if (!response.ok) {
      throw new Error(`Failed to get session: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * List active sessions
   */
  async listSessions(): Promise<
    Array<{
      sessionId: string;
      taskId: string;
      connectedAt: number;
    }>
  > {
    const response = await fetch(
      `${this.apiBaseUrl}/api/v1/agents/streaming/sessions`,
    );

    if (!response.ok) {
      throw new Error(`Failed to list sessions: ${response.statusText}`);
    }

    const data = await response.json();
    return data.sessions;
  }

  /**
   * List available tools
   */
  async listTools(): Promise<
    Array<{
      name: string;
      description: string;
      category: string;
    }>
  > {
    const response = await fetch(
      `${this.apiBaseUrl}/api/v1/agents/streaming/tools`,
    );

    if (!response.ok) {
      throw new Error(`Failed to list tools: ${response.statusText}`);
    }

    const data = await response.json();
    return data.tools;
  }

  /**
   * Disconnect from a session
   */
  disconnect(sessionId: string): void {
    const eventSource = this.eventSources.get(sessionId);
    if (eventSource) {
      eventSource.close();
      this.eventSources.delete(sessionId);
    }
  }

  /**
   * Disconnect all sessions
   */
  disconnectAll(): void {
    for (const [sessionId, eventSource] of this.eventSources) {
      eventSource.close();
    }
    this.eventSources.clear();
  }
}

// Singleton instance
let streamingServiceInstance: AgentStreamingService | null = null;

export function getStreamingService(): AgentStreamingService {
  if (!streamingServiceInstance) {
    streamingServiceInstance = new AgentStreamingService();
  }
  return streamingServiceInstance;
}

export function setStreamingServiceApiBaseUrl(url: string): void {
  streamingServiceInstance = new AgentStreamingService(url);
}
