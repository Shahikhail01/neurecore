NeuroCore Enterprise Integration Architecture Audit & Remediation Directive
Mission
Perform a comprehensive cross-capability integration architecture audit of NeuroCore, then create a constitutionally compliant, phased remediation and implementation plan.
This is NOT a feature-development exercise.
This is NOT a request to patch the individual findings from the Enterprise Simulation one by one.
The enterprise simulation demonstrated that NeuroCore has substantial vertical capabilities, but the end-to-end organizational behaviour connecting those capabilities is not operationally proven.
The central architectural question is:
Are NeuroCore’s enterprise capabilities already designed to operate as one digital organization but their integration contracts are incomplete or incorrectly implemented, or are critical cross-capability architectural bridges missing from the system design?
You must answer this question before implementing fixes.

1. Governing Authority
The NeuroCore Architectural Constitution is the highest architectural authority.
All analysis, recommendations, and implementation decisions must comply with it.
Particular attention must be given to constitutional principles governing:
    • Enterprise Before Features
    • Enterprise Information Engine
    • Continuous Discovery
    • AI Employees are Employees
    • Human-AI Collaboration
    • Hermes as the Organizational Interface
    • Organizational Memory
    • Governance Before Automation
    • Progressive Autonomy
    • Capability-Based Architecture
    • Event-Driven Organization
    • Enterprise Learning Loop
    • Digital Workforce
    • Business Intelligence Everywhere
    • Dependency boundaries
    • Enterprise ownership of information
Do NOT modify constitutional principles to accommodate the current implementation.
Do NOT introduce shortcuts that violate the Constitution merely to make the simulation pass.
If the existing architecture conflicts with the Constitution, explicitly identify the conflict.

2. Evidence From Enterprise Simulation
Treat the latest NeuroCore Enterprise Simulation findings and RUN A/RUN B reports as primary behavioural evidence.
The simulation established:
    • Tenant and enterprise entity CRUD works.
    • Project creation from a Project Type is browser-accessible.
    • Project lifecycle transitions from LEAD to ACTIVE work.
    • Hermes AI chat is operational.
    • Hermes has limited organizational visibility.
    • Hermes can observe some task/workflow and agent information but lacks reliable project/customer/finance context.
    • Hermes encountered a LangGraph recursion limit during an organizational query.
    • EIE project integration endpoints return 404.
    • Project Types do not operationally resolve Question Packs in the project Discovery workflow.
    • AI-to-AI organizational collaboration could not be demonstrated.
    • Human governance of AI work through a complete approval lifecycle could not be demonstrated.
    • Project financial state is not operationally reflected in tenant finance.
    • Event-driven downstream organizational reactions could not be demonstrated.
    • Socket.IO real-time behaviour is broken.
    • Organizational memory based on simulation-created facts could not be proven.
    • Google OAuth initiation appears correctly wired, but operational Workspace execution remains blocked pending successful consent.
Do not assume these are isolated bugs.
Investigate whether they reveal a shared architectural integration problem.

3. Primary Audit Scope
Audit the integration architecture between:
    1. Enterprise Information Engine
    2. Projects
    3. Hermes
    4. AI Employees / Digital Workforce
    5. Communications
    6. Enterprise Events
    7. Approvals and Governance
    8. Tenant Finance
    9. Organizational Memory
    10. Google Workspace
    11. Tasks and Workflows
    12. Timeline and Scheduling capabilities
The objective is to trace how these capabilities are intended to operate together.

4. Mandatory Audit Method
Before modifying code, inspect the actual codebase.
For every capability identify:
    • Module boundary
    • Bounded context
    • Domain ownership
    • Primary entities
    • Public interfaces
    • Application services
    • Domain services
    • Adapters
    • Ports
    • Controllers
    • Event publishers
    • Event consumers
    • Message handlers
    • Background workers
    • Queues
    • Scheduled jobs
    • AI tools
    • Hermes tools
    • Repository dependencies
    • Direct database dependencies
    • Cross-module imports
    • Shared abstractions
    • Frontend API clients
    • Browser routes
    • Feature flags
    • Configuration dependencies
Do not rely on filenames alone.
Trace runtime execution paths.

5. Build a Cross-Capability Integration Map
Create a complete integration map.
At minimum map:
    • Project Type → EIE
    • Project → EIE
    • EIE → Continuous Discovery
    • Project → Tasks
    • Project → AI Employees
    • Project → Finance
    • Project → Approvals
    • Project → Memory
    • Project → Google Workspace
    • Project → Timeline
    • Event Bus → AI Employees
    • Event Bus → Hermes
    • Event Bus → Finance
    • Event Bus → Memory
    • Event Bus → Continuous Discovery
    • Comms → AI Employees
    • AI Employee → Comms
    • AI Employee → AI Employee
    • AI Employee → Approval
    • AI Employee → Enterprise Capabilities
    • Hermes → Organizational Context
    • Hermes → Enterprise Capabilities
    • Approval Decision → AI Employee
    • Finance Exception → AI Employee
    • Timeline Event → AI Employee
    • Workspace Event → Organizational Context
    • Completed Work → Organizational Memory
For every relationship classify it as:
    • OPERATIONAL
    • DESIGNED BUT INCOMPLETE
    • IMPLEMENTED BUT MISWIRED
    • DUPLICATED
    • BYPASSED
    • MISSING CONTRACT
    • MISSING CONSUMER
    • MISSING PRODUCER
    • ARCHITECTURALLY ABSENT
    • CONSTITUTIONALLY INVALID
Provide code evidence for every classification.

6. Determine the Integration Failure Pattern
Explicitly determine whether NeuroCore currently suffers primarily from:
Pattern A — Incomplete Implementation
The correct integration contracts exist architecturally but were not completed.
Pattern B — Miswired Implementation
The required services and contracts exist but runtime routes, adapters, consumers, or registrations are incorrect.
Pattern C — Capability Islands
Capabilities were independently implemented without sufficient cross-capability contracts.
Pattern D — Orchestration Fragmentation
Multiple modules independently orchestrate enterprise behaviour without a coherent organizational execution model.
Pattern E — Context Fragmentation
Hermes and AI Employees receive different, incomplete, or capability-specific views of organizational state.
Pattern F — Event Fragmentation
Events are emitted but are not durably routed to appropriate organizational consumers.
Pattern G — Mixed Failure
A combination of the above.
Select the dominant pattern and provide evidence.
Do not use vague language such as “integration needs improvement.”

7. Audit the Organizational Context Plane
The Enterprise Simulation showed Hermes could observe agents, tasks, and workflows but lacked reliable project/customer/finance context.
Investigate exactly how organizational context is assembled.
Trace:
User request → Hermes → AI Gateway → LangGraph → Context assembly → Tool selection → Enterprise capability → Response
Determine:
    • Which tenant data is loaded.
    • Which capabilities contribute context.
    • Whether context is statically assembled.
    • Whether Hermes queries capabilities dynamically.
    • Whether project context is available.
    • Whether customer context is available.
    • Whether finance context is available.
    • Whether communication history is available.
    • Whether approvals are available.
    • Whether organizational memory is available.
    • Whether context respects tenant isolation.
    • Whether context respects employee authority and data access.
Determine whether NeuroCore needs a formal Organizational Context Plane.
Do NOT create a global database query service.
If a Context Plane is required, design it using ports, adapters, capability-owned context providers, authorization, tenant isolation, provenance, and bounded context ownership.
The Context Plane must aggregate context.
It must not own capability data or business logic.

8. Audit the AI Employee Runtime
Determine how an AI Employee currently receives and performs work.
Trace the actual runtime.
The required conceptual lifecycle is:
Event or Work Request → AI Employee Awareness → Identity and Role Resolution → Organizational Context Acquisition → Goal / Responsibility Evaluation → Authority and Autonomy Evaluation → Capability Selection → Work Execution → Communication or Work Output → Approval / Escalation if Required → Resulting Enterprise Event → Memory / Learning where permitted
For every step identify:
    • Existing implementation
    • Responsible module
    • Interface
    • Missing implementation
    • Constitutional implications
Determine whether NeuroCore currently has an actual AI Employee Work Runtime or merely AI agents that can be invoked.
This distinction must be explicitly answered.
Do not treat Hermes chat as proof of an AI Employee runtime.

9. Audit AI-to-AI Work Handoffs
Trace how one AI Employee is expected to assign or request work from another AI Employee.
Determine whether the system supports:
    • Sender identity
    • Recipient identity
    • Department
    • Role
    • Work request
    • Organizational context
    • Customer context
    • Project context
    • Correlation ID
    • Thread continuity
    • Authority
    • Expected output
    • Deadline
    • Receiver awareness
    • Work execution
    • Reply
    • Resulting event
    • Subsequent use of the response
Determine whether Comms is:
    • Merely messaging infrastructure, or
    • A real organizational work transport.
Do not implement AI-to-AI collaboration as direct agent-to-agent function calls.
AI Employees must remain identifiable organizational actors.
Their work must be observable and auditable.

10. Audit Event Architecture
Separate these concepts:
    1. Domain events
    2. Enterprise events
    3. Integration events
    4. UI real-time events
    5. Socket.IO notifications
Do not treat Socket.IO as the enterprise event architecture.
Trace at least these business events:
    • CustomerCommunicationReceived
    • ProjectCreated
    • InformationResponseRecorded
    • InformationCompletenessChanged
    • ProjectStageChanged
    • TaskAssigned
    • WorkRequested
    • AIWorkCompleted
    • ApprovalRequested
    • ApprovalRejected
    • ApprovalGranted
    • ProjectBudgetChanged
    • ExpenseThresholdExceeded
    • TimelineChanged
    • DeadlineApproaching
    • DeadlineMissed
    • WorkspaceDocumentCreated
For each determine:
    • Producer
    • Event contract
    • Persistence
    • Transport
    • Consumer
    • Retry behaviour
    • Idempotency
    • Dead-letter handling
    • Tenant boundary
    • Correlation
    • Auditability
Identify events that exist without consumers.
Identify consumers with no reliable producers.
Identify silent state changes that should generate enterprise events.

11. Audit EIE Runtime Integration
The EIE is the first critical remediation dependency.
Trace:
Project Type → Capabilities → Question Packs → Information Requirements → Applicability → Adaptive Questioning → Information Response → Information Source → Confidence → Completeness → Supersession → Continuous Discovery
Determine why:
    • Information requirement endpoints return 404.
    • next-question returns 404.
    • Discovery displays 0/0.
    • Project Types do not resolve Question Packs.
Determine whether the problem is:
    • Route registration
    • Controller path
    • Frontend API contract
    • Adapter registration
    • Project consumer implementation
    • Capability Pack linking
    • Seed data
    • Resolver logic
    • Tenant filtering
    • Version mismatch
    • Missing runtime implementation
Do NOT create project-specific information tables or duplicate EIE logic inside Projects.
Projects must consume EIE through constitutionally valid interfaces.

12. Audit Governance and Approvals
Determine how enterprise capabilities request approval.
Trace:
Proposed Action → Risk Evaluation → Authority Evaluation → Autonomy Policy → Approval Requirement → Approval Request → Human Approver → Decision → Decision Event → Original Actor Awareness → Revision or Continuation
Determine why the approval UI exists but no operational workflow produces approval requests.
Determine whether approvals are:
    • A standalone CRUD capability, or
    • Integrated into enterprise execution.
Design the integration contract required for any capability or AI Employee to request governed approval without importing approval business logic.

13. Audit Project and Tenant Finance Integration
Trace:
Project Budget → Financial Commitment → Expense → Invoice → Revenue → Tenant Finance → Finance AI Employee → Exception Detection → Approval → Enterprise Event
Determine why a project can contain a $75,000 budget while tenant finance reports zero financial activity.
Do not automatically assume a project budget must create an accounting transaction.
Define the correct domain semantics.
Explicitly distinguish:
    • Planned budget
    • Financial commitment
    • Actual expense
    • Invoice
    • Revenue
    • Cash movement
Then define the constitutionally correct integration events and contracts.

14. Audit Organizational Memory
Determine how organizational facts become memory.
Trace:
Enterprise Activity → Event / Information / Decision / Communication → Memory Candidate → Provenance → Retention Policy → Memory Storage → Retrieval → Organizational Context → Hermes / AI Employee Usage
Determine whether current memory is:
    • Manually entered records
    • Vector retrieval
    • Event-derived knowledge
    • Project-specific memory
    • Enterprise-wide organizational memory
Do not create a second enterprise database disguised as memory.
Memory must preserve provenance and capability ownership.

15. Audit Google Workspace as an Enterprise Capability
Do not focus on OAuth unless OAuth itself is defective.
Assume successful manual tenant authorization can be provided.
Audit how:
    • Gmail messages enter organizational workflows.
    • Gmail identity maps to customers or contacts.
    • Documents relate to projects.
    • Sheets relate to financial or operational work.
    • Slides consume enterprise information.
    • Drive files preserve entity relationships.
    • Calendar events affect timelines and employee awareness.
Determine whether Google Workspace is currently a set of API tools or an integrated enterprise capability.

16. SOLID and Dependency Audit
Explicitly inspect for violations of:
    • Single Responsibility Principle
    • Open/Closed Principle
    • Liskov Substitution Principle
    • Interface Segregation Principle
    • Dependency Inversion Principle
Pay particular attention to:
    • Projects importing EIE internals.
    • Hermes importing capability repositories.
    • AI runtime directly querying Prisma.
    • Finance depending on Projects.
    • Memory becoming a shared dumping ground.
    • Comms containing AI business logic.
    • Event consumers directly modifying foreign bounded-context tables.
    • Controllers orchestrating enterprise workflows.
    • Frontend compensating for missing backend integration.
Identify every cross-capability direct repository or Prisma dependency.
Classify each as valid or invalid.

17. No Quick-Patch Rule
You are explicitly prohibited from solving the simulation findings by:
    • Adding ad hoc project-specific endpoints.
    • Duplicating EIE logic inside Projects.
    • Giving Hermes unrestricted Prisma access.
    • Giving AI Employees direct database access.
    • Direct agent-to-agent function calls.
    • Hardcoding AI Employee IDs.
    • Hardcoding department relationships.
    • Creating one giant orchestration service.
    • Making Comms responsible for enterprise business logic.
    • Making the event bus responsible for business logic.
    • Using Socket.IO as durable event transport.
    • Creating fake finance records merely to synchronize project budgets.
    • Pre-seeding memory answers to pass recall tests.
    • Bypassing approval policies.
    • Silently using database writes to make browser workflows pass.
If an existing implementation already uses one of these patterns, report it.

18. Required Audit Deliverable
Before changing code, create:
plans/enterprise-integration-architecture-audit.md
The document must contain:
    1. Executive Assessment
    2. Dominant Integration Failure Pattern
    3. Current Cross-Capability Architecture
    4. Integration Relationship Matrix
    5. Organizational Context Plane Analysis
    6. AI Employee Runtime Analysis
    7. AI-to-AI Work Handoff Analysis
    8. Event Architecture Analysis
    9. EIE Runtime Integration Analysis
    10. Governance and Approval Analysis
    11. Project-Finance Integration Analysis
    12. Organizational Memory Analysis
    13. Google Workspace Integration Analysis
    14. SOLID and Dependency Violations
    15. Constitutional Risks
    16. Root Cause Findings
    17. Architecture Decision Requirements
    18. Recommended Target Integration Architecture
For every finding include:
    • Finding ID
    • Capability or relationship
    • Current behaviour
    • Code evidence
    • Runtime evidence
    • Root cause
    • Classification
    • Severity
    • Constitutional article affected
    • SOLID principle affected
    • Recommended architectural correction
Do not implement remediation until this audit is complete.

19. Required Remediation Plan
After completing the architecture audit, create:
plans/enterprise-integration-remediation-plan.md
The remediation plan must be dependency ordered.
Use these phases unless the audit provides strong architectural evidence requiring a different order:
Phase 0 — Architectural Decisions and Contracts
Define missing cross-capability contracts, ports, event contracts, and ownership boundaries.
Phase 1 — EIE Runtime Integration
Restore Project Type → EIE → Discovery → Continuous Discovery.
Phase 2 — Organizational Context Plane
Provide authorized, provenance-aware organizational context to Hermes and AI Employees.
Phase 3 — AI Employee Work Runtime
Implement the employee work lifecycle.
Phase 4 — Communications and AI-to-AI Work Transport
Enable observable, auditable employee work handoffs.
Phase 5 — Governance and Approval Integration
Integrate authority, autonomy, risk, approval, rejection, revision, and continuation.
Phase 6 — Durable Enterprise Event Reactions
Wire producers and consumers and establish reliable organizational reactions.
Phase 7 — Project and Tenant Finance Integration
Implement correct financial semantics and event-based integration.
Phase 8 — Organizational Memory Integration
Derive organizational knowledge from real enterprise activity with provenance.
Phase 9 — Google Workspace Enterprise Workflows
Integrate Gmail, Docs, Sheets, Slides, Drive, and Calendar into organizational workflows.
Phase 10 — Browser Workflow Completion
Expose missing operational actions through constitutionally valid UI workflows.
Phase 11 — Full NESP Re-Execution
Run the NeuroCore Enterprise Verification Protocol again from a clean mock tenant.
For every phase specify:
    • Objective
    • Constitutional basis
    • Root cause addressed
    • Modules affected
    • Interfaces to create or modify
    • Events to create or consume
    • Database changes, if genuinely required
    • Migration requirements
    • Backend changes
    • Frontend changes
    • Tests
    • Architectural tests
    • Browser acceptance tests
    • Entry criteria
    • Exit criteria
    • Regression risks
    • Dependencies

20. Architecture Decision Records
If the audit determines that any of the following do not currently exist as coherent architectural concepts, create proposed ADRs:
    • Organizational Context Plane
    • AI Employee Work Runtime
    • Enterprise Work Request Contract
    • AI-to-AI Work Handoff
    • Enterprise Event Taxonomy
    • Capability Approval Port
    • Project-Finance Integration Contract
    • Organizational Memory Ingestion Contract
Do not silently introduce these as implementation details.
They are enterprise architecture decisions.

21. Implementation Instruction
After producing both audit and remediation documents:
STOP.
Do not modify production code.
Report:
    1. The dominant integration failure pattern.
    2. Whether the existing Constitution remains architecturally viable.
    3. Whether the existing bounded contexts can be preserved.
    4. Whether major redesign is required.
    5. The five highest-risk integration gaps.
    6. The recommended remediation sequence.
    7. Any ADRs requiring approval before implementation.
The purpose of this stage is architectural diagnosis.
Implementation begins only after the audit and remediation plan have been reviewed and explicitly approved.

Final Question
The audit must ultimately answer:
Does NeuroCore already possess the correct architectural foundations for a coherent AI-native digital organization and merely require cross-capability integration remediation, or are fundamental architectural concepts missing that require constitutional or structural redesign?
Answer with evidence from the actual codebase and the Enterprise Simulation.
Do not optimize for a positive conclusion.
Do not optimize for passing the previous test.
Determine the architectural truth.