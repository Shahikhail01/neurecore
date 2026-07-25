/**
 * src/components/agents/AgentStatusWidget.tsx
 *
 * TopBar widget showing agent status summary
 * SOLID:
 * - SRP: Only displays agent status summary
 * - OCP: Extensible via onClick callback
 */

'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Zap, Users } from 'lucide-react';
import type { AgentStatusWidgetProps } from './types';

/**
 * AgentStatusWidget Component
 * SOLID: SRP - Displays summary only
 */
export const AgentStatusWidgetComponent: React.FC<AgentStatusWidgetProps> = ({
    totalOnline,
    totalOffline,
    activelyWorking,
    onClick,
    isLoading = false,
}) => {
    const total = totalOnline + totalOffline;
    const onlinePercentage = useMemo(
        () =>
            total > 0
                ? Math.round((totalOnline / total) * 100)
                : 0,
        [totalOnline, total]
    );

    return (
        <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
            disabled={isLoading}
            className="relative flex items-center gap-3 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50"
        >
            {/* Pulsing dot for active work */}
            {activelyWorking > 0 && (
                <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute top-1 right-1 w-2 h-2 bg-[color:var(--state-success)] rounded-full"
                />
            )}

            {/* Icon */}
            <div className="flex items-center gap-1">
                {isLoading ? (
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                        <Zap className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                    </motion.div>
                ) : (
                    <Users className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                )}
            </div>

            {/* Status Text */}
            <div className="flex flex-col items-start gap-0.5">
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                    {totalOnline}/{total} Online
                </span>
                <span className="text-xs text-slate-600 dark:text-slate-400">
                    {activelyWorking} working
                </span>
            </div>

            {/* Progress bar indicator */}
            <div className="hidden sm:flex items-center gap-1 ml-2 pl-2 border-l border-slate-200 dark:border-slate-700">
                <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${onlinePercentage}%` }}
                        className="h-full bg-gradient-to-r from-emerald-500 to-blue-500"
                        transition={{ duration: 0.6 }}
                    />
                </div>
                <span className="text-xs text-slate-600 dark:text-slate-400">
                    {onlinePercentage}%
                </span>
            </div>
        </motion.button>
    );
};

export { AgentStatusWidgetComponent as AgentStatusWidget };
