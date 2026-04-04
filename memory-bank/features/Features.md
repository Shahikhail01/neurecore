# Features — NeureCore Platform

## Table of Contents

- [Authentication & User Management](#authentication--user-management)
- [Tenant Management](#tenant-management)
- [AI Agents](#ai-agents)
- [Task Management](#task-management)
- [Workflow Automation](#workflow-automation)
- [Real-Time Chat](#real-time-chat)
- [Analytics & Intelligence](#analytics--intelligence)
- [CRM Integrations](#crm-integrations)
- [Finance & Billing](#finance--billing)
- [Governance & Approvals](#governance--approvals)
- [Department Management](#department-management)
- [Goals & Projects](#goals--projects)
- [Inbox & Notifications](#inbox--notifications)
- [Settings & Configuration](#settings--configuration)
- [Onboarding](#onboarding)
- [Admin Portal](#admin-portal)

---

## Authentication & User Management

### User Registration & Login

| Feature                | Description                                           |
| ---------------------- | ----------------------------------------------------- |
| **Email Registration** | Register with email, password, name                   |
| **Secure Login**       | JWT-based authentication with bcrypt password hashing |
| **Token Refresh**      | Automatic token refresh (15min access, 7d refresh)    |
| **Logout**             | Secure logout with token blacklisting                 |
| **Password Security**  | bcrypt hashing with salt rounds                       |

### User Roles & Permissions

| Role           | Access Level                            |
| -------------- | --------------------------------------- |
| SUPER_ADMIN    | Platform-wide admin (admin portal only) |
| PLATFORM_ADMIN | Platform management                     |
| OWNER          | Full tenant control                     |
| ADMIN          | Tenant management                       |
| MANAGER        | Team management                         |
| AGENT          | AI agent access                         |
| VIEWER         | Read-only access                        |

### User Features

- Profile management (first name, last name, avatar)
- Role-based access control
- User invitation system
- Team member management
- Activity tracking

---

## Tenant Management

### Multi-Tenant Architecture

| Feature             | Description                                        |
| ------------------- | -------------------------------------------------- |
| **Tenant Creation** | Create new tenants with unique slug                |
| **Tenant Plans**    | Support for Starter, Growth, Pro, Enterprise tiers |
| **Tenant Limits**   | Configurable limits for agents, users, features    |
| **Tenant Status**   | Active, Suspended, Trial, Cancelled states         |

### Tenant Features

- Tenant-specific settings and configuration
- Tenant-scoped data isolation
- Logo and branding customization
- Industry and company size selection

---

## AI Agents

### Agent Management

| Feature             | Description                                   |
| ------------------- | --------------------------------------------- |
| **Agent Creation**  | Create AI agents with custom prompts          |
| **Agent Templates** | Pre-built templates for common use cases      |
| **Agent Types**     | Functional, Conversational, Task-oriented     |
| **Model Selection** | Choose LLM (GPT-4, Claude, DeepSeek, MiniMax) |
| **System Prompts**  | Custom system instructions                    |
| **Agent Status**    | Idle, Active, Executing states                |

### Agent Execution

| Feature                 | Description                      |
| ----------------------- | -------------------------------- |
| **Task Execution**      | Execute agents on specific tasks |
| **Streaming Responses** | Real-time token streaming        |
| **Execution History**   | View past agent runs             |
| **Memory Management**   | Agent memory with vector storage |
| **Tool Integration**    | Connect agents to various tools  |

### Built-in Agent Tools

| Tool                      | Status    | Function                              |
| ------------------------- | --------- | ------------------------------------- |
| **Calculator**            | ✅ Active | Mathematical expressions evaluation   |
| **Calculator Enhanced**   | ✅ Active | Advanced calculations with validation |
| **Database Query**        | ✅ Active | Read-only SQL queries                 |
| **Document Summary**      | ✅ Active | Document summarization                |
| **Email Send**            | ✅ Active | Send emails                           |
| **HTTP Request**          | ✅ Active | Make HTTP API calls                   |
| **HTTP Request Enhanced** | ✅ Active | HTTP with structured output           |
| **Web Search**            | ✅ Active | Search the web                        |
| **Agent Messaging**       | ✅ Active | Inter-agent communication             |
| **Calendar Management**   | ✅ Active | Google Calendar, Outlook integration  |
| **Task Management**       | ✅ Active | Task creation, assignment, tracking   |
| **CRM Integration**       | ✅ Active | Salesforce, HubSpot, Pipedrive sync   |
| **Spreadsheet**           | ✅ Active | Google Sheets, Excel API              |
| **Document Creation**     | ✅ Active | Word, PDF generation                  |
| **Social Media API**      | ✅ Active | Meta, LinkedIn, Twitter posting       |
| **Knowledge Base**        | ✅ Active | KB article retrieval and search       |
| **Vector Search**         | ✅ Active | pgvector semantic search              |
| **Code Deployment**       | ✅ Active | Vercel, Netlify CI/CD                 |
| **Alerting**              | ✅ Active | PagerDuty, Slack, email alerts        |
| **Banking API**           | ✅ Active | Payment processing, transactions      |
| **Maps API**              | ✅ Active | Geocoding, routing, place search      |

### Agent Capabilities

- Natural language understanding
- Structured output (Zod schema validation)
- Multi-step task execution
- Tool chaining
- LangGraph workflow support

---

## Task Management

### Task Features

| Feature               | Description                                            |
| --------------------- | ------------------------------------------------------ |
| **Task Creation**     | Create tasks with title, description, priority         |
| **Task Assignment**   | Assign tasks to users or agents                        |
| **Task Status**       | Track status (Pending, In Progress, Completed, Failed) |
| **Task Priorities**   | Low, Medium, High, Urgent                              |
| **Task Comments**     | Add comments and notes                                 |
| **Task Dependencies** | Define task relationships                              |

### Task Operations

- Create, read, update, delete tasks
- Bulk operations
- Filtering and sorting
- Search functionality
- Due date management

---

## Workflow Automation

### Workflow Builder

| Feature                | Description                          |
| ---------------------- | ------------------------------------ |
| **Visual Builder**     | Create workflows with drag-and-drop  |
| **Workflow Steps**     | Define sequential and parallel steps |
| **Step Types**         | Trigger, Action, Condition, Loop     |
| **Triggers**           | Manual, scheduled, event-based       |
| **Workflow Templates** | Pre-built workflow patterns          |

### Workflow Execution

| Feature                | Description                         |
| ---------------------- | ----------------------------------- |
| **Execution Engine**   | Run workflows with state management |
| **Real-time Progress** | Track workflow execution            |
| **Error Handling**     | Automatic retry and fallback        |
| **Execution History**  | View past runs and logs             |
| **Branching Logic**    | Conditional workflow paths          |

### Routine Automation

| Feature               | Description               |
| --------------------- | ------------------------- |
| **Scheduled Tasks**   | Run routines on schedule  |
| **Trigger Types**     | Time-based, event-based   |
| **Routine Runs**      | Track routine executions  |
| **Routine Templates** | Reusable routine patterns |

---

## Real-Time Chat

### Chat Features

| Feature               | Description                     |
| --------------------- | ------------------------------- |
| **Conversations**     | Create and manage conversations |
| **Messages**          | Send and receive messages       |
| **Real-time Updates** | WebSocket-based live messaging  |
| **Message History**   | Persistent chat history         |
| **Typing Indicators** | Show when user is typing        |

### WebSocket Events

| Event              | Description                    |
| ------------------ | ------------------------------ |
| **Connection**     | Establish WebSocket connection |
| **Ping/Pong**      | Keep-alive heartbeat           |
| **User Status**    | Online/away/offline presence   |
| **Message Events** | Send and receive messages      |
| **Agent Updates**  | Real-time agent state changes  |

### Chat Capabilities

- Tenant-scoped conversations
- User-to-user messaging
- Agent-to-user interaction
- Message persistence

---

## Analytics & Intelligence

### Analytics Features

| Feature                | Description                     |
| ---------------------- | ------------------------------- |
| **Dashboard Metrics**  | View key performance indicators |
| **Data Visualization** | Charts, graphs, dashboards      |
| **Trend Analysis**     | Track metrics over time         |
| **Forecasting**        | Predictive analytics            |
| **Anomaly Detection**  | Identify unusual patterns       |

### Analytics Models

| Model                 | Purpose                              |
| --------------------- | ------------------------------------ |
| **Score Models**      | Calculate scores for various metrics |
| **Forecast Models**   | Predict future values                |
| **Anomaly Detection** | Detect outliers                      |
| **Feature Store**     | Feature engineering and storage      |

### AI-Powered Analytics

- Machine learning model integration
- Custom model execution
- Feature extraction
- Data preprocessing pipeline

---

## CRM Integrations

### Supported Integrations

| Integration    | Status      |
| -------------- | ----------- |
| **HubSpot**    | Implemented |
| **Salesforce** | Implemented |
| **Pipedrive**  | Implemented |

### Connector Features

| Feature               | Description                         |
| --------------------- | ----------------------------------- |
| **OAuth Connection**  | Secure OAuth 2.0 authentication     |
| **Token Management**  | Automatic token refresh             |
| **Data Sync**         | Bi-directional data synchronization |
| **Sync Scheduling**   | Configurable sync intervals         |
| **Connection Status** | Monitor connection health           |

### Integration Capabilities

- Contact synchronization
- Deal tracking
- Activity logging
- Custom field mapping

---

## Finance & Billing

### Billing Features

| Feature                | Description                    |
| ---------------------- | ------------------------------ |
| **Invoice Generation** | Create and manage invoices     |
| **Invoice Tracking**   | Track payment status           |
| **Expense Tracking**   | Record and categorize expenses |
| **Billing Events**     | Track all billing activities   |

### Cost Management

| Feature               | Description                 |
| --------------------- | --------------------------- |
| **Cost Tracking**     | Track API and model costs   |
| **Provider Tracking** | Per-provider cost breakdown |
| **Token Usage**       | Input/output token counts   |
| **Cost Forecasting**  | Predict future costs        |

### Budget Management

| Feature              | Description                |
| -------------------- | -------------------------- |
| **Budget Policies**  | Set spending limits        |
| **Budget Alerts**    | Notify on threshold breach |
| **Budget Incidents** | Track budget violations    |
| **Spending Caps**    | Enforce spending limits    |

---

## Governance & Approvals

### Approval Workflow

| Feature               | Description                  |
| --------------------- | ---------------------------- |
| **Approval Requests** | Create approval requests     |
| **Approval Rules**    | Define approval criteria     |
| **Approval Status**   | Pending, Approved, Rejected  |
| **Approval History**  | Track all approval decisions |

### Governance Rules

| Feature                 | Description                |
| ----------------------- | -------------------------- |
| **Rule Creation**       | Define governance rules    |
| **Rule Enforcement**    | Automatic rule application |
| **Compliance Tracking** | Monitor compliance status  |

---

## Department Management

### Department Features

| Feature                    | Description                              |
| -------------------------- | ---------------------------------------- |
| **Department CRUD**        | Create, read, update, delete departments |
| **Department Templates**   | Pre-built department structures          |
| **Department Hierarchy**   | Organizational hierarchy                 |
| **Department Assignments** | Assign users to departments              |

### Templates

- Platform-level department templates
- Tenant-specific templates
- Template deployment to tenants

---

## Goals & Projects

### Goal Management

| Feature           | Description                 |
| ----------------- | --------------------------- |
| **Goal Creation** | Define goals with targets   |
| **Goal Tracking** | Monitor progress            |
| **Goal Status**   | Active, Completed, Archived |
| **Goal关联**      | Link to projects and tasks  |

### Project Management

| Feature              | Description                  |
| -------------------- | ---------------------------- |
| **Project Creation** | Create projects with details |
| **Project Status**   | Track project lifecycle      |
| **Project Team**     | Assign team members          |
| **Project Goals**    | Link to organizational goals |

---

## Inbox & Notifications

### Inbox Features

| Feature                 | Description                       |
| ----------------------- | --------------------------------- |
| **Notification Inbox**  | Central notification hub          |
| **Notification Types**  | Different notification categories |
| **Notification Status** | Read/unread/archived              |
| **Real-time Delivery**  | Instant notification delivery     |

### Notification Channels

| Channel    | Description                               |
| ---------- | ----------------------------------------- |
| **In-App** | In-platform notifications                 |
| **Toast**  | Temporary pop-up notifications            |
| **Email**  | Email notifications (via email-send tool) |

### Notification Services

- Priority-based delivery
- Notification queuing
- Delivery confirmation

---

## Settings & Configuration

### Tenant Settings

| Feature                      | Description                       |
| ---------------------------- | --------------------------------- |
| **General Settings**         | Tenant name, logo, timezone       |
| **Security Settings**        | 2FA, session policy, IP allowlist |
| **Integration Settings**     | Configure integrations            |
| **Notification Preferences** | User notification preferences     |

### Platform Settings (Admin)

| Feature            | Description                       |
| ------------------ | --------------------------------- |
| **AI Settings**    | Configure AI models and providers |
| **Tier Settings**  | Manage subscription tiers         |
| **Email Settings** | Configure email templates         |
| **Audit Settings** | Audit log configuration           |

---

## Onboarding

### Onboarding Wizard

The platform includes a 9-step onboarding wizard for new tenant setup:

| Step | Feature          | Description                            |
| ---- | ---------------- | -------------------------------------- |
| 1    | **Organization** | Company name, industry, size, timezone |
| 2    | **Admin**        | Admin user profile setup               |
| 3    | **Plan**         | Select billing tier/plan               |
| 4    | **Departments**  | Create organizational departments      |
| 5    | **Team**         | Invite team members                    |
| 6    | **Integrations** | Configure integrations                 |
| 7    | **Agents**       | Configure AI agents                    |
| 8    | **Security**     | Set security policies                  |
| 9    | **Review**       | Review and complete setup              |

### Wizard Features

- Step-by-step guidance
- Progress persistence (Redis session)
- Idempotent completion
- Skip certain steps (deploy directly)

---

## Admin Portal

### Platform Administration

| Feature                | Description                 |
| ---------------------- | --------------------------- |
| **Tenant Management**  | View and manage all tenants |
| **Tenant Deployment**  | Deploy templates to tenants |
| **Platform Analytics** | Cross-tenant metrics        |

### Tier Management

| Feature             | Description                   |
| ------------------- | ----------------------------- |
| **Tier CRUD**       | Create, edit, toggle tiers    |
| **Feature Control** | Define tier features          |
| **Pricing**         | Set pricing and billing cycle |
| **Agent Pools**     | Configure agent allocation    |

### Agent Template Management

| Feature                 | Description                     |
| ----------------------- | ------------------------------- |
| **Template CRUD**       | Create platform agent templates |
| **Template Types**      | Platform vs tenant templates    |
| **Template Deployment** | Deploy to specific tenants      |

### Monitoring & Analytics

| Feature              | Description                   |
| -------------------- | ----------------------------- |
| **Platform KPIs**    | Global platform metrics       |
| **Tenant Analytics** | Per-tenant statistics         |
| **Agent Fleet View** | Cross-tenant agent monitoring |
| **Usage Metrics**    | Platform-wide usage data      |

### Platform Security

| Feature                   | Description                       |
| ------------------------- | --------------------------------- |
| **Security Policies**     | Platform-wide security settings   |
| **Password Requirements** | Configure password rules          |
| **2FA Enforcement**       | Require two-factor authentication |
| **Audit Logs**            | View platform-wide audit logs     |

---

## Voice & Input Features

### Voice Commands

| Feature             | Description                        |
| ------------------- | ---------------------------------- |
| **Voice Input**     | Accept voice commands              |
| **Voice Analytics** | Log and analyze voice interactions |
| **Voice Profiles**  | User voice profile management      |

### Command Palette

| Feature              | Description                       |
| -------------------- | --------------------------------- |
| **Quick Actions**    | Keyboard-driven command execution |
| **Command Registry** | Central command management        |
| **Command History**  | Track executed commands           |

---

## Additional Features

### AI Chat

| Feature               | Description                |
| --------------------- | -------------------------- |
| **Conversational AI** | AI-powered chat interface  |
| **Chat History**      | Persistent chat sessions   |
| **AI Responses**      | Context-aware AI responses |

### Reporting

| Feature               | Description                 |
| --------------------- | --------------------------- |
| **Report Builder**    | Create custom reports       |
| **Export Options**    | CSV, JSON export formats    |
| **Scheduled Reports** | Automated report generation |

### API Access

| Feature               | Description                  |
| --------------------- | ---------------------------- |
| **API Keys**          | Generate and manage API keys |
| **API Documentation** | RESTful API access           |
| **Rate Limiting**     | API access controls          |

---

_Last Updated: April 4, 2026_
_Document Version: 1.1 (12 new agent tools added)_
