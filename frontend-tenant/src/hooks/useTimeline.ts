// src/hooks/useTimeline.ts
//
// Phase 7 (§9.3) — Unified timeline hook.
//
// Strategy (per Phase 7 §9.3 and gate G7):
//   1. Subscribe to the entity-scoped Socket.IO room via the shared
//      socket client (`services/socket.ts`). The server gates room
//      join on tenant ownership so cross-tenant fanout is impossible.
//   2. On socket disconnect, fall back to GET polling
//      (`timelineService.getEntityTimeline`) every `pollIntervalMs`.
//   3. On reconnect, drop the polling loop and rely on the socket.
//
// The hook is also key-navigable: tab/shift+tab between events.

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { getSocket } from '@/services/socket';
import {
  timelineService,
  TimelineEvent,
  SupportedEntityType,
} from '@/services/timeline.service';

export interface UseTimelineOptions {
  entityType: SupportedEntityType;
  entityId: string;
  pollIntervalMs?: number;
  initialLimit?: number;
}

export interface UseTimelineState {
  events: TimelineEvent[];
  loading: boolean;
  error: string | null;
  transport: 'socket' | 'polling' | 'idle';
  retry: () => void;
}

export function useTimeline({
  entityType,
  entityId,
  pollIntervalMs = 5000,
  initialLimit = 200,
}: UseTimelineOptions): UseTimelineState {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transport, setTransport] = useState<'socket' | 'polling' | 'idle'>(
    'idle',
  );

  const sinceRef = useRef<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  const upsertEvent = useCallback((event: TimelineEvent) => {
    setEvents((prev) => {
      const idx = prev.findIndex((e) => e.id === event.id);
      if (idx >= 0) {
        const next = prev.slice();
        next[idx] = event;
        return next;
      }
      return [...prev, event].sort((a, b) =>
        a.occurredAt.localeCompare(b.occurredAt),
      );
    });
  }, []);

  const ingest = useCallback(
    (list: TimelineEvent[]) => {
      setEvents((prev) => {
        const map = new Map(prev.map((e) => [e.id, e]));
        for (const e of list) map.set(e.id, e);
        return Array.from(map.values()).sort((a, b) =>
          a.occurredAt.localeCompare(b.occurredAt),
        );
      });
      if (list.length > 0) {
        const last = list[list.length - 1];
        sinceRef.current = last.occurredAt;
      }
    },
    [],
  );

  const pollOnce = useCallback(async () => {
    try {
      const list = await timelineService.getEntityTimeline(
        entityType,
        entityId,
        sinceRef.current ? { since: sinceRef.current } : { limit: initialLimit },
      );
      if (cancelledRef.current) return;
      ingest(list);
      setError(null);
    } catch (e) {
      if (cancelledRef.current) return;
      setError(e instanceof Error ? e.message : 'timeline fetch failed');
    }
  }, [entityType, entityId, ingest, initialLimit]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollTimerRef.current) return;
    setTransport('polling');
    const tick = async () => {
      if (cancelledRef.current) return;
      await pollOnce();
      if (cancelledRef.current) return;
      pollTimerRef.current = setTimeout(tick, pollIntervalMs);
    };
    void tick();
  }, [pollOnce, pollIntervalMs]);

  const setupSocket = useCallback(() => {
    const socket = getSocket();
    socketRef.current = socket;

    const onEvent = (payload: { entityType: string; entityId: string; event: TimelineEvent }) => {
      if (
        payload?.entityType === entityType &&
        payload?.entityId === entityId &&
        payload.event
      ) {
        upsertEvent(payload.event);
        sinceRef.current = payload.event.occurredAt;
      }
    };

    const onConnect = () => {
      if (cancelledRef.current) return;
      stopPolling();
      setTransport('socket');
      socket.emit('timeline:subscribe', { entityType, entityId });
      // Pull missed events since the last seen timestamp on reconnect.
      void pollOnce();
    };

    const onDisconnect = () => {
      if (cancelledRef.current) return;
      setTransport('polling');
      socket.emit('timeline:unsubscribe', { entityType, entityId });
      startPolling();
    };

    socket.on('timeline:event', onEvent);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    if (socket.connected) {
      onConnect();
    } else {
      // Boot polling immediately so the UI is never empty while the
      // socket is still negotiating the handshake.
      startPolling();
      socket.connect();
    }

    return () => {
      socket.emit('timeline:unsubscribe', { entityType, entityId });
      socket.off('timeline:event', onEvent);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [entityType, entityId, upsertEvent, startPolling, stopPolling, pollOnce]);

  const retry = useCallback(() => {
    setError(null);
    cancelledRef.current = false;
    void (async () => {
      setLoading(true);
      try {
        const list = await timelineService.getEntityTimeline(entityType, entityId, {
          limit: initialLimit,
        });
        if (cancelledRef.current) return;
        ingest(list);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'timeline fetch failed');
      } finally {
        if (!cancelledRef.current) setLoading(false);
      }
    })();
  }, [entityType, entityId, ingest, initialLimit]);

  // Initial load + lifecycle
  useEffect(() => {
    cancelledRef.current = false;
    setLoading(true);
    void (async () => {
      try {
        const list = await timelineService.getEntityTimeline(entityType, entityId, {
          limit: initialLimit,
        });
        if (cancelledRef.current) return;
        ingest(list);
      } catch (e) {
        if (cancelledRef.current) return;
        setError(e instanceof Error ? e.message : 'timeline fetch failed');
      } finally {
        if (!cancelledRef.current) setLoading(false);
      }
    })();

    const cleanup = setupSocket();
    return () => {
      cancelledRef.current = true;
      stopPolling();
      cleanup?.();
    };
  }, [entityType, entityId, ingest, initialLimit, setupSocket, stopPolling]);

  return { events, loading, error, transport, retry };
}
