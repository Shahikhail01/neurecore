/**
 * ConfidenceScore.tsx
 *
 * SRP: Display AI confidence percentage with reasoning tooltip
 * This component has ONE responsibility: render confidence visually
 *
 * SOLID: Reusable, no dependencies on approval data
 * - Takes confidence and optional reasoning
 * - Shows percentage with visual indicator
 * - Displays tooltip on hover explaining the score
 */

import type { FC } from 'react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ConfidenceScoreProps {
    score: number; // 0-100
    reasoning?: string;
    className?: string;
}

/**
 * Get color based on confidence level
 * 0-30: Red, 30-60: Yellow, 60-85: Blue, 85-100: Green
 */
const getConfidenceColor = (score: number): string => {
    if (score >= 85) return 'text-[color:var(--state-success)]';
    if (score >= 60) return 'text-[color:var(--state-info)]';
    if (score >= 30) return 'text-yellow-600';
    return 'text-[color:var(--state-danger)]';
};

/**
 * Get confidence level label
 */
const getConfidenceLevel = (score: number): string => {
    if (score >= 90) return 'Very High';
    if (score >= 75) return 'High';
    if (score >= 50) return 'Medium';
    if (score >= 25) return 'Low';
    return 'Very Low';
};

export const ConfidenceScore: FC<ConfidenceScoreProps> = ({
    score,
    reasoning,
    className,
}) => {
    const clampedScore = Math.min(Math.max(score, 0), 100);
    const level = getConfidenceLevel(clampedScore);
    const color = getConfidenceColor(clampedScore);

    const content = (
        <div className="flex items-center gap-2">
            <div className="flex flex-col">
                <span className={cn('text-lg font-bold', color)}>
                    {clampedScore}%
                </span>
                <span className="text-xs text-gray-600">{level} Confidence</span>
            </div>

            {reasoning && (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                className="text-gray-400 hover:text-gray-600"
                                aria-label="Show reasoning"
                            >
                                ⓘ
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-xs">
                            <p className="text-sm">{reasoning}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}
        </div>
    );

    if (reasoning) {
        return <div className={cn('confidence-score', className)}>{content}</div>;
    }

    return <div className={cn('confidence-score', className)}>{content}</div>;
};
