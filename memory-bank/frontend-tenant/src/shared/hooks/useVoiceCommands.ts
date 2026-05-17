'use client';
// ─── useVoiceCommands.ts ──────────────────────────────────────────────────────
// SRP: Hook that bridges VoiceCommandService ↔ React router + stores.
// DIP: Depends on IVoiceCommandService abstraction via getVoiceCommandService().
//
// Usage:
//   const { isListening, isSupported, toggle, transcript } = useVoiceCommands();

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getVoiceCommandService }     from '@/core/services/voice/VoiceCommandService';
import { getVoiceAnalyticsLogger }    from '@/core/services/voice/VoiceAnalyticsLogger';
import { useCommandStore }            from '@/stores/commandStore';
import { ROUTES }                     from '@/shared/constants/routes';
import type { VoiceCommand, VoiceTranscript } from '@/core/services/voice/interfaces/IVoiceCommandService';

// ─── Action → navigation map (OCP: add entries, no logic change) ─────────────
const ACTION_ROUTES: Partial<Record<VoiceCommand['action'], string>> = {
  navigateToDashboard:  ROUTES.DASHBOARD,
  navigateToAgents:     ROUTES.AGENTS.ROOT,
  navigateToTasks:      ROUTES.TASKS.ROOT,
  navigateToWorkflows:  ROUTES.WORKFLOWS.ROOT,
  navigateToApprovals:  ROUTES.APPROVALS,
  navigateToAnalytics:  ROUTES.ANALYTICS,
};

interface UseVoiceCommandsReturn {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  lastCommand: VoiceCommand | null;
  error: string | null;
  toggle: () => void;
  stop: () => void;
}

export function useVoiceCommands(): UseVoiceCommandsReturn {
  const router        = useRouter();
  const openPalette   = useCommandStore((s) => s.openPalette);
  const service       = getVoiceCommandService();
  const analytics     = getVoiceAnalyticsLogger();

  const [isListening, setListening]   = useState(false);
  const [transcript, setTranscript]   = useState('');
  const [lastCommand, setLastCommand] = useState<VoiceCommand | null>(null);
  const [error, setError]             = useState<string | null>(null);

  useEffect(() => {
    // Subscribe to transcript updates
    const unsubTranscript = service.onTranscript((t: VoiceTranscript) => {
      setTranscript(t.text);
      // Log unmatched finals (command subscription below logs matches)
      if (t.isFinal && !service.match(t.text)) {
        analytics.log({
          type:       'command_unmatched',
          transcript: t.text,
          confidence: t.confidence,
        });
      }
    });

    // Subscribe to matched commands
    const unsubCommand = service.onCommand((cmd: VoiceCommand) => {
      setLastCommand(cmd);
      setTranscript('');
      analytics.log({
        type:       'command_matched',
        action:     cmd.action,
      });
      executeAction(cmd);
    });

    // Subscribe to errors
    const unsubError = service.onError((err: Error) => {
      setError(err.message);
      setListening(false);
      analytics.log({ type: 'recognition_error', transcript: err.message });
    });

    return () => {
      unsubTranscript();
      unsubCommand();
      unsubError();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const executeAction = useCallback((cmd: VoiceCommand) => {
    // Handle navigation
    const route = ACTION_ROUTES[cmd.action];
    if (route) {
      router.push(route);
      return;
    }

    // Handle non-navigation actions
    switch (cmd.action) {
      case 'openCommandPalette':
        openPalette();
        break;
      case 'openNewTask':
        router.push(ROUTES.TASKS.DELEGATE);
        break;
      case 'bulkApprove':
        router.push(ROUTES.APPROVALS);
        break;
      case 'stopListening':
        service.stop();
        setListening(false);
        break;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, openPalette]);

  const toggle = useCallback(() => {
    if (isListening) {
      service.stop();
      setListening(false);
      analytics.endSession();
    } else {
      setError(null);
      analytics.startSession();
      service.start();
      setListening(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListening, service]);

  const stop = useCallback(() => {
    service.stop();
    setListening(false);
  }, [service]);

  return {
    isListening,
    isSupported: service.isSupported(),
    transcript,
    lastCommand,
    error,
    toggle,
    stop,
  };
}
