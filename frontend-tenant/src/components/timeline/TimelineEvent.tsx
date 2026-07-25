/**
 * TimelineEvent.tsx - Single timeline event card
 *
 * Displays a single event with title, description, impact level, and actions.
 *
 * SOLID Principles:
 * - Single Responsibility: Renders a single event card
 * - Open/Closed: Extensible via props, no modification needed for new event types
 * - Liskov Substitution: Can be substituted with other event displays
 * - Interface Segregation: Only accepts necessary props
 * - Dependency Inversion: Depends on interface (TimelineEvent) not concrete types
 */

'use client';

import type { FC, ReactNode } from 'react';
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
    AlertCircle,
    CheckCircle2,
    Star,
    Info,
    AlertTriangle,
    Flag,
    Trophy,
    ChevronRight,
} from 'lucide-react';
import type { TimelineEvent, TimelineEventType, TimelineEventImpact } from './types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────

interface TimelineEventCardProps {
    event: TimelineEvent;
    onEventClick?: (eventId: string) => void;
    onActionClick?: (action: string, target?: string) => void;
    isHighlighted?: boolean;
    className?: string;
}

// ─── Icon Mapping ────────────────────────────────────────────────────────

/**
 * Maps event type to Lucide icon component
 * SOLID: Interface Segregation - Mapping concern separated
 */
const getEventIcon = (type: TimelineEventType): ReactNode => {
    const iconClass = 'w-5 h-5';
    const iconMap: Record<TimelineEventType, ReactNode> = {
        APPROVAL_NEEDED: <AlertCircle className={cn(iconClass, 'text-[color:var(--state-danger)]')} />,
        ACTION_TAKEN: <CheckCircle2 className={cn(iconClass, 'text-[color:var(--state-success)]')} />,
        OPPORTUNITY: <Star className={cn(iconClass, 'text-yellow-500')} />,
        FYI: <Info className={cn(iconClass, 'text-[color:var(--state-info)]')} />,
        BLOCKER: <AlertTriangle className={cn(iconClass, 'text-orange-500')} />,
        MILESTONE: <Trophy className={cn(iconClass, 'text-purple-500')} />,
        ALERT: <Flag className={cn(iconClass, 'text-[color:var(--state-danger)]')} />,
    };

    return iconMap[type];
};

/**
 * Gets impact level styling
 * SOLID: Interface Segregation - Styling concern separated
 */
const getImpactStyles = (impact: TimelineEventImpact) => {
    const styleMap: Record<TimelineEventImpact, { border: string; bg: string; badge: string }> = {
        CRITICAL: {
            border: 'border-red-300',
            bg: 'bg-red-50 hover:bg-red-100',
            badge: 'bg-red-100 text-red-700 border-red-300',
        },
        HIGH: {
            border: 'border-orange-300',
            bg: 'bg-orange-50 hover:bg-orange-100',
            badge: 'bg-orange-100 text-orange-700 border-orange-300',
        },
        MEDIUM: {
            border: 'border-yellow-300',
            bg: 'bg-yellow-50 hover:bg-yellow-100',
            badge: 'bg-yellow-100 text-yellow-700 border-yellow-300',
        },
        LOW: {
            border: 'border-gray-300',
            bg: 'bg-gray-50 hover:bg-gray-100',
            badge: 'bg-gray-100 text-gray-700 border-gray-300',
        },
    };

    return styleMap[impact];
};

/**
 * Formats relative time (e.g., "2 minutes ago")
 * SOLID: Single Responsibility - Time formatting only
 */
const formatRelativeTime = (timestamp: Date | string): string => {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
};

// ─── Component ────────────────────────────────────────────────────────────

/**
 * TimelineEvent - Displays a single event card
 *
 * Layout:
 * ┌─────────────────────────────────────────┐
 * │ [Icon] Title              [Impact Badge] │
 * │ Description (optional)                  │
 * │ Metadata (optional)                     │
 * │ [Action Button] ... [More →]            │
 * └─────────────────────────────────────────┘
 */
const TimelineEventComponent: FC<TimelineEventCardProps> = ({
    event,
    onActionClick,
    onEventClick,
    isHighlighted = false,
    className,
}) => {
    const impactStyles = useMemo(() => getImpactStyles(event.impact), [event.impact]);
    const icon = useMemo(() => getEventIcon(event.type), [event.type]);
    const relativeTime = useMemo(() => formatRelativeTime(event.timestamp), [event.timestamp]);

    const handleEventClick = () => {
        onEventClick?.(event.id);
    };

    const handleActionClick = (target?: string) => {
        onActionClick?.(event.type, target);
    };

    return (
        <motion.article
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            onClick={handleEventClick}
            className={cn(
                'timeline-event relative p-4 rounded-lg border-2 cursor-pointer transition-all duration-200',
                'hover:shadow-md active:shadow-sm',
                impactStyles.border,
                impactStyles.bg,
                isHighlighted && 'ring-2 ring-blue-400 shadow-lg',
                className,
            )}
            role="article"
            aria-label={`${event.type}: ${event.title}`}
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    handleEventClick();
                }
            }}
        >
            {/* Header: Icon + Title + Impact Badge */}
            <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="flex-shrink-0 mt-1">{icon}</div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">{event.title}</h3>
                    </div>
                </div>

                {/* Impact Badge */}
                <div className="flex-shrink-0">
                    <span
                        className={cn(
                            'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border',
                            impactStyles.badge,
                        )}
                        aria-label={`Impact: ${event.impact}`}
                    >
                        {event.impact}
                    </span>
                </div>
            </div>

            {/* Description */}
            {event.description && (
                <p className="text-xs text-gray-700 mb-2 line-clamp-2">{event.description}</p>
            )}

            {/* Metadata Row (Department, Agent, Amount, etc.) */}
            {event.metadata && (
                <div className="flex flex-wrap gap-2 mb-3 text-xs text-gray-600">
                    {event.metadata.department && (
                        <span className="inline-flex items-center gap-1">
                            <span className="font-medium">{event.metadata.department.name}</span>
                        </span>
                    )}
                    {event.metadata.agent && (
                        <span className="inline-flex items-center gap-1">
                            <span>via {event.metadata.agent.name}</span>
                        </span>
                    )}
                    {event.metadata.amount && (
                        <span className="inline-flex items-center gap-1">
                            <span>${(event.metadata.amount / 1000).toFixed(1)}K</span>
                        </span>
                    )}
                    {event.metadata.metric && (
                        <span className="inline-flex items-center gap-1">
                            <span>{event.metadata.metric}</span>
                        </span>
                    )}
                </div>
            )}

            {/* Footer: Timestamp + Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                <span className="text-xs text-gray-500">{relativeTime}</span>

                {event.actions && event.actions.length > 0 && (
                    <div className="flex gap-1">
                        {event.actions.slice(0, 1).map((action, idx) => (
                            <Button
                                key={idx}
                                variant={action.isPrimary ? 'default' : 'ghost'}
                                size="sm"
                                className="h-7 text-xs px-2"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleActionClick(action.target);
                                }}
                            >
                                {action.label}
                            </Button>
                        ))}
                        {event.actions.length > 1 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleEventClick();
                                }}
                            >
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </motion.article>
    );
};

export default TimelineEventComponent;
export { TimelineEventComponent as TimelineEvent };
