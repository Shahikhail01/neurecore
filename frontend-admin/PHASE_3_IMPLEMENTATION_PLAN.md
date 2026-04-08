# Phase 3: Frontend Infrastructure & Admin Dashboard

**Weeks 13-18 (6 weeks) - Frontend Admin with Ant Design Integration**

---

## Executive Summary

**Phase 3 builds the admin dashboard UI** connecting to Phase 2's JWT authentication backend. Implements agent management, task oversight, and real-time dashboards using Ant Design 5.24.2.

| Metric        | Value                                   |
| ------------- | --------------------------------------- |
| Duration      | 6 weeks (Weeks 13-18)                   |
| Files Created | 35-40 production files                  |
| Lines of Code | ~4,500 lines                            |
| Components    | 25 Ant Design components                |
| Pages         | 8 main pages                            |
| Complexity    | High (state management, real-time sync) |
| Status        | Planning → Implementation               |

---

## Phase 3 Scope: 2-Track Parallel Development

### **Track A: Authentication UI (Weeks 13-14)**

Frontend login/logout/password reset connected to Phase 2 JWT backend

### **Track B: Dashboard & Agent Management (Weeks 15-18)**

Admin interface for agents, tasks, approvals, analytics

---

## Week 13: Authentication UI Foundation

### Deliverables

```
src/pages/
  ├── LoginPage.tsx           (150 lines) - Email/password form
  ├── RegisterPage.tsx        (140 lines) - Registration flow
  ├── ForgotPasswordPage.tsx  (120 lines) - Password reset request
  ├── ResetPasswordPage.tsx   (130 lines) - Token-based reset

src/components/Auth/
  ├── LoginForm.tsx           (100 lines) - Reusable form component
  ├── PasswordField.tsx       (80 lines)  - Password strength indicator
  └── OAuthButtons.tsx        (70 lines)  - Social login (future)

src/hooks/
  ├── useAuth.ts             (120 lines) - Auth context + methods
  ├── useLogin.ts            (90 lines)  - Login logic
  ├── usePasswordReset.ts    (100 lines) - Reset flow

src/services/
  ├── authService.ts         (150 lines) - API calls to Phase 2 backend
  ├── tokenStorage.ts        (80 lines)  - Secure token management

src/store/
  └── authSlice.ts           (120 lines) - Redux/Zustand auth state

src/contexts/
  └── AuthContext.tsx        (100 lines) - Global auth provider
```

**Key Features:**

- ✅ Login with email/password → Phase 2 JWT endpoint
- ✅ Token refresh auto-handling (background)
- ✅ Secure token storage (localStorage + memory for access token)
- ✅ Session timeout with warning
- ✅ Password strength meter (Real-time)
- ✅ Registration with tenant ID
- ✅ Password reset flow (request → token → new password)
- ✅ Remember me (optional, 30-day refresh token)
- ✅ Error handling + retry logic

**Technical Stack:**

- UI: Ant Design 5.24.2 (Form, Input, Button, Modal, Message)
- State: Zustand or Redux (your preference)
- HTTP: axios with JWT interceptor
- Styling: Tailwind CSS + Ant Design theme

---

## Week 14: Auth Guards & Protected Routes

### Deliverables

```
src/components/
  ├── ProtectedRoute.tsx      (60 lines)  - Route guard wrapper
  ├── AuthGuard.tsx           (50 lines)  - HOC for protected components
  └── SessionWarning.tsx      (80 lines)  - Session timeout modal

src/middleware/
  ├── axiosInterceptor.ts    (100 lines) - JWT + error handling
  └── tokenRefresh.ts        (120 lines) - Auto-refresh logic

src/pages/
  ├── UnauthorizedPage.tsx   (50 lines)  - 401 error page
  └── SessionExpiredPage.tsx (60 lines)  - Session timeout page
```

**Key Logic:**

```typescript
// ProtectedRoute Example
<ProtectedRoute
  path="/dashboard"
  requiredRole="admin"
  fallback={<LoginPage />}
>
  <AdminDashboard />
</ProtectedRoute>

// Auto-refresh on 401
// Refresh token stored in httpOnly cookie (from Phase 2)
// New access token obtained silently
// Request retried
```

**Features:**

- ✅ Route-level role checking (admin, agent_manager, task_approver, viewer)
- ✅ Component-level permission checks (@Roles decorator equivalent)
- ✅ Automatic token refresh on expiry (transparent to user)
- ✅ Session timeout warning (5-min before logout)
- ✅ Global auth error handling
- ✅ Redirect to login on 401

---

## Week 15: Dashboard Layout & Navigation

### Deliverables

```
src/layouts/
  ├── AdminLayout.tsx        (180 lines) - Main layout + sidebar
  ├── Header.tsx             (120 lines) - Top nav with user menu
  ├── Sidebar.tsx            (150 lines) - Navigation menu
  └── BreadcrumbNav.tsx      (60 lines)  - Route breadcrumbs

src/pages/
  └── DashboardHome.tsx      (200 lines) - Welcome + metrics

src/components/
  ├── StatCard.tsx           (70 lines)  - KPI display cards
  ├── QuickStats.tsx         (100 lines) - Agents, tasks, approvals count
  └── RecentActivity.tsx     (120 lines) - Activity feed
```

**Layout Structure:**

```
┌─────────────────────────────────────────┐
│  Header (User, Logout, Notifications)   │
├──────────┬──────────────────────────────┤
│ Sidebar  │                              │
│ Menu     │     Main Content Area        │
│          │                              │
│ • Home   │                              │
│ • Agents │                              │
│ • Tasks  │                              │
│ • Teams  │                              │
│ • Logs   │                              │
│ • Audit  │                              │
└──────────┴──────────────────────────────┘
```

**Features:**

- ✅ Responsive design (mobile + tablet + desktop)
- ✅ Collapsible sidebar
- ✅ Active route highlighting
- ✅ User profile dropdown
- ✅ Logout button
- ✅ Notification bell (placeholder)
- ✅ Dark mode toggle (future)

---

## Week 16: Agent Management Interface

### Deliverables

```
src/pages/
  ├── AgentsPage.tsx         (180 lines) - Agent list + filters
  └── AgentDetailPage.tsx    (200 lines) - Single agent view

src/components/Agents/
  ├── AgentTable.tsx         (150 lines) - Data table with sorting
  ├── AgentFilters.tsx       (100 lines) - Search, role, status filters
  ├── AgentModal.tsx         (180 lines) - Create/edit agent form
  ├── AgentStatusBadge.tsx   (50 lines)  - Status indicator
  └── AgentActions.tsx       (100 lines) - Bulk actions menu

src/services/
  └── agentService.ts        (120 lines) - CRUD API calls

src/store/
  └── agentSlice.ts          (150 lines) - Agent state management
```

**Agent Table Features:**

- ✅ Display: Name, email, role, status, created_date, last_active
- ✅ Sorting by any column
- ✅ Search by name/email
- ✅ Filter by role (admin, agent_manager, task_approver, viewer)
- ✅ Filter by status (active, inactive, pending)
- ✅ Pagination (20 per page)
- ✅ Bulk actions (deactivate, delete, change role)
- ✅ Create new agent form (email, name, role, tenant)
- ✅ Edit agent (name, role, status)
- ✅ Delete with confirmation

**Agent Detail Modal:**

- ✅ Display full profile
- ✅ Edit permissions
- ✅ View activity log
- ✅ Reset password (admin only)
- ✅ View assigned tasks
- ✅ Change role

---

## Week 17: Task & Approval Management

### Deliverables

```
src/pages/
  ├── TasksPage.tsx          (200 lines) - Task list + filters
  ├── TaskDetailPage.tsx     (180 lines) - Task detail view
  ├── ApprovalsPage.tsx      (150 lines) - Pending approvals
  └── ApprovalDetailPage.tsx (140 lines) - Approval workflow

src/components/Tasks/
  ├── TaskTable.tsx          (160 lines) - Task list display
  ├── TaskFilters.tsx        (120 lines) - Search, priority, status
  ├── TaskModal.tsx          (180 lines) - Create/edit task
  ├── TaskStatusBadge.tsx    (50 lines)  - Status indicators
  └── TaskTimeline.tsx       (100 lines) - Task progress

src/components/Approvals/
  ├── ApprovalCard.tsx       (120 lines) - Approval workflow card
  ├── ApprovalSteps.tsx      (100 lines) - Step indicator
  └── ApproveRejectButtons.tsx (80 lines) - CTA buttons

src/services/
  ├── taskService.ts         (120 lines) - Task API calls
  └── approvalService.ts     (100 lines) - Approval API calls

src/store/
  ├── taskSlice.ts           (150 lines) - Task state
  └── approvalSlice.ts       (130 lines) - Approval state
```

**Task Management Features:**

- ✅ List all tasks (paginated)
- ✅ Filter by status (open, in_progress, completed, blocked)
- ✅ Filter by priority (high, medium, low)
- ✅ Filter by assignee
- ✅ Sort by created_date, due_date, priority
- ✅ Create new task (title, description, priority, due_date, assignee)
- ✅ Edit task details
- ✅ Update task status
- ✅ View task timeline (comments, status changes)
- ✅ Assign to agent

**Approval Workflow:**

- ✅ Show pending approvals
- ✅ Display approval chain (created_by → approved_by)
- ✅ Show task/request being approved
- ✅ Approve with notes
- ✅ Reject with reason
- ✅ Request changes (back to creator)
- ✅ View approval history

---

## Week 18: Analytics & Audit Logs

### Deliverables

```
src/pages/
  ├── AnalyticsPage.tsx      (220 lines) - KPI dashboards
  └── AuditLogsPage.tsx      (180 lines) - Security audit trail

src/components/Analytics/
  ├── ChartAgentMetrics.tsx  (100 lines) - Agent KPIs
  ├── ChartTaskMetrics.tsx   (100 lines) - Task completion rates
  ├── ChartApprovalMetrics.tsx (100 lines) - Approval SLA
  └── ChartsTrends.tsx       (120 lines) - Time-series trends

src/components/AuditLogs/
  ├── AuditLogTable.tsx      (150 lines) - Log listing
  ├── AuditFilters.tsx       (100 lines) - Filter by user/action/date
  └── AuditDetail.tsx        (100 lines) - Log detail modal

src/services/
  ├── analyticsService.ts    (100 lines) - Analytics API
  └── auditService.ts        (100 lines) - Audit log API

src/store/
  ├── analyticsSlice.ts      (120 lines) - Analytics state
  └── auditSlice.ts          (100 lines) - Audit state
```

**Analytics Dashboard:**

- ✅ Total agents count
- ✅ Total tasks created (this week, this month)
- ✅ Task completion rate (% completed on time)
- ✅ Average approval time (SLA tracking)
- ✅ Agent utilization (tasks per agent)
- ✅ Most active agents (by task count)
- ✅ Approval bottlenecks (longest pending)
- ✅ Task status breakdown (pie chart)
- ✅ Tasks by priority (stacked bar)
- ✅ Approval time trend (line chart)
- ✅ Export reports (CSV/PDF)

**Audit Logs:**

- ✅ Display all security events (login, logout, create, update, delete)
- ✅ Filter by user
- ✅ Filter by action type
- ✅ Filter by date range
- ✅ Search by resource name
- ✅ View detailed log entry (changes, IP, timestamp)
- ✅ Retention policy display (90 days default)

---

## Technology Stack

### Frontend Framework

- **Next.js 14+** (or CRA) - React 18
- **TypeScript** - Strict mode
- **Ant Design 5.24.2** - UI components
- **Tailwind CSS** - Styling
- **Zustand** - State management

### Charts & Visualization

- **Recharts** or **ECharts** - Dashboard charts
- **Date-fns** - Date handling

### HTTP & API

- **axios** - HTTP client
- **JWT handling** - Token store + refresh logic
- **Error boundary** - Global error catching

### Testing

- **Vitest** - Unit tests
- **React Testing Library** - Component tests
- **Cypress** - E2E tests (optional Week 18)

---

## API Integration Points (Phase 2 Backend)

### Authentication Endpoints

```
POST /api/v1/auth/login
POST /api/v1/auth/register
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
POST /api/v1/auth/forgot-password
POST /api/v1/auth/reset-password
POST /api/v1/auth/change-password
GET  /api/v1/auth/me
```

### Resource Management (Phase 1 - to be connected)

```
GET    /api/v1/tenants/:tenantId/agents
POST   /api/v1/tenants/:tenantId/agents
PATCH  /api/v1/tenants/:tenantId/agents/:agentId
DELETE /api/v1/tenants/:tenantId/agents/:agentId

GET    /api/v1/tenants/:tenantId/tasks
POST   /api/v1/tenants/:tenantId/tasks
PATCH  /api/v1/tenants/:tenantId/tasks/:taskId
DELETE /api/v1/tenants/:tenantId/tasks/:taskId

GET    /api/v1/tenants/:tenantId/approvals
PATCH  /api/v1/tenants/:tenantId/approvals/:approvalId
```

### Analytics & Audit

```
GET /api/v1/tenants/:tenantId/analytics
GET /api/v1/tenants/:tenantId/audit-logs
```

---

## File Structure

```
frontend-admin/
├── src/
│   ├── components/
│   │   ├── Auth/
│   │   │   ├── LoginForm.tsx
│   │   │   ├── PasswordField.tsx
│   │   │   └── OAuthButtons.tsx
│   │   ├── Agents/
│   │   │   ├── AgentTable.tsx
│   │   │   ├── AgentModal.tsx
│   │   │   └── ...
│   │   ├── Tasks/
│   │   │   ├── TaskTable.tsx
│   │   │   └── ...
│   │   ├── Approvals/
│   │   │   ├── ApprovalCard.tsx
│   │   │   └── ...
│   │   ├── Analytics/
│   │   │   ├── ChartAgentMetrics.tsx
│   │   │   └── ...
│   │   └── AuditLogs/
│   │       └── AuditLogTable.tsx
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── DashboardHome.tsx
│   │   ├── AgentsPage.tsx
│   │   ├── TasksPage.tsx
│   │   ├── ApprovalsPage.tsx
│   │   ├── AnalyticsPage.tsx
│   │   └── AuditLogsPage.tsx
│   ├── layouts/
│   │   ├── AdminLayout.tsx
│   │   ├── Header.tsx
│   │   └── Sidebar.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useLogin.ts
│   │   └── usePasswordReset.ts
│   ├── services/
│   │   ├── authService.ts
│   │   ├── agentService.ts
│   │   ├── taskService.ts
│   │   ├── approvalService.ts
│   │   ├── analyticsService.ts
│   │   └── auditService.ts
│   ├── store/
│   │   ├── authSlice.ts
│   │   ├── agentSlice.ts
│   │   ├── taskSlice.ts
│   │   └── approvalSlice.ts
│   ├── contexts/
│   │   └── AuthContext.tsx
│   ├── middleware/
│   │   └── axiosInterceptor.ts
│   ├── utils/
│   │   ├── dateFormat.ts
│   │   ├── validators.ts
│   │   └── constants.ts
│   └── App.tsx
├── PHASE_3_IMPLEMENTATION_PLAN.md
└── README.md
```

---

## Success Criteria

### Code Quality

- ✅ Zero TypeScript errors
- ✅ Zero lint errors (ESLint)
- ✅ 80%+ test coverage
- ✅ 100% accessibility (WCAG 2.1 AA)

### Functionality

- ✅ Login/logout flow works end-to-end
- ✅ Protected routes enforce authentication
- ✅ Token refresh works transparently
- ✅ Agent CRUD operations work
- ✅ Task CRUD operations work
- ✅ Approval workflow complete
- ✅ Audit logs display correctly

### Performance

- ✅ Login page loads in < 2s
- ✅ Dashboard loads in < 3s
- ✅ Table operations don't block UI (virtualization)
- ✅ Network requests show loading states

### Security

- ✅ Tokens stored securely (httpOnly + memory)
- ✅ No sensitive data logged to console
- ✅ CSRF protection (if needed)
- ✅ XSS protection (Content Security Policy)

---

## Dependencies to Add

```json
{
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "next": "^14.0.0",
    "antd": "^5.24.2",
    "axios": "^1.6.0",
    "zustand": "^4.4.0",
    "recharts": "^2.10.0",
    "date-fns": "^2.30.0",
    "tailwindcss": "^3.3.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/react": "^18.3.0",
    "@types/node": "^20.0.0",
    "vitest": "^1.0.0",
    "@testing-library/react": "^14.0.0",
    "cypress": "^13.0.0"
  }
}
```

---

## Risks & Mitigation

| Risk                         | Impact | Mitigation                             |
| ---------------------------- | ------ | -------------------------------------- |
| Token expiry handling bugs   | High   | Comprehensive interceptor + unit tests |
| Stale data in UI             | Medium | Automatic refresh on page focus        |
| Slow table rendering         | Medium | Virtual scrolling + pagination         |
| CORS issues with backend     | High   | Proper CORS headers in Phase 2         |
| Layout shifts on role change | Low    | Skeleton loaders + consistent layout   |

---

## Next Phase (Phase 4)

If Phase 3 completes ahead of schedule, start Phase 4:

- **Real-time Updates** via WebSockets
- **Notifications** system
- **Advanced Filtering** (saved filters)
- **Bulk Operations** optimization

---

## Kickoff Checklist

- [ ] Can you access Phase 2 API locally? (test login endpoint)
- [ ] Do you have frontend-admin directory ready?
- [ ] Should I start with auth UI (Week 13) or dashboard layout (Week 15)?
- [ ] Any preference on state management (Zustand vs Redux)?
- [ ] Should password reset include email verification?
