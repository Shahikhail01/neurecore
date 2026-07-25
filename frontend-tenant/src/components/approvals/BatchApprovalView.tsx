/**
 * src/components/approvals/BatchApprovalView.tsx
 *
 * Stratified batch approval view (Critical vs Routine)
 * SOLID:
 * - SRP: Displays stratified approval grid only
 * - OCP: Extensible via callback props
 */

'use client';

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AlertTriangle,
    ClipboardList,
    Zap,
    TrendingDown,
} from 'lucide-react';
import { ApprovalCard } from './ApprovalCard';
import type { BatchApprovalViewProps } from './types';

/**
 * Transform ApprovalCardProps to Approval data type for ApprovalCard
 * SOLID: SRP - Only data transformation
 */
const toApprovalData = (props: any) => ({
    id: props.id,
    title: props.title,
    description: props.description,
    riskLevel: props.riskLevel,
    amount: props.amount,
    aiRecommendation: props.aiRecommendation,
});

/**
 * Section header component
 * SOLID: SRP - Only header display
 */
const SectionHeader: React.FC<{
    icon: React.ReactNode;
    title: string;
    count: number;
}> = ({ icon, title, count }) => (
    <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-center gap-3 mb-4 pb-3 border-b-2 border-slate-300 dark:border-slate-700"
    >
        {icon}
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {title}
        </h2>
        <span className="ml-auto px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-300">
            {count}
        </span>
    </motion.div>
);

/**
 * Empty state component
 * SOLID: SRP - Only empty state rendering
 */
const EmptyApprovals: React.FC = () => (
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="col-span-full py-12 text-center"
    >
        <ClipboardList className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
        <p className="text-slate-600 dark:text-slate-400 font-medium">
            No approvals pending
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-500">
            All caught up! 🎉
        </p>
    </motion.div>
);

/**
 * Skeleton loader
 * SOLID: SRP - Only skeleton rendering
 */
const SkeletonLoader: React.FC<{ count: number }> = ({ count }) => (
    <>
        {Array.from({ length: count }).map((_, i) => (
            <div
                key={i}
                className="bg-slate-200 dark:bg-slate-800 rounded-lg h-80 animate-pulse"
            />
        ))}
    </>
);

/**
 * BatchApprovalView Component
 * SOLID: SRP - Renders stratified approval grid
 */
export const BatchApprovalViewComponent: React.FC<BatchApprovalViewProps> = ({
    critical,
    routine,
    isLoading = false,
    onApprovalAction,
    onFeedbackClick,
}) => {
    const criticalCount = useMemo(() => critical.length, [critical]);
    const routineCount = useMemo(() => routine.length, [routine]);
    const totalPending = criticalCount + routineCount;

    return (
        <div className="w-full space-y-8">
            {/* Summary Banner */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4"
            >
                <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5 text-[color:var(--state-info)] dark:text-[color:var(--state-info)]" />
                    <div>
                        <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                            {totalPending} approvals pending
                        </p>
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                            {criticalCount > 0
                                ? `${criticalCount} critical, `
                                : ''}
                            {routineCount} routine
                        </p>
                    </div>
                </div>
            </motion.div>

            {isLoading ? (
                <>
                    <div>
                        <SectionHeader
                            icon={<AlertTriangle className="w-5 h-5 text-[color:var(--state-danger)]" />}
                            title="Critical Approvals"
                            count={0}
                        />
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <SkeletonLoader count={2} />
                        </div>
                    </div>
                    <div>
                        <SectionHeader
                            icon={<TrendingDown className="w-5 h-5 text-[color:var(--state-warning)]" />}
                            title="Routine Approvals"
                            count={0}
                        />
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            <SkeletonLoader count={3} />
                        </div>
                    </div>
                </>
            ) : (
                <>
                    {/* Critical Section */}
                    {criticalCount > 0 && (
                        <div>
                            <SectionHeader
                                icon={<AlertTriangle className="w-5 h-5 text-[color:var(--state-danger)]" />}
                                title="🚨 Critical Approvals"
                                count={criticalCount}
                            />
                            <motion.div
                                layout
                                className="grid grid-cols-1 lg:grid-cols-2 gap-4"
                            >
                                <AnimatePresence mode="popLayout">
                                    {critical.map(approval => (
                                        <motion.div
                                            key={approval.id}
                                            layout
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                        >
                                            <ApprovalCard
                                                approval={toApprovalData(approval)}
                                                onApprove={async (id: string) => {
                                                    onApprovalAction?.(id, 'approve');
                                                    onFeedbackClick?.(
                                                        id,
                                                        approval.aiRecommendation.action,
                                                        'approve'
                                                    );
                                                }}
                                                onReject={async (id: string) => {
                                                    onApprovalAction?.(id, 'reject');
                                                    onFeedbackClick?.(
                                                        id,
                                                        approval.aiRecommendation.action,
                                                        'reject'
                                                    );
                                                }}
                                                onReview={async (id: string) => {
                                                    onApprovalAction?.(id, 'review');
                                                }}
                                                onEscalate={async (id: string) => {
                                                    onApprovalAction?.(id, 'approve');
                                                }}
                                            />
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </motion.div>
                        </div>
                    )}

                    {/* Routine Section */}
                    {routineCount > 0 && (
                        <div>
                            <SectionHeader
                                icon={<TrendingDown className="w-5 h-5 text-[color:var(--state-warning)]" />}
                                title="Routine Approvals"
                                count={routineCount}
                            />
                            <motion.div
                                layout
                                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                            >
                                <AnimatePresence mode="popLayout">
                                    {routine.map(approval => (
                                        <motion.div
                                            key={approval.id}
                                            layout
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                        >
                                            <ApprovalCard
                                                approval={toApprovalData(approval)}
                                                onApprove={async (id: string) => {
                                                    onApprovalAction?.(id, 'approve');
                                                    if (
                                                        approval.aiRecommendation.action !==
                                                        'APPROVE'
                                                    ) {
                                                        onFeedbackClick?.(
                                                            id,
                                                            approval.aiRecommendation.action,
                                                            'approve'
                                                        );
                                                    }
                                                }}
                                                onReject={async (id: string) => {
                                                    onApprovalAction?.(id, 'reject');
                                                    if (
                                                        approval.aiRecommendation.action !==
                                                        'REJECT'
                                                    ) {
                                                        onFeedbackClick?.(
                                                            id,
                                                            approval.aiRecommendation.action,
                                                            'reject'
                                                        );
                                                    }
                                                }}
                                                onReview={async (id: string) => {
                                                    onApprovalAction?.(id, 'review');
                                                }}
                                                onEscalate={async (id: string) => {
                                                    onApprovalAction?.(id, 'approve');
                                                }}
                                            />
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </motion.div>
                        </div>
                    )}

                    {/* Empty State */}
                    {totalPending === 0 && <EmptyApprovals />}
                </>
            )}
        </div>
    );
};

export { BatchApprovalViewComponent as BatchApprovalView };
