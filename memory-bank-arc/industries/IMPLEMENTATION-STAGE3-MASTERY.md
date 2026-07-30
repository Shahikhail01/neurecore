# Stage 3 Implementation Plan: Industry Mastery

**Status:** Draft  
**Date:** 2026-07-21  
**Target:** Months 5-6+  
**Source:** [INDUSTRY-REQUIREMENTS-STAGED.md §5](./INDUSTRY-REQUIREMENTS-STAGED.md#5-stage-3--industry-mastery)  
**Depends on:** [IMPLEMENTATION-STAGE2-ACCELERATION.md](./IMPLEMENTATION-STAGE2-ACCELERATION.md) (all phases complete)

---

## 1. Overview

Stage 3 delivers **proprietary, AI-driven competitive advantage** — the features that make NeureCore irreplaceable in each vertical. Every industry gets:
- Industry-specific AI agents (domain-tuned prompts, not generic)
- Predictive analytics models per industry
- Automated regulatory tracking
- Sub-industry deep specialization
- Peer benchmarking (anonymized multi-tenant)
- Advanced RAG with industry knowledge corpus

**Stage 3 is continuous innovation** — features ship as models mature, not on a fixed schedule.

---

## 2. Current State Assessment

### 2.1 What Stage 2 Delivers (Precondition)

| Stage 2 Asset | Status |
|---------------|--------|
| Compliance checklist engine | ✅ Deployed |
| Approval routing with addon system | ✅ Deployed |
| Dashboard templates per industry group | ✅ Deployed |
| Customer field definitions (structured) | ✅ Deployed |
| Integration presets per industry | ✅ Deployed |
| Notification template registry | ✅ Deployed |

### 2.2 What Already Exists That Stage 3 Extends

| Existing Asset | Stage 3 Extension |
|----------------|-------------------|
| Hermes AI / LangGraph | Fine-tune LLMs per industry for specialized agents |
| ProjectShapeSynthesisService | Add industry-specific RAG corpus as few-shot examples |
| AiGatewayService | Add predictive analytics capability |
| RAG pipeline (pgvector) | Seed comprehensive industry knowledge corpus |
| Knowledge module | Build industry peer benchmarking dataset |
| Tiers module | Add industry-specific feature gating per tier |

### 2.3 What Is New

| Need | Why New |
|------|---------|
| Predictive model registry | ML models per industry for churn, risk, demand forecasting |
| Regulatory tracking service | Monitor regulatory websites/databases for changes |
| Sub-industry configs | Deep specialization (e.g., "Islamic Banking" within Financial Services) |
| Benchmarking service | Anonymized peer comparison using aggregated tenant data |
| Fine-tuning pipeline | Per-industry LLM fine-tuning infrastructure |

---

## 3. Architecture Principles

### 3.1 Data-Driven, Not Hardcoded

Every Stage 3 feature is powered by data, not configuration:
- Predictive models learn from tenant usage in Stages 1-2
- Regulatory tracking monitors external sources
- Benchmarking aggregates anonymized tenant metrics
- Fine-tuning uses project/agent interaction data

### 3.2 SOLID Application

| Principle | Application |
|-----------|-------------|
| **SRP** | Each model is a standalone service. Each sub-industry is a separate config. |
| **OCP** | New predictive model = new model registered in registry. Existing dashboards unchanged. |
| **LSP** | All models implement `PredictionModel` interface. All sub-industry configs conform to shared schema. |
| **ISP** | `PredictionModel` exposes only `predict(input): Prediction`. `RegulatorySource` exposes only `check(): Change[]`. |
| **DIP** | `PredictiveAnalyticsService` depends on `PredictionModel[]`. DI resolves models per tenant industry. |

---

## 4. Module Design

### 4.1 Predictive Model Registry

```typescript
// backend/src/modules/predictive/industry-models/prediction-model.interface.ts

export interface PredictionModel {
  industrySlugs: string[];
  modelName: string;
  predictionType: 'churn' | 'risk' | 'demand' | 'no-show' | 'completion';
  predict(input: PredictionInput): Promise<Prediction>;
  train(data: TrainingData[]): Promise<TrainingResult>;
  getAccuracy(): Promise<number>;
}
```

```typescript
// backend/src/modules/predictive/industry-models/financial-churn.model.ts

@Injectable()
export class FinancialChurnModel implements PredictionModel {
  industrySlugs = ['financial-services', 'accounting-audit-services'];
  modelName = 'financial-client-churn-v1';
  predictionType = 'churn' as const;

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly prisma: PrismaService,
  ) {}

  async predict(input: PredictionInput): Promise<Prediction> {
    // Features: engagement count, days since last project, approval volume, NPS score
    // Model: Logistic regression (trained on tenant's historical data)
    const features = await this.extractFeatures(input.tenantId, input.entityId);
    const score = this.score(features);
    return {
      probability: score,
      confidence: this.calibrateConfidence(score),
      topFactors: this.topContributors(features),
      suggestedAction: score > 0.7 ? 'Schedule quarterly review call' : 'Continue monitoring',
    };
  }

  private async extractFeatures(tenantId: string, clientId: string): Promise<Record<string, number>> {
    // Query tenant-scoped data only — never cross-tenant
  }
}
```

```typescript
// backend/src/modules/predictive/predictive-analytics.service.ts

@Injectable()
export class PredictiveAnalyticsService {
  constructor(@Inject(PREDICTION_MODELS) private readonly models: PredictionModel[]) {}

  async predict(
    tenantId: string,
    industrySlug: string,
    type: string,
    entityId: string,
  ): Promise<Prediction | null> {
    const model = this.models.find(
      m => m.industrySlugs.includes(industrySlug) && m.predictionType === type
    );
    if (!model) return null;
    return model.predict({ tenantId, entityId, industrySlug });
  }
}
```

### 4.2 Regulatory Tracking Service

```typescript
// backend/src/modules/regulatory-tracking/regulatory-source.interface.ts

export interface RegulatorySource {
  industrySlugs: string[];
  sourceName: string;
  check(): Promise<RegulatoryChange[]>;
}
```

```typescript
// backend/src/modules/regulatory-tracking/sources/financial-regulatory.source.ts

@Injectable()
export class FinancialRegulatorySource implements RegulatorySource {
  industrySlugs = ['financial-services', 'accounting-audit-services'];
  sourceName = 'SEC / FINRA / PCAOB';

  async check(): Promise<RegulatoryChange[]> {
    // Fetch from SEC RSS feed, FINRA alerts, PCAOB updates
    // Parse and return structured changes
    return [
      {
        agency: 'SEC',
        title: 'New Cybersecurity Disclosure Rules',
        effectiveDate: new Date('2026-09-15'),
        summary: 'Public companies must disclose cybersecurity risk management...',
        affectedRegulations: ['SEC Rule 10b-5', 'Regulation S-K Item 106'],
        requiredActions: ['Update risk assessment', 'Add disclosure to annual report'],
        severity: 'high',
      },
    ];
  }
}
```

```typescript
// backend/src/modules/regulatory-tracking/regulatory-tracking.service.ts

@Injectable()
export class RegulatoryTrackingService {
  constructor(
    @Inject(REGULATORY_SOURCES) private readonly sources: RegulatorySource[],
    private readonly complianceService: IndustryComplianceService,
  ) {}

  async getRelevantChanges(tenantId: string, industrySlug: string): Promise<RegulatoryChange[]> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const relevantSources = this.sources.filter(s => s.industrySlugs.includes(industrySlug));
    const allChanges = await Promise.all(relevantSources.map(s => s.check()));
    const flat = allChanges.flat();

    // Auto-update compliance checklists
    for (const change of flat) {
      await this.complianceService.applyRegulatoryChange(tenantId, industrySlug, change);
    }
    return flat;
  }
}
```

### 4.3 Sub-Industry Deep Specialization

Extends the Stage 1 `IndustryFeatureProvider` system with sub-industry discriminators:

```typescript
// backend/src/modules/industry-features/sub-industry-configs.ts

export const SUB_INDUSTRY_CONFIGS: Record<string, SubIndustryDef[]> = {
  'financial-services': [
    {
      slug: 'banking',
      label: 'Banking',
      description: 'Retail and commercial banking operations',
      overrides: {
        workspaceExtras: ['loans', 'portfolios', 'compliance', 'risk'],
        agentRoles: ['relationship-manager', 'loan-processor', 'compliance-officer'],
      },
    },
    {
      slug: 'insurance',
      label: 'Insurance',
      description: 'Life, property, and health insurance',
      overrides: {
        workspaceExtras: ['underwriting', 'claims', 'policies', 'compliance'],
        agentRoles: ['underwriter', 'claims-adjuster', 'compliance-officer'],
      },
    },
    {
      slug: 'wealth-management',
      label: 'Wealth Management',
      description: 'Portfolio management for HNW clients',
      overrides: {
        workspaceExtras: ['portfolios', 'compliance', 'risk'],
        agentRoles: ['wealth-advisor', 'portfolio-manager', 'risk-analyst'],
      },
    },
    {
      slug: 'fintech',
      label: 'FinTech',
      description: 'Financial technology startups',
      overrides: {
        workspaceExtras: ['compliance', 'engagements'],
        agentRoles: ['product-manager', 'compliance-officer'],
      },
    },
  ],
  // ... other industries with sub-industries (healthcare: dental/ortho/pediatric, etc.)
};
```

The sub-industry is set as an optional `industrySubType` on the Tenant, but **only modifiable by Super Admin** (same constraint as `industry`).

### 4.4 Peer Benchmarking Service

```typescript
// backend/src/modules/benchmarking/benchmarking.service.ts

@Injectable()
export class BenchmarkingService {
  constructor(private readonly prisma: PrismaService) {}

  async getBenchmarks(tenantId: string, industrySlug: string): Promise<IndustryBenchmarks | null> {
    // Aggregated, anonymized metrics from all tenants in the same industry
    // No PII or tenant-identifying data ever exposed

    const peers = await this.prisma.tenant.findMany({
      where: { industry: industrySlug, status: 'ACTIVE', id: { not: tenantId } },
      select: {
        id: true,
        // Aggregate metrics only — never individual data
        _count: { select: { agents: true, projects: true, customers: true } },
      },
    });

    if (peers.length < 5) return null; // Not enough data for meaningful comparison

    return {
      industrySlug,
      peerCount: peers.length,
      metrics: {
        avgAgents: this.average(peers.map(p => p._count.agents)),
        avgProjects: this.average(peers.map(p => p._count.projects)),
        avgCustomers: this.average(peers.map(p => p._count.customers)),
        projectCompletionRate: await this.aggregateProjectCompletion(peers.map(p => p.id)),
      },
    };
  }
}
```

### 4.5 Advanced RAG — Industry Knowledge Corpus

Extends the existing `RAGPipelineService` with industry-specific knowledge seeds:

```typescript
// backend/src/modules/knowledge/industry-knowledge-corpus.ts

export const INDUSTRY_KNOWLEDGE_SEEDS: Record<string, KnowledgeSeed[]> = {
  'financial-services': [
    {
      category: 'Regulations',
      documents: [
        { title: 'SEC Rule 10b-5 Overview', url: '...', contentType: 'regulation' },
        { title: 'FINRA Compliance Guide', url: '...', contentType: 'guide' },
        { title: 'AML/KYC Best Practices', url: '...', contentType: 'best-practice' },
        { title: 'Basel III Capital Requirements Summary', url: '...', contentType: 'reference' },
      ],
    },
    {
      category: 'Industry Standards',
      documents: [
        { title: 'IFRS 17 Insurance Contracts', url: '...', contentType: 'standard' },
        { title: 'GAAP vs IFRS Comparison', url: '...', contentType: 'reference' },
        { title: 'PCI-DSS Compliance for Payment Processors', url: '...', contentType: 'checklist' },
      ],
    },
    {
      category: 'Operational Best Practices',
      documents: [
        { title: 'Client Onboarding Workflow Guide', url: '...', contentType: 'procedure' },
        { title: 'Quarterly Portfolio Review Template', url: '...', contentType: 'template' },
        { title: 'Compliance Audit Preparation Checklist', url: '...', contentType: 'checklist' },
      ],
    },
  ],
  'healthcare-life-sciences': [
    {
      category: 'Regulations',
      documents: [
        { title: 'HIPAA Privacy Rule Summary', url: '...', contentType: 'regulation' },
        { title: 'HITECH Act Compliance Guide', url: '...', contentType: 'guide' },
        { title: 'FDA Clinical Trial Guidelines', url: '...', contentType: 'guideline' },
      ],
    },
    {
      category: 'Clinical Standards',
      documents: [
        { title: 'ICD-10 Coding Reference', url: '...', contentType: 'reference' },
        { title: 'CPT Code Guidelines', url: '...', contentType: 'reference' },
        { title: 'Meaningful Use Requirements', url: '...', contentType: 'regulation' },
      ],
    },
  ],
  // ... 6 more industry groups with 10-15 knowledge seeds each
};
```

These are ingested into the pgvector RAG corpus on deployment and become the `fewShotExamples` for `ProjectShapeSynthesisService`:

```typescript
// project-shape-synthesis.service.ts — extend synthesizeShape()
async synthesizeShape(input: SynthesizeShapeInput) {
  // Stage 3 addition: Query RAG corpus before LLM call
  if (input.industryHint) {
    const corpus = await this.ragPipeline.ask({
      query: `${input.industryHint} project templates workflows`,
      industryScope: input.industryHint,  // NEW — filter by industry
      limit: 5,
    });
    // Use corpus results as few-shot examples
  }
  // ... rest of synthesis flow
}
```

### 4.6 Industry-Specific Agent Fine-Tuning

```typescript
// backend/src/modules/agents/fine-tuning/industry-agent-tuning.service.ts

@Injectable()
export class IndustryAgentTuningService {
  constructor(
    private readonly aiGateway: AiGatewayService,
    private readonly prisma: PrismaService,
  ) {}

  async getTunedSystemPrompt(
    agentTemplateSlug: string,
    industrySlug: string,
  ): Promise<string> {
    const base = await this.prisma.agentTemplate.findUnique({
      where: { slug: agentTemplateSlug },
    });
    if (!base) throw new NotFoundException('Agent template not found');

    const industryOverride = AGENT_PROMPT_OVERRIDES[agentTemplateSlug]?.[industrySlug];
    if (!industryOverride) return base.systemPrompt;

    // Merge base prompt with industry-specific context
    return `${base.systemPrompt}\n\nINDUSTRY CONTEXT:\n${industryOverride}`;
  }
}

export const AGENT_PROMPT_OVERRIDES: Record<string, Record<string, string>> = {
  'compliance-officer': {
    'financial-services': `You operate in a Financial Services context.
    - KYC/AML compliance is your primary focus
    - FINRA, SEC, and local financial regulators set your rules
    - Client due diligence and suspicious activity reporting are critical
    - Confidentiality and data protection are paramount`,
    'healthcare-life-sciences': `You operate in a Healthcare context.
    - HIPAA compliance is your primary focus
    - Patient data privacy is non-negotiable
    - Clinical trial regulations and FDA guidelines apply
    - Breach notification protocols must be followed strictly`,
    'manufacturing-industrial': `You operate in an Industrial context.
    - OSHA safety compliance is your primary focus
    - ISO 9001 and 14001 standards apply
    - Environmental regulations and waste management are key
    - Equipment safety and maintenance compliance`,
  },
  // ... more agent overrides per industry
};
```

---

### 4.7 Template Wiring — How Stage 3 Features Drive Behavior

Each Stage 3 feature must map to a consuming service. See [IMPLEMENTATION-STAGE1-FOUNDATION.md §4.7](./IMPLEMENTATION-STAGE1-FOUNDATION.md#47-template-wiring--how-templates-drive-runtime-behavior) for the wiring pattern established in Stage 1.

| Stage 3 Feature | Consumed By | How |
|---|---|---|
| Predictive models | `PredictiveAnalyticsService` (new) | Reads model from `PredictionModel[]` registry. Dispatches `predict()` per tenant industry. Results displayed in dashboard. |
| Regulatory tracking | `RegulatoryTrackingService` (new) | Reads `RegulatorySource[]` registry. Each source monitors its agency. Changes auto-update Stage 2 compliance checklists via `IndustryComplianceService`. |
| Sub-industry configs | `SubIndustryOverrideService` (new) | Reads `SUB_INDUSTRY_CONFIGS[industrySlug][subIndustrySlug]`, overrides workspace extras and agent roles per sub-industry. Consumed by `IconRail.buildRailSections()`. |
| Peer benchmarking | `BenchmarkingService` (new) | Aggregates metrics from `TenantTemplate` + project/customer data across tenants in same industry (anonymized). Exposed via dashboard. |
| Advanced RAG corpus | `RAGPipelineService` (existing) + `ProjectShapeSynthesisService` | Industry knowledge seeds ingested into pgvector. `synthesizeShape()` queries RAG before LLM call — retrieves industry-specific few-shot examples. |
| Agent prompt overrides | `IndustryAgentTuningService` (new) | Reads `AGENT_PROMPT_OVERRIDES[agentSlug][industrySlug]`, merges with base system prompt. Called by `DeploymentService.spawnFromTemplate()`. |

Each Stage 3 feature is independently deployable — wire one model/source at a time.

---

## 5. Implementation Phases

### Phase 3A: Predictive Models (Month 5, Weeks 1-2)

| Task | Files | Description |
|------|-------|-------------|
| Prediction model interface | `predictive/industry-models/prediction-model.interface.ts` | Contract for all models |
| Financial churn model | `predictive/industry-models/financial-churn.model.ts` | Train on historical engagement data |
| Healthcare no-show model | `predictive/industry-models/healthcare-noshow.model.ts` | Predict no-show probability |
| Predictive analytics service | `predictive/predictive-analytics.service.ts` | Model registry + dispatch |

### Phase 3B: Regulatory Tracking (Month 5, Weeks 3-4)

| Task | Files | Description |
|------|-------|-------------|
| Regulatory source interface | `regulatory-tracking/regulatory-source.interface.ts` | Contract for all sources |
| Financial regulatory source | `regulatory-tracking/sources/financial-regulatory.source.ts` | SEC/FINRA/PCAOB feeds |
| Healthcare regulatory source | `regulatory-tracking/sources/healthcare-regulatory.source.ts` | HIPAA/FDA/CDC feeds |
| Auto-update compliance checklists | `regulatory-tracking/regulatory-tracking.service.ts` | Wire into Stage 2 compliance engine |

### Phase 3C: Sub-Industry Specialization + Benchmarking (Month 6, Weeks 1-2)

| Task | Files | Description |
|------|-------|-------------|
| Sub-industry configs | `industry-features/sub-industry-configs.ts` | Deep specialization per industry |
| Sub-industry discriminator | Tenant.industrySubType field | Optional, admin-only editable |
| Peer benchmarking service | `benchmarking/benchmarking.service.ts` | Anonymized multi-tenant aggregation |
| Benchmarking dashboard | `frontend-tenant/src/app/intelligence/benchmarks/` | Visual comparison view |

### Phase 3D: Advanced RAG + Agent Tuning (Month 6, Weeks 3-4)

| Task | Files | Description |
|------|-------|-------------|
| Industry knowledge corpus | `knowledge/industry-knowledge-corpus.ts` | 10-15 documents per industry group |
| RAG ingest pipeline | Extend existing `RAGPipelineService` | Industry-scoped retrieval |
| Synthesis RAG wiring | `project-shape-synthesis.service.ts` | Use corpus as few-shot examples |
| Agent prompt overrides | `agents/fine-tuning/industry-agent-tuning.service.ts` | Per-industry system prompt augmentation |

---

## 6. SOLID Compliance Checklist

| Principle | How Stage 3 Satisfies It |
|-----------|--------------------------|
| **SRP** | Each prediction model handles ONE industry metric. Each regulatory source handles ONE agency. |
| **OCP** | New prediction model = new class implementing `PredictionModel`. New regulatory source = new class implementing `RegulatorySource`. Zero changes to dispatch services. |
| **LSP** | All models interchangeable via `PredictionModel` interface. All sources interchangeable via `RegulatorySource` interface. |
| **ISP** | `PredictionModel.predict()` returns only what callers need. `RegulatorySource.check()` returns only what consumers need. |
| **DIP** | `PredictiveAnalyticsService` depends on `PredictionModel[]` (constructor injection of registered models). No concrete model references. |

---

## 7. Dependencies & Sequencing

```
Stage 2 Complete (precondition)
       │
       ▼
[Phase 3A: Predictive Models]
       ├── PredictionModel Interface + Registry
       ├── Financial Churn Model
       ├── Healthcare No-Show Model (first two by demand)
       └── PredictiveAnalyticsService
       │
       ▼
[Phase 3B: Regulatory Tracking]
       ├── RegulatorySource Interface
       ├── Financial Source (SEC/FINRA/PCAOB)
       ├── Healthcare Source (HIPAA/FDA)
       └── Compliance checklist auto-update wiring
       │
       ▼
[Phase 3C: Sub-Industry + Benchmarking]
       ├── Sub-Industry Configs
       ├── Tenant.industrySubType field
       ├── PeerBenchmarkingService
       └── Benchmarking Dashboard
       │
       ▼
[Phase 3D: Advanced RAG + Agent Tuning]
       ├── Industry Knowledge Corpus (all 8 groups)
       ├── RAG ingest pipeline extension
       ├── Synthesis service RAG wiring
       └── Agent prompt override system
```

---

## 8. What Defers Beyond Stage 3

| Feature | Reason |
|---------|--------|
| Autonomous regulatory compliance (auto-file reports) | Legal liability — needs legal review |
| Full LLM fine-tuning on tenant data | Data privacy + compute cost |
| Real-time industry benchmarking (live peer data) | Infrastructure scaling |
| White-label industry solutions | Market demand dependent |
| Industry-specific mobile apps | Platform maturity dependent |

---

## 9. Cross-Reference: Stage Features by Group

| Industry Group | Stage 1 Delivers | Stage 2 Delivers | Stage 3 Delivers |
|----------------|-----------------|-----------------|-----------------|
| Financial & Compliance | Client lifecycle, 5 agents, audit/tax project types, KYC fields | Risk dashboards, KYC automation, compliance checklists, QuickBooks/ Xero integration | Churn prediction, SEC/FINRA tracking, Islamic Banking sub-specialization |
| Business & Technology | Engagement lifecycle, 5 agents, ticket/release project types, contracts | SLA monitoring, ticket auto-triage, Jira/GitHub integration, profitability dashboards | Churn prediction, capacity planning AI, SaaS specialization |
| Consumer & Commerce | Customer lifecycle, 5 agents, campaign/product project types, inventory | Demand forecasting, campaign ROI, Shopify/Square integration | CLV prediction, price optimization AI, retail sub-specialization |
| Industrial & Infra | Work order lifecycle, 5 agents, production/maintenance project types | Production dashboards, maintenance automation, ERP integration | Equipment failure prediction, production optimization AI |
| Healthcare | Patient lifecycle, 5 agents, episode/care project types, HIPAA audit log | Clinical workflow auto, no-show prediction, Epic/lab integration | Readmission prediction, FDA tracking, dental/ortho specialization |
| Public & Social | Program lifecycle, 5 agents, grant/case project types, volunteer tracking | Grant compliance, constituent portal, fund accounting | Caseload prediction, accreditation automation, multi-agency consolidation |
| Agriculture & Food | Harvest lifecycle, 5 agents, crop/livestock project types | Quality tracking, distribution dashboards, commodity integration | Yield prediction AI, climate adaptation, sustainability certification |
| Other | Portfolio lifecycle, 5 agents, entity management project types | Consolidated dashboards, governance tracking | Multi-entity tax optimization, M&A integration|

---

## 10. Note on Deployment Cadence

Stage 3 features ship independently as they mature — not as a single release. Each predictive model, regulatory source, and sub-industry config is independently deployable. The phased delivery above is an ordering suggestion, not a hard schedule.
