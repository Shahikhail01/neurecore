'use client';
// ─── useDailyBriefing.ts ──────────────────────────────────────────────────────
// SRP: Hook that bridges DailyBriefingService ↔ React component state.
// DIP: Depends on IDailyBriefingService abstraction.

import { useState, useCallback, useRef } from 'react';
import { dailyBriefingService }           from '@/core/services/DailyBriefingService';
import type { DailyBriefing }             from '@/core/services/interfaces/IDailyBriefingService';

interface UseDailyBriefingReturn {
  briefing:     DailyBriefing | null;
  isLoading:    boolean;
  isNarrating:  boolean;
  error:        string | null;
  isSupported:  boolean;
  /** Fetch (or use cached) briefing */
  open:         () => Promise<void>;
  /** Refresh — invalidates cache then re-fetches */
  refresh:      () => Promise<void>;
  /** Start / stop narration toggle */
  toggleNarration: () => void;
}

export function useDailyBriefing(): UseDailyBriefingReturn {
  const [briefing, setBriefing]   = useState<DailyBriefing | null>(null);
  const [isLoading, setLoading]   = useState(false);
  const [isNarrating, setNarrating] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const cancelNarration           = useRef<(() => void) | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const b = await dailyBriefingService.getBriefing();
      setBriefing(b);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load briefing');
    } finally {
      setLoading(false);
    }
  }, []);

  const open = useCallback(async () => {
    if (!briefing) await fetch();
  }, [briefing, fetch]);

  const refresh = useCallback(async () => {
    dailyBriefingService.invalidate();
    await fetch();
  }, [fetch]);

  const toggleNarration = useCallback(() => {
    if (isNarrating) {
      dailyBriefingService.stopNarration();
      cancelNarration.current?.();
      cancelNarration.current = null;
      setNarrating(false);
    } else if (briefing) {
      setNarrating(true);
      const cancel = dailyBriefingService.narrate(briefing);
      cancelNarration.current = cancel;
      // Reset narrating state when done (speech API fires onend)
      const interval = setInterval(() => {
        if (!dailyBriefingService.isSpeaking) {
          setNarrating(false);
          clearInterval(interval);
        }
      }, 500);
    }
  }, [briefing, isNarrating]);

  return {
    briefing,
    isLoading,
    isNarrating,
    error,
    isSupported: dailyBriefingService.isNarrationSupported(),
    open,
    refresh,
    toggleNarration,
  };
}
