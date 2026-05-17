// ─── storeEventBridge.ts ─────────────────────────────────────────────────────
// SRP: Centralises all EventBus → Zustand store subscriptions.
// OCP: New event wiring is added here; stores are not modified.
// Call `initStoreEventBridge()` once at app startup (e.g. in layout.tsx).

import { hqEventBus } from '@/core/infrastructure/socket/EventBus';
import { useAgentStore } from '@/stores/agentStore';
import { useTaskStore } from '@/stores/taskStore';
import { useWorkflowStore } from '@/stores/workflowStore';
import { useNotificationStore } from '@/shared/stores/notificationStore';
import type { AgentStatus, TaskStatus, WorkflowStatus, NotificationType } from '@/shared/types/domain.types';

let _initialized = false;
const _unsubs: Array<() => void> = [];

export function initStoreEventBridge(): () => void {
  if (_initialized) return teardownStoreEventBridge;
  _initialized = true;

  // ─── Agent status changes ──────────────────────────────────────────────────
  _unsubs.push(
    hqEventBus.on('agent:status', ({ agentId, status }) => {
      useAgentStore.getState().updateAgentStatus(agentId, status as AgentStatus);
    }),
  );

  // ─── Task status changes ───────────────────────────────────────────────────
  _unsubs.push(
    hqEventBus.on('task:update', ({ taskId, status }) => {
      useTaskStore.getState().updateTaskStatus(taskId, status as TaskStatus);
    }),
  );

  // ─── Workflow events ───────────────────────────────────────────────────────
  _unsubs.push(
    hqEventBus.on('workflow:event', ({ workflowId, event }) => {
      const statusMap: Record<string, WorkflowStatus> = {
        started: 'ACTIVE',
        completed: 'ARCHIVED',
        failed: 'ERROR',
        paused: 'PAUSED',
      };
      const status = statusMap[event];
      if (status) {
        useWorkflowStore.getState().updateWorkflowStatus(workflowId, status);
      }
    }),
  );

  // ─── Inbound push notifications ───────────────────────────────────────────
  _unsubs.push(
    hqEventBus.on('notification:new', ({ title, message, type }) => {
      useNotificationStore.getState().addNotification({
        title,
        message,
        type: type as NotificationType,
        priority: 'info',
      });
    }),
  );

  // ─── Approval requests → notifications ────────────────────────────────────
  _unsubs.push(
    hqEventBus.on('approval:requested', ({ approvalId, title }) => {
      useNotificationStore.getState().addNotification({
        title: 'Approval Required',
        message: title,
        type: 'warning',
        priority: 'important',
        entityId: approvalId,
        entityType: 'Approval',
      });
    }),
  );

  return teardownStoreEventBridge;
}

export function teardownStoreEventBridge(): void {
  _unsubs.forEach((fn) => fn());
  _unsubs.length = 0;
  _initialized = false;
}
