/**
 * TimelineFilter.tsx - Filter controls for timeline events
 *
 * Provides UI controls to filter timeline events by type/urgency.
 *
 * SOLID Principles:
 * - Single Responsibility: Filter UI only
 * - Open/Closed: Extensible filter options via props
 * - Liskov Substitution: Can be replaced with different filter UI
 * - Interface Segregation: Only filter-related props
 * - Dependency Inversion: Depends on TimelineFilterType interface
 */

'use client';

import type { FC } from 'react';
import { useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Star, AlertTriangle, Search, X } from 'lucide-react';
import type { TimelineFilterType } from './types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────

interface TimelineFilterProps {
    activeFilter: TimelineFilterType;
    onFilterChange: (filter: TimelineFilterType) => void;
    searchTerm?: string;
    onSearchChange?: (term: string) => void;
    eventCounts?: Record<TimelineFilterType, number>;
    className?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────

/**
 * Filter options with icons and labels
 * SOLID: Single Responsibility - Configuration only
 */
const FILTER_OPTIONS: Array<{
    value: TimelineFilterType;
    label: string;
    icon: FC<{ className?: string }>;
    description: string;
}> = [
        {
            value: 'urgent',
            label: 'Urgent',
            icon: AlertCircle,
            description: 'Critical and high-impact events requiring immediate attention',
        },
        {
            value: 'my-action',
            label: 'My Action',
            icon: CheckCircle2,
            description: 'Events requiring your personal decision or approval',
        },
        {
            value: 'opportunities',
            label: 'Opportunities',
            icon: Star,
            description: 'Positive events and growth opportunities',
        },
        {
            value: 'blockers',
            label: 'Blockers',
            icon: AlertTriangle,
            description: 'Issues blocking progress or workflows',
        },
        {
            value: 'all',
            label: 'All Events',
            icon: Search,
            description: 'Show all events regardless of type',
        },
    ];

// ─── Component ────────────────────────────────────────────────────────────

/**
 * TimelineFilter - Filter and search controls for timeline
 *
 * Layout:
 * ┌────────────────────────────────────────┐
 * │ [Urgent] [My Action] [Opp.] [Block]   │
 * ├────────────────────────────────────────┤
 * │ [🔍 Search events...           ] [✕]  │
 * └────────────────────────────────────────┘
 */
export const TimelineFilter: FC<TimelineFilterProps> = ({
    activeFilter,
    onFilterChange,
    searchTerm = '',
    onSearchChange,
    eventCounts,
    className,
}) => {
    // Filter option lookup
    const activeOption = useMemo(
        () => FILTER_OPTIONS.find((opt) => opt.value === activeFilter),
        [activeFilter],
    );

    // Handle filter change
    const handleFilterChange = useCallback(
        (filter: TimelineFilterType) => {
            onFilterChange(filter);
        },
        [onFilterChange],
    );

    // Handle search clear
    const handleSearchClear = useCallback(() => {
        onSearchChange?.('');
    }, [onSearchChange]);

    return (
        <div className={cn('space-y-3', className)}>
            {/* Filter Buttons */}
            <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label="Timeline filters"
            >
                {FILTER_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const count = eventCounts?.[option.value] ?? 0;
                    const isActive = activeFilter === option.value;

                    return (
                        <motion.button
                            key={option.value}
                            type="button"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleFilterChange(option.value)}
                            className={cn(
                                'inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-all duration-200',
                                'border-2 hover:shadow-sm',
                                isActive
                                    ? 'border-blue-400 bg-blue-50 text-blue-700 shadow-sm'
                                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300',
                            )}
                            aria-pressed={isActive}
                            title={option.description}
                        >
                            <Icon className="w-4 h-4" />
                            <span>{option.label}</span>
                            {count !== undefined && count > 0 && (
                                <motion.span
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className={cn(
                                        'inline-flex items-center justify-center',
                                        'w-5 h-5 rounded-full text-xs font-bold',
                                        isActive
                                            ? 'bg-blue-200 text-blue-900'
                                            : 'bg-gray-200 text-gray-900',
                                    )}
                                >
                                    {count > 99 ? '99+' : count}
                                </motion.span>
                            )}
                        </motion.button>
                    );
                })}
            </div>

            {/* Search Box */}
            {onSearchChange && (
                <div className="relative">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        <Input
                            type="text"
                            placeholder="Search events..."
                            value={searchTerm}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="pl-9 pr-8 h-9 text-sm"
                            aria-label="Search timeline events"
                        />
                        {searchTerm && (
                            <motion.button
                                type="button"
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                onClick={handleSearchClear}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded transition-colors"
                                aria-label="Clear search"
                            >
                                <X className="w-4 h-4 text-gray-500" />
                            </motion.button>
                        )}
                    </div>
                </div>
            )}

            {/* Active Filter Description */}
            {activeOption && activeFilter !== 'all' && (
                <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-gray-600 px-1"
                    role="status"
                >
                    Showing: {activeOption.description}
                </motion.p>
            )}
        </div>
    );
};

export default TimelineFilter;
