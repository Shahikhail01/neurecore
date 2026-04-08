/**
 * useTimeRange — shared chart time-range state for admin portal
 * I principle: single responsibility — manages range toggle only
 */
'use client';

import { useState } from 'react';
import type { ChartTimeRange } from '@/types/ui.types';

export function useTimeRange(initial: ChartTimeRange = '7d') {
  const [range, setRange] = useState<ChartTimeRange>(initial);
  return { range, setRange };
}
