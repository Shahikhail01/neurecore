/**
 * Timeline Components Index
 *
 * Central export point for Phase 7 unified timeline components and
 * the legacy impact-timeline components used by the Mission Feed.
 */

export { TimelineEvent as TimelineEventComponent } from './TimelineEvent';
export { ImpactTimeline } from './ImpactTimeline';
export { TimelineFilter } from './TimelineFilter';
export { UnifiedTimeline } from './UnifiedTimeline';

export { default as TimelineEvent } from './TimelineEvent';

export type {
  TimelineEvent as TimelineEventData,
  TimelineEventType,
  TimelineEventImpact,
  TimelineEventAction,
  TimelineEventMetadata,
  TimelineFilterType,
  TimelineState,
  TimelineResponse,
} from './types';

export type {
  TimelineEvent as UnifiedTimelineEvent,
  SupportedEntityType,
} from '@/services/timeline.service';
