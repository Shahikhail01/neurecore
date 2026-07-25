/**
 * ImpactTimeline.tsx - Scrollable list of timeline events sorted by impact
 *
 * Displays a vertical scrollable timeline of events, with optional loading
 * states and empty states.
 *
 * SOLID Principles:
 * - Single Responsibility: Renders event list only
 * - Open/Closed: Extensible via children render props
 * - Liskov Substitution: Can replace any list component
 * - Interface Segregation: Focused props only
 * - Dependency Inversion: Depends on TimelineEvent interface
 */

'use client';

import type { FC, ReactNode } from 'react';
import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Inbox } from 'lucide-react';
import type { TimelineEvent } from './types';
import { TimelineEvent as TimelineEventComponent } from './TimelineEvent';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────

interface ImpactTimelineProps {
    events: TimelineEvent[];
    onEventClick?: (eventId: string) => void;
    onActionClick?: (eventType: string, target?: string) => void;
    isLoading?: boolean;
    isEmpty?: boolean;
    emptyMessage?: string;
    className?: string;
    maxHeight?: string;
    showScrollGradient?: boolean;
    highlightedEventId?: string;
}

// ─── Utilities ────────────────────────────────────────────────────────────

/**
 * Sorts events by impact priority
 * SOLID: Single Responsibility - Sorting logic only
 */
const sortByImpact = (events: TimelineEvent[]): TimelineEvent[] => {
    const impactOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return [...events].sort((a, b) => {
        const aOrder = impactOrder[a.impact] ?? 999;
        const bOrder = impactOrder[b.impact] ?? 999;
        if (aOrder !== bOrder) return aOrder - bOrder;
        // Secondary sort by timestamp (newer first)
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
};

/**
 * Skeleton loader for events
 * SOLID: Single Responsibility - Loading state only
 */
const SkeletonLoader: FC = () => (
    <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, idx) => (
            <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="h-20 bg-gray-200 rounded-lg animate-pulse"
            />
        ))}
    </div>
);

/**
 * Empty state view
 * SOLID: Single Responsibility - Empty state only
 */
const EmptyState: FC<{ message?: string }> = ({
    message = 'No events to display',
}) => (
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center py-12 text-center"
    >
        <Inbox className="w-12 h-12 text-gray-400 mb-4" />
        <p className="text-gray-600 font-medium">{message}</p>
        <p className="text-gray-500 text-sm mt-1">Check back later for updates</p>
    </motion.div>
);

// ─── Component ────────────────────────────────────────────────────────────

/**
 * ImpactTimeline - Displays a scrollable timeline of events
 *
 * Features:
 * - Automatically sorts events by impact
 * - Loading skeleton
 * - Empty state
 * - Smooth animations
 * - Accessibility support
 *
 * Layout:
 * ┌──────────────────────────────┐
 * │ TimelineEvent 1 (CRITICAL)   │
 * │ TimelineEvent 2 (HIGH)       │
 * │ TimelineEvent 3 (MEDIUM)     │
 * │ ...scroll...                 │
 * └──────────────────────────────┘
 */
export const ImpactTimeline: FC<ImpactTimelineProps> = ({
    events,
    onEventClick,
    onActionClick,
    isLoading = false,
    isEmpty = false,
    emptyMessage,
    className,
    maxHeight = 'max-h-[600px]',
    showScrollGradient = true,
    highlightedEventId,
}) => {
    // Sort events by impact
    const sortedEvents = useMemo(() => sortByImpact(events), [events]);

    // Determine content to render
    const content: ReactNode = useMemo(() => {
        if (isLoading) return <SkeletonLoader />;
        if (isEmpty || sortedEvents.length === 0) {
            return <EmptyState message={emptyMessage} />;
        }
        return null;
    }, [isLoading, isEmpty, sortedEvents.length, emptyMessage]);

    // Count events by impact for stats
    const impactStats = useMemo(() => {
        const stats = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
        sortedEvents.forEach((event) => {
            if (event.impact in stats) {
                stats[event.impact as keyof typeof stats]++;
            }
        });
        return stats;
    }, [sortedEvents]);

    return (
        <div className={cn('flex flex-col h-full', className)}>
            {/* Header Stats (optional) */}
            {!isLoading && sortedEvents.length > 0 && (
                <div
                    className="flex gap-4 mb-4 px-2 text-xs font-medium text-gray-600 border-b border-gray-200 pb-3"
                    role="region"
                    aria-label="Impact summary"
                >
                    {impactStats.CRITICAL > 0 && (
                        <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-[color:var(--state-danger)]" />
                            <span>{impactStats.CRITICAL} Critical</span>
                        </div>
                    )}
                    {impactStats.HIGH > 0 && (
                        <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-orange-500" />
                            <span>{impactStats.HIGH} High</span>
                        </div>
                    )}
                    {impactStats.MEDIUM > 0 && (
                        <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-yellow-500" />
                            <span>{impactStats.MEDIUM} Medium</span>
                        </div>
                    )}
                    {impactStats.LOW > 0 && (
                        <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-gray-500" />
                            <span>{impactStats.LOW} Low</span>
                        </div>
                    )}
                </div>
            )}

            {/* Scroll Container */}
            <div
                className={cn(
                    'relative flex-1 overflow-y-auto overflow-x-hidden rounded-lg border border-gray-200 bg-white',
                    maxHeight,
                )}
                role="region"
                aria-label="Timeline events"
                aria-live="polite"
            >
                {/* Scroll Gradient (Top) */}
                {showScrollGradient && (
                    <div className="sticky top-0 left-0 right-0 h-2 bg-gradient-to-b from-white to-transparent pointer-events-none z-10" />
                )}

                {/* Content Area */}
                <div className="p-4 space-y-3">
                    {content ? (
                        content
                    ) : (
                        <AnimatePresence>
                            {sortedEvents.map((event, index) => (
                                <TimelineEventComponent
                                    key={event.id}
                                    event={event}
                                    onEventClick={onEventClick}
                                    onActionClick={onActionClick}
                                    isHighlighted={event.id === highlightedEventId}
                                    className="mb-2"
                                />
                            ))}
                        </AnimatePresence>
                    )}
                </div>

                {/* Scroll Gradient (Bottom) */}
                {showScrollGradient && (
                    <div className="sticky bottom-0 left-0 right-0 h-2 bg-gradient-to-t from-white to-transparent pointer-events-none" />
                )}
            </div>

            {/* Footer: Event Count */}
            {!isLoading && sortedEvents.length > 0 && (
                <div className="mt-3 text-xs text-gray-500 text-center font-medium">
                    Showing {sortedEvents.length} event{sortedEvents.length !== 1 ? 's' : ''}
                </div>
            )}

            {/* Error State (optional) */}
            {sortedEvents.length === 0 && !isLoading && !isEmpty && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center justify-center gap-2 p-4 text-sm text-yellow-700 bg-yellow-50 rounded-lg mt-4"
                    role="alert"
                >
                    <AlertCircle className="w-4 h-4" />
                    <span>No events match your criteria</span>
                </motion.div>
            )}
        </div>
    );
};

export default ImpactTimeline;
