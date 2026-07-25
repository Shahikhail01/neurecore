/**
 * ApprovalSignalDisplay.tsx
 *
 * SRP: Display a single approval signal (evidence)
 * This component has ONE responsibility: render a single signal
 *
 * SOLID: Reusable for any signal type (Positive, Negative, Unknown)
 * - Takes signal data as input
 * - Renders with appropriate styling
 * - No business logic, pure presentation
 */

import type { FC } from 'react';
import { cn } from '@/lib/utils';

export enum SignalType {
    POSITIVE = 'POSITIVE',
    NEGATIVE = 'NEGATIVE',
    UNKNOWN = 'UNKNOWN',
}

interface ApprovalSignal {
    type: SignalType;
    description: string;
    weight: number; // 0-100, influence on confidence
}

interface ApprovalSignalDisplayProps {
    signal: ApprovalSignal;
    className?: string;
}

const signalConfig = {
    [SignalType.POSITIVE]: {
        icon: '✓',
        bg: 'bg-green-50',
        text: 'text-green-700',
        border: 'border-green-200',
        iconBg: 'bg-green-200',
    },
    [SignalType.NEGATIVE]: {
        icon: '✕',
        bg: 'bg-red-50',
        text: 'text-red-700',
        border: 'border-red-200',
        iconBg: 'bg-red-200',
    },
    [SignalType.UNKNOWN]: {
        icon: '?',
        bg: 'bg-gray-50',
        text: 'text-gray-700',
        border: 'border-gray-200',
        iconBg: 'bg-gray-200',
    },
};

export const ApprovalSignalDisplay: FC<ApprovalSignalDisplayProps> = ({
    signal,
    className,
}) => {
    const config = signalConfig[signal.type];

    return (
        <div
            className={cn(
                'flex items-start gap-2 p-2 rounded border',
                config.bg,
                config.border,
                className,
            )}
            role="article"
            aria-label={`${signal.type} signal: ${signal.description}`}
        >
            {/* Icon */}
            <div
                className={cn(
                    'flex-shrink-0 w-6 h-6 rounded flex items-center justify-center text-sm font-bold',
                    config.iconBg,
                    config.text,
                )}
            >
                {config.icon}
            </div>

            {/* Content */}
            <div className="flex-grow">
                <p className={cn('text-sm', config.text)}>{signal.description}</p>

                {/* Weight indicator (optional) */}
                {signal.weight > 0 && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                        <span>Influence: </span>
                        <div className="w-16 h-1 bg-gray-200 rounded overflow-hidden">
                            <div
                                className={cn(
                                    'h-full',
                                    signal.type === SignalType.POSITIVE && 'bg-[color:var(--state-success)]',
                                    signal.type === SignalType.NEGATIVE && 'bg-[color:var(--state-danger)]',
                                    signal.type === SignalType.UNKNOWN && 'bg-gray-500',
                                )}
                                style={{ width: `${signal.weight}%` }}
                            />
                        </div>
                        <span>{signal.weight}%</span>
                    </div>
                )}
            </div>
        </div>
    );
};
