/**
 * src/components/agents/AgentOrchestrationBoard.tsx
 *
 * Grid board showing all agents with filtering and sorting
 * SOLID:
 * - SRP: Renders agent grid and filtering only
 * - OCP: Extensible via filter callbacks
 */

'use client';

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Zap,
    Clock,
    AlertCircle,
    Filter,
    Grid,
    List,
} from 'lucide-react';
import { AgentCard } from './AgentCard';
import type { AgentOrchestrationBoardProps } from './types';

/**
 * Pure function to filter agents
 * SOLID: SRP - Only filtering logic
 */
const filterAgents = (
    agents: AgentOrchestrationBoardProps['agents'],
    filter: string
) => {
    switch (filter) {
        case 'active':
            return agents.filter(a => a.status === 'ACTIVE');
        case 'idle':
            return agents.filter(a => a.status === 'IDLE');
        case 'offline':
            return agents.filter(a => a.status === 'OFFLINE');
        default:
            return agents;
    }
};

/**
 * Skeleton loader for agent cards
 * SOLID: SRP - Only skeleton rendering
 */
const SkeletonLoader: React.FC<{ count: number }> = ({ count }) => (
    <>
        {Array.from({ length: count }).map((_, i) => (
            <div
                key={i}
                className="bg-slate-200 dark:bg-slate-800 rounded-lg h-96 animate-pulse"
            />
        ))}
    </>
);

/**
 * Empty state component
 * SOLID: SRP - Only empty state rendering
 */
const EmptyState: React.FC<{ filter: string }> = ({ filter }) => (
    <div className="col-span-full py-12 text-center">
        <Zap className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
        <p className="text-slate-600 dark:text-slate-400 font-medium">
            No employees found {filter !== 'all' ? `with status "${filter}"` : ''}
        </p>
    </div>
);

/**
 * Summary card component
 * SOLID: SRP - Only summary display
 */
const SummaryCard: React.FC<{
    label: string;
    value: number;
    icon: React.ReactNode;
    bgColor: string;
}> = ({ label, value, icon, bgColor }) => (
    <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`${bgColor} rounded-lg p-4 flex items-start gap-3`}
    >
        <div className="flex-shrink-0 mt-0.5">{icon}</div>
        <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-400">
                {label}
            </p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {value}
            </p>
        </div>
    </motion.div>
);

/**
 * AgentOrchestrationBoard Component
 * SOLID: SRP - Renders agent grid and filter controls
 */
export const AgentOrchestrationBoardComponent: React.FC<AgentOrchestrationBoardProps> = ({
    agents,
    summary,
    isLoading = false,
    filter = 'all',
    onFilterChange,
    onAgentClick,
}) => {
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    const filteredAgents = useMemo(
        () => filterAgents(agents, filter),
        [agents, filter]
    );

    const filterOptions = [
        { value: 'all', label: 'All Employees', count: agents.length },
        {
            value: 'active',
            label: 'Active',
            count: agents.filter(a => a.status === 'ACTIVE').length,
        },
        {
            value: 'idle',
            label: 'Idle',
            count: agents.filter(a => a.status === 'IDLE').length,
        },
        {
            value: 'offline',
            label: 'Offline',
            count: agents.filter(a => a.status === 'OFFLINE').length,
        },
    ];

    return (
        <div className="w-full">
            {/* Summary Cards */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8"
            >
                <SummaryCard
                    label="Online"
                    value={summary.totalOnline}
                    icon={<Zap className="w-5 h-5 text-[color:var(--state-success)]" />}
                    bgColor="bg-emerald-50 dark:bg-[color:var(--state-success)]"
                />
                <SummaryCard
                    label="Offline"
                    value={summary.totalOffline}
                    icon={<AlertCircle className="w-5 h-5 text-gray-500" />}
                    bgColor="bg-gray-50 dark:bg-gray-900"
                />
                <SummaryCard
                    label="Working"
                    value={summary.activelyWorking}
                    icon={<Zap className="w-5 h-5 text-[color:var(--state-info)]" />}
                    bgColor="bg-blue-50 dark:bg-[color:var(--state-info)]"
                />
                <SummaryCard
                    label="Idle"
                    value={summary.idle}
                    icon={<Clock className="w-5 h-5 text-[color:var(--state-warning)]" />}
                    bgColor="bg-amber-50 dark:bg-[color:var(--state-warning)]"
                />
                <SummaryCard
                    label="Standby"
                    value={summary.standby}
                    icon={<AlertCircle className="w-5 h-5 text-[color:var(--accent-400)]" />}
                    bgColor="bg-violet-50 dark:bg-[color:var(--accent-500)]"
                />
            </motion.div>

            {/* Filter + View Mode Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                {/* Filter Tabs */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
                    <Filter className="w-4 h-4 text-slate-600 dark:text-slate-400 flex-shrink-0" />
                    <div className="flex gap-2">
                        {filterOptions.map(option => (
                            <motion.button
                                key={option.value}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() =>
                                    onFilterChange?.(
                                        option.value as
                                        | 'all'
                                        | 'active'
                                        | 'idle'
                                        | 'offline'
                                    )
                                }
                                className={`px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${filter === option.value
                                        ? 'bg-[color:var(--state-info)] text-white'
                                        : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
                                    }`}
                            >
                                {option.label}
                                <span className="ml-1.5 text-xs opacity-75">
                                    ({option.count})
                                </span>
                            </motion.button>
                        ))}
                    </div>
                </div>

                {/* View Mode Toggle */}
                <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 rounded-lg p-1">
                    <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setViewMode('grid')}
                        className={`p-2 rounded transition-colors ${viewMode === 'grid'
                                ? 'bg-white dark:bg-slate-800 text-[color:var(--state-info)] dark:text-[color:var(--state-info)]'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                            }`}
                    >
                        <Grid className="w-5 h-5" />
                    </motion.button>
                    <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setViewMode('list')}
                        className={`p-2 rounded transition-colors ${viewMode === 'list'
                                ? 'bg-white dark:bg-slate-800 text-[color:var(--state-info)] dark:text-[color:var(--state-info)]'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                            }`}
                    >
                        <List className="w-5 h-5" />
                    </motion.button>
                </div>
            </div>

            {/* Agent Cards Grid/List */}
            <motion.div
                layout
                className={`${viewMode === 'grid'
                        ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'
                        : 'space-y-4'
                    }`}
            >
                <AnimatePresence mode="popLayout">
                    {isLoading ? (
                        <SkeletonLoader count={6} />
                    ) : filteredAgents.length > 0 ? (
                        filteredAgents.map(agent => (
                            <motion.div
                                key={agent.id}
                                layout
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                            >
                                <AgentCard
                                    {...agent}
                                    onViewDetails={() => onAgentClick?.(agent.id)}
                                />
                            </motion.div>
                        ))
                    ) : (
                        <EmptyState filter={filter} />
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};

export {
    AgentOrchestrationBoardComponent as AgentOrchestrationBoard,
};
