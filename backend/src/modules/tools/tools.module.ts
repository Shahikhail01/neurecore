import { Module, forwardRef } from '@nestjs/common';
import { ToolsController } from './tools.controller';
import { ToolsService } from './tools.service';
import { StructuredToolRegistry } from './structured-tool.registry';
import { HttpRequestTool } from './built-in/http-request.tool';
import { CalculatorTool } from './built-in/calculator.tool';
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
import {
  SocialMediaTool,
  TwitterProvider,
  LinkedInProvider,
} from './built-in/social-media.tool';
import { KnowledgeBaseTool } from './built-in/knowledge-base.tool';
import { VectorSearchTool } from './built-in/vector-search.tool';
import {
  CodeDeploymentTool,
  VercelDeploymentProvider,
  NetlifyDeploymentProvider,
} from './built-in/code-deployment.tool';
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
import { ToolsInitializerService } from './tools-initializer.service';
import { EventsModule } from '../events/events.module';
import { ModelsModule } from '../models/models.module';
import { DatabaseModule } from '../../infrastructure/database/database.module';

@Module({
  imports: [
    forwardRef(() => EventsModule), // EventsGateway for AgentMessagingTool
    ModelsModule, // LLMFactory for DocumentSummaryTool
    DatabaseModule, // PrismaService for TaskManagementTool
  ],
  controllers: [ToolsController],
  providers: [
    // Legacy built-in tools (kept for backward compatibility)
    HttpRequestTool,
    CalculatorTool,
    // Enhanced tools — registered into StructuredToolRegistry by ToolsInitializerService
    CalculatorEnhancedTool,
    HttpRequestEnhancedTool,
    // New structured tools
    WebSearchTool,
    DatabaseQueryTool,
    EmailSendTool,
    AgentMessagingTool,
    DocumentSummaryTool,
    // New agent tools
    CalendarTool,
    TaskManagementTool,
    CRMTool,
    SpreadsheetTool,
    DocumentTool,
    TwitterProvider,
    LinkedInProvider,
    SocialMediaTool,
    VercelDeploymentProvider,
    NetlifyDeploymentProvider,
    CodeDeploymentTool,
    KnowledgeBaseTool,
    VectorSearchTool,
    AlertingTool,
    BankingTool,
    MapsTool,
    // New P0 tools
    AnalyticsDashboardTool,
    InvoiceGenerationTool,
    BudgetTrackingTool,
    HRSystemsTool,
    GoogleWorkspaceTool,
    PDFGenerationTool,
    ReportBuilderTool,
    CodeAnalysisTool,
    ExportTool,
    VoiceAnalyticsTool,
    TemplateEngineTool,
    CodeExecutionTool,
    LLMIntegrationTool,
    PaymentProcessingTool,
    ExpenseTrackingTool,
    SEOToolsTool,
    AdOptimizationTool,
    GeocodingTool,
    VoiceInputTool,
    SystemMonitorTool,
    SecurityScannerTool,
    MeetingSchedulerTool,
    AvailabilityCheckerTool,
    WorkflowEngineTool,
    RoutineAutomationTool,
    // Registry + initializer
    StructuredToolRegistry,
    ToolsInitializerService,
    ToolsService,
  ],
  exports: [ToolsService, StructuredToolRegistry],
})
export class ToolsModule {}
