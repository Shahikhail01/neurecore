// ─── useTimeRange ─────────────────────────────────────────────────────────────
// S — Single Responsibility: shared chart time range selector state
'use client';
import { useState } from 'react';
import type { ChartTimeRange } from '@/types/ui.types';

export function useTimeRange(initial: ChartTimeRange = '7d') {
  const [range, setRange] = useState<ChartTimeRange>(initial);
  return { range, setRange };
}
