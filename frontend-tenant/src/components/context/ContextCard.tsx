/**
 * src/components/context/ContextCard.tsx
 *
 * Single responsibility: Render a cross-functional initiative card
 * SOLID:
 * - SRP: Only renders card UI, no data fetching
 * - OCP: Extensible via props (onViewDetails callback)
 * - DIP: Depends on ContextCardProps interface
 */

'use client';

import { FC } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, AlertCircle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ContextCardProps } from './types';

/**
 * Maps initiative status to visual styling
 * SOLID: Pure function (no side effects, separation of concerns)
 */
const getStatusIcon = (status: ContextCardProps['status']): React.ReactNode => {
    const iconProps = { className: 'w-4 h-4' };
    switch (status) {
        case 'COMPLETED':
            return <CheckCircle2 {...iconProps} className="w-4 h-4 text-[color:var(--state-success)]" />;
        case 'ON_TRACK':
            return <Clock {...iconProps} className="w-4 h-4 text-[color:var(--state-info)]" />;
        case 'AT_RISK':
            return <AlertCircle {...iconProps} className="w-4 h-4 text-yellow-500" />;
        case 'BLOCKED':
            return <XCircle {...iconProps} className="w-4 h-4 text-[color:var(--state-danger)]" />;
        default:
            return null;
    }
};

/**
 * Maps status to color classes
 * SOLID: Pure function (no side effects, separation of concerns)
 */
const getStatusStyles = (
    status: ContextCardProps['status']
): { bg: string; border: string; badge: string } => {
    switch (status) {
        case 'COMPLETED':
            return {
                bg: 'bg-green-50 dark:bg-[color:var(--state-success)]',
                border: 'border-green-200 dark:border-green-800',
                badge: 'bg-green-100 text-green-800 dark:bg-[color:var(--state-success)] dark:text-green-100',
            };
        case 'ON_TRACK':
            return {
                bg: 'bg-blue-50 dark:bg-[color:var(--state-info)]',
                border: 'border-blue-200 dark:border-blue-800',
                badge: 'bg-blue-100 text-blue-800 dark:bg-[color:var(--state-info)] dark:text-blue-100',
            };
        case 'AT_RISK':
            return {
                bg: 'bg-yellow-50 dark:bg-yellow-950',
                border: 'border-yellow-200 dark:border-yellow-800',
                badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
            };
        case 'BLOCKED':
            return {
                bg: 'bg-red-50 dark:bg-[color:var(--state-danger)]',
                border: 'border-red-200 dark:border-red-800',
                badge: 'bg-red-100 text-red-800 dark:bg-[color:var(--state-danger)] dark:text-red-100',
            };
        default:
            return {
                bg: 'bg-gray-50 dark:bg-gray-900',
                border: 'border-gray-200 dark:border-gray-800',
                badge: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100',
            };
    }
};

/**
 * Maps department stat color to Tailwind class
 * SOLID: Pure function (no side effects, separation of concerns)
 */
const getDeptStatColor = (color?: string): string => {
    switch (color) {
        case 'green':
            return 'text-[color:var(--state-success)] dark:text-[color:var(--state-success)]';
        case 'blue':
            return 'text-[color:var(--state-info)] dark:text-[color:var(--state-info)]';
        case 'yellow':
            return 'text-yellow-600 dark:text-yellow-400';
        case 'red':
            return 'text-[color:var(--state-danger)] dark:text-[color:var(--state-danger)]';
        case 'purple':
            return 'text-purple-600 dark:text-purple-400';
        default:
            return 'text-gray-600 dark:text-gray-400';
    }
};

/**
 * ContextCard Component
 * Renders a single cross-functional initiative with department stats
 *
 * SOLID:
 * - SRP: Renders single card, no side effects
 * - OCP: Extensible via onViewDetails callback
 * - LSP: Substitutable in any card grid
 * - ISP: Props interface only has needed fields
 * - DIP: Depends on ContextCardProps interface
 */
const ContextCardComponent: FC<ContextCardProps> = ({
    id,
    title,
    description,
    status,
    progressScore,
    departmentStats,
    onViewDetails,
}) => {
    const statusStyles = getStatusStyles(status);

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className={cn(
                'rounded-lg border p-4 transition-all',
                statusStyles.bg,
                statusStyles.border,
                'hover:shadow-md dark:hover:shadow-lg'
            )}
            role="article"
            aria-label={`Initiative: ${title}`}
        >
            {/* Header: Title + Status Badge */}
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2">
                        {title}
                    </h3>
                    {description && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-1">
                            {description}
                        </p>
                    )}
                </div>
                <div
                    className={cn('px-2 py-1 rounded text-xs font-medium flex items-center gap-1', statusStyles.badge)}
                >
                    {getStatusIcon(status)}
                    {status.replace(/_/g, ' ')}
                </div>
            </div>

            {/* Department Stats Grid */}
            <div className="grid grid-cols-2 gap-2 mb-3 sm:grid-cols-3">
                {departmentStats.map((stat, idx) => (
                    <motion.div
                        key={`${stat.dept}-${idx}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: idx * 0.05 }}
                        className="px-2 py-1.5 rounded bg-white/50 dark:bg-black/20 border border-gray-200 dark:border-gray-700"
                    >
                        <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{stat.dept}</p>
                        <p className={cn('text-sm font-semibold truncate', getDeptStatColor(stat.color))}>
                            {stat.value}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 truncate">{stat.stat}</p>
                    </motion.div>
                ))}
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5 mb-3">
                <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Progress</span>
                    <span className="text-xs font-semibold text-gray-900 dark:text-white">{progressScore}%</span>
                </div>
                <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progressScore}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className={cn('h-full rounded-full transition-colors', {
                            'bg-[color:var(--state-success)]': status === 'COMPLETED',
                            'bg-[color:var(--state-info)]': status === 'ON_TRACK',
                            'bg-yellow-500': status === 'AT_RISK',
                            'bg-[color:var(--state-danger)]': status === 'BLOCKED',
                        })}
                    />
                </div>
            </div>

            {/* View Details Button */}
            {onViewDetails && (
                <motion.button
                    whileHover={{ x: 2 }}
                    whileTap={{ x: 0 }}
                    onClick={onViewDetails}
                    className="w-full flex items-center justify-center gap-2 px-2 py-1.5 rounded text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-black/20 transition-colors"
                    aria-label={`View details for ${title}`}
                >
                    View Details <ChevronRight className="w-3 h-3" />
                </motion.button>
            )}
        </motion.div>
    );
};

export const ContextCard = ContextCardComponent;
export default ContextCardComponent;
