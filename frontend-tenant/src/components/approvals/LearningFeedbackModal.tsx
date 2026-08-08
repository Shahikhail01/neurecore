/**
 * src/components/approvals/LearningFeedbackModal.tsx
 *
 * Modal for capturing user feedback when decision differs from AI recommendation
 * SOLID:
 * - SRP: Only feedback capture and submission
 * - OCP: Extensible via callback props
 */

'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Send,
} from 'lucide-react';
import type { LearningFeedbackModalProps } from './types';

/**
 * Decision badge component
 * SOLID: SRP - Only badge rendering
 */
const DecisionBadge: React.FC<{
    decision: 'approve' | 'reject' | 'review';
    label: string;
    icon: React.ReactNode;
}> = ({ decision, label, icon }) => {
    const colors = {
        approve: 'bg-emerald-100 text-emerald-700 dark:bg-[color:var(--state-success)] dark:text-emerald-300',
        reject: 'bg-red-100 text-red-700 dark:bg-[color:var(--state-danger)] dark:text-red-300',
        review: 'bg-amber-100 text-amber-700 dark:bg-[color:var(--state-warning)] dark:text-amber-300',
    };

    return (
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${colors[decision]}`}>
            {icon}
            {label}
        </div>
    );
};

/**
 * LearningFeedbackModal Component
 * SOLID: SRP - Only handles feedback capture
 */
export const LearningFeedbackModalComponent: React.FC<
    LearningFeedbackModalProps
> = ({
    isOpen,
    approvalId,
    title,
    aiRecommendation,
    userDecision,
    onSubmit,
    onClose,
    isSubmitting = false,
}) => {
        const [feedback, setFeedback] = useState('');
        const [focusedReason, setFocusedReason] = useState<string | null>(null);

        const predefinedReasons = {
            approve: [
                'AI reasoning was incomplete',
                'I have additional context',
                'Market conditions changed',
                'Budget approved outside system',
                'Other reason',
            ],
            reject: [
                'Risk assessment underestimated',
                'Budget constraints',
                'Timing not right',
                'Better alternative exists',
                'Other reason',
            ],
            review: [
                'Need more information',
                'Should involve team',
                'Requires additional analysis',
                'Pending external approval',
                'Other reason',
            ],
        };

        const getDecisionLabel = useCallback(() => {
            return userDecision === 'approve'
                ? 'Approved'
                : userDecision === 'reject'
                    ? 'Rejected'
                    : 'Marked for Review';
        }, [userDecision]);

        const getAILabel = useCallback(() => {
            return aiRecommendation.action === 'APPROVE'
                ? 'Recommended Approval'
                : aiRecommendation.action === 'REJECT'
                    ? 'Recommended Rejection'
                    : 'Recommended Review';
        }, [aiRecommendation.action]);

        const isDiscrepancy = userDecision !== aiRecommendation.action.toLowerCase();

        const handleSubmit = async () => {
            if (!onSubmit) return;

            await onSubmit({
                approvalId,
                userDecision,
                aiRecommendation: aiRecommendation.action.toLowerCase() as string,
                reasoning: feedback || focusedReason || 'No reason provided',
                isDiscrepancy,
            });

            setFeedback('');
            setFocusedReason(null);
        };

        return (
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={onClose}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && onClose) { e.preventDefault(); onClose(); } }}
                            className="fixed inset-0 bg-black/50 dark:bg-black/70 z-40"
                        />

                        {/* Modal */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="fixed left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white dark:bg-slate-950 rounded-lg shadow-2xl z-50 border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto"
                        >
                            {/* Header */}
                            <div className="sticky top-0 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-start justify-between">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                        Help Us Learn
                                    </h2>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                        Why did you choose differently?
                                    </p>
                                </div>
                                <motion.button
                                    type="button"
                                    aria-label="Close feedback modal"
                                    whileHover={{ rotate: 90 }}
                                    onClick={onClose}
                                    disabled={isSubmitting}
                                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded disabled:opacity-50"
                                >
                                    <X className="w-5 h-5 text-slate-400" />
                                </motion.button>
                            </div>

                            {/* Content */}
                            <div className="px-6 py-4 space-y-4">
                                {/* Approval Title */}
                                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                                        Approval
                                    </p>
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                        {title}
                                    </p>
                                </div>

                                {/* Decision Comparison */}
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">
                                        Decision Comparison
                                    </p>
                                    <div className="grid grid-cols-2 gap-3">
                                        {/* AI Recommendation */}
                                        <div className="p-3 bg-blue-50 dark:bg-[color:var(--state-info)] rounded-lg border border-blue-200 dark:border-blue-800">
                                            <p className="text-xs text-[color:var(--state-info)] dark:text-[color:var(--state-info)] font-semibold mb-2">
                                                AI Recommended
                                            </p>
                                            <DecisionBadge
                                                decision={
                                                    aiRecommendation.action === 'APPROVE'
                                                        ? 'approve'
                                                        : aiRecommendation.action === 'REJECT'
                                                            ? 'reject'
                                                            : 'review'
                                                }
                                                label={getAILabel()}
                                                icon={
                                                    aiRecommendation.action === 'APPROVE' ? (
                                                        <CheckCircle2 className="w-4 h-4" />
                                                    ) : aiRecommendation.action === 'REJECT' ? (
                                                        <XCircle className="w-4 h-4" />
                                                    ) : (
                                                        <AlertCircle className="w-4 h-4" />
                                                    )
                                                }
                                            />
                                        </div>

                                        {/* Your Decision */}
                                        <div className="p-3 bg-emerald-50 dark:bg-[color:var(--state-success)] rounded-lg border border-emerald-200 dark:border-emerald-800">
                                            <p className="text-xs text-[color:var(--state-success)] dark:text-[color:var(--state-success)] font-semibold mb-2">
                                                You Chose
                                            </p>
                                            <DecisionBadge
                                                decision={userDecision}
                                                label={getDecisionLabel()}
                                                icon={
                                                    userDecision === 'approve' ? (
                                                        <CheckCircle2 className="w-4 h-4" />
                                                    ) : userDecision === 'reject' ? (
                                                        <XCircle className="w-4 h-4" />
                                                    ) : (
                                                        <AlertCircle className="w-4 h-4" />
                                                    )
                                                }
                                            />
                                        </div>
                                    </div>

                                    {/* Discrepancy Alert */}
                                    {isDiscrepancy && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="p-2 bg-amber-50 dark:bg-[color:var(--state-warning)] rounded border border-amber-200 dark:border-amber-800"
                                        >
                                            <p className="text-xs text-amber-700 dark:text-amber-300">
                                                <span className="font-semibold">
                                                    This decision differs from the AI recommendation.
                                                </span>
                                                {' '}Your feedback helps us improve.
                                            </p>
                                        </motion.div>
                                    )}
                                </div>

                                {/* Quick Reason Selection */}
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">
                                        Select a Reason (Optional)
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {predefinedReasons[userDecision].map(reason => (
                                            <motion.button
                                                type="button"
                                                key={reason}
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                                onClick={() => setFocusedReason(reason)}
                                                className={`px-2.5 py-1.5 text-xs rounded-md font-medium transition-colors ${focusedReason === reason
                                                        ? 'bg-[color:var(--state-info)] text-white'
                                                        : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
                                                    }`}
                                            >
                                                {reason}
                                            </motion.button>
                                        ))}
                                    </div>
                                </div>

                                {/* Additional Details */}
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">
                                        Additional Details
                                    </label>
                                    <textarea
                                        id="feedback-textarea"
                                        value={feedback}
                                        onChange={e => setFeedback(e.target.value)}
                                        placeholder="Tell us more about your decision..."
                                        aria-label="Additional feedback details"
                                        rows={3}
                                        disabled={isSubmitting}
                                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                                    />
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="sticky bottom-0 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 px-6 py-4 flex gap-2">
                                <motion.button
                                    type="button"
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={onClose}
                                    disabled={isSubmitting}
                                    className="flex-1 px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                                >
                                    Cancel
                                </motion.button>
                                <motion.button
                                    type="button"
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={handleSubmit}
                                    disabled={isSubmitting}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[color:var(--state-info)] text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Submitting...
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-4 h-4" />
                                            Submit Feedback
                                        </>
                                    )}
                                </motion.button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        );
    };

export {
    LearningFeedbackModalComponent as LearningFeedbackModal,
};
