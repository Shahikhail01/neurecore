/**
 * approval-enrichment.service.ts
 *
 * SRP: Fetch enriched approval data from backend
 * This service is responsible for:
 * 1. Calling the backend /approvals/stratified endpoint
 * 2. Handling errors gracefully
 * 3. Returning typed data to components
 *
 * SOLID: DIP - depends on abstract HTTP interface via api.ts
 */

import api from '@/services/api';
import type { SignalType } from '@/components/approvals';

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
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ESCALATED' | 'CANCELLED';
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    amount?: number;
    aiRecommendation: AiRecommendation;
    canBatchApprove?: boolean;
}

interface StratifiedApprovalsResponse {
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

function normalizeApprovals(raw: unknown): StratifiedApprovalsResponse {
    const source =
        raw && typeof raw === 'object' && 'data' in raw
            ? (raw as { data: unknown }).data
            : raw;
    const data = source && typeof source === 'object'
        ? (source as Partial<StratifiedApprovalsResponse>)
        : {};
    const critical = Array.isArray(data.critical) ? data.critical : [];
    const high = Array.isArray(data.high) ? data.high : [];
    const medium = Array.isArray(data.medium) ? data.medium : [];
    const low = Array.isArray(data.low) ? data.low : [];

    return {
        critical,
        high,
        medium,
        low,
        count: {
            critical: typeof data.count?.critical === 'number' ? data.count.critical : critical.length,
            high: typeof data.count?.high === 'number' ? data.count.high : high.length,
            medium: typeof data.count?.medium === 'number' ? data.count.medium : medium.length,
            low: typeof data.count?.low === 'number' ? data.count.low : low.length,
        },
    };
}

/**
 * Fetch stratified approvals from backend
 * GET /approvals/stratified?status=PENDING&limit=50
 */
export async function getStratifiedApprovals(
    status = 'PENDING',
    limit = 50,
): Promise<StratifiedApprovalsResponse> {
    try {
        const response = await api.get('/approvals/stratified', {
            params: { status, limit },
        });
        return normalizeApprovals(response.data);
    } catch (error) {
        console.error('Failed to fetch stratified approvals:', error);
        throw error;
    }
}

/**
 * Submit approval feedback for learning loop
 * POST /approvals/:id/feedback
 */
export async function submitApprovalFeedback(
    approvalId: string,
    feedback: {
        userDecision: string;
        aiRecommendation: string;
        reason: string;
        explanation?: string;
    },
): Promise<void> {
    try {
        await api.post(`/approvals/${approvalId}/feedback`, feedback);
    } catch (error) {
        console.error('Failed to submit approval feedback:', error);
        throw error;
    }
}

/**
 * Approve an approval request
 * PATCH /approvals/:id/review (with status: 'APPROVED')
 */
export async function approveApproval(approvalId: string): Promise<void> {
    try {
        await api.patch(`/approvals/${approvalId}/review`, {
            status: 'APPROVED',
        });
    } catch (error) {
        console.error('Failed to approve request:', error);
        throw error;
    }
}

/**
 * Reject an approval request
 * PATCH /approvals/:id/review (with status: 'REJECTED')
 */
export async function rejectApproval(
    approvalId: string,
    reason?: string,
): Promise<void> {
    try {
        await api.patch(`/approvals/${approvalId}/review`, {
            status: 'REJECTED',
            rejectionReason: reason,
        });
    } catch (error) {
        console.error('Failed to reject request:', error);
        throw error;
    }
}

/**
 * Escalate an approval request (mark as needing higher authority)
 * Custom endpoint - might need to be added to backend
 * For now, treats escalate as REVIEW status with escalation metadata
 */
export async function escalateApproval(approvalId: string): Promise<void> {
    try {
        // Call review endpoint with ESCALATE action
        // Backend should interpret this and notify higher authorities
        await api.patch(`/approvals/${approvalId}/review`, {
            status: 'ESCALATED',
        });
    } catch (error) {
        console.error('Failed to escalate request:', error);
        throw error;
    }
}
