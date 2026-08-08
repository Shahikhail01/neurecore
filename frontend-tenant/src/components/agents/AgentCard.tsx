/**
 * src/components/agents/AgentCard.tsx
 *
 * Individual agent status card with task progress and performance metrics
 * SOLID:
 * - SRP: Renders single agent card only
 * - OCP: Extensible via props callbacks
 */

'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
    Zap,
    Clock,
    CheckCircle2,
    AlertCircle,
    MoreVertical,
    TrendingUp,
} from 'lucide-react';
import type { AgentCardProps } from './types';

/**
 * Pure function to get status display properties
 * SOLID: SRP - Only status styling
 */
const getStatusDisplay = (
    status: AgentCardProps['status']
): { label: string; icon: React.ReactNode; bgColor: string; dotColor: string } => {
    const statuses = {
        ACTIVE: {
            label: 'Active',
            icon: <Zap className="w-4 h-4" />,
            bgColor: 'bg-emerald-50 dark:bg-[color:var(--state-success)]',
            dotColor: 'bg-[color:var(--state-success)]',
        },
        IDLE: {
            label: 'Idle',
            icon: <Clock className="w-4 h-4" />,
            bgColor: 'bg-blue-50 dark:bg-[color:var(--state-info)]',
            dotColor: 'bg-[color:var(--state-info)]',
        },
        STANDBY: {
            label: 'Standby',
            icon: <AlertCircle className="w-4 h-4" />,
            bgColor: 'bg-amber-50 dark:bg-[color:var(--state-warning)]',
            dotColor: 'bg-[color:var(--state-warning)]',
        },
        OFFLINE: {
            label: 'Offline',
            icon: <AlertCircle className="w-4 h-4" />,
            bgColor: 'bg-gray-50 dark:bg-gray-950',
            dotColor: 'bg-gray-400',
        },
    };
    return statuses[status];
};

/**
 * Pure function to format seconds to readable duration
 * SOLID: SRP - Only time formatting
 */
const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h`;
};

/**
 * AgentCard Component
 * SOLID: SRP - Renders single agent card
 */
export const AgentCardComponent: React.FC<AgentCardProps> = ({
    id,
    name,
    department,
    status,
    currentTask,
    queue,
    performance,
    onViewDetails,
}) => {
    const statusDisplay = useMemo(
        () => getStatusDisplay(status),
        [status]
    );

    const isActive = status === 'ACTIVE' || status === 'IDLE';

    return (
        <motion.div
            key={id}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            whileHover={{ y: -4 }}
            className="bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
        >
            {/* Header: Status + Name */}
            <div className="px-4 py-4 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <div className={`w-2 h-2 rounded-full ${statusDisplay.dotColor}`} />
                            <h3 className="font-semibold text-slate-900 dark:text-white">
                                {name}
                            </h3>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            {department.name}
                        </p>
                    </div>
                    <motion.button
                        type="button"
                        whileHover={{ rotate: 90 }}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                        onClick={onViewDetails}
                    >
                        <MoreVertical className="w-4 h-4 text-slate-400" />
                    </motion.button>
                </div>

                {/* Status Badge */}
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md ${statusDisplay.bgColor}`}>
                    <span className="text-slate-600 dark:text-slate-300">
                        {statusDisplay.icon}
                    </span>
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                        {statusDisplay.label}
                    </span>
                </div>
            </div>

            {/* Current Task Section */}
            {isActive && currentTask && (
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wider font-semibold">
                        Current Task
                    </p>
                    <p className="text-sm font-medium text-slate-900 dark:text-white mb-2">
                        {currentTask.title}
                    </p>

                    {/* Progress Bar */}
                    <div className="mb-2">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-xs text-slate-600 dark:text-slate-400">
                                Progress
                            </span>
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                {currentTask.progress}%
                            </span>
                        </div>
                        <motion.div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${currentTask.progress}%` }}
                                className="h-full bg-gradient-to-r from-blue-500 to-cyan-500"
                                transition={{ duration: 0.6, ease: 'easeOut' }}
                            />
                        </motion.div>
                    </div>

                    {/* ETA + Reasoning */}
                    <div className="flex items-start gap-2">
                        <Clock className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                                ETA: {formatDuration(currentTask.eta)}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-500 italic mt-0.5 line-clamp-2">
                                {currentTask.reasoning}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Queue + Performance */}
            <div className="px-4 py-3">
                {queue > 0 && (
                    <div className="flex items-center justify-between mb-3 p-2 bg-amber-50 dark:bg-[color:var(--state-warning)] rounded">
                        <span className="text-xs text-amber-700 dark:text-amber-200 font-medium">
                            {queue} in queue
                        </span>
                    </div>
                )}

                {/* Performance Metrics */}
                <div className="grid grid-cols-3 gap-2">
                    {/* Completed Today */}
                    <div className="text-center p-2 bg-slate-50 dark:bg-slate-900 rounded-md">
                        <div className="flex items-center justify-center mb-1">
                            <CheckCircle2 className="w-4 h-4 text-[color:var(--state-success)]" />
                        </div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                            {performance.completedToday}
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            Completed
                        </p>
                    </div>

                    {/* Accuracy */}
                    <div className="text-center p-2 bg-slate-50 dark:bg-slate-900 rounded-md">
                        <div className="flex items-center justify-center mb-1">
                            <TrendingUp className="w-4 h-4 text-[color:var(--state-info)]" />
                        </div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                            {performance.accuracy}%
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            Accuracy
                        </p>
                    </div>

                    {/* Avg Time */}
                    <div className="text-center p-2 bg-slate-50 dark:bg-slate-900 rounded-md">
                        <div className="flex items-center justify-center mb-1">
                            <Clock className="w-4 h-4 text-purple-500" />
                        </div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                            {formatDuration(performance.avgCompletionTime)}
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            Avg Time
                        </p>
                    </div>
                </div>
            </div>

            {/* View Details Button */}
            <button
                onClick={onViewDetails}
                className="w-full px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 border-t border-slate-200 dark:border-slate-800 transition-colors"
            >
                View Details
            </button>
        </motion.div>
    );
};

export { AgentCardComponent as AgentCard };
