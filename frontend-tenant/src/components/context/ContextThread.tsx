/**
 * src/components/context/ContextThread.tsx
 *
 * Single responsibility: Render full context thread for an initiative
 * SOLID:
 * - SRP: Only renders thread info, no data fetching
 * - OCP: Extensible via props
 * - DIP: Depends on ContextThreadProps interface
 */

'use client';

import { FC } from 'react';
import { motion } from 'framer-motion';
import { Users, Calendar, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ContextThreadProps } from './types';

/**
 * Formats relative time display
 * SOLID: Pure function (no side effects)
 */
const formatRelativeTime = (date?: Date | string): string => {
    if (!date) return '';

    const now = new Date();
    const updated = new Date(date);
    const diffMs = now.getTime() - updated.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return updated.toLocaleDateString();
};

/**
 * ContextThread Component
 * Shows summary info about a cross-functional initiative
 *
 * SOLID:
 * - SRP: Renders thread UI only
 * - OCP: Extensible via props
 * - LSP: Substitutable in context displays
 * - ISP: Props only have needed fields
 * - DIP: Depends on ContextThreadProps interface
 */
const ContextThreadComponent: FC<ContextThreadProps> = ({
    initiativeId,
    title,
    description,
    departmentCount,
    progressScore,
    lastUpdated,
}) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4"
            role="article"
            aria-label={`Initiative thread: ${title}`}
        >
            {/* Header */}
            <div className="space-y-2 mb-4">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white line-clamp-2">
                    {title}
                </h3>
                {description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                        {description}
                    </p>
                )}
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-4 mb-4">
                {/* Departments Involved */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.05 }}
                    className="flex flex-col items-start"
                >
                    <div className="flex items-center gap-1.5 mb-1">
                        <Users className="w-4 h-4 text-[color:var(--state-info)] dark:text-[color:var(--state-info)]" />
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Departments</span>
                    </div>
                    <span className="text-base font-bold text-gray-900 dark:text-white">
                        {departmentCount}
                    </span>
                </motion.div>

                {/* Progress Score */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="flex flex-col items-start"
                >
                    <div className="flex items-center gap-1.5 mb-1">
                        <TrendingUp className="w-4 h-4 text-[color:var(--state-success)] dark:text-[color:var(--state-success)]" />
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Progress</span>
                    </div>
                    <span className="text-base font-bold text-gray-900 dark:text-white">
                        {progressScore}%
                    </span>
                </motion.div>

                {/* Last Updated */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.15 }}
                    className="flex flex-col items-start"
                >
                    <div className="flex items-center gap-1.5 mb-1">
                        <Calendar className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Updated</span>
                    </div>
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                        {formatRelativeTime(lastUpdated)}
                    </span>
                </motion.div>
            </div>

            {/* Progress Bar */}
            <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progressScore}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                />
            </div>
        </motion.div>
    );
};

export const ContextThread = ContextThreadComponent;
export default ContextThreadComponent;
