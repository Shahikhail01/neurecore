// ─── useActivityStream ────────────────────────────────────────────────────────
// S — Single Responsibility: socket event → activity store bridge only
'use client';
import { useEffect } from 'react';
import { useActivityStore } from '@/stores/activityStore';
import { getSocket, connectSocket } from '@/services/socket';

export function useActivityStream() {
  const { events, addEvent, dismiss, clear } = useActivityStore();

  useEffect(() => {
    const socket = getSocket();
    connectSocket();

    socket.on('agent:status_updated', (p: { agentId: string; status: string; name?: string }) => {
      addEvent({
        message: `Agent ${p.name ?? p.agentId} → ${p.status}`,
        type: 'agent',
        severity: p.status === 'FAILED' ? 'error' : p.status === 'RUNNING' ? 'success' : 'info',
      });
    });

    socket.on('task:completed', (p: { taskId: string; agentName?: string }) => {
      addEvent({
        message: `Task completed${p.agentName ? ` by ${p.agentName}` : ''}`,
        type: 'task',
        severity: 'success',
      });
    });

    socket.on('task:failed', (p: { taskId: string }) => {
      addEvent({ message: `Task ${p.taskId} failed`, type: 'task', severity: 'error' });
    });

    socket.on('system:alert', (p: { level: string; message: string }) => {
      addEvent({ message: p.message, type: 'system', severity: p.level as 'warn' | 'error' | 'info' });
    });

    socket.on('workflow:completed', (p: { workflowId: string; name?: string }) => {
      addEvent({
        message: `Workflow ${p.name ?? p.workflowId} completed`,
        type: 'workflow',
        severity: 'success',
      });
    });

    return () => {
      socket.off('agent:status_updated');
      socket.off('task:completed');
      socket.off('task:failed');
      socket.off('system:alert');
      socket.off('workflow:completed');
    };
  }, [addEvent]);

  return { events, dismiss, clear };
}
