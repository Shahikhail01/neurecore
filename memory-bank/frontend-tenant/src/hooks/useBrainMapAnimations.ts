'use client';
// ─── useBrainMapAnimations ────────────────────────────────────────────────────
// S — Single Responsibility: Socket.IO → animation state bridge only
// D — Dependency Inversion: depends on socket service abstraction

import { useEffect, useCallback } from 'react';
import { getSocket, connectSocket } from '../services/socket';

export type AnimationEvent =
  | { type: 'agent:thinking'; agentId: string }
  | { type: 'agent:task-started'; agentId: string; taskId: string }
  | { type: 'agent:task-completed'; agentId: string; taskId: string; success: boolean }
  | { type: 'agent:idle'; agentId: string }
  | { type: 'agent:error'; agentId: string }
  | { type: 'task:flow'; fromAgentId: string; toAgentId: string; taskId: string };

export interface AgentAnimState {
  pulse: boolean;        // animated ring (task running)
  thinking: boolean;     // spinner inside node
  error: boolean;        // red glow
  flowEdges: string[];   // list of target agentIds with active flow edge
}

type AnimStateMap = Map<string, AgentAnimState>;

export function useBrainMapAnimations(
  onUpdate: (agentId: string, patch: Partial<AgentAnimState>) => void,
) {
  const apply = useCallback(
    (agentId: string, patch: Partial<AgentAnimState>) => onUpdate(agentId, patch),
    [onUpdate],
  );

  useEffect(() => {
    connectSocket();
    const socket = getSocket();

    socket.on('agent:task_started', (p: { agentId: string; taskId: string }) => {
      apply(p.agentId, { pulse: true, thinking: false });
    });

    socket.on('agent:thinking', (p: { agentId: string }) => {
      apply(p.agentId, { thinking: true, pulse: true });
    });

    socket.on('agent:task_completed', (p: { agentId: string; taskId: string; status?: string }) => {
      apply(p.agentId, {
        pulse: false,
        thinking: false,
        error: p.status === 'FAILED',
      });
      // Clear error glow after 3s
      if (p.status === 'FAILED') {
        setTimeout(() => apply(p.agentId, { error: false }), 3000);
      }
    });

    socket.on('agent:idle', (p: { agentId: string }) => {
      apply(p.agentId, { pulse: false, thinking: false, error: false, flowEdges: [] });
    });

    socket.on('agent:error', (p: { agentId: string }) => {
      apply(p.agentId, { error: true, pulse: false, thinking: false });
      setTimeout(() => apply(p.agentId, { error: false }), 4000);
    });

    socket.on('task:assigned', (p: { agentId: string; fromAgent?: string }) => {
      if (p.fromAgent) {
        apply(p.fromAgent, { flowEdges: [p.agentId] });
        setTimeout(() => apply(p.fromAgent!, { flowEdges: [] }), 2500);
      }
    });

    // Also respond to existing status_updated event from ActivityStream
    socket.on('agent:status_updated', (p: { agentId: string; status: string }) => {
      if (p.status === 'RUNNING') apply(p.agentId, { pulse: true });
      if (p.status === 'IDLE') apply(p.agentId, { pulse: false, thinking: false });
      if (p.status === 'ERROR') apply(p.agentId, { error: true, pulse: false });
    });

    return () => {
      socket.off('agent:task_started');
      socket.off('agent:thinking');
      socket.off('agent:task_completed');
      socket.off('agent:idle');
      socket.off('agent:error');
      socket.off('task:assigned');
      socket.off('agent:status_updated');
    };
  }, [apply]);
}
