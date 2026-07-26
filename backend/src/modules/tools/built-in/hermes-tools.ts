/**
 * hermes-tools.ts — Domain-specific tool definitions for each Hermes agent type.
 *
 * These are metadata descriptors used by ToolGatewayService to:
 *   1. Define which tools are available per Hermes type
 *   2. Set default permission levels
 *   3. Power the "tool menu" shown to the Hermes LLM
 *
 * Actual tool implementations live in the tools/built-in directory.
 * This file maps Hermes types to tool capability sets.
 *
 * SOLID — OCP: New tool domains added as new entries, no changes to existing ones.
 */

import type { HermesAgentType } from '@prisma/client';
import { ToolPermissionLevel } from '@prisma/client';

export interface HermesToolDescriptor {
    name: string;
    description: string;
    permission: ToolPermissionLevel;
    /** Conditions, e.g. requiresApproval for high-value operations */
    conditions?: Record<string, unknown>;
}

export type HermesToolSet = Record<string, HermesToolDescriptor[]>;

/**
 * Default tool set for each Hermes agent type.
 *
 * Permission levels:
 *   ALLOW            — unrestricted
 *   READ_ONLY        — can only read, not write
 *   APPROVAL_REQUIRED — requires human approval before execution
 *   DENY             — never allowed
 */
export const HERMES_TOOL_SETS: Record<HermesAgentType, HermesToolDescriptor[]> = {
    HR: [
        { name: 'email', description: 'Send and read emails', permission: ToolPermissionLevel.ALLOW },
        { name: 'calendar', description: 'Schedule and manage calendar events', permission: ToolPermissionLevel.ALLOW },
        { name: 'documents', description: 'Read and create HR documents', permission: ToolPermissionLevel.ALLOW },
        { name: 'tasks', description: 'Create and manage onboarding tasks', permission: ToolPermissionLevel.ALLOW },
        { name: 'query', description: 'Query HR data (read-only)', permission: ToolPermissionLevel.READ_ONLY },
        { name: 'reports', description: 'Generate HR reports', permission: ToolPermissionLevel.ALLOW },
        {
            name: 'terminate_employee',
            description: 'Terminate an employee record',
            permission: ToolPermissionLevel.APPROVAL_REQUIRED,
            conditions: { approvalType: 'FIRE', minApprovers: 3 },
        },
        {
            name: 'update_payroll',
            description: 'Update payroll information',
            permission: ToolPermissionLevel.APPROVAL_REQUIRED,
            conditions: { approvalType: 'BUDGET', minApprovers: 2 },
        },
    ],

    FINANCE: [
        { name: 'email', description: 'Send and read emails', permission: ToolPermissionLevel.ALLOW },
        { name: 'query', description: 'Query financial data (read-only)', permission: ToolPermissionLevel.READ_ONLY },
        { name: 'reports', description: 'Generate financial reports', permission: ToolPermissionLevel.ALLOW },
        { name: 'documents', description: 'Read and create financial documents', permission: ToolPermissionLevel.ALLOW },
        { name: 'sheets', description: 'Create and manage spreadsheets', permission: ToolPermissionLevel.ALLOW },
        { name: 'calendar', description: 'Schedule and manage calendar events', permission: ToolPermissionLevel.ALLOW },
        {
            name: 'process_invoice',
            description: 'Process and approve invoices',
            permission: ToolPermissionLevel.APPROVAL_REQUIRED,
            conditions: { approvalType: 'VENDOR_PAYMENT', thresholdUsd: 1000 },
        },
        {
            name: 'execute_payment',
            description: 'Execute vendor payments',
            permission: ToolPermissionLevel.APPROVAL_REQUIRED,
            conditions: { approvalType: 'VENDOR_PAYMENT', thresholdUsd: 5000, minApprovers: 2 },
        },
        { name: 'approve_expense', description: 'Approve expense reports', permission: ToolPermissionLevel.ALLOW },
        {
            name: 'sync_erp',
            description: 'Sync data to ERP system',
            permission: ToolPermissionLevel.APPROVAL_REQUIRED,
            conditions: { approvalType: 'CUSTOM', minApprovers: 1 },
        },
    ],

    SALES: [
        { name: 'email', description: 'Send and read emails', permission: ToolPermissionLevel.ALLOW },
        { name: 'calendar', description: 'Schedule meetings and demos', permission: ToolPermissionLevel.ALLOW },
        { name: 'documents', description: 'Read and create sales documents', permission: ToolPermissionLevel.ALLOW },
        { name: 'query', description: 'Query CRM data', permission: ToolPermissionLevel.READ_ONLY },
        { name: 'reports', description: 'Generate sales reports', permission: ToolPermissionLevel.ALLOW },
        { name: 'create_deal', description: 'Create CRM deals', permission: ToolPermissionLevel.ALLOW },
        { name: 'update_contact', description: 'Update CRM contacts', permission: ToolPermissionLevel.ALLOW },
        {
            name: 'generate_quote',
            description: 'Generate sales quotes',
            permission: ToolPermissionLevel.ALLOW,
        },
        {
            name: 'apply_discount',
            description: 'Apply discounts to quotes',
            permission: ToolPermissionLevel.APPROVAL_REQUIRED,
            conditions: { approvalType: 'BUDGET', maxDiscountPct: 20 },
        },
    ],

    MARKETING: [
        { name: 'email', description: 'Send marketing emails', permission: ToolPermissionLevel.ALLOW },
        { name: 'documents', description: 'Read and create marketing content', permission: ToolPermissionLevel.ALLOW },
        { name: 'query', description: 'Query marketing analytics', permission: ToolPermissionLevel.READ_ONLY },
        { name: 'reports', description: 'Generate marketing reports', permission: ToolPermissionLevel.ALLOW },
        { name: 'sheets', description: 'Create and manage spreadsheets', permission: ToolPermissionLevel.ALLOW },
        { name: 'calendar', description: 'Schedule and manage calendar events', permission: ToolPermissionLevel.ALLOW },
        { name: 'http_request', description: 'Call external marketing APIs', permission: ToolPermissionLevel.ALLOW },
        {
            name: 'publish_content',
            description: 'Publish marketing content externally',
            permission: ToolPermissionLevel.APPROVAL_REQUIRED,
            conditions: { approvalType: 'CUSTOM', minApprovers: 1 },
        },
    ],

    LEGAL: [
        { name: 'email', description: 'Send and read emails', permission: ToolPermissionLevel.ALLOW },
        { name: 'documents', description: 'Read and create legal documents', permission: ToolPermissionLevel.ALLOW },
        { name: 'query', description: 'Query compliance data (read-only)', permission: ToolPermissionLevel.READ_ONLY },
        {
            name: 'sign_contract',
            description: 'Sign contracts on behalf of organization',
            permission: ToolPermissionLevel.APPROVAL_REQUIRED,
            conditions: { approvalType: 'CONTRACT', minApprovers: 2 },
        },
        {
            name: 'generate_nda',
            description: 'Generate NDA documents',
            permission: ToolPermissionLevel.ALLOW,
        },
        {
            name: 'check_compliance',
            description: 'Check regulatory compliance',
            permission: ToolPermissionLevel.READ_ONLY,
        },
    ],

    RESEARCH: [
        { name: 'http_request', description: 'Fetch external data', permission: ToolPermissionLevel.ALLOW },
        { name: 'documents', description: 'Read and create research documents', permission: ToolPermissionLevel.ALLOW },
        { name: 'query', description: 'Query internal knowledge base', permission: ToolPermissionLevel.READ_ONLY },
        { name: 'reports', description: 'Generate research reports', permission: ToolPermissionLevel.ALLOW },
        { name: 'sheets', description: 'Create and manage spreadsheets', permission: ToolPermissionLevel.ALLOW },
        { name: 'calculator', description: 'Perform calculations', permission: ToolPermissionLevel.ALLOW },
    ],

    ENGINEERING: [
        { name: 'documents', description: 'Read and create technical docs', permission: ToolPermissionLevel.ALLOW },
        { name: 'query', description: 'Query engineering data', permission: ToolPermissionLevel.READ_ONLY },
        { name: 'tasks', description: 'Create and manage engineering tasks', permission: ToolPermissionLevel.ALLOW },
        { name: 'http_request', description: 'Call external APIs', permission: ToolPermissionLevel.ALLOW },
        { name: 'calculator', description: 'Perform calculations', permission: ToolPermissionLevel.ALLOW },
    ],

    QA: [
        { name: 'documents', description: 'Read and create QA documents', permission: ToolPermissionLevel.ALLOW },
        { name: 'query', description: 'Query test data', permission: ToolPermissionLevel.READ_ONLY },
        { name: 'tasks', description: 'Create bug reports and QA tasks', permission: ToolPermissionLevel.ALLOW },
        { name: 'reports', description: 'Generate QA reports', permission: ToolPermissionLevel.ALLOW },
    ],

    SECURITY: [
        { name: 'query', description: 'Query security logs (read-only)', permission: ToolPermissionLevel.READ_ONLY },
        { name: 'reports', description: 'Generate security reports', permission: ToolPermissionLevel.ALLOW },
        { name: 'email', description: 'Send security alerts', permission: ToolPermissionLevel.ALLOW },
        {
            name: 'block_resource',
            description: 'Block access to a resource',
            permission: ToolPermissionLevel.APPROVAL_REQUIRED,
            conditions: { approvalType: 'DATA_ACCESS', minApprovers: 1 },
        },
    ],

    OPERATIONS: [
        { name: 'email', description: 'Send and read emails', permission: ToolPermissionLevel.ALLOW },
        { name: 'calendar', description: 'Schedule operational events', permission: ToolPermissionLevel.ALLOW },
        { name: 'documents', description: 'Operational documentation', permission: ToolPermissionLevel.ALLOW },
        { name: 'query', description: 'Query operational data', permission: ToolPermissionLevel.READ_ONLY },
        { name: 'tasks', description: 'Create and manage operational tasks', permission: ToolPermissionLevel.ALLOW },
        { name: 'reports', description: 'Generate operations reports', permission: ToolPermissionLevel.ALLOW },
        { name: 'sheets', description: 'Create and manage spreadsheets', permission: ToolPermissionLevel.ALLOW },
    ],

    CUSTOMER_SUPPORT: [
        { name: 'email', description: 'Send and read support emails', permission: ToolPermissionLevel.ALLOW },
        { name: 'query', description: 'Query customer data (read-only)', permission: ToolPermissionLevel.READ_ONLY },
        { name: 'documents', description: 'Access knowledge base', permission: ToolPermissionLevel.READ_ONLY },
        { name: 'tasks', description: 'Create support tickets', permission: ToolPermissionLevel.ALLOW },
        {
            name: 'process_refund',
            description: 'Process customer refunds',
            permission: ToolPermissionLevel.APPROVAL_REQUIRED,
            conditions: { approvalType: 'REFUND', thresholdUsd: 1000 },
        },
    ],

    // Phase 2E — Project Discovery agent (Enterprise Information Engine).
    // Exposes the conversational + document channels of the EIE to Hermes.
    PROJECT_DISCOVERY: [
        {
            name: 'approve_initiation',
            description: 'Approve a discovered project initiation through the canonical command path',
            permission: ToolPermissionLevel.APPROVAL_REQUIRED,
            conditions: { approvalType: 'PROJECT_CREATION', command: 'ApproveEnterpriseInitiationCommand' },
        },
        {
            name: 'create_project_from_initiation',
            description: 'Materialize an approved initiation through CreateProjectFromInitiationCommand',
            permission: ToolPermissionLevel.APPROVAL_REQUIRED,
            conditions: { approvalType: 'PROJECT_CREATION', command: 'CreateProjectFromInitiationCommand' },
        },
        {
            name: 'interview_ask_next',
            description: 'Return the next discovery question + prompt for a project',
            permission: ToolPermissionLevel.ALLOW,
        },
        {
            name: 'interview_parse_reply',
            description: 'Parse a free-form reply into InformationResponse rows',
            permission: ToolPermissionLevel.ALLOW,
        },
        {
            name: 'document_extract',
            description: 'Extract candidate answers from an uploaded document',
            permission: ToolPermissionLevel.ALLOW,
        },
        {
            name: 'document_accept_candidates',
            description: 'Persist user-accepted extraction candidates into the engine',
            permission: ToolPermissionLevel.ALLOW,
        },
        {
            name: 'completeness_get',
            description: 'Read EntityCompleteness for a project',
            permission: ToolPermissionLevel.READ_ONLY,
        },
        {
            name: 'resolved_requirements_get',
            description: 'Read the flat resolved question list for a project',
            permission: ToolPermissionLevel.READ_ONLY,
        },
        {
            name: 'record_response',
            description: 'Record a single InformationResponse (one-question write)',
            permission: ToolPermissionLevel.ALLOW,
        },
    ],

    // Phase 3C — Chief of Staff agent.
    // Access to project memory, goals, tasks, health, and the CoS chat API.
    CHIEF_OF_STAFF: [
        {
            name: 'project_memory_add',
            description: 'Add a memory entry to a project',
            permission: ToolPermissionLevel.ALLOW,
        },
        {
            name: 'project_memory_search',
            description: 'Search project memory by keyword',
            permission: ToolPermissionLevel.READ_ONLY,
        },
        {
            name: 'project_memory_update_confidence',
            description: 'Update the confidence score of a memory entry',
            permission: ToolPermissionLevel.ALLOW,
        },
        {
            name: 'getProject',
            description: 'Read a project by ID',
            permission: ToolPermissionLevel.READ_ONLY,
        },
        {
            name: 'getTask',
            description: 'Read a task by ID',
            permission: ToolPermissionLevel.READ_ONLY,
        },
        {
            name: 'completeness_get',
            description: 'Read completeness score for a project',
            permission: ToolPermissionLevel.READ_ONLY,
        },
        {
            name: 'record_response',
            description: 'Record an information response for a project',
            permission: ToolPermissionLevel.ALLOW,
        },
    ],

    CUSTOM: [
        { name: 'email', description: 'Email operations', permission: ToolPermissionLevel.ALLOW },
        { name: 'documents', description: 'Document operations', permission: ToolPermissionLevel.ALLOW },
        { name: 'query', description: 'Query data', permission: ToolPermissionLevel.READ_ONLY },
        { name: 'sheets', description: 'Spreadsheet operations', permission: ToolPermissionLevel.ALLOW },
        { name: 'calendar', description: 'Calendar operations', permission: ToolPermissionLevel.ALLOW },
    ],
};

/**
 * Get the default tool set for a Hermes agent type.
 */
export function getHermesToolSet(type: HermesAgentType): HermesToolDescriptor[] {
    return HERMES_TOOL_SETS[type] ?? HERMES_TOOL_SETS['CUSTOM'];
}

/**
 * Get all tool names allowed for a Hermes type (excludes DENY).
 */
export function getAllowedToolNames(type: HermesAgentType): string[] {
    return getHermesToolSet(type)
        .filter((t) => t.permission !== ToolPermissionLevel.DENY)
        .map((t) => t.name);
}
