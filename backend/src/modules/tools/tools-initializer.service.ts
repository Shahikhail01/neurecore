/**
 * ToolsInitializerService
 *
 * Registers all structured tool instances into the StructuredToolRegistry
 * during application bootstrap via OnModuleInit.
 *
 * WHY THIS EXISTS (bug fix):
 *   CalculatorEnhancedTool and HttpRequestEnhancedTool were listed as providers
 *   in ToolsModule but were never registered into StructuredToolRegistry.
 *   As a result, StructuredToolRegistry.toLangChainTools() returned an empty
 *   array — the LangGraph agent had no tools available at runtime.
 *
 * SOLID:
 *   SRP  — registration only; does not construct tools or own any application logic.
 *   OCP  — add a new tool by adding one line here; no other service changes needed.
 *   DIP  — depends on BaseStructuredTool / IStructuredTool abstractions, not
 *          concrete implementations directly (they are injected by NestJS DI).
 */
import { Injectable, OnModuleInit } from '@nestjs/common';
import { StructuredToolRegistry } from './structured-tool.registry';
import { CalculatorEnhancedTool } from './built-in/calculator-enhanced.tool';
import { HttpRequestEnhancedTool } from './built-in/http-request-enhanced.tool';
import { WebSearchTool } from './built-in/web-search.tool';
import { DatabaseQueryTool } from './built-in/database-query.tool';
import { EmailSendTool } from './built-in/email-send.tool';
import { AgentMessagingTool } from './built-in/agent-messaging.tool';
import { DocumentSummaryTool } from './built-in/document-summary.tool';
import { CalendarTool } from './built-in/calendar.tool';
import { TaskManagementTool } from './built-in/task-management.tool';
import { CRMTool } from './built-in/crm.tool';
import { SpreadsheetTool } from './built-in/spreadsheet.tool';
import { DocumentTool } from './built-in/document.tool';
import { SocialMediaTool } from './built-in/social-media.tool';
import { KnowledgeBaseTool } from './built-in/knowledge-base.tool';
import { VectorSearchTool } from './built-in/vector-search.tool';
import { CodeDeploymentTool } from './built-in/code-deployment.tool';
import { AlertingTool } from './built-in/alerting.tool';
import { BankingTool } from './built-in/banking.tool';
import { MapsTool } from './built-in/maps.tool';
import { AnalyticsDashboardTool } from './built-in/analytics-dashboard.tool';
import { InvoiceGenerationTool } from './built-in/invoice-generation.tool';
import { BudgetTrackingTool } from './built-in/budget-tracking.tool';
import { HRSystemsTool } from './built-in/hr-systems.tool';
import { GoogleWorkspaceTool } from './built-in/google-workspace.tool';
import { PDFGenerationTool } from './built-in/pdf-generation.tool';
import { ReportBuilderTool } from './built-in/report-builder.tool';
import { CodeAnalysisTool } from './built-in/code-analysis.tool';
import { ExportTool } from './built-in/export.tool';
import { VoiceAnalyticsTool } from './built-in/voice-analytics.tool';
import { TemplateEngineTool } from './built-in/template-engine.tool';
import { CodeExecutionTool } from './built-in/code-execution.tool';
import { LLMIntegrationTool } from './built-in/llm-integration.tool';
import { PaymentProcessingTool } from './built-in/payment-processing.tool';
import { ExpenseTrackingTool } from './built-in/expense-tracking.tool';
import { SEOToolsTool } from './built-in/seo-tools.tool';
import { AdOptimizationTool } from './built-in/ad-optimization.tool';
import { GeocodingTool } from './built-in/geocoding.tool';
import { VoiceInputTool } from './built-in/voice-input.tool';
import { SystemMonitorTool } from './built-in/system-monitor.tool';
import { SecurityScannerTool } from './built-in/security-scanner.tool';
import { MeetingSchedulerTool } from './built-in/meeting-scheduler.tool';
import { AvailabilityCheckerTool } from './built-in/availability-checker.tool';
import { WorkflowEngineTool } from './built-in/workflow-engine.tool';
import { RoutineAutomationTool } from './built-in/routine-automation.tool';

@Injectable()
export class ToolsInitializerService implements OnModuleInit {
  constructor(
    private readonly registry: StructuredToolRegistry,
    private readonly calcEnhanced: CalculatorEnhancedTool,
    private readonly httpEnhanced: HttpRequestEnhancedTool,
    private readonly webSearch: WebSearchTool,
    private readonly dbQuery: DatabaseQueryTool,
    private readonly emailSend: EmailSendTool,
    private readonly agentMsg: AgentMessagingTool,
    private readonly docSummary: DocumentSummaryTool,
    private readonly calendar: CalendarTool,
    private readonly taskMgmt: TaskManagementTool,
    private readonly crm: CRMTool,
    private readonly spreadsheet: SpreadsheetTool,
    private readonly document: DocumentTool,
    private readonly socialMedia: SocialMediaTool,
    private readonly knowledgeBase: KnowledgeBaseTool,
    private readonly vectorSearch: VectorSearchTool,
    private readonly codeDeployment: CodeDeploymentTool,
    private readonly alerting: AlertingTool,
    private readonly banking: BankingTool,
    private readonly maps: MapsTool,
    private readonly analyticsDashboard: AnalyticsDashboardTool,
    private readonly invoiceGeneration: InvoiceGenerationTool,
    private readonly budgetTracking: BudgetTrackingTool,
    private readonly hrSystems: HRSystemsTool,
    private readonly googleWorkspace: GoogleWorkspaceTool,
    private readonly pdfGeneration: PDFGenerationTool,
    private readonly reportBuilder: ReportBuilderTool,
    private readonly codeAnalysis: CodeAnalysisTool,
    private readonly exportTool: ExportTool,
    private readonly voiceAnalytics: VoiceAnalyticsTool,
    private readonly templateEngine: TemplateEngineTool,
    private readonly codeExecution: CodeExecutionTool,
    private readonly llmIntegration: LLMIntegrationTool,
    private readonly paymentProcessing: PaymentProcessingTool,
    private readonly expenseTracking: ExpenseTrackingTool,
    private readonly seoTools: SEOToolsTool,
    private readonly adOptimization: AdOptimizationTool,
    private readonly geocoding: GeocodingTool,
    private readonly voiceInput: VoiceInputTool,
    private readonly systemMonitor: SystemMonitorTool,
    private readonly securityScanner: SecurityScannerTool,
    private readonly meetingScheduler: MeetingSchedulerTool,
    private readonly availabilityChecker: AvailabilityCheckerTool,
    private readonly workflowEngine: WorkflowEngineTool,
    private readonly routineAutomation: RoutineAutomationTool,
  ) {}

  onModuleInit(): void {
    // Existing tools
    this.registry.register(this.calcEnhanced);
    this.registry.register(this.httpEnhanced);
    this.registry.register(this.webSearch);
    this.registry.register(this.dbQuery);
    this.registry.register(this.emailSend);
    this.registry.register(this.agentMsg);
    this.registry.register(this.docSummary);
    // New agent tools
    this.registry.register(this.calendar);
    this.registry.register(this.taskMgmt);
    this.registry.register(this.crm);
    this.registry.register(this.spreadsheet);
    this.registry.register(this.document);
    this.registry.register(this.socialMedia);
    this.registry.register(this.knowledgeBase);
    this.registry.register(this.vectorSearch);
    this.registry.register(this.codeDeployment);
    this.registry.register(this.alerting);
    this.registry.register(this.banking);
    this.registry.register(this.maps);
    // New P0 tools
    this.registry.register(this.analyticsDashboard);
    this.registry.register(this.invoiceGeneration);
    this.registry.register(this.budgetTracking);
    // P0-4, P0-5
    this.registry.register(this.hrSystems);
    this.registry.register(this.googleWorkspace);
    // P1-6, P1-7
    this.registry.register(this.pdfGeneration);
    this.registry.register(this.reportBuilder);
    // P1-8 through P2-10
    this.registry.register(this.codeAnalysis);
    this.registry.register(this.exportTool);
    this.registry.register(this.voiceAnalytics);
    this.registry.register(this.templateEngine);
    this.registry.register(this.codeExecution);
    this.registry.register(this.llmIntegration);
    this.registry.register(this.paymentProcessing);
    this.registry.register(this.expenseTracking);
    this.registry.register(this.seoTools);
    this.registry.register(this.adOptimization);
    this.registry.register(this.geocoding);
    this.registry.register(this.voiceInput);
    this.registry.register(this.systemMonitor);
    this.registry.register(this.securityScanner);
    this.registry.register(this.meetingScheduler);
    this.registry.register(this.availabilityChecker);
    this.registry.register(this.workflowEngine);
    this.registry.register(this.routineAutomation);
  }
}
