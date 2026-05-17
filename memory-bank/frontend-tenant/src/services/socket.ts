import { io, Socket } from "socket.io-client";
import { tokenManager } from "@/core/infrastructure/auth/TokenManager";
import { hqEventBus } from "@/core/infrastructure/socket/EventBus";

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3000";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      auth: (cb) => cb({ token: tokenManager.getAccessToken() }),
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      autoConnect: false,
    });

    // ── Bridge all backend events → EventBus ────────────────────────────────
    socket.on("connect", () =>
      hqEventBus.emit("socket:connected", undefined as void),
    );
    socket.on("disconnect", () =>
      hqEventBus.emit("socket:disconnected", undefined as void),
    );

    // Agent events
    socket.on(
      "agent:status_updated",
      ({ agentId, status }: { agentId: string; status: string }) =>
        hqEventBus.emit("agent:status", { agentId, status }),
    );

    socket.on(
      "agent:error",
      ({ agentId, error }: { agentId: string; error: string }) =>
        hqEventBus.emit("notification:new", {
          id: `ae-${Date.now()}`,
          title: "Agent Error",
          message: `${agentId}: ${error}`,
          type: "error",
        }),
    );

    // Task events — normalised to a unified task:update
    socket.on("task:started", ({ taskId }: { taskId: string }) =>
      hqEventBus.emit("task:update", { taskId, status: "RUNNING" }),
    );

    socket.on(
      "task:completed",
      ({ taskId, success }: { taskId: string; success: boolean }) =>
        hqEventBus.emit("task:update", {
          taskId,
          status: success ? "COMPLETED" : "FAILED",
        }),
    );

    socket.on("task:failed", ({ taskId }: { taskId: string }) =>
      hqEventBus.emit("task:update", { taskId, status: "FAILED" }),
    );

    // Workflow events — backend status → EventBus event string
    socket.on(
      "workflow:status_changed",
      ({ workflowId, status }: { workflowId: string; status: string }) => {
        const statusToEvent: Record<string, string> = {
          ACTIVE: "started",
          ARCHIVED: "completed",
          ERROR: "failed",
          PAUSED: "paused",
        };
        hqEventBus.emit("workflow:event", {
          workflowId,
          event: statusToEvent[status] ?? status.toLowerCase(),
        });
      },
    );

    // System alerts → notification store
    socket.on(
      "system:alert",
      ({ level, message }: { level: string; message: string }) =>
        hqEventBus.emit("notification:new", {
          id: `sa-${Date.now()}`,
          title: "System Alert",
          message,
          type:
            level === "error" ? "error" : level === "warn" ? "warning" : "info",
        }),
    );

    // Governance — requires-approval case → approval store
    socket.on(
      "governance:triggered",
      ({
        agentId,
        requiresApproval,
        triggeredRules,
      }: {
        agentId: string;
        requiresApproval: boolean;
        triggeredRules: string[];
      }) => {
        if (requiresApproval) {
          hqEventBus.emit("approval:requested", {
            approvalId: agentId,
            title: `Approval required — rules: ${triggeredRules.join(", ")}`,
          });
        }
      },
    );

    // Pass-through events (if backend emits them directly)
    socket.on("notification:new", (p) =>
      hqEventBus.emit("notification:new", p),
    );
    socket.on("approval:requested", (p) =>
      hqEventBus.emit("approval:requested", p),
    );
  }
  return socket;
}

export function connectSocket(): void {
  getSocket().connect();
}

/** Full disconnect — resets socket so next connectSocket() uses fresh token. */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
