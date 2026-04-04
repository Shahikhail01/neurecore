/**
 * Security Scanner Tool - P2-6 of remaining tools
 * Enables AI agents to perform security scans and vulnerability assessments
 * For IT, Security Analyst agents
 *
 * SOLID Principles Applied:
 * - SRP: Single responsibility for security scanning operations
 * - OCP: Extensible via security provider interfaces
 * - DIP: Depends on abstractions for security providers
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { BaseStructuredTool } from '../structured-tool.base';
import {
  ToolCategory,
  StructuredToolResult,
  ToolExecutionContext,
} from '../interfaces/structured-tool.interface';

// ─────────────────────────────────────────────────────────────
// Input Schema
// ─────────────────────────────────────────────────────────────

export const SecurityScannerActionEnum = z.enum([
  'scan_vulnerabilities',
  'check_compliance',
  'analyze_dependencies',
  'scan_infrastructure',
  'get_security_report',
  'list_findings',
]);

export type SecurityScannerAction = z.infer<typeof SecurityScannerActionEnum>;

export const SecurityScannerInputSchema = z.object({
  action: SecurityScannerActionEnum.describe(
    'The security scanner action to perform',
  ),
  target: z
    .string()
    .optional()
    .describe('Target to scan (URL, IP, repository)'),
  scanType: z
    .enum(['full', 'quick', 'critical', 'custom'])
    .optional()
    .default('quick')
    .describe('Type of security scan'),
  complianceStandard: z
    .enum(['owasp', 'pci-dss', 'hipaa', 'gdpr', 'soc2'])
    .optional()
    .describe('Compliance standard to check'),
  packageFile: z
    .string()
    .optional()
    .describe('Package file content for dependency scan'),
  reportId: z.string().optional().describe('Report ID'),
  severity: z
    .enum(['critical', 'high', 'medium', 'low', 'info'])
    .optional()
    .describe('Filter by severity'),
  page: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export type SecurityScannerInput = z.infer<typeof SecurityScannerInputSchema>;

// ─────────────────────────────────────────────────────────────
// Output Types
// ─────────────────────────────────────────────────────────────

type Vulnerability = {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  cve?: string;
  cvss: number;
  affectedComponent: string;
  recommendation: string;
  references: string[];
};

type ComplianceResult = {
  standard: string;
  score: number;
  passed: number;
  failed: number;
  warnings: number;
  findings: Array<{ control: string; status: string; details: string }>;
};

type DependencyVulnerability = {
  package: string;
  version: string;
  vulnerabilities: Vulnerability[];
  isDev: boolean;
};

type InfrastructureScan = {
  target: string;
  status: 'passed' | 'failed' | 'warning';
  issues: Vulnerability[];
  securityScore: number;
  scannedAt: string;
};

type SecurityReport = {
  id: string;
  type: string;
  target: string;
  score: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  generatedAt: string;
  summary: string;
};

// ─────────────────────────────────────────────────────────────
// Provider Interface (DIP)
// ─────────────────────────────────────────────────────────────

interface ISecurityScannerProvider {
  scanVulnerabilities(
    target: string,
    scanType?: string,
  ): Promise<Vulnerability[]>;

  checkCompliance(target: string, standard: string): Promise<ComplianceResult>;

  analyzeDependencies(packageFile: string): Promise<DependencyVulnerability[]>;

  scanInfrastructure(target: string): Promise<InfrastructureScan>;

  getSecurityReport(reportId: string): Promise<SecurityReport>;

  listFindings(target?: string, severity?: string): Promise<Vulnerability[]>;
}

// ─────────────────────────────────────────────────────────────
// Mock Security Scanner Provider
// ─────────────────────────────────────────────────────────────

@Injectable()
class MockSecurityScannerProvider implements ISecurityScannerProvider {
  private readonly logger = new Logger(MockSecurityScannerProvider.name);

  async scanVulnerabilities(
    target: string,
    scanType?: string,
  ): Promise<Vulnerability[]> {
    this.logger.log('Scanning vulnerabilities: ' + target);

    const severityCount =
      scanType === 'critical' ? 1 : scanType === 'quick' ? 2 : 5;

    return [
      {
        id: 'vuln-1',
        title: 'SQL Injection',
        description:
          'Potential SQL injection vulnerability in user input handling',
        severity: 'high',
        cve: 'CVE-2024-1234',
        cvss: 8.5,
        affectedComponent: 'api/users',
        recommendation: 'Use parameterized queries',
        references: ['https://owasp.org/www-community/attacks/SQL_Injection'],
      },
      {
        id: 'vuln-2',
        title: 'XSS Vulnerability',
        description: 'Cross-site scripting in search parameter',
        severity: 'medium',
        cvss: 6.1,
        affectedComponent: 'web/search',
        recommendation: 'Sanitize user input',
        references: ['https://owasp.org/www-community/attacks/xss/'],
      },
    ];
  }

  async checkCompliance(
    target: string,
    standard: string,
  ): Promise<ComplianceResult> {
    this.logger.log('Checking compliance: ' + standard);

    return {
      standard,
      score: 85 + Math.floor(Math.random() * 15),
      passed: 45,
      failed: 3,
      warnings: 5,
      findings: [
        {
          control: 'A1-Injection',
          status: 'pass',
          details: 'No injection vulnerabilities found',
        },
        {
          control: 'A2-Auth',
          status: 'warning',
          details: 'Consider implementing MFA',
        },
      ],
    };
  }

  async analyzeDependencies(
    packageFile: string,
  ): Promise<DependencyVulnerability[]> {
    this.logger.log('Analyzing dependencies');

    return [
      {
        package: 'lodash',
        version: '4.17.15',
        vulnerabilities: [
          {
            id: 'dep-1',
            title: 'Prototype Pollution',
            description: 'Prototype pollution vulnerability in lodash',
            severity: 'high',
            cve: 'CVE-2021-23337',
            cvss: 7.5,
            affectedComponent: 'lodash',
            recommendation: 'Upgrade to version 4.17.21 or higher',
            references: [],
          },
        ],
        isDev: false,
      },
    ];
  }

  async scanInfrastructure(target: string): Promise<InfrastructureScan> {
    this.logger.log('Scanning infrastructure: ' + target);

    return {
      target,
      status: 'warning',
      issues: [
        {
          id: 'infra-1',
          title: 'Exposed Sensitive Data',
          description: 'Environment variables may contain sensitive data',
          severity: 'high',
          cvss: 7.2,
          affectedComponent: 'configuration',
          recommendation: 'Use secret management services',
          references: [],
        },
      ],
      securityScore: 75,
      scannedAt: new Date().toISOString(),
    };
  }

  async getSecurityReport(reportId: string): Promise<SecurityReport> {
    this.logger.log('Getting security report: ' + reportId);

    return {
      id: reportId,
      type: 'full-scan',
      target: 'example.com',
      score: 78,
      critical: 0,
      high: 2,
      medium: 5,
      low: 8,
      generatedAt: new Date().toISOString(),
      summary:
        'Overall security posture is acceptable but needs attention in several areas',
    };
  }

  async listFindings(
    target?: string,
    severity?: string,
  ): Promise<Vulnerability[]> {
    this.logger.log('Listing findings');

    return [
      {
        id: 'find-1',
        title: 'Insecure Direct Object Reference',
        description: 'IDOR vulnerability in API endpoint',
        severity: 'high',
        cvss: 7.5,
        affectedComponent: 'api/orders',
        recommendation: 'Implement proper authorization checks',
        references: [],
      },
    ];
  }
}

// ─────────────────────────────────────────────────────────────
// Tool Implementation
// ─────────────────────────────────────────────────────────────

@Injectable()
export class SecurityScannerTool extends BaseStructuredTool {
  readonly name = 'security_scanner';
  readonly description =
    'Scan for vulnerabilities, check compliance, analyze dependencies, and generate security reports';
  readonly category = ToolCategory.MONITORING;
  readonly inputSchema = SecurityScannerInputSchema;

  private readonly log = new Logger(SecurityScannerTool.name);
  private readonly provider: ISecurityScannerProvider;

  constructor(private readonly config: ConfigService) {
    super();
    this.provider = new MockSecurityScannerProvider();
  }

  protected async executeImpl(
    input: SecurityScannerInput,
    context: ToolExecutionContext,
  ): Promise<StructuredToolResult<unknown>> {
    this.log.log('Executing Security Scanner action: ' + input.action);

    try {
      switch (input.action) {
        case 'scan_vulnerabilities':
          return await this.handleScanVulnerabilities(input);
        case 'check_compliance':
          return await this.handleCheckCompliance(input);
        case 'analyze_dependencies':
          return await this.handleAnalyzeDependencies(input);
        case 'scan_infrastructure':
          return await this.handleScanInfrastructure(input);
        case 'get_security_report':
          return await this.handleGetSecurityReport(input);
        case 'list_findings':
          return await this.handleListFindings(input);
        default:
          throw new Error('Unknown action: ' + input.action);
      }
    } catch (error) {
      const err = error as Error;
      this.log.error(
        'Security Scanner action failed: ' + err.message,
        err.stack,
      );
      return { success: false, error: err.message };
    }
  }

  private async handleScanVulnerabilities(
    input: SecurityScannerInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.target) {
      throw new Error('target is required for scan_vulnerabilities action');
    }

    const result = await this.provider.scanVulnerabilities(
      input.target,
      input.scanType,
    );

    return {
      success: true,
      data: { vulnerabilities: result, count: result.length },
    };
  }

  private async handleCheckCompliance(
    input: SecurityScannerInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.target || !input.complianceStandard) {
      throw new Error(
        'target and complianceStandard are required for check_compliance action',
      );
    }

    const result = await this.provider.checkCompliance(
      input.target,
      input.complianceStandard,
    );

    return {
      success: true,
      data: result,
    };
  }

  private async handleAnalyzeDependencies(
    input: SecurityScannerInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.packageFile) {
      throw new Error(
        'packageFile is required for analyze_dependencies action',
      );
    }

    const result = await this.provider.analyzeDependencies(input.packageFile);

    return {
      success: true,
      data: { dependencies: result, count: result.length },
    };
  }

  private async handleScanInfrastructure(
    input: SecurityScannerInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.target) {
      throw new Error('target is required for scan_infrastructure action');
    }

    const result = await this.provider.scanInfrastructure(input.target);

    return {
      success: true,
      data: result,
    };
  }

  private async handleGetSecurityReport(
    input: SecurityScannerInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.reportId) {
      throw new Error('reportId is required for get_security_report action');
    }

    const result = await this.provider.getSecurityReport(input.reportId);

    return {
      success: true,
      data: result,
    };
  }

  private async handleListFindings(
    input: SecurityScannerInput,
  ): Promise<StructuredToolResult<unknown>> {
    const result = await this.provider.listFindings(
      input.target,
      input.severity,
    );

    return {
      success: true,
      data: { findings: result, count: result.length },
    };
  }
}
