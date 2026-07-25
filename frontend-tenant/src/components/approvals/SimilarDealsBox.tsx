/**
 * SimilarDealsBox.tsx
 *
 * SRP: Display historical context and past similar approvals
 * Shows success rate and number of past similar items
 *
 * SOLID: Focused on past data presentation
 * - Takes past similar metrics
 * - Displays trend and success rate
 * - No business logic, pure presentation
 */

import type { FC } from 'react';
import { cn } from '@/lib/utils';

interface PastSimilar {
    count: number;
    approvalRate: number; // 0-1
    avgOutcome?: string;
}

interface SimilarDealsBoxProps {
    past: PastSimilar;
    className?: string;
}

/**
 * Get trend indicator based on approval rate
 */
const getTrendIndicator = (rate: number): { icon: string; label: string; color: string } => {
    if (rate >= 0.7) {
        return { icon: '📈', label: 'Strong track record', color: 'text-[color:var(--state-success)]' };
    }
    if (rate >= 0.5) {
        return { icon: '➡', label: 'Mixed results', color: 'text-yellow-600' };
    }
    return { icon: '📉', label: 'Weak track record', color: 'text-[color:var(--state-danger)]' };
};

export const SimilarDealsBox: FC<SimilarDealsBoxProps> = ({ past, className }) => {
    const percentage = Math.round(past.approvalRate * 100);
    const trend = getTrendIndicator(past.approvalRate);

    // Don't render if no past data
    if (past.count === 0) {
        return (
            <div
                className={cn(
                    'p-3 rounded border border-gray-200 bg-gray-50 text-sm text-gray-600',
                    className,
                )}
            >
                No historical data available yet
            </div>
        );
    }

    return (
        <div
            className={cn(
                'p-3 rounded border border-blue-200 bg-blue-50',
                className,
            )}
            role="region"
            aria-label="Historical context"
        >
            <div className="flex items-start gap-3">
                {/* Icon */}
                <span className="text-xl">{trend.icon}</span>

                {/* Content */}
                <div className="flex-grow">
                    <h4 className="text-sm font-semibold text-gray-700">
                        Similar Past Approvals
                    </h4>

                    <div className="mt-2 space-y-1">
                        {/* Count */}
                        <p className="text-sm text-gray-600">
                            <span className="font-medium">{past.count}</span> similar items
                        </p>

                        {/* Success Rate */}
                        <div className="flex items-center gap-2">
                            <div className="flex-grow max-w-xs bg-gray-200 h-2 rounded overflow-hidden">
                                <div
                                    className={cn(
                                        'h-full transition-all',
                                        past.approvalRate >= 0.7 && 'bg-[color:var(--state-success)]',
                                        past.approvalRate >= 0.5 && past.approvalRate < 0.7 && 'bg-yellow-500',
                                        past.approvalRate < 0.5 && 'bg-[color:var(--state-danger)]',
                                    )}
                                    style={{ width: `${percentage}%` }}
                                />
                            </div>
                            <span className="text-sm font-medium text-gray-700">
                                {percentage}%
                            </span>
                        </div>

                        {/* Trend Label */}
                        <p className={cn('text-xs font-medium', trend.color)}>
                            {trend.label}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
