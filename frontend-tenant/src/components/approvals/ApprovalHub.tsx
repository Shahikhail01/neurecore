/**
 * ApprovalHub.tsx
 *
 * SRP: Display stratified approvals grouped by risk level
 * Container component that shows: CRITICAL, HIGH, MEDIUM, LOW risk groups
 *
 * SOLID: Uses ApprovalCard component, handles stratification logic
 * - Displays approvals in priority order
 * - Groups by risk level
 * - Provides count summary
 */

'use client';

import type { FC } from 'react';
import { ApprovalCard } from './ApprovalCard';
import { RiskBadge, type RiskLevel } from './RiskBadge';
import { cn } from '@/lib/utils';
import type { SignalType } from './ApprovalSignalDisplay';

interface ApprovalSignal {
    type: SignalType;
    description: string;
    weight: number;
}

interface AiRecommendation {
    action: 'APPROVE' | 'REJECT' | 'ESCALATE' | 'REVIEW';
    confidence: number;
    reasoning: string;
    signals: ApprovalSignal[];
    pastSimilar: {
        count: number;
        approvalRate: number;
        avgOutcome?: string;
    };
}

interface Approval {
    id: string;
    title: string;
    description?: string;
    riskLevel: RiskLevel;
    amount?: number;
    aiRecommendation: AiRecommendation;
    canBatchApprove?: boolean;
}

interface StratifiedApprovals {
    critical: Approval[];
    high: Approval[];
    medium: Approval[];
    low: Approval[];
    count: {
        critical: number;
        high: number;
        medium: number;
        low: number;
    };
}

interface ApprovalHubProps {
    approvals: StratifiedApprovals;
    onApprove: (id: string) => Promise<void>;
    onReject: (id: string) => Promise<void>;
    onEscalate: (id: string) => Promise<void>;
    onReview: (id: string) => Promise<void>;
    isLoading?: boolean;
    className?: string;
}

interface RiskSection {
    level: RiskLevel;
    title: string;
    icon: string;
    color: string;
}

const riskSections: RiskSection[] = [
    {
        level: 'CRITICAL',
        title: 'Critical Risk',
        icon: '🚨',
        color: 'red',
    },
    {
        level: 'HIGH',
        title: 'High Risk',
        icon: '⚠️',
        color: 'orange',
    },
    {
        level: 'MEDIUM',
        title: 'Medium Risk',
        icon: '📋',
        color: 'yellow',
    },
    {
        level: 'LOW',
        title: 'Low Risk',
        icon: '✓',
        color: 'green',
    },
];

export const ApprovalHub: FC<ApprovalHubProps> = ({
    approvals,
    onApprove,
    onReject,
    onEscalate,
    onReview,
    isLoading,
    className,
}) => {
    const safeApprovals = {
        critical: Array.isArray(approvals?.critical) ? approvals.critical : [],
        high: Array.isArray(approvals?.high) ? approvals.high : [],
        medium: Array.isArray(approvals?.medium) ? approvals.medium : [],
        low: Array.isArray(approvals?.low) ? approvals.low : [],
        count: {
            critical:
                typeof approvals?.count?.critical === 'number'
                    ? approvals.count.critical
                    : Array.isArray(approvals?.critical)
                      ? approvals.critical.length
                      : 0,
            high:
                typeof approvals?.count?.high === 'number'
                    ? approvals.count.high
                    : Array.isArray(approvals?.high)
                      ? approvals.high.length
                      : 0,
            medium:
                typeof approvals?.count?.medium === 'number'
                    ? approvals.count.medium
                    : Array.isArray(approvals?.medium)
                      ? approvals.medium.length
                      : 0,
            low:
                typeof approvals?.count?.low === 'number'
                    ? approvals.count.low
                    : Array.isArray(approvals?.low)
                      ? approvals.low.length
                      : 0,
        },
    };
    const totalApprovals =
        safeApprovals.count.critical +
        safeApprovals.count.high +
        safeApprovals.count.medium +
        safeApprovals.count.low;

    return (
        <div
            className={cn('approval-hub', className)}
            role="main"
            aria-label="Approval request hub"
        >
            {/* SUMMARY */}
            <div className="mb-6 p-4 rounded-lg bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    Pending Approvals
                </h2>
                <div className="grid grid-cols-4 gap-4">
                    {riskSections.map((section) => {
                        const count =
                            safeApprovals.count[section.level.toLowerCase() as keyof typeof safeApprovals.count];
                        return (
                            <div key={section.level} className="text-center">
                                <div className="text-2xl mb-1">{section.icon}</div>
                                <div className="text-3xl font-bold text-gray-900">{count}</div>
                                <div className="text-xs text-gray-600">{section.title}</div>
                            </div>
                        );
                    })}
                </div>
                <div className="mt-3 text-sm text-gray-700">
                    <span className="font-semibold">{totalApprovals} total</span> approval
                    requests awaiting review
                </div>
            </div>

            {/* STRATIFIED SECTIONS */}
            {riskSections.map((section) => {
                const approvalList = safeApprovals[section.level.toLowerCase() as keyof typeof safeApprovals];

                if (!Array.isArray(approvalList) || approvalList.length === 0) {
                    return null;
                }

                return (
                    <div key={section.level} className="mb-8">
                        {/* SECTION HEADER */}
                        <div className="mb-4 flex items-center gap-2">
                            <span className="text-2xl">{section.icon}</span>
                            <h3 className="text-lg font-semibold text-gray-900">
                                {section.title}
                            </h3>
                            <span className="ml-auto inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
                                {approvalList.length}
                            </span>
                        </div>

                        {/* APPROVAL CARDS */}
                        <div className="space-y-4">
                            {approvalList.map((approval) => (
                                <ApprovalCard
                                    key={approval.id}
                                    approval={approval}
                                    onApprove={onApprove}
                                    onReject={onReject}
                                    onEscalate={onEscalate}
                                    onReview={onReview}
                                    isLoading={isLoading}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}

            {/* EMPTY STATE */}
            {totalApprovals === 0 && (
                <div className="text-center py-12">
                    <span className="text-5xl mb-4 block">✓</span>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        All caught up!
                    </h3>
                    <p className="text-gray-600">
                        No pending approvals at this time.
                    </p>
                </div>
            )}
        </div>
    );
};
