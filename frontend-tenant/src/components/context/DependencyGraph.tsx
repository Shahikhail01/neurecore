/**
 * src/components/context/DependencyGraph.tsx
 *
 * Single responsibility: Render upstream blockers and downstream waiters
 * SOLID:
 * - SRP: Only renders dependencies, no data fetching
 * - OCP: Extensible via callbacks
 * - DIP: Depends on DependencyGraphProps interface
 */

'use client';

import { FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp, ArrowDown, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DependencyGraphProps } from './types';

/**
 * Maps priority to color classes
 * SOLID: Pure function (no side effects)
 */
const getPriorityStyles = (
    priority: 'HIGH' | 'MEDIUM' | 'LOW'
): { badge: string; icon: string } => {
    switch (priority) {
        case 'HIGH':
            return {
                badge: 'bg-red-100 text-red-800 dark:bg-[color:var(--state-danger)] dark:text-red-100',
                icon: 'text-[color:var(--state-danger)] dark:text-[color:var(--state-danger)]',
            };
        case 'MEDIUM':
            return {
                badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
                icon: 'text-yellow-600 dark:text-yellow-400',
            };
        case 'LOW':
            return {
                badge: 'bg-blue-100 text-blue-800 dark:bg-[color:var(--state-info)] dark:text-blue-100',
                icon: 'text-[color:var(--state-info)] dark:text-[color:var(--state-info)]',
            };
    }
};

/**
 * Single dependency item component
 * SOLID: SRP - Renders single dependency, no side effects
 */
const DependencyItem: FC<{
    direction: 'upstream' | 'downstream';
    description: string;
    estimatedHours?: number;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    onBlockerClick?: () => void;
}> = ({ direction, description, estimatedHours, priority, onBlockerClick }) => {
    const styles = getPriorityStyles(priority);
    const isUpstream = direction === 'upstream';

    return (
        <motion.div
            initial={{ opacity: 0, x: isUpstream ? -12 : 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isUpstream ? -12 : 12 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-900/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer group"
            onClick={onBlockerClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onBlockerClick?.();
                }
            }}
            aria-label={`${isUpstream ? 'Upstream' : 'Downstream'} blocker: ${description}`}
        >
            {/* Arrow Icon */}
            <div className={cn('flex-shrink-0', styles.icon)}>
                {isUpstream ? (
                    <ArrowUp className="w-4 h-4" />
                ) : (
                    <ArrowDown className="w-4 h-4" />
                )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1">
                    {description}
                </p>
                {estimatedHours && (
                    <div className="flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                            ~{estimatedHours}h
                        </span>
                    </div>
                )}
            </div>

            {/* Priority Badge */}
            <div className={cn('px-2 py-1 rounded text-xs font-medium flex-shrink-0', styles.badge)}>
                {priority}
            </div>
        </motion.div>
    );
};

/**
 * DependencyGraph Component
 * Shows upstream blockers and downstream waiters
 *
 * SOLID:
 * - SRP: Renders dependencies only
 * - OCP: Extensible via callbacks
 * - ISP: Props only have needed fields
 * - DIP: Depends on DependencyGraphProps interface
 */
const DependencyGraphComponent: FC<DependencyGraphProps> = ({
    upstreamBlockers,
    downstreamWaiters,
    onBlockerClick,
}) => {
    const hasBlockers = upstreamBlockers && upstreamBlockers.length > 0;
    const hasWaiters = downstreamWaiters && downstreamWaiters.length > 0;

    if (!hasBlockers && !hasWaiters) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-4 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 text-center"
            >
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    ✨ No blockers or dependencies found
                </p>
            </motion.div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Upstream Blockers Section */}
            <AnimatePresence>
                {hasBlockers && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-2"
                    >
                        <div className="flex items-center gap-2 px-1">
                            <AlertTriangle className="w-4 h-4 text-orange-500" />
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                                Upstream Blockers ({upstreamBlockers.length})
                            </h3>
                        </div>
                        <div className="space-y-2">
                            {upstreamBlockers.map((blocker) => (
                                <DependencyItem
                                    key={blocker.id}
                                    direction="upstream"
                                    description={blocker.description}
                                    estimatedHours={blocker.estimatedHours}
                                    priority={blocker.priority}
                                    onBlockerClick={() => onBlockerClick?.(blocker.id)}
                                />
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Downstream Waiters Section */}
            <AnimatePresence>
                {hasWaiters && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-2"
                    >
                        <div className="flex items-center gap-2 px-1">
                            <ArrowDown className="w-4 h-4 text-[color:var(--state-info)]" />
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                                Downstream Waiters ({downstreamWaiters.length})
                            </h3>
                        </div>
                        <div className="space-y-2">
                            {downstreamWaiters.map((waiter) => (
                                <DependencyItem
                                    key={waiter.id}
                                    direction="downstream"
                                    description={waiter.description}
                                    estimatedHours={waiter.estimatedHours}
                                    priority={waiter.priority}
                                    onBlockerClick={() => onBlockerClick?.(waiter.id)}
                                />
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export const DependencyGraph = DependencyGraphComponent;
export default DependencyGraphComponent;
